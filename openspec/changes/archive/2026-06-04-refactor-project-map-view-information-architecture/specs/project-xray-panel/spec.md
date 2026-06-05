## ADDED Requirements

### Requirement: Project Map SHALL Use Priority-Based View Information Architecture

Project Map SHALL organize its primary view around map understanding and current user focus instead of rendering all available tools as equal-weight always-expanded sections.

#### Scenario: default view shows primary map understanding first

- **WHEN** a user opens Project Map for a loaded workspace
- **THEN** the default view SHALL prioritize project/profile identity, current map or lens focus, health/risk summary, and primary navigation affordances
- **AND** raw utility controls, filters, diagnostics, and secondary investigation surfaces SHALL NOT visually dominate the first-read area
- **AND** existing navigation, evidence, relation, and repair summaries MAY remain visible only as compact intent affordances

#### Scenario: utility surfaces do not compete as default full peers

- **WHEN** Evidence Files, Relations, Tour, Path Finder, Impact Overlay, or Graph Repair capabilities are available
- **THEN** Project Map SHALL keep each capability reachable through a clear affordance
- **AND** Project Map SHALL NOT render Evidence Files and Relations as simultaneous large always-expanded peer sections in the default state unless the user has explicitly selected or expanded them
- **AND** mode expansion SHALL be driven by explicit user action or by an active contextual subject such as selected evidence file, selected relation, active path, active search, active tour, or active repair attention

#### Scenario: empty and sparse sections collapse into meaningful affordances

- **WHEN** a secondary Project Map section has no data or only sparse data
- **THEN** the view SHALL show a concise empty, unavailable, or count-based affordance
- **AND** the section SHALL NOT consume disproportionate vertical space merely to show absence of data

### Requirement: Project Map SHALL Separate Contextual Focus From Supporting Investigation Surfaces

Project Map SHALL make one contextual subject dominant at a time and keep evidence, relation, navigation, and diagnostic details as supporting surfaces unless the user selects them.

#### Scenario: selected node becomes the contextual focus

- **WHEN** a user selects a Project Map node
- **THEN** the selected node SHALL become the dominant contextual subject
- **AND** node explanation, local evidence summary, risk/confidence/stale state, and primary node actions SHALL be presented before unrelated global controls
- **AND** relation and evidence details MAY be summarized or collapsed until expanded

#### Scenario: selected evidence file becomes the contextual focus

- **WHEN** a user selects an Evidence Files entry
- **THEN** the selected file SHALL become the contextual subject
- **AND** related nodes and file-backed evidence refs SHALL be shown with node focus actions
- **AND** the graph MAY highlight related nodes without mutating Project Map semantic data

#### Scenario: selected relation becomes the contextual focus

- **WHEN** a user selects a Project Map relation
- **THEN** the selected relation SHALL become the contextual subject
- **AND** the view SHALL show source node, target node, relation type, source kind, confidence, stale or degraded markers, and available evidence refs
- **AND** endpoint navigation SHALL remain available when endpoints exist

### Requirement: Project Map SHALL Escalate Repair And Diagnostics Only When Attention Is Needed

Project Map SHALL treat graph repair and degraded diagnostics as health/attention signals rather than primary content in healthy or empty states.

#### Scenario: healthy graph keeps repair low noise

- **WHEN** graph integrity checks find no invalid records, dangling endpoints, repair candidates, or stale evidence requiring attention
- **THEN** Graph Repair SHALL render as a compact health cue or secondary affordance
- **AND** it SHALL NOT appear as a prominent warning-like block
- **AND** normal zero-issue state SHALL be visually distinguishable from repair-required state

#### Scenario: graph issues escalate repair visibility

- **WHEN** graph integrity checks find invalid records, dangling relation endpoints, repair candidates, or degraded evidence that requires user attention
- **THEN** Project Map SHALL escalate Graph Repair or diagnostics visibility with an explainable attention cue
- **AND** the cue SHALL identify the issue category and preserve access to the repair details
- **AND** the attention cue SHALL not require the user to inspect raw relation or evidence filters to understand that repair is needed

### Requirement: Project Map View State SHALL Remain Non-Mutating

Project Map SHALL keep information architecture state, section expansion, active mode, filters, and visual highlights separate from persisted semantic Project Map data.

#### Scenario: section and mode changes do not mutate semantic data

- **WHEN** a user switches Project Map mode, expands or collapses sections, filters relation visibility, focuses evidence, or highlights a path
- **THEN** Project Map SHALL update only view state
- **AND** persisted nodes, relations, evidence records, candidates, runs, and generated map facts SHALL remain unchanged
- **AND** existing node layout persistence SHALL remain limited to graph layout/pinning semantics rather than becoming a storage channel for semantic facts

#### Scenario: completed capabilities remain reachable after refactor

- **WHEN** the view information architecture refactor is applied
- **THEN** existing Project Map search, guided tour, path finder, impact overlay, evidence file reverse navigation, relation inspector, relation filters, and graph repair flows SHALL remain reachable
- **AND** legacy datasets without relations, evidence files, tour metadata, or repair candidates SHALL continue rendering usable fallback states
