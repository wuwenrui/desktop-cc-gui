## ADDED Requirements

### Requirement: Windows AskUserQuestion Resume MUST Expose Termination And Spawn Outcomes

The Claude runtime MUST make Windows AskUserQuestion kill-and-resume transitions observable and failure-safe.

#### Scenario: successful Windows parent termination is recorded

- **WHEN** AskUserQuestion resume attempts to terminate the current Claude child process on Windows
- **AND** process-tree termination succeeds
- **THEN** runtime diagnostics MUST record the terminated PID or equivalent process identity
- **AND** runtime MUST proceed to resume spawn with the submitted answer

#### Scenario: Windows parent termination failure is diagnosable

- **WHEN** AskUserQuestion resume attempts to terminate the current Claude child process on Windows
- **AND** `taskkill` or equivalent process-tree termination fails
- **THEN** runtime MUST record the failure status and PID context
- **AND** runtime MUST surface a terminal or recoverable error instead of silently treating the submit as fully resumed

#### Scenario: missing session id blocks resume explicitly

- **WHEN** AskUserQuestion answer has been accepted
- **AND** no Claude `session_id` is available for `--resume`
- **THEN** runtime MUST record a missing-session diagnostic for the turn
- **AND** runtime MUST NOT silently discard the submitted answer

#### Scenario: resume spawn failure includes command wrapper evidence

- **WHEN** AskUserQuestion resume starts a new Claude process
- **AND** spawn fails before stdout can be read
- **THEN** runtime MUST include resolved binary path and wrapper kind in diagnostics
- **AND** runtime MUST emit a failure signal suitable for clearing ambiguous processing state
