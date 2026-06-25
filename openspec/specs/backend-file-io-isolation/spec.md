# backend-file-io-isolation Specification

## Purpose
TBD - created by archiving change realtime-input-and-io-isolation-2026-06. Update Purpose after archive.
## Requirements
### Requirement: Local File Command Surface MUST Run File I/O On The Blocking Pool

Workspace and external file commands MUST execute their synchronous `std::fs` work via a `tokio::task::spawn_blocking` helper, so that the Tauri async runtime workers remain available to forward streaming `app-server-event` and `detached-external-file-change` traffic during real-time engine sessions.

#### Scenario: workspace read runs off the async worker

- **WHEN** `read_workspace_file` is invoked during a codex streaming burst
- **THEN** `File::open` + `read_to_end` MUST execute inside `tokio::task::spawn_blocking`
- **AND** the async worker that received the invoke MUST be free to process `app.emit("app-server-event", ...)` within the same wall-clock window.

#### Scenario: workspace write runs off the async worker

- **WHEN** `write_workspace_file` is invoked during streaming
- **THEN** `std::fs::write` MUST execute inside `spawn_blocking`
- **AND** the same async-worker freedom guarantee MUST hold.

#### Scenario: external spec and external absolute paths run off the async worker

- **WHEN** `read_external_spec_file`, `read_external_absolute_file`, `write_external_spec_file`, or `write_external_absolute_file` is invoked
- **THEN** their synchronous `std::fs` closures MUST execute inside `spawn_blocking`
- **AND** the command's error shape MUST remain `Result<T, String>` so frontend handlers do not break.

#### Scenario: copy, duplicate, and preview-handle commands run off the async worker

- **WHEN** `copy_workspace_item`, `duplicate_workspace_item`, or `resolve_file_preview_handle` is invoked
- **THEN** their synchronous `std::fs` work (copy, rename, metadata, read) MUST execute inside `spawn_blocking`.

### Requirement: File I/O Helper MUST Isolate Panics From The Async Runtime

The shared `spawn_blocking` helper for file I/O MUST convert `tokio::task::JoinError` into a `String` error so that a panic inside a file closure does not poison the async runtime.

#### Scenario: panic inside spawn_blocking becomes a String error

- **WHEN** a file I/O closure inside `spawn_blocking` panics
- **THEN** `JoinError` MUST be converted to `Err("...file I/O task failed: ...")`
- **AND** the Tauri async runtime MUST continue serving other commands.

#### Scenario: JoinError conversion uses a stable error string prefix

- **WHEN** a panic occurs
- **THEN** the resulting error string MUST contain the operation name (e.g. `read_workspace_file`, `write_external_absolute_file`) and the substring `file I/O task failed:`
- **AND** frontend code MAY match on this prefix to distinguish panic-induced errors from business errors.

### Requirement: External Change Watcher Signature I/O Is Already Async

The external change watcher uses `tokio::fs::metadata` for signature computation. This MUST NOT be classified as blocking I/O and MUST NOT be wrapped in `spawn_blocking`.

#### Scenario: signature metadata is already non-blocking

- **WHEN** the file change watcher computes a disk signature for a path
- **THEN** the call MUST use `tokio::fs::metadata` (already async)
- **AND** the change MUST NOT introduce an extra `spawn_blocking` wrapper around it.

### Requirement: File I/O Evidence MUST Be Reported As Realistic Metrics

Runtime evidence gates MUST report file I/O metrics that are physically meaningful, not artificial low thresholds.

#### Scenario: command wall time is reported

- **WHEN** a 10MB file read or write fixture runs
- **THEN** `file_io_command_wall_ms_p95` MUST be present in the report
- **AND** the value MUST be in the realistic range (no artificial 5ms threshold).

#### Scenario: async worker stall is reported

- **WHEN** a file command runs during streaming
- **THEN** `file_io_async_worker_stall_ms_p95` MUST be present
- **AND** MUST be near zero (proves the async worker was not blocked).

#### Scenario: blocking pool call count is reported

- **WHEN** any file I/O command is invoked
- **THEN** `file_io_blocking_pool_call_count` MUST increment by exactly 1 per command
- **AND** the regression gate MUST fail if a command bypasses the helper.

#### Scenario: Tauri command duration during stream is reported

- **WHEN** a file command is invoked during an active streaming session
- **THEN** `tauri_command_during_stream_ms_p95` MUST be present
- **AND** MUST not regress against the pre-change baseline.

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

