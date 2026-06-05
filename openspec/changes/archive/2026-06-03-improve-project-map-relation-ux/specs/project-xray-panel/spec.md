## ADDED Requirements

### Requirement: Project Map SHALL Expose Relation Inspector

Project Map SHALL expose typed relations as inspectable read-only graph evidence instead of only using them for background context or path finding.

#### Scenario: selected node shows incoming and outgoing relations

- **WHEN** a user selects a Project Map node and the dataset contains relations for that node
- **THEN** Project Map SHALL show outgoing relations from that node
- **AND** Project Map SHALL show incoming relations to that node
- **AND** each relation item SHALL identify the other endpoint when available

#### Scenario: relation item shows explainable metadata

- **WHEN** Project Map renders a relation item
- **THEN** the item SHALL show relation type
- **AND** the item SHALL show source kind or degraded source state when available
- **AND** the item SHALL expose confidence, stale, or degraded markers when available

#### Scenario: relation endpoint can be focused

- **WHEN** user activates an available source or target endpoint from a relation item
- **THEN** Project Map SHALL focus or select that endpoint node
- **AND** if the endpoint is missing, the UI SHALL show an explainable missing-endpoint state

### Requirement: Project Map SHALL Provide Relation Filters And Legend

Project Map SHALL allow users to control relation visibility and graph density without mutating persisted relations.

#### Scenario: user filters relations by type or source kind

- **WHEN** user applies a relation type or source-kind filter
- **THEN** Project Map SHALL update visible or highlighted relations according to the filter
- **AND** the underlying relation records SHALL remain unchanged

#### Scenario: relation legend displays visible relation counts

- **WHEN** relations are available in the current dataset
- **THEN** Project Map SHALL show a legend or equivalent summary of visible relation types and counts
- **AND** sparse or absent relations SHALL render a clear empty state

#### Scenario: path finder labels relation-backed path segments

- **WHEN** Path Finder returns a path segment backed by a typed relation
- **THEN** the segment SHALL expose relation type and source kind when available
- **AND** hierarchy fallback segments SHALL be distinguishable from typed relation segments

#### Scenario: legacy datasets without relations remain usable

- **WHEN** a Project Map dataset has no persisted relation records
- **THEN** Project Map SHALL continue rendering graph, inspector, search, tour, and path UI without crashing
- **AND** relation controls SHALL show empty or unavailable states rather than errors
