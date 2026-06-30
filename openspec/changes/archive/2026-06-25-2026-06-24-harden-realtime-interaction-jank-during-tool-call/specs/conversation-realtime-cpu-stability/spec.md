## ADDED Requirements

### Requirement: User Input Pending MUST Yield Realtime Dispatch

When the user has pending input (mouse, keyboard, scroll, or any other UI gesture), realtime event dispatch MUST yield between chunks so the input can be processed within 50ms.

#### Scenario: interactive yield between chunks leaves pending input responsive under 50ms
- **WHEN** the per-event dispatch loop is processing a 200-event queue
- **AND** the user clicks the file tree (pointerdown)
- **THEN** the current chunk MUST complete
- **AND** the next chunk MUST be deferred via `requestIdleCallback` (timeout 50ms) or `setTimeout(32ms)`
- **AND** the file tree click handler MUST run within 50ms.

#### Scenario: no input pending does not yield
- **WHEN** the user is not interacting with the UI
- **AND** the per-event dispatch loop is processing a 200-event queue
- **THEN** the dispatcher MUST still apply the 8ms per-chunk wall-clock budget
- **AND** MUST yield only when the budget is exceeded.

### Requirement: Three-Layer Pacing MUST Bound Realtime Main Thread Work Without Dropping Protected Events

The realtime event pipeline MUST bound main-thread work through three cooperating layers without violating protected event delivery: (1) backend snapshot throttle at source, (2) per-event webview backpressure with derived-snapshot-only overflow drop, (3) per-chunk wall-clock budget in the per-event dispatch loop. Tauri sink MUST remain lossless. Raw `outputDelta`, lifecycle, terminal, and critical events MUST be protected from webview overflow drops.

#### Scenario: 10min tool call turn with 10K deltas
- **WHEN** a single tool call produces 10000 deltas over 10 minutes
- **THEN** `main_thread_long_task_count_during_stream` MUST be bounded relative to the v0.5.13 baseline (specific threshold defined by task 0.1)
- **AND** `reducer_dispatches_per_active_turn_per_sec` MUST be bounded (specific threshold defined by task 0.1).

#### Scenario: critical event preservation
- **WHEN** the three-layer pacing is active
- **AND** critical events (`turn/completed`, `turn/error`, `runtime/ended`, `item/tool/requestUserInput`, `approval/request`) are emitted
- **THEN** every critical event MUST reach the reducer
- **AND** MUST NOT be dropped, coalesced, or delayed by idle yield.

#### Scenario: snapshot drop reconverges via realtime event batcher
- **WHEN** the per-event backpressure drops an `item/updated` snapshot due to `maxQueueDepth` overflow
- **THEN** the next `realtimeEventBatcher` cadence flush MUST apply the latest retained snapshot
- **AND** the visible conversation state MUST converge to the final content without requiring history replay.

#### Scenario: raw output delta is never dropped by webview overflow
- **WHEN** the per-event backpressure queue is over capacity
- **AND** a raw `item/commandExecution/outputDelta` or `item/fileChange/outputDelta` event is queued
- **THEN** that event MUST be classified as protected
- **AND** the overflow policy MUST choose only an eligible derived snapshot for dropping or defer delivery until capacity is available.

#### Scenario: long-running realtime client does not accumulate stale pacing state
- **WHEN** the client stays open across many completed realtime turns
- **THEN** pacing state held by `appServerEventBackpressure`, `SnapshotThrottle`, and `useToolOutputTailGate` MUST remain bounded by explicit retained-count, TTL, and active-key caps
- **AND** completed item/thread metadata MUST be removed after terminal events or idle eviction
- **AND** UI input latency MUST NOT degrade solely because old pacing state remained in memory.
