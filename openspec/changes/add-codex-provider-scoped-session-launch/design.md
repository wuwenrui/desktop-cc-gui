## Context

Codex CLI reads configuration from `CODEX_HOME/config.toml`, project `.codex/config.toml`, profile files, CLI `-c/--config` overrides, and built-in defaults. The current mossx Codex launch path starts `codex app-server`, sets `CODEX_HOME` from workspace/global settings, and sends per-turn `approvalPolicy/sandboxPolicy`. The Codex supplier management page stores provider `configToml/authJson`, but current runtime creation never reads `codex.current` or those provider fields.

The current frontend also treats provider selection as a global active state. That is the wrong model for Codex app-server because provider configuration is effectively process/config-home scoped. Supporting multiple providers in parallel requires a runtime identity that includes provider profile identity.

## Goals / Non-Goals

**Goals:**

- Make Codex provider selection part of new conversation creation.
- Preserve existing default behavior through a first option named “磁盘 .codex 配置”.
- Isolate managed provider configuration through provider-scoped `CODEX_HOME`.
- Allow multiple Codex runtimes for the same workspace when provider profiles differ.
- Persist enough metadata for turn routing, resume/fork continuity, sidebar display, and diagnostics.
- Remove misleading Codex provider “启用” semantics from supplier management.

**Non-Goals:**

- No runtime provider hot-swap for existing active conversations.
- No mutation of global `~/.codex` to apply managed providers.
- No cross-engine provider model rewrite.
- No full runtime pool replacement beyond the minimal provider-aware runtime key and lifecycle.

## Decisions

### Decision 1: Provider profile is selected at thread creation

New Codex conversation creation introduces a `CodexProviderProfile` selection:

```ts
type CodexProviderProfile =
  | { id: "__disk__"; source: "disk"; label: "磁盘 .codex 配置" }
  | { id: string; source: "managed"; name: string; configToml: string; authJson?: string };
```

The selected profile id is passed to the backend `start_thread` path and persisted with the created thread. Later turn and resume operations use the persisted binding instead of the current UI selection.

Fork is the only MVP affordance that can intentionally change providers. It is modeled as a new thread launch from an existing parent thread:

- parent thread keeps its original provider binding;
- fork selector defaults to "inherit parent provider";
- user may choose disk or another managed provider for the child thread;
- child thread metadata records the selected provider binding.
- provider-selected message-tail fork is a child-creation path; it MUST NOT execute the legacy rewind state transition that renames the parent thread id to the child id or hides the parent row.

Alternative considered: keep a global active provider. Rejected because it creates surprising behavior when the user changes provider after a thread already exists and cannot support parallel providers safely.

### Decision 2: Managed providers materialize into persistent app-local scoped Codex homes

For managed providers, backend writes:

```text
<app-config>/codex-provider-homes/<providerId>/
  config.toml
  auth.json
```

Then starts `codex app-server` with:

```text
CODEX_HOME=<app-config>/codex-provider-homes/<providerId>
```

Provider homes are persistent app-local config/runtime artifacts for MVP. They are reused across app restarts so provider-owned auth/session state and conversation history can be discovered again. Regeneration is allowed only when provider config changes before a new runtime starts.

The disk profile keeps existing resolution:

```text
workspace codex_home -> parent/worktree inheritance -> legacy .codemoss -> env CODEX_HOME -> ~/.codex
```

Project-level `.codex/config.toml` may have higher precedence than the provider home's user config. For managed providers, launch MUST therefore either:

1. pass critical provider/model fields from the selected provider through explicit CLI config overrides when the Codex CLI supports them; or
2. compute/report an effective-config conflict before thread creation and block launch when the selected managed provider would be silently overridden.

Auth material remains file-backed in the scoped provider home. CLI overrides are used only to protect launch-critical settings from precedence collisions, not to replace the provider-owned home model.

Alternative considered: use only `CODEX_HOME` without precedence handling. Rejected because a project `.codex/config.toml` can make the selected provider appear chosen in the UI while Codex actually uses project config.

### Decision 3: Runtime key includes provider profile identity

The runtime registry must distinguish at least:

```text
codex::<workspaceId>::<providerProfileId>
```

Existing workspace-only lookup remains valid for disk/default profile but must not collapse managed provider runtimes into the same session. Existing code paths that accept `workspaceId` only need a provider binding lookup when operating on a thread.

This runtime key is not a thread key. Multiple Codex conversations using the same workspace and the same provider profile, including `disk + disk + disk`, MAY share the same provider-scoped app-server runtime if Codex app-server supports multiple threads safely. The contract is that concurrent threads remain independently addressable and never reuse the wrong thread id, not that every thread must spawn a separate process.

Alternative considered: run one app-server and send provider config per turn. Rejected because Codex app-server configuration and auth are process/CODEX_HOME scoped, not turn-local.

### Decision 4: Vendor tab manages reusable provider profiles, not active state

The Codex supplier list removes the “启用” button. Each managed provider card shows neutral status such as “可用于新会话” plus edit/delete/model actions. The active/in-use concept moves to conversation surfaces, where each thread shows its provider binding.

