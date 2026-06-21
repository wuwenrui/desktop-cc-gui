# parallel-conversation-runtime-residuals Specification (Delta)

## MODIFIED Requirements

### Requirement: Parallel Conversation Runtime Residuals MUST Be Diagnosable From Webview

The client MUST expose diagnostic surfaces that let an operator inspect the layers that contribute to the "parallel conversation jank" symptom from DevTools or Settings.

#### Scenario: operator can identify active engine child processes

- **WHEN** active process diagnostics are requested
- **THEN** the response MUST include workspace ids, engine type, registered active process ids, total registered active process count, and a sampling timestamp
- **AND** the diagnostic payload MUST be stable enough to paste into a bug report
- **AND** local Claude, OpenCode, and Gemini sessions that own `active_processes` MUST be represented when they have active child handles
- **AND** the payload MUST NOT imply OS process exit solely from a drained runtime registry

#### Scenario: operator can inspect realtime performance flags

- **WHEN** `getActiveRealtimePerfFlags()` is called
- **THEN** it MUST return every known `ccgui.perf.*` flag
- **AND** each entry MUST include `value`, `source`, `storageKey`, `defaultValue`, `testDefaultValue`, and `metric`

#### Scenario: diagnostic command survives degraded runtime mode

- **WHEN** active process diagnostics are invoked in remote backend mode
- **THEN** the response MUST succeed with `measured=false`
- **AND** it MUST include an `unsupportedReason` explaining that active process diagnostics are local-runtime only

### Requirement: ClaudeSession MUST Release Child Processes On Drop

`ClaudeSession` MUST provide a non-blocking Drop fallback for any child process handles still present in `active_processes`.

#### Scenario: Drop drains remaining active children

- **WHEN** `Drop::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit

#### Scenario: Drop does not block runtime teardown

- **WHEN** `Drop::drop` runs while the active process mutex is locked
- **THEN** it MUST log a warning and return without panicking
- **AND** it MUST NOT block waiting for the async mutex

#### Scenario: active process diagnostics are webview-callable

- **WHEN** `get_engine_active_process_diagnostics` is invoked in local mode
- **THEN** the response MUST include Claude workspace ids and active process ids
- **AND** it MUST include a total active process count and a timestamp

#### Scenario: remote mode diagnostics do not break UI

- **WHEN** `get_engine_active_process_diagnostics` is invoked in remote backend mode
- **THEN** the response MUST succeed with `measured=false`
- **AND** it MUST include an `unsupportedReason` explaining that active process diagnostics are local-runtime only

## ADDED Requirements

### Requirement: OpenCodeSession And GeminiSession MUST Release Child Processes On Drop

OpenCode and Gemini sessions MUST provide the same non-blocking Drop fallback as Claude for any child process handles still present in their `active_processes` maps.

#### Scenario: OpenCode Drop drains remaining active children

- **WHEN** `OpenCodeSession::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining OpenCode child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit
- **AND** lock failure MUST log a warning and return without panicking

#### Scenario: Gemini Drop drains remaining active children

- **WHEN** `GeminiSession::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining Gemini child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit
- **AND** lock failure MUST log a warning and return without panicking

#### Scenario: active process diagnostics include all child-owning local engines

- **WHEN** `get_engine_active_process_diagnostics` is invoked in local mode
- **THEN** the response MUST include active child process rows for Claude, OpenCode, and Gemini sessions when present
- **AND** the total active process count MUST equal the sum of all included row process ids
- **AND** the count MUST be documented as a registered runtime handle count, not an OS process liveness proof

### Requirement: Stale Child Reconciliation MUST Start Diagnostics-Only

Stale child-process reconciliation MUST first ship as diagnostics-only so false positives can be reviewed before any automatic kill policy is enabled.

#### Scenario: stale child candidate is reported without kill

- **WHEN** a local engine child process exceeds the configured registered-age threshold
- **THEN** diagnostics MUST record workspace id, engine, process id, registered age, stale reason, and progress evidence class
- **AND** engines without reliable progress metadata MUST report `progressEvidence=unsupported` instead of claiming missing progress
- **AND** the reconciler MUST NOT kill the process unless an explicit follow-up policy enables kill behavior

#### Scenario: reconciler evidence is content-safe

- **WHEN** stale child diagnostics are emitted
- **THEN** the payload MUST NOT include prompt text, assistant body text, terminal output, tool output, or file content
- **AND** it MAY include ids, process ids, durations, engine names, and bounded reason strings

### Requirement: Runtime Registry And OS Process Liveness MUST Be Separate Evidence

The client MUST keep registered child-handle diagnostics separate from OS-level process liveness evidence.

#### Scenario: registry count after close is measured separately

- **WHEN** all local runtime workspaces are closed and diagnostics are sampled after the documented wait window
- **THEN** registered active process count MUST be reported from runtime registries
- **AND** a zero registry count MUST only mean no known child handles remain registered

#### Scenario: OS liveness sampling is explicit

- **WHEN** OS child process liveness is sampled after workspace close
- **THEN** the evidence MUST state measured, proxy, manual-only, or unsupported
- **AND** unsupported OS sampling MUST include a bounded rationale instead of being inferred from registry diagnostics
