# PRD: Harden realtime interaction jank during tool call (v2)

> OpenSpec change id: `2026-06-24-harden-realtime-interaction-jank-during-tool-call`
> v2: post-expert-review changes — see `notes` field in `task.json`

## Problem

`feature/v0.5.13` users report that during an active realtime conversation with tool calls, the client becomes unresponsive: file tree clicks, sidebar collapse, and session switch all take 200-500ms. The blocking work lives in the Tauri batch sink -> webview `app-server-event-batch` -> per-event dispatch -> `useThreadsReducer` chain.

## Root cause (verified in code)

- `BatchedTauriEventSink` emits a full `Vec<AppServerEvent>` per workspace every 40ms with no critical-bypass observability and no source-side snapshot throttle.
- `appServerBatchHub` does not wrap `createEventBackpressure` (unlike `terminal-output`).
- Per-event backpressure was never introduced; the webview per-event dispatch had no idle yield, no wall-clock budget, no input-pending detection.
- `onItemStarted/Updated/Completed` and `onAgentMessageCompleted` (5 consecutive dispatches) hit the reducer synchronously.
- `backgroundRenderGating` is just `useDeferredValue`; it does not bound dispatch frequency.

## v2 key changes vs v1

1. **Sink stays lossless** (C-1): no event drops in `BatchedTauriEventSink`; source-side snapshot throttle replaces the dropped byte budget.
2. **Per-event backpressure** (T-1): `appServerEventDeliverHub` with `createEventHub.publish(payload)`, status-only `coalesceKey`, and snapshot-only `dropPolicy` applied at per-event level (not per-batch).
3. **useRenderScheduler hook** (T-2): extracted `requestIdleCallback` + 8ms budget + input pending yield; also refactors `useWorkspaceThreadListHydration`.
4. **Snapshot throttle at source** (C-1): Rust `SnapshotThrottle` throttles `item/updated` text snapshots to 32ms per `(workspaceId, itemId, kind)`; terminal events force flush.
5. **Tier-vs-flag relationship table** (C-3): explicit enumeration of how `streamingScheduleTier` interacts with existing 8 perf flags.
6. **Baseline 0.1 task** (V-1): v0.5.13 release run records 7 metric baseline numbers; task 0.2 fills design.md §6 and proposal §验收 placeholders with concrete numbers.
7. **Critical event 3-path verification** (V-2): Rust unit test + webview unit test + integration test for critical zero-loss.
8. **N-1 rename**: `streamingSchedulePolicy` → `renderSchedulingPolicy` to avoid clash with `runtimeSessionScheduling`.

## Goals

1. Lossless three-layer pacing: Rust snapshot throttle -> per-event backpressure -> per-chunk wall-clock budget.
2. Preserve critical events (`turn/completed`, `turn/error`, `runtime/ended`, `item/tool/requestUserInput`, `approval/request`) with zero loss.
3. Throttle stdout/stderr tool output to <= 32Hz per `(workspaceId, itemId, kind)` through append-buffer semantics, never generic last-write coalesce.
4. Collapse the 5-dispatch `onAgentMessageCompleted` into a single `flushAgentCompletedBatch` action.
5. Route dispatches through `urgent` / `transition` / `idle` based on `renderSchedulingPolicy`.
6. Yield to `requestIdleCallback` and react to input pending signals.
7. Expose `streamingScheduleTier` (`baseline` / `guarded` / `aggressive`) with full rollback.

## Acceptance (placeholders; final numbers from task 0.1/0.2)

- File tree click < 200ms during active tool call.
- Sidebar collapse < 200ms during active tool call.
- Session switch < 200ms during active tool call.
- `main_thread_long_task_count_during_stream` reduced relative to v0.5.13 baseline (target: 40% reduction; archive gate 11.1 uses concrete threshold from task 0.2).
- `reducer_dispatches_per_active_turn_per_sec` reduced relative to v0.5.13 baseline (target: 30% reduction).
- `appendAgentMessageDelta` first-token latency < 5% regression vs v0.5.13.
- 50/50 critical events reach reducer in 1024-event burst across all 3 verification paths (V-2 split).
- `streamingScheduleTier=baseline` reverts to v0.5.13 behavior within 30s.
- 4 rollback paths (tier=baseline / toolOutputTailGate=off / appServerEventBatch=off / env=0) all verifiable.

## Rollback

| Key / env | Effect |
|---|---|
| `ccgui.perf.streamingScheduleTier=baseline` | Disables idle yield, tail gate, background 3-frame accumulation. |
| `ccgui.perf.appServerEventBatch=off` | Disables frontend batch channel + per-event dispatch. Backend `SnapshotThrottle` remains. |
| `ccgui.perf.toolOutputTailGate=off` | Disables webview tool output tail gate. Raw outputDelta remains protected from generic coalesce/drop. |
| `CCGUI_APP_SERVER_EVENT_BATCH=0` (env) | Disables batch channel entirely; falls back to single-event. |
