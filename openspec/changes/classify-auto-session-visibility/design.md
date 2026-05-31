## Context

当前客户端有多条自动创建 session/thread 的路径，且来源横跨 frontend hooks、Tauri commands、engine sync APIs 与 Codex background helper：

- Prompt Enhancer 使用 `engineSendMessageSync(... continueSession:false, sessionId:<isolated>)`。
- Project Map generation 使用 `startThread` + `sendUserMessage`，完成后 best-effort archive。
- Project Map organizer 使用 `engineSendMessageSync`。
- 自动标题、commit message、run metadata 在 Codex backend 内部启动 background thread，并 emit `codex/backgroundThread hide`。
- Spec Hub apply、review fallback、PR 问答会创建用户可追溯的新 execution/review/question session。

这些 session 都以 workspace root 作为 execution cwd 或 workspace scope，因此仅靠 cwd/catalog ownership 无法区分“用户会话”和“系统自动 helper”。现有隐藏机制是局部的：Codex helper 用 event hide，Project Map generation 用 archive，sync engine helper 多数没有统一 metadata。

## Goals / Non-Goals

**Goals:**

- 建立跨 engine 的 automatic session classification contract。
- 在 session 创建时或最早可识别时写入 metadata overlay，避免只依赖事后 hide/archive。
- 在 catalog projection 层统一执行 `hidden`、`system-auto`、`user-visible` 展示规则。
- 让 `system-auto` 成为稳定组织分组，而不是用户手工 folder。
- 保持执行审计：会改代码或代表用户动作的自动 session 不被无条件隐藏。

**Non-Goals:**

- 不迁移或重写 engine 原生历史文件格式。
- 不删除历史 helper session 文件。
- 不改变普通用户 session 创建、发送、恢复、fork、rewind 语义。
- 不把 runtime-only state 当作长期 truth source。

## Decisions

### Decision 1: Use a generic metadata overlay instead of engine-specific hiding only

Automatic session creation sites MUST pass or record a generic metadata envelope:

```ts
type AutoSessionVisibility = "hidden" | "system-auto" | "user-visible";

type AutoSessionMetadata = {
  sessionPurpose: string;
  visibility: AutoSessionVisibility;
  ownerFeature: string;
  autoArchive?: boolean;
  createdBy: "system" | "user";
};
```

The durable key follows existing session-management stable-key rules: `engine + ownerWorkspaceId + canonicalSessionId/threadId`.

Alternatives considered:

- Keep `codex/backgroundThread hide` as the only mechanism. Rejected because it is Codex-specific and event delivery is not durable.
- Infer from title prefixes like `Task:` or `You are`. Rejected because prompts are unstable and localization/model output can change.

### Decision 2: Classify at creation time, project at catalog time

Creation sites are responsible for declaring purpose and intended visibility. Catalog projection is responsible for applying the visibility:

- `hidden`: exclude from normal sidebar, Workspace Home, and Session Management active list.
- `system-auto`: exclude from root rows and place under stable system grouping.
- `user-visible`: preserve existing projection behavior.

Alternatives considered:

- Move sessions into folders immediately from each feature. Rejected because folder writes would duplicate ownership routing logic and race pending-to-real identity transitions.
- Filter only in the UI. Rejected because Settings, Sidebar, Workspace Home, and future surfaces would drift.

### Decision 3: `system-auto` is a reserved grouping, not a normal mutable folder

`system-auto` SHOULD render like a folder/group in user surfaces, but it is system-owned:

- Users MAY expand/collapse it.
- Sessions inside it retain their true owner workspace.
- Deleting/archive actions route by true owner.
- User-created folders cannot use the reserved system id.

Alternatives considered:

- Create a real normal folder named `system-auto`. Rejected because users could rename/delete it and break the invariant.
- Hide all system-auto sessions. Rejected because Spec Hub apply and Project Map generation need traceability.

### Decision 4: Default classification matrix

| Purpose | Visibility | Rationale |
|---|---|---|
| `prompt-enhancer` | `hidden` | Pure helper; no user continuation value |
| `title-generation` | `hidden` | Metadata helper only |
| `commit-message` | `hidden` | Metadata helper only |
| `run-metadata` | `hidden` | Metadata helper only |
| `project-map-organizer` | `hidden` | Internal organizer/normalizer |
| `project-map-generation` | `system-auto` | User-triggered/observable generation with possible failure evidence |
| `spec-hub-apply` | `system-auto` | Execution may change files and must remain auditable |
| `review` / `review-fallback` | `system-auto` | Review context remains useful but should not pollute root |
| `pull-request-question` | `system-auto` | User-triggered contextual helper; traceable but not root conversation |
| ordinary send, `/new`, `/clear` | `user-visible` | Explicit user conversation |

### Decision 5: Metadata recording is tied to session identity, not successful completion

For automatic sessions, the metadata overlay MUST be written once a stable session/thread identity is known, even if the engine turn later fails, times out after creating history, or returns a stream/runtime error.

This matters for Claude sync paths because the CLI can emit a real `session_id` before a later non-zero process exit or stream error. If metadata is written only after a successful sync response, that failed but persisted automatic session can still leak into workspace root.

Alternatives considered:

- Record metadata only on successful response. Rejected because failure transcripts are still persisted and are exactly the sessions users notice as root noise.
- Infer failed automatic sessions later from prompt/title text. Rejected because prompt/title heuristics are unstable and conflict with the non-goal of historical migration by title.

## Risks / Trade-offs

- [Risk] Engine returns canonical session id after a pending id is already shown. → Mitigation: write metadata against pending id and migrate on pending-to-real identity transition using existing rename/folder migration contract.
- [Risk] Sync engine emits a canonical id and then fails before returning success. → Mitigation: record automatic metadata as soon as the canonical id is known, or use the preallocated explicit session id for new sync sessions when the engine supports stable identity.
- [Risk] Remote daemon does not understand new metadata payloads. → Mitigation: keep metadata additive and tolerate older daemon responses; frontend/backend can write overlay after receiving thread/session id.
- [Risk] Historical helper sessions remain visible. → Mitigation: optional best-effort title/purpose heuristic may be added later, but this change focuses on new sessions only.
- [Risk] `system-auto` grouping hides useful failures too deeply. → Mitigation: keep group visible when it has active/failed sessions and expose purpose labels in diagnostics.
- [Risk] Hidden sessions make debugging harder. → Mitigation: hidden sessions remain accessible through explicit debug/internal diagnostics, not normal workspace lists.

## Migration Plan

1. Add shared TypeScript/Rust classification enums and payload shape.
2. Add durable metadata overlay read/write helpers keyed by stable session key.
3. Extend automatic creation call sites to pass classification metadata or write it after thread/session id resolution.
4. Update catalog projection to apply metadata before root/folder surface projection.
5. Add reserved `system-auto` grouping projection.
6. Keep legacy `codex/backgroundThread hide` as a compatibility signal that writes/overlays `visibility=hidden`.
7. Verify sync failure paths where a canonical session id is known before terminal error; these paths must still record automatic metadata.

Rollback strategy:

- If classification causes false hiding, disable catalog filtering behind a local feature gate while preserving metadata writes.
- Because the change is additive metadata/projection logic, rollback should not corrupt underlying engine session files.

## Open Questions

- Whether hidden helper sessions should be surfaced in Session Management behind an explicit “Show system hidden sessions” debug toggle in this change or a follow-up.
- Whether historical helper rows should be backfilled using safe heuristics after the new creation-time metadata is stable.
