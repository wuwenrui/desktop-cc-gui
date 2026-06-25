# file-change-event-debounce Specification

## Purpose
TBD - created by archiving change realtime-input-and-io-isolation-2026-06. Update Purpose after archive.
## Requirements
### Requirement: External File Change Events MUST Be Debounced Per Path

External file change events MUST be coalesced by `(workspace_id, normalized_path)` before crossing the Tauri-to-webview event boundary.

#### Scenario: same-path events coalesce

- **WHEN** multiple watcher events for the same `(workspace_id, normalized_path)` arrive within the debounce window
- **THEN** the backend MUST emit only the latest event for that key in the batch
- **AND** the batch MUST use `detached-external-file-change-batch`.

#### Scenario: cross-path events are preserved

- **WHEN** watcher events for different normalized paths arrive within the same window
- **THEN** every path MUST be represented in the emitted batch
- **AND** no empty batch MUST be emitted.

#### Scenario: arrival order is explicitly preserved

- **WHEN** a batch contains events for multiple paths
- **THEN** event order MUST be based on arrival sequence or an explicit monotonic sequence number
- **AND** the implementation MUST NOT claim that `HashMap` or `BTreeMap` preserves arrival order.

### Requirement: Frontend File Refresh MUST Be Batch-Aware And Stale-Safe

The frontend file external sync path MUST process batch events without causing duplicate refreshes or stale overwrite.

#### Scenario: frontend chooses one event mode

- **WHEN** batch mode is enabled
- **THEN** the frontend consumer MUST process `detached-external-file-change-batch`
- **AND** MUST NOT also process the same change through the single-event fallback.

#### Scenario: batch refresh coalesces by file

- **WHEN** a batch contains repeated or adjacent changes for the active file
- **THEN** the frontend MUST coalesce refresh work before reading from disk
- **AND** in-flight refresh state MUST queue at most the latest required refresh per file.

#### Scenario: stale refresh cannot overwrite newer local state

- **WHEN** an older refresh finishes after a newer refresh or local edit
- **THEN** the older refresh MUST be dropped
- **AND** dirty editor state MUST NOT be overwritten by stale external content.

### Requirement: File Change Event Evidence MUST Be Reported

Runtime evidence gates MUST expose raw and emitted file-change event rates plus refresh queue pressure.

#### Scenario: file change event metrics are reported

- **WHEN** the runtime evidence gate runs
- **THEN** `fs_event_raw_per_sec` MUST be present
- **AND** `fs_event_emitted_per_sec` MUST be present
- **AND** `file_refresh_queue_depth_max` MUST be present
- **AND** `file_refresh_stale_drop_count` MUST be present.

### Requirement: V0511 File Change Debounce Evidence MUST Use Burst Fixtures

File-change debounce evidence MUST be derived from same-path and cross-path burst fixtures.

#### Scenario: same-path burst reports coalescing

- **WHEN** a same-path burst fixture submits repeated file-change events within the debounce window
- **THEN** the producer MUST emit raw event count and emitted event count
- **AND** it MUST emit `S-IO-FC/fs_event_same_path_coalesce_ratio`

#### Scenario: empty batch remains forbidden

- **WHEN** the debounce fixture completes
- **THEN** the producer MUST emit `S-IO-FC/fs_event_empty_batch_emit_count`
- **AND** the expected value MUST be zero

