## ADDED Requirements

### Requirement: Phase 2a Reconciliation MUST Use Scoped Backend Status Without Cleanup

Phase 2a lifecycle reconciliation MUST query backend/runtime status when terminal evidence is missing and progress is stale, and MUST keep all side effects disabled.

#### Scenario: reconciliation query starts from pure helper decision

- **WHEN** `evaluateTurnSettlement` returns `request-reconciliation`
- **THEN** the frontend MUST issue at most one in-flight status query for the same workspace, engine, thread, turn, and runtime scope
- **AND** it MUST include the current lifecycle scope in the request

#### Scenario: terminal status is diagnostic-only in Phase 2a

- **WHEN** the status query returns a scoped terminal status such as `runtime-ended`, `failed`, `stalled`, or `completed`
- **THEN** the frontend MUST convert it to Terminal Evidence candidate and re-run the pure helper
- **AND** Phase 2a MUST only emit diagnostics
- **AND** it MUST NOT clear processing state, active turn id, messages, blockers, runtime leases, or history

#### Scenario: running status protects active work

- **WHEN** the status query returns scoped `running`
- **THEN** the frontend MUST keep the turn active
- **AND** it MUST emit a bounded resolved diagnostic

#### Scenario: unknown status does not complete

- **WHEN** the status query returns `unknown`, `query-failed`, lacks required scope, or fails frontend scope validation
- **THEN** the frontend MUST defer settlement
- **AND** it MUST NOT mark the turn completed
