## Why

Claude Code conversations can appear to hang inside the desktop app even when the standalone Claude CLI works. The current regression was introduced by the app-server event batching refactor: the frontend batch consumer defaults to listening only on `app-server-event-batch`, while Claude/OpenCode/Gemini forwarders still emit realtime and terminal turn events directly on the legacy `app-server-event` channel.

This must be fixed now because it breaks the core conversation loop: `turn/started`, text deltas, `turn/completed`, approval, and error events can be produced by the backend but never reach the thread reducer when the webview batch consumer is enabled.

> 🛠 **深度推演**：[L2/L3 分析摘要] 根因不是 Claude runtime 不可用，而是跨层 channel contract 漂移。Rust introduced a batched `EventSink` for selected paths, but older engine forwarders still bypass that sink with direct Tauri emits. Frontend then treated the batch channel as exclusive, turning a performance optimization into a delivery partition. 通用法则：event transport migration 必须经历 compatibility phase；hot-path channel 切换不能要求所有 producers 原子迁移。

## 目标与边界

- Restore Claude Code realtime conversation delivery when `ccgui.perf.appServerEventBatch` defaults to enabled.
- Preserve the app-server batch performance path for producers that already emit through `BatchedTauriEventSink`.
- Keep legacy single-channel engine forwarders functional until they are explicitly migrated to `EventSink`.
- Add regression coverage proving batch-enabled frontend still receives legacy single-channel Claude-style events.
- Keep the fix focused on transport compatibility; do not redesign the conversation reducer or Claude CLI launch path.

## What Changes

- Update frontend app-server event subscription behavior so batch mode remains compatible with legacy `app-server-event` producers.
- Adjust batch consumer tests to treat single-channel compatibility as required behavior, not as a duplicate-dispatch failure.
- Add or update contract coverage that documents mixed-channel operation during the migration window.
- Add an OpenSpec delta clarifying that app-server batching MUST NOT make the legacy single-event channel unreachable while any engine forwarder still emits there.
- Optionally follow up by migrating Claude/OpenCode/Gemini direct `app.emit("app-server-event", ...)` forwarders to a shared `EventSink`, but that is not required for the immediate hotfix.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-server-event-batching`: require batch-enabled frontend consumers to remain compatible with legacy single-channel events during phased backend migration.
- `claude-code-stream-forwarding-latency`: clarify that forwarding guarantees include delivery to at least one frontend-subscribed app-server event route, not merely backend emission.
- `claude-code-realtime-stream-visibility`: clarify that Claude live text visibility depends on channel compatibility and must not regress when event batching is enabled.

## Impact

- Frontend:
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
  - Possible focused tests under `src/features/app/hooks/useAppServerEvents*.test.tsx`
- Backend:
  - No immediate Rust code is required for the compatibility hotfix.
  - Follow-up may touch `src-tauri/src/engine/commands.rs` and `src-tauri/src/event_sink.rs` if the project chooses to migrate direct engine forwarder emits to `EventSink`.
- Runtime behavior:
  - Claude/OpenCode/Gemini legacy single-channel events remain visible.
  - Batched event producers continue using `app-server-event-batch`.
  - No new dependencies.

## Non-Goals

- Do not change Claude CLI binary resolution, `CLAUDE_HOME`, model selection, or `--include-hook-events` behavior.
- Do not rewrite `ClaudeSession::send_message` or stream parsing.
- Do not remove `app-server-event-batch` or disable batching globally as the durable fix.
- Do not migrate every backend producer to `EventSink` in the same hotfix unless compatibility tests first pass.
- Do not change reducer semantics for text delta merge, turn settlement, approvals, or request-user-input.
- Do not touch unrelated app-shell performance refactors.

## 技术方案取舍

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. 临时关闭 frontend batch consumer 默认值 | Change `isAppServerEventBatchConsumerEnabled()` default to `false`. | Fastest rollback; Claude single-channel events immediately work. | Silently disables the performance change for all users; does not encode mixed-channel migration contract; easy to re-break later. | Rejected except as local emergency workaround |
| B. Batch enabled 时同时订阅 `app-server-event-batch` 和 `app-server-event` | Frontend keeps batch chunking for batch payloads and also routes single-channel events through the same dispatcher. | Minimal hotfix; directly restores Claude/OpenCode/Gemini forwarders; preserves batch path; frontend-only change with focused tests. | If a future backend producer double-emits the same logical event to both channels, frontend may need event-id dedupe. | Accepted for immediate fix |
| C. 立即迁移所有 engine forwarder 到 `EventSink` | Replace direct `app.emit("app-server-event", ...)` in Claude/OpenCode/Gemini with a sink chosen by backend config. | Architecturally clean; single source of truth for transport. | Larger Rust change in high-risk engine path; needs broader tests across Claude/OpenCode/Gemini; slower to ship during conversation outage. | Follow-up after hotfix |

## Acceptance Criteria

- With batch consumer enabled by default, a legacy single-channel `item/agentMessage/delta` event still reaches `onAgentMessageDelta`.
- With batch consumer enabled by default, a legacy single-channel `turn/completed` event still reaches `onTurnCompleted`.
- Existing batch payload routing still preserves non-coalescible text deltas and chunking behavior.
- Focused Vitest coverage proves batch mode subscribes to the batch channel and still handles the single-event channel.
- `npm run typecheck` passes.
- Focused tests pass:
  - `npx vitest run src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
- OpenSpec validation passes:
  - `openspec validate fix-app-server-event-channel-compat --strict --no-interactive`

## Audit Trail

- Refers to:
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/threads/utils/realtimePerfFlags.ts`
  - `src-tauri/src/engine/commands.rs`
  - `src-tauri/src/event_sink.rs`
  - `openspec/specs/app-server-event-batching/spec.md`
  - `openspec/specs/claude-code-stream-forwarding-latency/spec.md`
  - `openspec/specs/claude-code-realtime-stream-visibility/spec.md`
- Impact:
  - Restores frontend visibility for Claude Code stream events emitted on the legacy channel.
  - Preserves app-server event batching for migrated producers.
  - Documents mixed-channel compatibility as an explicit migration contract.
