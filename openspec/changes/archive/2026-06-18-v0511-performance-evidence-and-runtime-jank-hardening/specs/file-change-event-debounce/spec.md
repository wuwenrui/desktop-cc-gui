## ADDED Requirements

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
