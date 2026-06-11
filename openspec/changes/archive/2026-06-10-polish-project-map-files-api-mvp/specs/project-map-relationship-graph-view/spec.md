## ADDED Requirements

### Requirement: Relationship Graph panes are user-resizable
The Relationship Graph view SHALL let users resize the left Files pane and right Inspector pane without changing the graph projection, pan, zoom, or edge/node data.

#### Scenario: User resizes the Files pane
- **WHEN** the user drags the boundary between Files and the graph canvas
- **THEN** the Files pane width changes
- **AND** the graph canvas keeps the remaining available width.

#### Scenario: User resizes the Inspector pane
- **WHEN** the user drags the boundary between Inspector and the graph canvas
- **THEN** the Inspector pane width changes
- **AND** the graph canvas keeps the remaining available width.

#### Scenario: Focused Graph layout is active
- **WHEN** the file-relations-focused Graph layout applies its override styles
- **THEN** those overrides still use the same pane width variables
- **AND** resizing remains visible to the user.

### Requirement: Relationship Graph node basename remains readable
The Relationship Graph view SHALL treat the file basename as primary node content and SHOULD avoid hiding it behind avoidable ellipsis while keeping secondary metadata compact.

#### Scenario: Node basename is long
- **WHEN** a graph node represents a file with a long basename
- **THEN** the basename can wrap within the node title area
- **AND** secondary metadata such as language, layer, and relation counts may remain single-line and truncated.
