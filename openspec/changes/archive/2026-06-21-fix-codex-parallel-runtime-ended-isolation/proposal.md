## Why

Codex 单会话的生命周期基本正确：start、progress、terminal settlement 能按预期收敛。问题主要出现在两个或多个 Codex 会话并行时：某个会话已经 completed/failed/stalled 后，又被后续 raw event 拉回 loading；或者一个并行会话结束时，另一个 active/visible 会话被错误结算或卡在 processing。

这不是“thread state 变量没有隔离”的问题。`threadsByWorkspace`、`threadStatusById`、`activeTurnIdByThread` 等状态本身已经按 thread 拆开；真正的污染点在事件进入 reducer 之前：部分 Codex raw app-server events 缺少可靠 `threadId`、`turnId`、`affectedThreadIds`、`affectedActiveTurns` 或 runtime generation，frontend 会用 active Codex thread / visible thread 做 fallback。单会话时这个 fallback 常常刚好正确；并发时它会把 A 会话的 lifecycle/progress 信号写进 B 会话。

根治方向是建立 Codex event ownership contract：任何会影响 lifecycle、processing、active turn、terminal settlement 或 liveness progress 的事件，必须先证明 owner。证明不了 owner 的事件可以诊断，但不能 mutation。

后续并行实测又暴露了第二层残留：两个 Codex 会话并行时，tab 切换瞬间同一个 conversation curtain 可能短暂展示另一个会话的内容；最终 settle 后会刷回正确内容。这不是 reducer 中的持久状态串线，而是 render 层的 deferred stable snapshot 没有绑定 `workspaceId + threadId`。因此本变更需要同时收口 lifecycle owner 和 curtain render snapshot 两条链路。

## Status Calibration

2026-06-20 校准结论：本 change 已经完成一批 frontend owner hardening、settled-turn quarantine、curtain scope guard、deferred completion scoped reconciliation，并且自动化验证通过；但用户手工复测 3 个并行 Codex/Minimax 会话时，仍能复现“某个已输出完成的会话继续显示 running/loading”。

因此本 change 当前状态是 **implementation checkpoint, not archive-ready**：

- 已解决或收窄的类别：
  - active/visible tab 不再作为 Codex lifecycle owner proof。
  - settled turn 的 late duplicate start / turnless late raw item 不再复活已完成 turn。
  - assistant message completion 不再被误当作 terminal authority，避免提前切断工具链路。
  - conversation curtain deferred snapshot 已按 `workspaceId + threadId` scoped，避免 tab 切换串帧。
  - deferred `turn/completed` 在 stale local blocker 场景会触发 scoped backend terminal probe。
- 尚未闭环的类别：
  - 如果真实运行中没有收到 `turn/completed` / owner-gated `runtime-ended` / terminal scoped reconciliation，frontend 仍不能凭 assistant 文本自行 settlement。
  - 如果 backend `query_turn_reconciliation_status` 对实际已结束 turn 仍返回 `running` / `unknown`，frontend 会按当前安全策略继续保持 loading。
  - 如果清理被 `active-turn-mismatch`、scope mismatch、diagnostic/deferred completion missing 等 guard 拒绝，需要 diagnostic payload 才能判断下一层根因。

下一阶段不应继续堆 frontend guess。必须先采集以下 diagnostic label 的真实 payload，再决定是 backend terminal/owner payload enrichment，还是 frontend cleanup guard 过严：

- `deferred-completion-reconciliation-query-requested`
- `deferred-completion-reconciliation-query-resolved`
- `deferred-completion-reconciliation-cleanup-skipped`
- `three-evidence-reconciliation-cleanup-applied`
- `three-evidence-reconciliation-cleanup-skipped`
- `quarantined-codex-event-skipped`
- `turn-completed-deferred`

## Goals

