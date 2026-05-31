## MODIFIED Requirements

### Requirement: Engine Doctor MUST Explain Environment Drift

系统 MUST return structured diagnosis when an executable exists in one environment but is invisible to the GUI runtime.

#### Scenario: engine switch refreshes stale Codex availability before failing

- **WHEN** user switches the active engine to Codex
- **AND** cached engine status says Codex is unavailable or missing
- **THEN** UI MUST perform a fresh engine detection before reporting switch failure
- **AND** if refreshed detection shows Codex installed, the switch MUST proceed without requiring user restart

#### Scenario: Codex switch failure includes doctor evidence

- **WHEN** user switches the active engine to Codex
- **AND** fresh detection still says Codex is unavailable
- **THEN** UI MUST run Codex doctor or equivalent diagnostic path
- **AND** debug/error evidence MUST include structured fields such as `doctorOk`, `environmentDiagnosis`, `resolvedBinaryPath`, and `pathEnvUsed`
- **AND** UI MUST NOT emit only the generic `Engine codex is not installed` message when doctor evidence is available
