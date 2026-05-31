## Why

客户端已经有多条自动创建 session 的路径：Prompt Enhancer、Project Map generation、Project Map organizer、自动标题、commit message、run metadata、Spec Hub apply、review fallback、PR 问答等。当前这些 session 大多落在 workspace root，且只有部分路径通过 `codex/backgroundThread hide` 或 `archiveThread` 做事后处理，导致用户工作区会话列表混入 `Task: ...`、`You are ...` 这类系统 helper session。

需要一个跨引擎的统一可见性 contract，把“存储事实里的 session”与“用户信息架构里的会话”解耦：用户可追溯的自动执行会话保留但归入 `system-auto`，纯工具型 helper 默认隐藏，用户显式会话继续正常显示。

## 目标与边界

- 为所有 engine（Claude、Codex、Gemini、OpenCode、shared/remote backend where applicable）定义统一的 automatic session visibility classification。
- 将自动创建的新 session 标记为 `hidden`、`system-auto` 或 `user-visible`，并在 workspace session catalog / sidebar / folder projection 中按该语义展示。
- 只处理“会创建新 session/thread”的场景；不新建 session 的 continuation、Task Center run record、history scan 不纳入本次行为变更。
- 保留执行审计能力：会改代码、会执行 OpenSpec/Project Map/Review/PR 问答等用户可追溯场景，不应被无条件隐藏。

## 非目标

- 不改变用户显式创建 session 的交互语义，例如普通发送、`/new`、`/clear`。
- 不清理既有历史 session 文件，不做大规模历史迁移；历史回填最多提供 best-effort metadata / catalog overlay。
- 不重写各 engine 的底层持久化格式。
- 不把 `.omx/**`、runtime artifacts 或临时 debug state 提升为长期事实源。

## What Changes

- 新增通用 automatic session metadata contract：
  - `sessionPurpose`: `prompt-enhancer`、`title-generation`、`commit-message`、`run-metadata`、`project-map-generation`、`project-map-organizer`、`spec-hub-apply`、`review`、`pull-request-question` 等。
  - `visibility`: `hidden`、`system-auto`、`user-visible`。
  - `ownerFeature`: 触发功能域。
  - `autoArchive`: 完成后是否应归档或从用户 catalog 排除。
- 统一自动 session 默认展示策略：
  - 纯工具型 helper（Prompt Enhancer、自动标题、commit message、run metadata、Project Map organizer）默认 `hidden`。
  - 可追溯自动执行（Spec Hub apply、Project Map generation、review fallback、PR 问答）默认 `system-auto`。
  - 用户显式创建或继续的 session 保持 `user-visible`。
- Workspace session catalog MUST apply visibility classification before root-level sidebar projection.
- `system-auto` sessions MUST NOT appear at workspace root; they MUST appear under a stable `system-auto` folder or equivalent system grouping.
- `hidden` sessions MUST NOT appear in normal sidebar / workspace session list, but diagnostics MAY expose them in explicit debug/internal surfaces.
- Existing Codex-only `codex/backgroundThread hide` behavior becomes one implementation detail under the generic `hidden` contract, not the only source of truth.

## 技术方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| 全部移入 `system-auto` | 所有自动 session 都显示在系统文件夹 | 简单、可追溯 | Prompt Enhancer / title / metadata 噪音仍然膨胀；用户仍要承担系统实现细节 | 不采用 |
| 全部隐藏 | 所有自动 session 都从 UI 消失 | UI 最干净 | Spec Hub / Project Map / Review 这类执行链路失去审计入口 | 不采用 |
| 分层 visibility contract | helper 隐藏，可追溯执行进 `system-auto`，显式用户会话可见 | 同时降低噪音并保留审计；可跨引擎扩展 | 需要统一 metadata、catalog、folder projection 与各入口打点 | 采用 |

## Capabilities

### New Capabilities

- `auto-session-visibility-classification`: Defines cross-engine automatic session visibility, purpose metadata, hidden/system-auto/user-visible behavior, and catalog projection rules.

### Modified Capabilities

- `workspace-session-catalog-projection`: Catalog membership projection must apply automatic session visibility before sidebar/settings/root display.
- `workspace-session-folder-tree`: Adds stable `system-auto` grouping semantics for traceable automatic sessions.
- `git-commit-message-generation`: Commit message helper sessions must be classified as hidden.
- `project-map-incremental-generation`: Project Map AI generation and organizer sessions must declare automatic session purpose and visibility.
- `spec-hub-runtime-state`: Spec Hub apply execution sessions must be classified as system-auto traceable sessions.

## Impact

- Frontend:
  - Automatic session creation call sites in composer, Spec Hub, Project Map, git/PR/review, thread runtime, and title generation flows.
  - Sidebar/session catalog projection and folder assignment display.
- Backend:
  - Tauri commands and engine sync paths that create helper sessions or isolated sessions.
  - Codex background thread hide path must be normalized into the generic visibility model.
  - Engine adapters for Claude, Codex, Gemini, OpenCode, and remote daemon payloads need compatible metadata handling.
- Storage / metadata:
  - Adds automatic session metadata overlay keyed by engine + owner workspace + canonical session/thread id.
  - No dependency additions expected.
- Validation:
  - Focused Vitest for classification and sidebar projection.
  - Rust tests for metadata persistence/projection and Codex helper hidden semantics.
  - Cross-engine smoke coverage for `engineSendMessageSync` automatic session metadata.

## 验收标准

- Prompt Enhancer, auto title, commit message, run metadata, and Project Map organizer sessions do not appear in normal workspace root session lists.
- Spec Hub apply, Project Map generation, review fallback, and PR question automatic sessions appear under `system-auto`, not root.
- Ordinary user-created sessions remain visible at root or the user-selected folder.
- Classification works consistently for Claude, Codex, Gemini, OpenCode, and remote backend-compatible payloads where the engine supports session metadata.
- Existing archived/hidden Codex helper behavior remains backward compatible.
- `openspec validate classify-auto-session-visibility --strict --no-interactive` passes before implementation starts.
