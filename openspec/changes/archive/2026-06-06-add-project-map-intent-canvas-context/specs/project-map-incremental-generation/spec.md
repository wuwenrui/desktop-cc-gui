# Project Map Intent Canvas Context Delta

## ADDED Requirements

### Requirement: Intent Canvas conversation context

The system SHALL let users create a lightweight Project Map Intent Canvas and submit it as structured context to the current workspace conversation.

#### Scenario: User opens architect canvas from Project Map detail

- **WHEN** the user selects a Project Map node
- **AND** activates the architect canvas action
- **THEN** the system SHALL open an editable Intent Canvas
- **AND** the canvas SHALL allow adding nodes and connecting nodes
- **AND** the canvas SHALL NOT mutate the persisted Project Map dataset merely by opening or editing the canvas

#### Scenario: User opens spotlight canvas from selected node

- **WHEN** the user selects a Project Map node
- **AND** activates the spotlight canvas action
- **THEN** the system SHALL seed the Intent Canvas with the selected node as the central source node
- **AND** the submitted payload SHALL include that source node id, title, kind, and summary when available

#### Scenario: User submits canvas into the conversation

- **WHEN** the user submits an Intent Canvas
- **THEN** the system SHALL send the canvas mode, summary, nodes, edges, and source seed as structured text to the active workspace conversation
- **AND** if no active thread exists, the system MAY create a workspace thread before sending
- **AND** the message SHALL describe the canvas as user intent rather than persisted code fact

#### Scenario: Workspace or thread is unavailable

- **WHEN** the user submits an Intent Canvas
- **AND** the app cannot resolve an active workspace or create a target thread
- **THEN** the system SHALL show a readable error
- **AND** the canvas SHALL remain available for retry
