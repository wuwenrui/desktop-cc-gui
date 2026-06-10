## ADDED Requirements

### Requirement: AskUserQuestion Submitted Answer MUST Remain Recoverable Until Runtime Resume Settles

The system MUST distinguish local AskUserQuestion answer acceptance from successful Claude runtime resume, so a Windows resume failure does not silently lose the user's answer or leave the thread in ambiguous processing state.

#### Scenario: accepted answer records submitted evidence before resume settles

- **WHEN** a user submits an answer for a Claude `AskUserQuestion` card
- **AND** the backend accepts the response for a matching request id
- **THEN** the conversation MUST retain submitted-answer evidence for that request
- **AND** the system MUST NOT depend on successful Claude resume before preserving the submitted answer

#### Scenario: runtime resume failure is recoverable

- **WHEN** an AskUserQuestion answer is accepted
- **AND** Windows Claude parent termination, session id lookup, or resume process spawn fails
- **THEN** the user-visible thread MUST receive a recoverable runtime failure signal or equivalent diagnostic
- **AND** the thread MUST NOT remain indefinitely in pseudo-processing solely because the local submit succeeded

#### Scenario: non-stale submit failure keeps retry path

- **WHEN** AskUserQuestion answer submission fails before backend acceptance
- **THEN** the pending question card MUST remain retryable
- **AND** the system MUST NOT create submitted-answer evidence for an answer that was not accepted
