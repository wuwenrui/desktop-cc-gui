## ADDED Requirements

### Requirement: Runtime Reconciliation Status Query MUST Be Conversation Scoped

Backend/runtime MUST expose a bounded status-query contract for three-evidence reconciliation.

#### Scenario: required scope is enforced

- **WHEN** a status query request lacks workspace id, engine, or thread id
- **THEN** backend/runtime MUST return `query-failed` or diagnostic-only `unknown`
- **AND** it MUST NOT infer completion

#### Scenario: active matching runtime work reports running

- **WHEN** runtime manager has active turn lease, stream lease, or foreground work matching the requested workspace, engine, thread, and turn when available
- **THEN** backend/runtime MUST return `running`
- **AND** it MUST echo the matched scope

#### Scenario: scoped runtime-ended context reports runtime-ended

- **WHEN** runtime manager has a recent runtime-ended context for the same workspace and engine
- **AND** the affected thread/turn scope matches the request
- **THEN** backend/runtime MAY return `runtime-ended`
- **AND** it MUST include a bounded reason and observed timestamp

#### Scenario: unscoped runtime failure remains unknown

- **WHEN** runtime manager has runtime failure or recovery context but cannot match the requested thread/turn
- **THEN** backend/runtime MUST return `unknown`
- **AND** it MUST NOT return `completed` or `runtime-ended` for the active turn
