## ADDED Requirements

### Requirement: Project Map SHALL Expose Evidence Files Explorer

Project Map SHALL provide an evidence-file explorer that groups file-backed evidence by workspace-relative file path and keeps non-file evidence explainable.

#### Scenario: file-backed evidence is grouped by file

- **WHEN** a loaded Project Map dataset contains node sources, related artifacts, relations, or governance links with workspace file paths
- **THEN** Project Map SHALL group those evidence references by normalized workspace-relative file path
- **AND** each file entry SHALL expose related node count and evidence count
- **AND** the grouping SHALL NOT mutate Project Map semantic data

#### Scenario: file entry shows related nodes

- **WHEN** user selects an evidence file entry
- **THEN** Project Map SHALL show the related nodes that reference that file
- **AND** each related node link SHALL expose enough label or id information to identify the node
- **AND** missing nodes SHALL render as degraded references rather than crashing the panel

#### Scenario: file entry can focus map nodes

- **WHEN** user activates a related node from the selected evidence file detail
- **THEN** Project Map SHALL focus or select that node in the graph when it still exists
- **AND** Project Map MAY highlight other nodes related to the same file
- **AND** the highlight SHALL be clearable without modifying the dataset

#### Scenario: evidence file can open in editor

- **WHEN** user activates a file-backed evidence entry with a concrete workspace path
- **THEN** the system SHALL route the open-file action through the existing Project Map evidence navigation path
- **AND** available line references SHALL be preserved as 1-based line targets
- **AND** unsupported or missing file refs SHALL show an explainable disabled/degraded state

#### Scenario: non-file evidence is not faked as a file link

- **WHEN** evidence contains only a hash, conversation id, task id, spec id, package name, or free-text label without a concrete workspace file path
- **THEN** Project Map SHALL keep that evidence in a non-file or degraded evidence bucket
- **AND** the UI SHALL NOT render it as a clickable file link

#### Scenario: evidence explorer remains read-only

- **WHEN** user browses, filters, highlights, focuses, or opens evidence from the Evidence Files explorer
- **THEN** Project Map SHALL NOT rewrite node content, relations, governance artifacts, source files, or provider artifacts
