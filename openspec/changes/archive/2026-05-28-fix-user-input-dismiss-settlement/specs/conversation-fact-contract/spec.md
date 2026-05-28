## MODIFIED Requirements

### Requirement: request_user_input MUST Have A Settled Lifecycle

`request_user_input` facts MUST use an explicit lifecycle and settled requests MUST NOT block later conversation turns.

#### Scenario: active request remains pending until user or system settlement

- **WHEN** an agent asks for user input and the request is still actionable
- **THEN** the request MUST be represented as pending
- **AND** the message surface MAY show the interactive request card

#### Scenario: submitted request stops blocking input

- **WHEN** the user submits a response to `request_user_input`
- **THEN** the request MUST transition to submitted
- **AND** it MUST NOT continue blocking Composer or later sends

#### Scenario: timeout request stops blocking input

- **WHEN** a pending `request_user_input` expires
- **THEN** the request MUST transition to timeout or stale
- **AND** it MUST NOT continue blocking Composer or later sends

#### Scenario: explicit dismissed request settles through the response channel

- **WHEN** the user explicitly skips or dismisses an actionable request card as a runtime action
- **THEN** the request MUST transition to dismissed or cancelled through a runtime-visible settlement path
- **AND** the settlement MUST NOT be only a local presentation hide
- **AND** it MUST NOT continue blocking Composer or later sends

#### Scenario: local collapse does not settle request facts

- **WHEN** the user only collapses or hides an actionable request card
- **THEN** the request MAY be collapsed from the full card surface
- **AND** the UI MUST keep an actionable surface available to expand or settle the request
- **AND** the request MUST remain pending from the runtime fact perspective
- **AND** the local collapse MUST NOT be represented as submitted, dismissed, or cancelled

#### Scenario: stale dismissed request preserves transcript evidence

- **WHEN** the user dismisses a stale or obsolete request card
- **THEN** the request MUST transition to dismissed
- **AND** dismissing it MUST NOT delete durable transcript facts that already occurred

#### Scenario: cancelled request is settled

- **WHEN** runtime cancellation or turn termination cancels a pending request
- **THEN** the request MUST transition to cancelled
- **AND** it MUST NOT remain as an actionable request card

#### Scenario: settled request does not rehydrate as actionable

- **WHEN** history hydration, resume, or snapshot replay sees a request that was already submitted, dismissed, cancelled, timeout, or stale
- **THEN** the request MUST NOT be reintroduced as an actionable pending card
- **AND** any transcript evidence for the original request MAY remain visible as non-actionable history