- Test-first：实施前先锁住当前正确行为，明确哪些测试必须 pass-before/pass-after，哪些污染回归应先 fail 再 pass。
- Preserve single-session correctness：单个 Codex 会话仍必须能正常 start、progress、terminal settle，不因为收紧 fallback 而卡 loading。
- Fix Codex parallel contamination：两个及以上 Codex 会话并行时，ambiguous/no-owner event MUST NOT 通过 active/visible thread 串线。
- Prevent completed-session revival：completed/failed/stalled/abandoned Codex turn 收到 late 或 ambiguous progress/start event 时，MUST NOT 重新 loading。
- Prevent curtain cross-thread snapshot bleed：并行 Codex tab 切换时，conversation curtain MUST NOT 临时复用另一个 `workspaceId + threadId` 的 deferred render/presentation snapshot。
- Preserve Claude Code behavior：Claude Code 单会话、batch consumer、legacy single-channel、normalized realtime、turn completion 语义不能因为 Codex gate 被改坏。
- Preserve multi-engine behavior：Claude/Gemini/OpenCode/Codex 的 adapter、batcher、history parity、interrupt/continuation 现有 contract 继续成立。
- Preserve explicit owner priority：`threadId`、`turnId`、`affectedThreadIds`、`affectedActiveTurns`、shared-session native binding 等显式 owner context 仍为最高优先级。
- Preserve provider/shared-session routing：same-provider / different-provider Codex 并发、provider-bound continuation、shared-session native rebinding 不能被 active UI selection 覆盖。
- Preserve same-thread streaming performance：同一会话内的 stable snapshot、live row override、streaming render mitigation 继续生效。

## Non-Goals

- 不在本变更中修改 Codex app-server wire protocol 或强制 backend 补齐所有 event owner 字段。
- 不重写整个 conversation assembly、thread reducer 或 runtime store。
- 不把所有 no-thread-id event 一律丢弃；低风险 progress-only event 可以通过唯一 processing Codex thread 的 bounded fallback 保留单会话兼容。
- 不把 Claude/Gemini/OpenCode 套进 Codex-specific gate；只要求本次改动不得破坏它们的既有语义。
- 不新增外部依赖、全局 lock、incident store 或跨进程状态表。
- 不关闭 `useDeferredValue`、same-thread stable snapshot 或 streaming presentation 优化；只在 conversation scope 不一致时失效旧 snapshot。

## What Changes

### 1. Behavior Lock Before Implementation

在实现前先补齐或确认 pass-before/pass-after 测试：

- Codex 单会话 lifecycle/realtime 仍正确收敛，唯一 processing fallback 不退化。
- Codex explicit `runtime/ended` affected routing、shared-session native rebinding 仍精确路由。
- Claude Code legacy single channel、batch consumer、turn completion、normalized context usage 不回退。
- Multi-engine realtime adapters/batcher/history parity 不因 Codex gate 改变既有语义。
- Provider-scoped Codex metadata 和 same-provider/different-provider continuation 行为不回退。

这些测试是保护网，不是 bug reproduction；它们必须在实现前后都通过。

### 2. Pollution Regression Tests

新增并发污染回归，用来证明当前问题被覆盖：

- 双 Codex processing 会话中，无 explicit owner 的 terminal event 不得 settle active/visible Codex thread。
- 已完成 Codex 会话在另一个 Codex 会话运行期间收到 late/ambiguous progress 或 processing-start event，不得重新 `isProcessing=true`。
- ambiguous progress-only event 不得记录 liveness progress 到 guessed thread。
- same-provider 和 different-provider Codex 并发时，frontend fallback 不得通过 provider runtime sharing 误判 owner。
- Codex ownership hardening 不得影响 Claude Code 同时运行的 thread lifecycle。

这些测试在当前实现下可以暴露风险；实现完成后必须通过。

### 3. Codex Event Ownership Resolver

引入小型 ownership resolver，将 raw app-server event 的 owner 解析集中化：

- `explicit`：payload 或 shared/native binding 给出明确 `threadId` / `turnId` / affected mapping。
- `boundedFallback`：workspace 内恰好一个 processing Codex thread，可作为兼容 owner。
- `ambiguous`：多个候选或 provider/runtime 共享导致无法唯一归属。
- `unresolved`：没有可用 owner。

Resolver 返回 decision，不直接 dispatch，便于测试和审计。

### 4. Risk-Based Mutation Gate

按事件风险分级执行 gate：

