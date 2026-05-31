## MODIFIED Requirements

### Requirement: Unified History MUST Degrade Gracefully

Failure in one source path MUST NOT collapse the entire Codex history list response.

#### Scenario: live thread/list fails but local aggregate succeeds

- **WHEN** active-source live `thread/list` request fails or times out
- **AND** local Codex session summaries for the workspace are available
- **THEN** system MUST still return local aggregated history entries
- **AND** response MUST indicate `partialSource = "live-thread-list-unavailable"` or equivalent live-source degradation for diagnostics
- **AND** the response MUST keep the existing thread/list result shape so frontend list hydration does not enter fatal error fallback solely due to the live failure

#### Scenario: live thread/list and local scan both fail

- **WHEN** live `thread/list` fails
- **AND** local session scan is unavailable or times out
- **THEN** system MAY return a degraded empty response instead of a fatal live timeout when the workspace itself is valid
- **AND** `partialSource = "local-session-scan-unavailable"` MUST take priority over live-source degradation so known-session continuity logic remains compatible

#### Scenario: daemon thread/list uses bounded local fallback

- **WHEN** daemon-mode `list_threads` receives `live thread/list timed out after 1500ms` or another live list failure
- **THEN** daemon MUST attempt local Codex session summary fallback with a bounded timeout
- **AND** daemon MUST return a degraded thread-list response when fallback can answer
- **AND** daemon MUST NOT expose the live timeout as a fatal `thread/list error` when a degraded local response can be produced
