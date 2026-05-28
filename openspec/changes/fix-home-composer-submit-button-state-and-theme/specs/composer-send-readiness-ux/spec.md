## MODIFIED Requirements

### Requirement: Composer MUST Derive Send Readiness Through A View Model

Composer MUST derive user-visible send readiness through a dedicated view model or equivalent pure selector layer instead of scattering readiness decisions across presentation components.

#### Scenario: readiness view model includes target context and activity

- **WHEN** Composer renders an input area for a thread
- **THEN** the system MUST derive a readiness view model containing target, context summary, readiness, activity, and explainability fields
- **AND** presentation components SHOULD consume that view model rather than recomputing engine, model, mode, queue, or disabled semantics independently

#### Scenario: view model consumes runtime and conversation truth without redefining it

- **WHEN** runtime recovery, modeBlocked, request_user_input, or queue state affects sending
- **THEN** Composer readiness MUST consume the already-classified state from runtime, conversation, or queue layers
- **AND** it MUST NOT independently parse provider payload, settle request_user_input, or initiate stale-thread recovery

#### Scenario: plain text input enables primary send action

- **WHEN** the editable composer contains non-empty plain text
- **AND** no runtime, mode, or configuration blocker is active
- **THEN** the primary send button MUST become enabled immediately after the input event is observed
- **AND** the component MUST NOT wait for an unrelated blur, submit, or theme update before reflecting readiness

#### Scenario: unknown state degrades conservatively

- **WHEN** Composer cannot confidently determine a readiness dimension
- **THEN** it MUST degrade to a conservative label such as loading, unknown, blocked, or unavailable
- **AND** it MUST NOT present unsupported send, queue, fuse, or recovery actions as available