- `terminal`：`runtime/ended`、`turn/error`、`turn/completed`、`turn/stalled`。必须 explicit 或唯一 bounded fallback。
- `processing-start`：`turn/started`、status running/processing、可能创建/恢复 processing 的 item start。必须 explicit 或 verified successor。
- `progress-only`：heartbeat、token usage、reasoning delta、tool output、request user input。可以使用唯一 bounded fallback，但不得 revive settled turn。
- `diagnostic-only`：parse error 或 ambiguous lifecycle/status event。只诊断，不 mutation。

### 5. Active UI Selection Is Not Lifecycle Ownership

`getActiveCodexThreadId` 不能再作为 terminal / processing-start / liveness mutation owner。它最多保留给非 lifecycle UI 兼容路径，并且必须有清晰注释：active selection 是 display/navigation state，不是 event owner proof。

### 6. Conversation Curtain Deferred Snapshot Scope

`Messages` 的 render/presentation stable snapshot 必须绑定当前 conversation scope：

- `renderSourceItems` 和 `presentationRenderedItems` 进入 `useDeferredValue` 前带上 `workspaceId + threadId` scope。
- 当前 scope 与 deferred scope 不一致时，立即使用当前 thread 的 items，不复用上一个 tab 的 deferred snapshot。
- `resolveStreamingPresentationItems` 在 scope mismatch 时不得把旧 snapshot 与当前 live rows 合并。
- scope 一致时保留原有 same-thread streaming stabilization，避免大回复 streaming 时频繁重排。

### 7. Assistant Message Completion Is Content Evidence Only

后续实测暴露了一个反向回归：把 `onAgentMessageCompleted` / normalized `completeAgentMessage` 当成 turn terminal proof 后，Codex 可能在输出“我先了解一下...”这类中间 assistant message 后被前端提前 settlement，后续 tool/read/explore 链路被切断。

本变更明确校准 lifecycle authority：

- `assistant message completion` 只代表一个 message block 完成，不代表 Codex turn 完成。
- 它可以记录 content/stream evidence，但不能 `markProcessing(false)`、`setActiveTurnId(null)`、`markRealtimeTurnTerminal` 或写入 settled-turn quarantine。
- 即使 `turn/completed` 已到达并因 active child/tool blockers deferred，只要 blocker 仍 running，assistant completion / delta 也不能 flush 该 deferred completion。
- 只有 explicit terminal event、owner-gated `runtime/ended` / `turn/error` / `turn/stalled`、blocker terminal update，或 scoped backend reconciliation terminal result，才有 lifecycle settlement authority。

### 8. Deferred Completion Scoped Reconciliation

三会话并行实测暴露了另一类残留：Codex 会话内容已经完成，但 `turn/completed` 因某个 stale child/tool blocker 被 deferred，前端会继续显示 `正在生成响应...`。这不是 cross-thread contamination，也不能靠 assistant completion 推断解决。

本变更把该场景收敛到已有 scoped reconciliation contract：

