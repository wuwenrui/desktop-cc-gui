## ADDED Requirements

### Requirement: Project Map inspector action hierarchy
The Project Knowledge Map inspector SHALL expose only high-value primary actions and SHALL NOT duplicate low-value refresh controls across the top bar and selected-node detail.

#### Scenario: Redundant refresh controls are removed
- **WHEN** the Project Knowledge Map panel renders with persisted or generated data
- **THEN** the top toolbar SHALL NOT show a standalone refresh-evidence button
- **AND** the selected-node inspector action row SHALL NOT show a duplicate refresh-evidence button
- **AND** the panel SHALL keep global Collect, Task queue, node Complete, and node Calibrate actions available when applicable

#### Scenario: Node evidence refresh remains reachable through calibration path
- **WHEN** a user needs fresher evidence for a selected node
- **THEN** the inspector SHALL present Calibrate as the primary node-level evidence update action
- **AND** the UI SHALL NOT force users to choose between two visually similar refresh and calibrate commands

### Requirement: Project Map candidate review affordance
The Project Knowledge Map SHALL explain candidate semantics and provide a visible path from the global candidate count to candidate nodes.

#### Scenario: Candidate badge navigates to candidate node
- **WHEN** at least one Project Map node is marked `candidate`
- **THEN** the top toolbar SHALL show an interactive candidate badge
- **AND** activating the badge SHALL select a candidate node
- **AND** the inspector SHALL be expanded for that node

#### Scenario: Candidate meaning is explained in inspector
- **WHEN** the selected node is marked `candidate`
- **THEN** the inspector SHALL show a candidate notice
- **AND** the notice SHALL explain that the node is an evidence-backed draft rather than a confirmed project fact
- **AND** the notice SHALL direct the user toward Calibrate or the future candidate confirmation workflow

#### Scenario: No candidate affordance is shown without candidates
- **WHEN** the Project Map contains zero candidate nodes
- **THEN** the top toolbar SHALL NOT show a candidate review badge
- **AND** no empty candidate review control SHALL occupy toolbar space

### Requirement: Project Map inspector readability
The expanded Project Knowledge Map inspector SHALL provide enough width for structured detail and evidence scanning.

#### Scenario: Expanded inspector is wider
- **WHEN** the Project Knowledge Map inspector is expanded on a desktop-width viewport
- **THEN** the inspector SHALL use a width approximately 1.5 times the previous narrow detail width
- **AND** core description, key facts, related artifacts, and evidence sources SHALL remain readable without excessive chip wrapping

#### Scenario: Collapsed inspector remains compact
- **WHEN** the Project Knowledge Map inspector is collapsed
- **THEN** the collapsed rail SHALL remain compact
- **AND** the expanded-width change SHALL NOT make the collapsed rail consume the graph canvas

### Requirement: Project Map drilldown navigation
The Project Knowledge Map SHALL provide a clear way to return to the previous graph view after drilling into a lower-level node.

#### Scenario: Previous view is available after drilldown
- **WHEN** a user drills into a selected node
- **THEN** the graph SHALL expose a visible Back to previous control
- **AND** the inspector SHALL expose the same previous-view action when expanded
- **AND** activating the control SHALL restore the last focus and selected node state

#### Scenario: Parent fallback is available without history
- **WHEN** the graph is in a focused lower-level view
- **AND** no previous-view history snapshot exists
- **THEN** the graph and inspector SHALL expose a visible parent-level return control
- **AND** activating the control SHALL return to the parent view or overview

#### Scenario: Overview reset clears previous-view history
- **WHEN** a user activates Back to overview
- **THEN** the graph SHALL return to the overview
- **AND** previous-view history SHALL be cleared so stale navigation does not reappear

### Requirement: Project Map compact non-overlapping layout
The Project Knowledge Map graph SHALL reduce excessive empty space between nodes while preserving non-overlap.

#### Scenario: Focused lower-level graph is compact
- **WHEN** a user drills into a node with visible neighbors
- **THEN** the focused nodes SHALL be placed closer to the selected node than the previous wide-radius layout
- **AND** graph node cards SHALL NOT overlap

#### Scenario: Crowded graph still avoids overlap
- **WHEN** overview or focused graph contains many visible nodes
- **THEN** the layout SHALL keep using collision resolution
- **AND** visible node cards SHALL remain mutually exclusive

### Requirement: Project Map grouped view controls
The Project Knowledge Map SHALL group related view-control buttons into compact horizontal button groups and SHALL avoid redundant bilingual helper text inside Chinese buttons.

#### Scenario: Canvas controls are grouped
- **WHEN** the Project Knowledge Map graph canvas renders
- **THEN** zoom out, reset view, zoom in, and available previous-view navigation SHALL render in one horizontal button group
- **AND** the previous-view control SHALL NOT wrap onto a separate row

#### Scenario: Inspector navigation controls are grouped
- **WHEN** the inspector exposes both previous-view and overview navigation
- **THEN** collapse detail, previous-view, and overview navigation SHALL render in one horizontal navigation button group
- **AND** the button labels in Chinese locale SHALL use concise Chinese action text without appended English helper words

### Requirement: Project Map evidence link UX
The Project Knowledge Map inspector SHALL render related artifacts and evidence sources as traceable link-style controls when source metadata provides a path, line, hash, or ref.

#### Scenario: File-like artifact renders as traceable control
- **WHEN** a related artifact or evidence source has type `file`, `test`, or `spec`
- **AND** it has a `path`
- **THEN** the inspector SHALL render it with link-style affordance
- **AND** the visible label SHALL include the artifact label and source type
- **AND** the control title or secondary text SHALL expose the path and line number when available

#### Scenario: Ref-like artifact renders with ref trace
- **WHEN** a related artifact or evidence source has type `symbol`, `commit`, or `conversation`
- **AND** it has a `ref`, `hash`, or `path`
- **THEN** the inspector SHALL render it with link-style affordance
- **AND** the visible or accessible text SHALL expose the trace identifier

#### Scenario: Evidence without trace remains read-only
- **WHEN** a related artifact or evidence source lacks path, ref, and hash metadata
- **THEN** the inspector SHALL render it as a read-only chip
- **AND** the UI SHALL NOT pretend the evidence is clickable

#### Scenario: Evidence excerpt is visible without overwhelming detail
- **WHEN** an evidence source includes an excerpt
- **THEN** the inspector SHALL expose a concise excerpt preview
- **AND** the preview SHALL remain visually subordinate to the source label and trace metadata
