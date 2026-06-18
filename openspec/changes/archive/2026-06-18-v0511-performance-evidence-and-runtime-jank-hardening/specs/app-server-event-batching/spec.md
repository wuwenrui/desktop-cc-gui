## ADDED Requirements

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