Alternative considered: keep “启用” and add explanatory text. Rejected because the button remains semantically false for provider-scoped launch.

### Decision 5: Command routing is explicit by command class

Codex commands are classified before implementation:

| Command class | Examples | Routing rule |
|---|---|---|
| Thread-bound continuation | `turn/start`, resume, compaction, rewind, thread status | Resolve thread metadata, then route to `workspaceId + providerProfileId` runtime. |
| Thread-derived launch | fork | Read parent thread metadata/history, show provider selector, then create a native child through the parent provider runtime and bind the child to the selected provider. |
| Provider-selected workspace command | `model_list`, `account_read`, provider diagnostics, MCP status for a selected provider | Require an explicit provider profile id from UI or backend caller. |
| Disk-default workspace command | legacy commands that do not have thread context and are not provider-selectable in this MVP | Use `__disk__` and state that behavior in UI/diagnostics. |
| Provider-agnostic | pure catalog projection, local metadata reads, static UI state | Do not touch Codex app-server or provider homes. |

Any Codex command not in this matrix is treated as blocked for provider-scoped work until it is classified. This prevents accidental fallback to the old workspace-only runtime.

Thread-bound stale recovery is still thread-bound routing. If `turn/start` returns `thread not found` / `thread_not_found`, the backend may repair stale app-server state by sending `thread/resume` to the same provider-scoped runtime and retrying the original `turn/start` once. The repair must use bounded timeouts, must clear foreground work on failure, and must never reinterpret the missing thread as permission to fall back to the disk profile.

Remote/daemon adapters are part of the routing boundary. If an adapter accepts `providerProfileId` in the frontend command contract but cannot launch provider-scoped managed runtimes, it must reject managed provider ids explicitly. Dropping the field and continuing through the workspace-only disk runtime is a silent fallback and violates the provider binding contract.

### Decision 6: Historical catalog aggregates all provider homes

At app startup and Codex session catalog refresh, the backend reads:

```text
disk/default Codex home
managed provider home A
managed provider home B
...
```

Catalog entries include provider metadata:

```ts
{
  providerProfileId: string;
  providerProfileSource: "disk" | "managed";
  providerProfileName: string;
  providerAvailability: "available" | "unavailable";
}
```

If metadata is missing for older threads, the migration default is `__disk__`. If a thread points to a managed provider that no longer exists, it remains visible as unavailable and MUST NOT be rewritten to disk.

### Decision 6.1: Provider identity is visible in conversation UI

Every Codex conversation surface that identifies a thread SHOULD show an obvious provider label. At minimum, the sidebar row or conversation header displays:

```text
Disk .codex
Provider A
Provider B
Provider unavailable
```

The label comes from thread metadata, not from the supplier-management page's current state. For compact layouts, the label may be a badge, short text, or tooltip-backed indicator, but it must be visible enough that users can distinguish disk, provider A, and provider B while several Codex sessions run in parallel.

### Decision 7: Provider edits are next-runtime only

Editing a managed provider updates the stored profile and the materialization source for future launches. It does not mutate already running Codex app-server processes. A future explicit action may restart affected runtimes, but this change only requires:

- running sessions keep their current process/config state;
- newly spawned runtimes use the latest saved provider config;
- UI surfaces show enough provider metadata to explain that an existing thread may be using an older runtime until restart.

### Decision 8: In-flight start identity includes provider and launch shape

The frontend in-flight guard must include:

```text
workspaceId + folder/path + providerProfileId + autoSession identity
```

This reflects the current code: `start_thread` does not carry selected model, launch mode, or spec-root. Starts with different provider profiles must never share an in-flight promise. If future code adds selected model, launch mode, spec-root, or another material launch dimension to the start payload, the in-flight key MUST be extended in the same change.

### Decision 9: Code-spec is the executable contract for provider-scoped runtime

The implementation contract is also captured in:

```text
.trellis/spec/backend/codex-provider-scoped-runtime.md
.trellis/spec/frontend/codex-provider-session-ui.md
```

These code-specs are the operational checklist for future edits. OpenSpec defines product behavior; Trellis code-spec defines current executable signatures, payload fields, validation matrices, and test points.

## Data Flow

```text
User clicks New Codex Conversation
  -> UI opens provider selector
  -> user selects disk or managed provider
  -> frontend calls start_thread(workspaceId, providerProfileId, autoSession?)
  -> backend resolves runtimeKey
     - disk: legacy workspace runtime key
     - managed: codex::<workspaceId>::<providerProfileId>
  -> if runtime missing, materialize provider CODEX_HOME and spawn codex app-server
  -> backend sends thread/start to selected runtime
  -> created thread metadata stores providerProfileId/source/name/availability
  -> later turn/start resolves runtime from thread provider binding
```

Fork data flow:

