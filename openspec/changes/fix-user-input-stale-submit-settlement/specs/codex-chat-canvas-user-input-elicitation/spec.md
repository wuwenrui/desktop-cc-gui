## ADDED Requirements

### Requirement: Timed-Out User Input Settlement Releases Stale Cards

The system MUST treat a user action against a locally timed-out `AskUserQuestion` / `RequestUserInput` card as stale settlement when runtime reports that the request is no longer actionable.

#### Scenario: timed-out submit returns stale runtime error
- **WHEN** a visible user-input card has reached `0:00`
- **AND** the user clicks Submit with selected answers
- **AND** runtime response indicates the request is unknown, stale, timeout-settled, cancelled, or workspace disconnected
- **THEN** the client MUST remove the request from the pending queue
- **AND** the client MUST clear optimistic processing residue for that thread
- **AND** the client MUST NOT show the stale response as a fatal submit failure
- **AND** the client MUST NOT insert a submitted-answer history item for the stale response

#### Scenario: timed-out skip returns stale runtime error
- **WHEN** a visible or collapsed user-input card has reached `0:00`
- **AND** the user clicks Skip / dismiss
- **AND** runtime response indicates the request is unknown, stale, timeout-settled, cancelled, or workspace disconnected
- **THEN** the client MUST remove the request from the pending queue
- **AND** the client MUST NOT show the stale response as a fatal submit failure

#### Scenario: ordinary submit failure remains retryable
- **WHEN** the user submits a user-input card
- **AND** runtime response fails without stale / timeout settlement evidence
- **THEN** the client MUST keep the request visible
- **AND** the user MUST be able to retry submission
