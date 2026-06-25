## ADDED Requirements

### Requirement: AppShell MUST Compose Shell And Canvas Through Separate Runtime Boundaries
AppShell runtime boundaries SHALL distinguish Shell control node construction from Conversation Canvas content node construction.

#### Scenario: Shell boundary consumes narrow summaries
- **WHEN** AppShell composes sidebar, topbar session tabs, right-panel controls, and Composer control affordances
- **THEN** those nodes MUST be built from narrow typed summaries and stable callbacks
- **AND** they MUST NOT require full active conversation items, hidden panel datasets, or canvas render projections

#### Scenario: Canvas boundary consumes active conversation content
- **WHEN** AppShell composes the active conversation surface
- **THEN** full active thread items, conversation state, timeline projection inputs, task-run conversation surfaces, and canvas render diagnostics MUST stay inside the canvas boundary
- **AND** layout components MUST receive the resulting `canvasNode`/`messagesNode` rather than the full set of canvas data dependencies

#### Scenario: Boundary migration preserves layout API compatibility
- **WHEN** the shell/canvas boundary is introduced
- **THEN** existing desktop/tablet/phone layout components MAY keep their public node slots
- **AND** the migration MUST NOT require rewriting all layout surfaces in the same change