- 当 Codex `turn/completed` 因 active blockers 被 deferred 时，立即对同一 `workspaceId + threadId + turnId` 发起 backend status probe。
- 仍复用 `query_turn_reconciliation_status` 与 `requestSource: "three-evidence-reconciliation"`，不新增 backend wire 字段。
- response 必须 match workspace、engine、thread、turn，且当前 diagnostic/deferred completion 仍是同一 turn。
- response 为 terminal 时，允许以 `scoped-reconciliation-terminal` flush deferred completion，即使本地 blocker 仍 stale running。
- response 为 running/unknown/query-failed、scope mismatch、或新 turn 已开始时，必须保持 deferred，不清 loading。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-conversation-liveness`: Codex lifecycle/progress mutation MUST be owner-gated; settled turns MUST NOT revive from late or ambiguous events; single-session bounded fallback MUST remain correct.
- `codex-provider-scoped-session-launch`: Concurrent Codex conversations, including same-provider shared-runtime conversations, MUST not collide through frontend fallback routing or global active provider state.
- `conversation-realtime-cpu-stability`: Realtime batching/raw/normalized paths MUST preserve owner semantics and deferred render snapshot scope; they MUST NOT regress Claude/Gemini/OpenCode behavior while hardening Codex.

## Technical Options

| Option | Pros | Cons | Decision |
|---|---|---|---|
| A. Patch only `runtime/ended` active fallback | Smallest diff; fixes one visible terminal collision | Does not explain completed session returning to loading from progress/start paths | Reject |
| B. Drop every Codex event without `threadId` | Maximum isolation | Breaks legacy single-session usage, request-user-input/token/reasoning compatibility, and progress display | Reject |
| C. Add ownership resolver + risk-based mutation gate + test-first migration | Fixes root owner ambiguity while preserving explicit owner and unique fallback behavior | Larger implementation surface; needs focused tests before behavior changes | Adopt |
| D. Scope deferred conversation-curtain snapshots by `workspaceId + threadId` | Fixes transient tab-switch curtain bleed while preserving same-thread performance | Does not solve lifecycle owner ambiguity alone; must complement C | Adopt as render-layer companion |

## Acceptance Criteria

- Existing behavior lock tests for Codex single-session, Claude Code, multi-engine realtime, shared-session rebinding, and provider-scoped routing pass before and after implementation.
- Double-Codex concurrency tests prove ambiguous terminal/progress/start events do not mutate active/visible or completed threads.
- A completed Codex turn cannot return to loading from late raw or normalized events unless a verified successor turn is active.
- Single Codex processing fallback still clears or updates the only processing thread when explicit owner context is missing and the fallback is safe.
- Explicit owner context always wins over active UI selection.
- `getActiveCodexThreadId` is not used by lifecycle terminal, processing-start, or liveness progress mutation paths.
- Switching tabs between parallel Codex conversations cannot render previous thread grouped entries in the new thread's `MessagesTimeline`.
- `resolveStreamingPresentationItems` rejects cross-scope deferred snapshot merge, while same-thread stable snapshot behavior remains enabled.
- `onAgentMessageCompleted` / normalized `completeAgentMessage` cannot settle a Codex turn without terminal authority.
- Assistant delta/completion cannot flush a deferred `turn/completed` while child/tool blockers are still running.
- Deferred `turn/completed` with stale blockers triggers scoped backend status reconciliation; only matching terminal response may flush it.
- Manual 3-session Codex/Minimax runtime verification is still open as of 2026-06-20; this change MUST NOT be archived until the remaining stuck-loading reproduction is classified by diagnostic payloads.
- Focused validation includes:
  - `npx vitest run src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.realtime-contract.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
  - `npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts`
  - `npx vitest run src/features/threads/hooks/useThreads.integration.test.tsx`
  - `npx vitest run src/features/threads/adapters/realtimeAdapters.test.ts`
  - `npx vitest run src/features/threads/contracts/realtimeEventBatcher.test.ts src/features/threads/contracts/realtimeHistoryParity.test.ts`
  - `npx vitest run src/features/messages/components/Messages.streaming-presentation.test.tsx src/features/messages/components/messagesLiveWindow.test.ts src/features/messages/components/Messages.test.tsx`
  - `npx vitest run src/features/messages/components/Messages.live-behavior.test.tsx src/features/messages/components/Messages.windows-render-mitigation.test.tsx`
  - `npm run typecheck`

## Research Evidence

- `src/features/app/hooks/useAppServerEvents.ts`
  - `getActiveCodexThreadId` 当前用于多个 no-thread-id fallback，包括 generated image、`item/tool/requestUserInput`、`codex/parseError`、`runtime/ended`、`token_count`、reasoning deltas。
  - `runtime/ended` 在缺少 `affectedThreadIds` / `affectedActiveTurns` 时会 fallback 到 active Codex thread 并调用 `onTurnError`。
  - `turn/started` 和 `processing/heartbeat` 已经偏向显式 `threadId`，说明系统已有 owner-aware 方向，但 raw compatibility fallback 尚未统一。
