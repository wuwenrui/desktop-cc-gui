## ADDED Requirements

### Requirement: Runtime Reconnect Card State MUST Not Reset From Referentially New Equivalent Props

The conversation runtime recovery surface SHALL preserve user-visible recovery outcome state across parent rerenders when the runtime error, workspace, thread, and retry payload semantics have not changed.

#### Scenario: recover callback returns failed identity result
- **WHEN** a user clicks runtime reconnect from a conversation message
- **AND** `ensureRuntimeReady` succeeds
- **AND** the thread recovery callback returns null or a failed recovery result
- **THEN** the reconnect card MUST show the runtime failure label and recover-specific detail
- **AND** the failure state MUST NOT be cleared by a parent rerender that passes a referentially new but semantically identical retry message object

#### Scenario: retry prompt genuinely changes
- **WHEN** the reconnect card is still mounted
- **AND** the raw runtime error, workspace id, thread id, retry prompt text, or retry prompt images change
- **THEN** the card MAY reset local action status to idle for the new recovery context

### Requirement: Runtime Reconnect Tests MUST Model Effect-Phase Render Reports

Focused conversation reconnect tests SHALL model Markdown rendered-value notifications after render commit rather than during React render.

#### Scenario: Markdown mock reports rendered value
- **WHEN** a reconnect test replaces the Markdown component with a test double
- **THEN** the test double MUST call `onRenderedValueChange` from an effect or equivalent post-render phase
- **AND** it MUST NOT call parent state-updating callbacks during render
