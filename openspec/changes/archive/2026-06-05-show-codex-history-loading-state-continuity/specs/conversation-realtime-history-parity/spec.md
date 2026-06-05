## MODIFIED Requirements

### Requirement: Presentation State MUST Not Become Durable Transcript Fact

presentation-only state MUST remain outside durable transcript parity checks.

#### Scenario: history loading placeholder does not persist as message

- **WHEN** the UI shows a history loading, live placeholder, spinner, or scroll/sticky affordance
- **THEN** that state MUST be classified as presentation-state
- **AND** it MUST NOT become a durable transcript row after hydrate or reopen

#### Scenario: Codex history loading state is scoped presentation state

- **WHEN** the user selects an unloaded Codex history conversation and no visible items are available yet
- **THEN** the message surface MAY show a scoped restoring-history status instead of the generic empty-thread placeholder
- **AND** that status MUST clear when history restore settles or the selected thread changes
- **AND** the restoring-history status MUST NOT be persisted, replayed, or counted as a conversation item

#### Scenario: Markdown presentation convergence does not change fact identity

- **WHEN** live rendering uses throttled Markdown, staged Markdown, or plain-text fallback
- **THEN** completion MUST converge to final Markdown presentation
- **AND** the presentation strategy MUST NOT create extra dialogue facts
