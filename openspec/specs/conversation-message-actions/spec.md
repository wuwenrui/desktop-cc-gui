# conversation-message-actions Specification

## Purpose
TBD - created by archiving change refine-conversation-message-copy-actions. Update Purpose after archive.
## Requirements
### Requirement: Assistant Turn Copy Action SHALL Be Final-Row Scoped
The conversation canvas SHALL expose one assistant turn copy affordance on the final assistant message row for a completed assistant turn. Non-final assistant message segments SHALL NOT render their own assistant tail copy affordance.

#### Scenario: segmented assistant turn renders one assistant tail copy action
- **WHEN** one user request produces multiple assistant message segments
- **AND** the last assistant segment is marked final
- **THEN** the conversation canvas SHALL render the assistant tail copy affordance only on the final assistant segment
- **AND** earlier non-final assistant segments SHALL NOT render assistant tail copy affordances

#### Scenario: user message copy remains available
- **WHEN** a user message is visible in the conversation canvas
- **THEN** the user message copy affordance SHALL remain available according to the existing user message rules
- **AND** assistant final-row copy scoping SHALL NOT remove user copy behavior

### Requirement: Assistant Turn Copy Payload SHALL Aggregate Assistant Text Segments
The final assistant copy action SHALL copy the assistant text segments for the current assistant turn in display order. The aggregation boundary SHALL begin after the latest user message and end at the final assistant message row whose copy action was activated.

#### Scenario: final copy includes preceding assistant segments
- **WHEN** an assistant turn contains one or more non-final assistant text segments followed by a final assistant message
- **AND** the user activates the final assistant copy action
- **THEN** the copied text SHALL include all assistant text segments for that turn in order
- **AND** the copied text SHALL NOT be limited to only the final assistant segment

#### Scenario: non-assistant rows do not enter copy payload
- **WHEN** reasoning, tool, approval, image, or other non-message rows appear between assistant text segments
- **THEN** the assistant turn copy payload SHALL include assistant message text only
- **AND** non-assistant row payloads SHALL NOT be inserted into the assistant turn copy text

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

