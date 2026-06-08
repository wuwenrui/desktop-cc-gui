# Spec: project-xray-panel (Relationship Dashboard)

## 中文导读

这个规格把 Project Map 关系相关交互规范化：按钮、扫描状态、selected 邻域、过滤搜索、热点、impact、stale、repair 都要标准化。
目标是让用户每次看到的关系都有来源、可回溯、可执行性。

## ADDED Requirements

### Requirement: Project Map exposes scan action
The `Project Map` panel SHALL expose a relationship scan action for the active workspace.

#### Scenario: scan action exists
- **WHEN** the panel is opened with active workspace
- **THEN** the UI SHALL show a `Scan Relationships` action
- **AND** action language can be localized

#### Scenario: no active workspace
- **WHEN** no workspace is selected
- **THEN** scan action SHALL be disabled with a reason message and direct guidance

### Requirement: scan execution visibility
UI SHALL provide explicit run-state during scanning.

#### Scenario: scan starts
- **WHEN** scan is triggered
- **THEN** panel SHALL show running state, phase, and estimated file count

#### Scenario: large scan confirmation
- **WHEN** scope exceeds threshold
- **THEN** user SHALL confirm before execution
- **AND** estimated ignored files shall be shown

#### Scenario: scan succeeds
- **WHEN** backend returns success
- **THEN** dashboard SHALL refresh summary and selected-state data atomically

#### Scenario: scan fails
- **WHEN** scan returns failure
- **THEN** error message SHALL distinguish `path`, `permission`, `parser`, `storage`, `cancelled`

### Requirement: file neighborhood rendering
Selected file neighborhood SHALL show deterministic relations.

#### Scenario: selected file has neighbors
- **WHEN** user selects a scanned file
- **THEN** outgoing and incoming links SHALL display grouped by relation type
- **AND** each relation SHALL expose evidence source and evidence location

#### Scenario: selected file has no neighbors
- **WHEN** selected file has no known relation
- **THEN** UI SHALL show explicit empty-state text and suggestion to rescan or inspect ignore scope

### Requirement: relationship scan dashboard remains visually isolated
The scanned relationship dashboard SHALL remain visually and behaviorally separate from the existing Project Map semantic graph.

#### Scenario: scan data is available
- **WHEN** latest relationship scan artifacts contain files and relations
- **THEN** the panel SHALL render them in a dedicated scan snapshot dashboard
- **AND** it SHALL NOT automatically inject scanned edges into the Project Map canvas, hierarchy relation index, or semantic dataset
- **AND** existing Project Map semantic relations SHALL remain visually isolated from the scan snapshot

#### Scenario: large relationship set
- **WHEN** relation count is large
- **THEN** UI SHALL render capped lists, indexed summaries, or virtualized surfaces
- **AND** it SHALL NOT force all relationship edges into the graph layout by default

#### Scenario: semantic graph relation section is available
- **WHEN** scan snapshot and semantic graph relations are both shown
- **THEN** they SHALL use separate investigation entries instead of one vertically stacked relation view
- **AND** the scan snapshot SHALL keep independent filters and selection state

#### Scenario: file relationship entry is selected
- **WHEN** the user selects `File Relations`
- **THEN** the UI SHALL show deterministic scan snapshot content from `project-map-relations`
- **AND** it SHALL NOT render existing Project Map semantic relation filters in the same view

#### Scenario: inspect relations entry is selected
- **WHEN** the user selects `Inspect Relations`
- **THEN** the UI SHALL show existing Project Map semantic graph relations
- **AND** it SHALL NOT render scan snapshot dashboard content in the same view

### Requirement: relationship dashboard supports multiple views
The relationship dashboard SHALL support multiple complementary views over the same scan snapshot.

#### Scenario: default board view
- **WHEN** scan data is available
- **THEN** dashboard SHALL provide a board-style file tile view grouped by role or node type
- **AND** each tile SHOULD show file identity, role, language, and relation density

#### Scenario: analyst switches view
- **WHEN** user switches between board, list, and neighborhood views
- **THEN** filters and selected file context SHALL remain stable
- **AND** the system SHALL NOT trigger a new scan or mutate the semantic Project Map graph

### Requirement: relationship filtering and search
The panel SHALL support query and filtering.

#### Scenario: search
- **WHEN** user types query
- **THEN** files are filtered by path/module/role and focusable in the list

#### Scenario: relation type filter
- **WHEN** user selects one or more relation types
- **THEN** only matching relations are rendered

### Requirement: module and hotspot insight
The panel SHALL expose module summary and hotspot ranking.

#### Scenario: module summary
- **WHEN** modules are available
- **THEN** each module SHALL show file count, relation density, cross-module count, stale flag

#### Scenario: hotspot
- **WHEN** candidate has high risk score
- **THEN** it SHALL appear in hotspot list with reason (`many-dependents`, `cross-layer-hub`, `missing-test`, `stale`, `large-file`)

### Requirement: impact overlay from changes
The panel SHALL compute and show impact for changed files.

#### Scenario: explicit changed files
- **WHEN** explicit changed files are passed
- **THEN** they take precedence over git-derived changes

#### Scenario: unmapped changed files
- **WHEN** changed file is absent from latest scan
- **THEN** it SHALL be listed as unmapped with remediation hint

#### Scenario: impact summary card is shown
- **WHEN** impact artifact is available
- **THEN** UI SHALL show changed, direct, transitive, unmapped, and risk flag counts as capped summary
- **AND** it SHALL NOT render impacted edges directly on the main Project Map canvas

### Requirement: stale and repair visibility
The panel SHALL surface stale reasons and repair summaries.

#### Scenario: stale by git/fingerprint
- **WHEN** stale is detected
- **THEN** banner SHALL indicate stale reason and refresh mode

#### Scenario: repair exists
- **WHEN** repair summary has entries
- **THEN** user sees issue count and severity by type

### Requirement: UA-style actions over Project Map relationship substrate
The panel SHALL provide actions corresponding to explain/diff/onboard/chat/domain without schema coupling.

#### Scenario: explain selected file
- **WHEN** user triggers explain
- **THEN** an explain pack is assembled from neighborhood relations

#### Scenario: diff view
- **WHEN** diff impact is requested
- **THEN** changed and affected files are surfaced with relation paths

#### Scenario: guided read tour
- **WHEN** enough context exists
- **THEN** system can propose guided read order

## Non-goals for this spec

- No browser automation control in this panel.
- No automatic mutation from panel actions.


## 中文+English 术语对照（UI Glossary）

- scan state / 扫描状态
- progress / 进度
- neighborhood / 邻域
- filter / 过滤
- module summary / 模块摘要
- hotspot / 风险热点
- impact overlay / 影响叠加层
- repair summary / 修复摘要
- explanation pack / 解释包