```text
User clicks Fork on Codex thread
  -> UI opens provider selector
  -> default option inherits parent thread provider
  -> user keeps inherited provider or selects another provider
  -> frontend calls fork/start(parentThreadId, selectedProviderProfileId)
  -> backend reads parent thread metadata without mutating parent
  -> backend validates the selected provider can be materialized before creating the child
  -> backend resolves the message anchor from the parent provider runtime when local/runtime ids differ
     - exact native message id wins when present
     - otherwise normalized user text + occurrence is attempted
     - otherwise ordinal/tail alignment is attempted
     - if the local fork target is beyond runtime-visible native user messages, use the last runtime-visible user message as the fork anchor
     - if no runtime-visible user message exists, omit messageId and let Codex perform a full-thread native fork
  -> backend sends thread/fork to the parent provider runtime for both same-provider and cross-provider forks
  -> if selected provider differs from parent provider, backend makes the native child history visible in the selected provider home
  -> on success, child thread metadata stores parentThreadId, parentProviderProfileId, selected provider binding, and forkMode=native-provider-rebind
  -> frontend ensures child thread and optionally activates/resumes it
  -> frontend leaves parent thread id, visibility, loaded state, and provider metadata unchanged
```

## Error Handling

- Missing provider id at creation: normalize to the disk profile `__disk__`; this is the intentional legacy/default launch path, not an error fallback.
- Missing provider id at fork: default to the parent provider binding; the fork selector's inherit-parent state may serialize as a blank/omitted `providerProfileId`.
- Provider deleted after thread creation: existing thread shows “provider unavailable”; sending a new turn is blocked until user chooses an explicit migration/rebind action in a future change.
- Provider deleted before fork: inherit option is disabled/unavailable if the parent provider no longer exists; the user may fork to another available provider only if parent history is readable.
- Cross-provider fork: keep native Codex fork semantics by forking in the parent provider runtime first, then rebind the child to the selected provider. The backend must not create a new selected-provider thread by sending a transcript seed as a user message.
- Stale `turn/start` thread id: retry only as `thread/resume` + one original `turn/start` in the same provider runtime; use bounded timeouts and clear foreground work if recovery fails.
- Unsupported managed provider in daemon/remote adapter: fail visibly with provider id and unsupported runtime diagnostic; do not create/fork via disk.
- Fork anchor drift: provider-selected native fork is non-destructive and may tolerate frontend/local history being ahead of Codex runtime-native user message anchors. The backend should resolve exact id/text/ordinal first, then tail-fallback to the last runtime-visible user message, or omit the anchor for a full-thread native fork when no native user message is visible.
- Destructive rewind anchor drift: hard truncation remains strict fail-closed. Missing target anchors must continue to return a user-visible target-not-found error and must not reuse the fork-only tail fallback.
- Provider-rebind fork depends on child native history being visible to the selected provider home. If the child history cannot be found or copied, the fork fails visibly before the child is recorded as selected-provider bound.
- Provider edited after a runtime is already running: existing runtime continues with its current process config; new runtimes use the edited config.
- Project `.codex/config.toml` conflicts with managed provider launch-critical settings: block launch or apply explicit CLI overrides; never silently start with the wrong provider.
- Invalid provider `configToml`: materialization/start fails before thread is created and reports provider name plus validation/start error.
- Invalid `authJson`: save should already JSON-validate; materialization must still fail closed if writing/parsing detects invalid content.
- Runtime spawn failure: clean up staged runtime entry; do not mark thread as created.

## Security / Privacy

- `auth.json` is sensitive. Backend must set owner-only file permissions where supported.
- Provider homes must be app-local runtime/config artifacts, not committed project files.
- Logs and diagnostics must avoid printing raw `authJson`, API keys, or full config secrets.
- Deleting provider config should not delete historical conversation metadata unless user explicitly confirms cleanup.

## Migration Plan

1. Keep existing provider records in app config.
2. Treat all existing and historical Codex threads as `providerProfileId="__disk__"` unless metadata already records another provider.
3. Remove use of `codex.current` for Codex managed providers, or leave it as ignored legacy state with migration cleanup.
4. On first managed provider launch, materialize provider home lazily.
5. Provide a cleanup path for orphaned provider homes after provider deletion.

Rollback:

- Disable provider selector and route all new sessions to `__disk__`.
- Keep provider management records intact.
- Remove provider-scoped runtime lookup and terminate managed provider runtimes on restart.

## Risks / Trade-offs

- [Risk] More Codex app-server processes per workspace -> [Mitigation] provider-scoped idle cleanup and diagnostics.
- [Risk] Thread routing bugs send a turn to the wrong provider -> [Mitigation] persist provider binding and assert runtime key on each turn.
- [Risk] Edited provider config unexpectedly changes running sessions -> [Mitigation] edits are next-runtime/restart only; running runtime keeps current process state.
- [Risk] Sensitive auth data leaks in logs -> [Mitigation] redact provider config and only log provider id/name/source.
- [Risk] Project `.codex/config.toml` overrides selected provider -> [Mitigation] CLI override for critical fields or pre-launch conflict block.
- [Risk] Restarted app loses managed provider history -> [Mitigation] persistent provider homes and aggregated catalog scan.

## Open Questions

- Should editing a provider offer “restart affected runtimes now” in this change, or remain a follow-up?
- Should the provider selector also expose custom model filtering per selected provider in the same MVP?
