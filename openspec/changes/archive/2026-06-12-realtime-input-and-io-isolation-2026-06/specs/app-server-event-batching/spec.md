## ADDED Requirements

> **Implementation Status (本 change)**: Rust event sink (`BatchedTauriEventSink`) 已完成,含 per-workspace arrival order / per-workspace drain isolation / terminal workspace flush / env fallback inline tests。Rust flush 现在按 workspace 分批 emit,terminal event 立即 flush 本 workspace。Frontend follow-up 已完成 `useAppServerEvents` 互斥 batch consumer + shared dispatcher + `dispatchAppServerEventBatch`。当前 batch route 对连续状态快照事件 latest-wins coalesce，对 append-only delta 保序透传到既有 realtime buffer，并按 chunk 切片调度。


### Requirement: App Server Events MUST Be Batched With Order-Preserving Structures

The Tauri event sink MUST buffer `AppServerEvent` per workspace or session key and emit them as a batched payload on a 32-50ms interval, using a structure that preserves arrival order within a single workspace.

#### Scenario: per-workspace buffering isolates emit pressure

- **WHEN** three workspaces stream concurrently and each produces 30 deltas in a 100ms window
- **THEN** the batched emitter MUST produce at most 3 emits per flush window
- **AND** a slow workspace MUST NOT block the emit of fast workspaces.

#### Scenario: arrival order is preserved within a workspace

- **WHEN** the batched emitter flushes a batch
- **THEN** events for a single workspace MUST appear in the order they were submitted
- **AND** the implementation MUST use `VecDeque` or sequence-number-based ordering, NOT `HashMap` or `BTreeMap` iteration order.

#### Scenario: terminal or turn boundary events may flush immediately

- **WHEN** an `itemCompleted` or `completeAgentMessage` event arrives
- **THEN** it MAY be included in the next flush window OR trigger an immediate flush
- **AND** the event MUST NOT be emitted twice (once in the immediate flush and once in the cadence flush).

#### Scenario: fallback single-event channel is preserved

- **WHEN** the backend batch is disabled via backend runtime config
- **THEN** the emitter MUST fall back to the original per-event emit on `app-server-event`
- **AND** the batch channel `app-server-event-batch` MUST NOT be emitted.

### Requirement: Backend Runtime Config Source For Batching MUST Be Explicit

The decision to enable or disable event batching on the Rust side MUST come from app settings, environment variables, or an explicit frontend invoke. It MUST NOT come from the frontend's `ccgui.perf.*` localStorage.

#### Scenario: backend reads from explicit sources

- **WHEN** the emitter needs to decide batch vs single mode
- **THEN** it MUST consult an explicit backend-owned configuration
- **AND** the configuration source MUST be one of: app settings, env var, frontend invoke
- **AND** the configuration source MUST NOT include frontend `localStorage` reads.

#### Scenario: localStorage-based backend flags are forbidden

- **WHEN** a reviewer audits the batch configuration surface
- **THEN** a `rg "ccgui.perf\\." src-tauri/src/` MUST return zero Rust matches
- **AND** the documentation MUST state this restriction.

### Requirement: Frontend App Server Event Route MUST Be Batch-Aware

`useAppServerEvents` MUST treat batch events as a routing unit, not as N independent dispatches.

#### Scenario: batch is routed as a unit

- **WHEN** the webview receives an `app-server-event-batch` with N events
- **THEN** `useAppServerEvents` MUST apply a coalesce or budgeted flush policy
- **AND** MUST NOT synchronously call `originalHandler(event)` N times in a tight loop.

#### Scenario: per-event diagnostics are not recomputed inside a batch

- **WHEN** a batch contains repeated diagnostic or status events
- **THEN** diagnostics MAY be computed once per batch or per coalesced key
- **AND** MUST NOT force a full statistics recomputation per raw event.

#### Scenario: reducer dispatch is coalesced with realtime buffer

- **WHEN** batched deltas arrive during streaming
- **THEN** the existing realtime event batcher (`realtimeEventBatcher`) MUST receive the per-event payloads
- **AND** MUST NOT be bypassed by the batch route
- **AND** the dispatch count to `useThreadsReducer` MUST be bounded by the cadence flush, not by N events.

### Requirement: App Server Event Batching Evidence MUST Be Reported

Runtime evidence gates MUST report raw, IPC, and route-side rates so batching regressions are detectable.

#### Scenario: raw vs emitted rate divergence is reported

- **WHEN** the evidence gate runs against a multi-workspace codex streaming fixture
- **THEN** `app_server_event_raw_per_sec` MUST be present
- **AND** `app_server_event_ipc_emit_per_sec` MUST be present
- **AND** `ipc_emit_per_sec` MUST be `<< raw_per_sec` when batching is enabled.

#### Scenario: route and reducer cost is reported

- **WHEN** the realtime performance gate runs
- **THEN** `app_server_event_route_ms_p95` MUST be present
- **AND** `realtime_reducer_dispatches_per_1000_delta` MUST be present
- **AND** `main_thread_long_task_count_during_stream` MUST be present.
