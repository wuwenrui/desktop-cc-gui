# conversation-message-actions Specification Delta

## MODIFIED Requirements

### Requirement: Message Action Refinement SHALL Preserve Streaming And Runtime Contracts
Assistant copy action placement SHALL be a render-surface concern and SHALL NOT change streaming item emission, message persistence, Markdown rendering, fork, or rewind semantics.

#### Scenario: streaming rows remain segmented
- **WHEN** assistant text arrives as segmented streaming or reconciliation rows
- **THEN** the conversation canvas SHALL keep rendering those rows according to the existing streaming render contract
- **AND** copy action scoping SHALL NOT require merging assistant items before rendering

#### Scenario: latest final assistant actions remain intact
- **WHEN** the latest final assistant reply has fork or rewind callbacks available
- **THEN** fork and rewind actions SHALL continue to render only for that latest final assistant reply
- **AND** assistant copy action scoping SHALL NOT change their target user message

#### Scenario: message-tail fork does not mutate workspace files
- **WHEN** the user confirms a message-tail Fork from the conversation canvas
- **AND** the Fork targets a Claude or Codex history message
- **THEN** the Fork operation MUST run as a messages-only session fork
- **AND** it MUST NOT restore, delete, revert, or overwrite workspace files
- **AND** Codex provider selection MUST only affect the child conversation provider binding
