## ADDED Requirements

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
