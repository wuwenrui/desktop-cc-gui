## ADDED Requirements

### Requirement: Project Map node explain pack
The Project X-Ray panel SHALL allow users to inspect a Project Map node through an explain pack that includes the selected node, evidence, related nodes, confidence/stale risk indicators, and related artifacts without requiring a full map regeneration.

#### Scenario: Selected node exposes explain context
- **WHEN** a user selects a Project Map node that has evidence and related nodes
- **THEN** the panel displays an explain pack or explain action containing the node summary, evidence sources, related nodes, confidence/stale indicators, and related artifacts

#### Scenario: Legacy dataset without relations still explains node
- **WHEN** a user selects a Project Map node from a dataset that has no relation graph
- **THEN** the panel still builds the explain pack from existing children, parent, sources, and related artifacts

### Requirement: Project Map impact overlay
The Project X-Ray panel SHALL support an impact view that distinguishes directly changed nodes, affected nodes, affected lenses, unmapped changed files, and risk summary when changed file paths are provided.

#### Scenario: Changed files map to Project Map nodes
- **WHEN** changed file paths match Project Map node sources or file references
- **THEN** the panel marks those nodes as directly changed and shows related affected nodes when relationships or hierarchy indicate an impact

#### Scenario: Changed files are not mapped
- **WHEN** one or more changed file paths cannot be mapped to Project Map nodes
- **THEN** the panel reports those files as unmapped instead of silently ignoring them
