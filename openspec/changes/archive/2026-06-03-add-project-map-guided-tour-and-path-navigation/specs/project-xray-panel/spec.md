## ADDED Requirements

### Requirement: Project Map guided tour navigation
The Project X-Ray panel SHALL allow users to follow guided Project Map tour steps and focus the nodes referenced by each step.

#### Scenario: User starts a guided tour
- **WHEN** a guided tour is available and the user starts it
- **THEN** Project Map focuses the first step nodes and shows step title, summary, and navigation controls

### Requirement: Project Map path finder
The Project X-Ray panel SHALL allow users to find an available path between two Project Map nodes using hierarchy and relation data.

#### Scenario: Path exists between two nodes
- **WHEN** the user selects a source and target node with a discoverable path
- **THEN** Project Map displays the ordered path and highlights the path nodes

#### Scenario: No path exists between two nodes
- **WHEN** the user selects two nodes without a discoverable path
- **THEN** Project Map displays a clear no-path result
