## ADDED Requirements

### Requirement: History Sticky Header MUST Not Obscure Lightweight Mode Chrome

History sticky user-question pinning MUST remain presentation-only and MUST NOT cover the lightweight mode chrome shown above the timeline.

#### Scenario: sticky header appears below compact lightweight mode bar

- **WHEN** a completed history conversation renders the lightweight mode bar
- **AND** the history sticky header is active
- **THEN** the sticky header MUST remain visually separate from the lightweight mode bar
- **AND** the lightweight mode bar actions MUST remain readable and clickable

#### Scenario: sticky header does not cover the original user card

- **WHEN** a completed history conversation is scrolled near an ordinary user message
- **AND** that original user message card is still visible at the top boundary
- **THEN** the sticky header MUST NOT render over that original card
- **AND** the sticky header MAY become active after the original user card has scrolled out of the top boundary

#### Scenario: virtualized transformed history row stays unpinned while visible

- **WHEN** a completed history conversation is virtualized
- **AND** a history user message row is positioned with virtualizer `transform`
- **AND** the message card's viewport rect still intersects the messages viewport
- **THEN** the history sticky header MUST NOT pin that same user message
- **AND** the implementation MUST NOT rely only on `offsetTop` for this visibility decision

#### Scenario: sticky header behavior remains scoped to timeline content

- **WHEN** the lightweight mode bar is not present
- **THEN** the history sticky header MUST keep its existing condensed pinned-header behavior
- **AND** the implementation MUST NOT change sticky candidate selection or message data contracts
