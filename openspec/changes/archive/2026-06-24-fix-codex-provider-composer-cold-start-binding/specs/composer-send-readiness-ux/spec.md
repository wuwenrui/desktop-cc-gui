## ADDED Requirements

### Requirement: Create Session Loading MUST Fail Visibly After Bounded Wait

The create-session loading overlay MUST be bounded by a client-side timeout so initialization failure or missing first text does not leave the client indefinitely blocked.

#### Scenario: session creation exceeds client wait budget

- **WHEN** a create-session action remains unresolved longer than the configured client wait budget
- **THEN** the loading overlay MUST close
- **AND** the action MUST reject with a diagnosable timeout error that identifies session creation as the failed operation

#### Scenario: session creation completes before timeout

- **WHEN** a create-session action resolves before the client wait budget
- **THEN** the loading overlay MUST close normally
- **AND** the normal success result MUST be returned unchanged

#### Scenario: session creation fails before timeout

- **WHEN** a create-session action rejects before the client wait budget
- **THEN** the loading overlay MUST close
- **AND** the original failure MUST remain visible to the existing error handling path