- `src/features/threads/hooks/useThreadEventHandlers.ts`
  - 已有 `turnDiagnosticsRef`、`quarantinedCodexTurnsRef`、`shouldSkipCodexTurnEvent`、`isRealtimeTurnTerminalExact`、three-evidence reconciliation。
  - `onProcessingHeartbeat`、`onThreadTokenUsageUpdatedTracked`、`onNormalizedRealtimeEventTracked` 会记录 liveness progress，必须确保调用前 owner 已可信。
  - 已有 normalized late-event 防复活路径，应扩展到 raw/fallback app-server event，而不是推翻现有机制。
- `src/features/threads/hooks/useThreads.integration.test.tsx`
  - 已覆盖 “does not revive processing from late normalized realtime updates after turn completion”。本变更需要把同类保护扩展到 raw event fallback 和并发 Codex 场景。
- `src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`
  - 已覆盖 explicit affected context、manual shutdown skip、shared-session native rebinding；需要新增 ambiguous terminal 不 mutation、unique fallback 兼容语义。
- `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
  - 已覆盖 Claude legacy single channel 在 batch flag 打开时仍能 route agent deltas 和 turn completion，是 Claude Code 不回退的关键保护。
- `src/features/threads/adapters/realtimeAdapters.test.ts`、`src/features/threads/contracts/realtimeEventBatcher.test.ts`、`src/features/threads/contracts/realtimeHistoryParity.test.ts`
  - 已覆盖 Codex/Claude/Gemini/OpenCode adapter、batcher、history parity，适合作为 multi-engine regression fence。
- `src-tauri/src/backend/app_server_event_helpers.rs`
  - `build_runtime_ended_event` 已支持 `affectedThreadIds`、`affectedTurnIds`、`affectedActiveTurns`、`pendingRequestCount`、`hadActiveLease`、runtime identity；frontend 应优先消费这些 explicit owner fields。
- `src/features/messages/components/Messages.tsx`
  - `renderSourceItems` 与 `presentationRenderedItems` 使用 deferred stable snapshot 来稳定 streaming UI；tab 切换时如果 snapshot 不带 conversation scope，`threadId` 已切到 B 但 deferred items 仍可能来自 A。
  - 这解释了“幕布临时混入双方内容、最终又恢复正确”的现象：persistent thread state 正确，但 render snapshot 在一帧或数帧内复用了旧 owner。
- `src/features/messages/components/messagesLiveWindow.ts`
  - `resolveStreamingPresentationItems` 会基于 stable snapshot 保留历史 rows 并附加当前 live rows；如果不检查 scope，旧 thread snapshot 可能与新 thread live rows 合并。

## Impact

- Frontend event routing:
  - `src/features/app/hooks/useAppServerEvents.ts`
  - possible helper: `src/features/app/hooks/codexEventOwnership.ts`
- Conversation curtain rendering:
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/messagesLiveWindow.ts`
- Thread lifecycle / liveness:
  - `src/features/threads/hooks/useThreadEventHandlers.ts`
  - `src/features/threads/hooks/useThreads.ts`
- Existing and new tests:
  - `src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`
  - `src/features/app/hooks/useAppServerEvents.realtime-contract.test.tsx`
  - `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
  - `src/features/app/hooks/useAppServerEvents.request-user-input.test.tsx`
  - `src/features/app/hooks/useAppServerEvents.tokenUsage.test.tsx`
  - `src/features/threads/hooks/useThreads.integration.test.tsx`
  - `src/features/threads/adapters/realtimeAdapters.test.ts`
  - `src/features/threads/contracts/realtimeEventBatcher.test.ts`
  - `src/features/threads/contracts/realtimeHistoryParity.test.ts`
  - `src/features/messages/components/Messages.streaming-presentation.test.tsx`
  - `src/features/messages/components/messagesLiveWindow.test.ts`
  - `src/features/messages/components/Messages.test.tsx`
  - `src/features/messages/components/Messages.live-behavior.test.tsx`
  - `src/features/messages/components/Messages.windows-render-mitigation.test.tsx`
- Specs:
  - `openspec/specs/codex-conversation-liveness/spec.md`
  - `openspec/specs/codex-provider-scoped-session-launch/spec.md`
  - `openspec/specs/conversation-realtime-cpu-stability/spec.md`
- Backend:
  - No required backend change in this proposal. A follow-up may enrich lifecycle owner fields if frontend diagnostics show backend coverage gaps.
