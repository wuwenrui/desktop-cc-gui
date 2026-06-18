## Why

最新热启动实机 trace 显示 route work 已经是 `0ms` 级别，但 `batchFlushEndToReducerCommitMs=7265ms`，说明性能瓶颈不在路由函数本身，而在 flush 之后的 React scheduling / reducer commit 链路。

本变更要把已 flush 的 live assistant delta 从低优先级 transition 等待中解出来，让可见 live row 更快提交，同时保留 terminal fence 与重型事件的保守调度。

## 目标与边界

- 降低 live assistant delta 的 flush-to-reducer commit lag。
- 只触碰 frontend realtime event scheduling / tests / evidence notes。
- 保留现有 reducer fast path，不改 conversation assembler 的语义模型。
- 继续遵守 live row 即时增长、parent timeline heavy derivation 延后的 streaming render contract。

## 非目标

- 不做 Markdown worker 化、message timeline 重构、backend event batching 重写。
- 不改变 terminal event 顺序、settlement guard 或 stale turn filtering。
- 不把 diagnostics/report pipeline 作为本次性能修复重点。

## What Changes

- Live assistant `appendAgentMessageDelta` flushes MUST dispatch reducer work urgently instead of being wrapped in transition scheduling.
- Terminal completion and non-live/heavy normalized events remain guarded and MAY continue to use transition scheduling where safe.
- Regression tests will lock that cadence-flushed live assistant deltas do not sit in a transition queue.
- Existing terminal-fence tests remain active so urgent live delta cannot revive a completed turn.
- After hot-start validation, the same streaming turn produced no `realtime.turnTrace.summary` but did emit `visible-output-stall-after-first-delta` and activated `codex-markdown-stream-recovery`. The visible-text reporting path for lightweight Markdown streaming MUST therefore register latest assistant text growth even when the Markdown rendered-value callback is delayed.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-realtime-client-performance`: realtime client scheduling must treat live assistant delta commits as latency-critical while preserving terminal turn fences.
- `conversation-realtime-client-performance`: streaming visible-text diagnostics must stay aligned with the live assistant row for lightweight Codex/Codex-recovery Markdown surfaces.

## 技术方案选项与取舍

- 选项 A：把所有 normalized realtime events 改为 urgent dispatch。实现简单，但会把 tool/reasoning/terminal/snapshot 等重型或顺序敏感事件一起推入同步路径，风险过大。
- 选项 B：只把 live assistant `appendAgentMessageDelta` 的 first-token/cadence/manual flush 改为 urgent dispatch。它命中当前 trace 的 flush-to-commit 问题，同时复用已存在的 reducer fast path，影响面最小。

采用选项 B。

## 验收标准

- `appendAgentMessageDelta` cadence flush 不进入 `scheduleRealtimeDispatch` 队列。
- terminal turn fence 仍在执行时检查，late queued event 不能修改已 terminal 的 turn。
- reducer fast path 测试继续证明 streaming delta 不调用 `prepareThreadItems`。
- `codex-markdown-stream-recovery` / lightweight Markdown streaming 在 `displayText` 增长而 Markdown rendered callback 延迟时，仍会上报当前 assistant item 的 visible text，避免 diagnostics 继续卡在旧 item。
- focused Vitest、typecheck、lint、OpenSpec strict validation 通过。

## Impact

- Affected frontend code:
  - `src/features/threads/hooks/useThreadItemEvents.ts`
  - `src/features/threads/hooks/useThreadItemEvents.test.ts`
- Affected specs:
  - `conversation-realtime-client-performance`
- No new dependency, no backend/Rust change, no public API change.
