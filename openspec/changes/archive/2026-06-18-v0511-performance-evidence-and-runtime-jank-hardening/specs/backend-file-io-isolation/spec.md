## ADDED Requirements

### Requirement: V0511 Backend File IO Evidence MUST Report Blocking And Stall Metrics

Backend file I/O isolation evidence MUST report command duration and async-worker stall signals from a reproducible fixture.

#### Scenario: file IO producer records wall time

- **WHEN** the backend file I/O producer runs a large read/write fixture
- **THEN** it MUST emit `S-IO-FS/file_io_command_wall_ms_p95`
- **AND** it MUST preserve the command label without raw absolute paths or file contents

#### Scenario: blocking pool evidence remains content safe

- **WHEN** blocking-pool usage is recorded
- **THEN** the producer MUST emit `S-IO-FS/file_io_blocking_pool_call_count`
- **AND** the artifact MUST NOT include prompt text, assistant body, tool output, raw file contents, secrets, or raw absolute paths
