## ADDED Requirements

### Requirement: Windows AskUserQuestion Resume Churn MUST Be Diagnosable

Windows runtime churn diagnostics MUST capture AskUserQuestion resume attempts from accepted answer through terminal resume outcome.

#### Scenario: accepted answer starts resume-pending evidence

- **WHEN** a Windows Claude AskUserQuestion answer is accepted by request id
- **THEN** runtime diagnostics MUST record a resume-pending event for the target thread or turn
- **AND** the event MUST include source `ask-user-question-resume` or equivalent source attribution

#### Scenario: first valid resume event clears resume-pending evidence

- **WHEN** a resumed Claude process emits the first valid stream event after AskUserQuestion answer submission
- **THEN** runtime diagnostics MUST clear or settle the AskUserQuestion resume-pending marker
- **AND** operators MUST be able to distinguish successful resume from timeout or spawn failure

#### Scenario: resume timeout or spawn failure remains queryable

- **WHEN** Windows AskUserQuestion resume fails to spawn or fails to produce a valid event within the bounded resume window
- **THEN** runtime diagnostics MUST retain a bounded failure record
- **AND** the record MUST include wrapper kind, resume source, and failure category when available
