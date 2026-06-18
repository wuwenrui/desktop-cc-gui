# app-server-event-batching Specification

## Purpose
TBD - created by archiving change realtime-input-and-io-isolation-2026-06. Update Purpose after archive.
## Requirements
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

### Requirement: Batch-Enabled Frontend MUST Preserve Legacy Single-Event Compatibility

When app-server event batching is enabled, the frontend MUST continue receiving legacy `app-server-event` payloads until all backend producers have migrated to the shared batched `EventSink` contract. Batch mode MUST NOT make legacy single-channel engine forwarders unreachable.

#### Scenario: legacy Claude event arrives while batch consumer is enabled

- **WHEN** `ccgui.perf.appServerEventBatch` is enabled in the webview
- **AND** a Claude forwarder emits an `AppServerEvent` on `app-server-event`
- **THEN** `useAppServerEvents` MUST route that event through the same dispatcher used by non-batch mode
- **AND** the event MUST reach the relevant thread handler, such as `onAgentMessageDelta`, `onTurnCompleted`, `onApprovalRequest`, or `onTurnError`.

#### Scenario: batch payloads still use chunked dispatch

- **WHEN** the webview receives an `app-server-event-batch` payload
- **THEN** `useAppServerEvents` MUST continue applying the batch coalesce and chunking policy
- **AND** text delta events in the batch MUST remain non-coalescible append-only events.

#### Scenario: mixed-channel migration does not require producer lockstep

- **WHEN** one backend producer emits through `BatchedTauriEventSink`
- **AND** another backend producer still emits directly through `app.emit("app-server-event", ...)`
- **THEN** frontend delivery MUST remain correct for both producers
- **AND** migrating one producer MUST NOT require all producers to switch channels in the same release.

#### Scenario: future double-emission is explicitly guarded

- **WHEN** a producer is later migrated from direct `app-server-event` emit to `EventSink`
- **AND** that producer could temporarily emit the same logical event on both channels
- **THEN** the implementation MUST either avoid double-emission at the producer
- **OR** add stable event identity based deduplication before reducer dispatch.

### Requirement: V0511 App Server Batching Evidence MUST Compare Raw And IPC Counts

App-server batching evidence MUST expose whether batching reduces IPC emission relative to raw event volume.

#### Scenario: batch producer reports raw and IPC rates

- **WHEN** an app-server event batching producer runs a multi-event fixture
- **THEN** it MUST emit `S-IO-AS/app_server_event_raw_per_sec`
- **AND** it MUST emit `S-IO-AS/app_server_event_ipc_emit_per_sec`

#### Scenario: reducer dispatch count remains visible

- **WHEN** a 1000-delta app-server event route fixture runs
- **THEN** the producer MUST emit `S-IO-AS/realtime_reducer_dispatches_per_1000_delta`
- **AND** the report MUST distinguish this count from raw event count

