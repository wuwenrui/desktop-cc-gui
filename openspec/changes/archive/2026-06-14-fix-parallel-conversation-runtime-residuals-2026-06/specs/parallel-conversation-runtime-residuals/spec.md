# parallel-conversation-runtime-residuals delta

## MODIFIED Requirements

### Requirement: Performance Flag Default Values MUST Be Self-Documenting And Resettable

The realtime performance flag system MUST expose its known flags, current value, source, defaults, and reset path from a single source-of-truth registry.

#### Scenario: operator inspects active perf flags

- **WHEN** `getActiveRealtimePerfFlags()` is called
- **THEN** it MUST return all 8 `ccgui.perf.*` flags
- **AND** each entry MUST include `value`, `source`, `storageKey`, `defaultValue`, `testDefaultValue`, and `metric`

#### Scenario: operator resets perf flags

- **WHEN** `resetRealtimePerfFlags()` is called
- **THEN** every known `ccgui.perf.*` key MUST be removed from `localStorage`
- **AND** the in-memory cache MUST be cleared
- **AND** Settings MUST show a reload-required message rather than silently reloading

### Requirement: ClaudeSession MUST Release Child Processes On Drop

`ClaudeSession` MUST provide a non-blocking Drop fallback for any child process handles still present in `active_processes`.

#### Scenario: Drop drains remaining active children

- **WHEN** `Drop::drop` runs and `active_processes.try_lock()` succeeds
- **THEN** every remaining child handle MUST be drained
- **AND** `start_kill()` MUST be called best-effort without awaiting child exit

#### Scenario: active process diagnostics are webview-callable

- **WHEN** `get_engine_active_process_diagnostics` is invoked in local mode
- **THEN** the response MUST include Claude workspace ids and active process ids
- **AND** it MUST include a total active process count and a timestamp

#### Scenario: remote mode diagnostics do not break UI

- **WHEN** `get_engine_active_process_diagnostics` is invoked in remote backend mode
- **THEN** the response MUST succeed with `measured=false`
- **AND** it MUST include an `unsupportedReason` explaining that active process diagnostics are local-runtime only
