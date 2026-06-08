# Project X-Ray Panel Specification

## Purpose

Project X-Ray / Project Knowledge Map provides a visual, evidence-backed project knowledge surface for navigating generated project-map nodes, inspecting node details, running AI-backed map generation, reviewing candidates, and adjusting graph view state without mutating semantic project-map data.
## Requirements
### Requirement: Project Knowledge Map tab entry

The system SHALL display a Project Knowledge Map entry in the right panel toolbar using a globe-style icon.

#### Scenario: Globe icon is visible
- **WHEN** a workspace is active and the right panel toolbar is visible
- **THEN** the toolbar SHALL include a Project Knowledge Map tab
- **AND** the tab SHALL use a globe-style lucide icon
- **AND** the tooltip SHALL support Chinese and English locales

#### Scenario: Opening the map
- **WHEN** the user clicks the Project Knowledge Map tab
- **THEN** the system SHALL switch the center area to the Project Knowledge Map panel
- **AND** other center content layers SHALL become inactive through the existing mutual-exclusion mechanism

### Requirement: Lightweight in-house graph rendering

The system SHALL render the Project Knowledge Map graph using a lightweight in-house SVG/HTML renderer for the initial release.

#### Scenario: Node body drag works independent of visible edges

- **WHEN** a visible Project Map graph node receives pointer capture from a drag that starts on the node body
- **THEN** pointer move and pointer end events delivered to the node body SHALL update the drag preview and persist the pinned node position
- **AND** this SHALL work regardless of whether the node has a visible SVG edge line in the current graph view
- **AND** nested node action buttons SHALL NOT start node drag

#### Scenario: Root node is visually distinguished

- **WHEN** the Project Map overview graph is rendered
- **THEN** the root node SHALL use a visual treatment that is stronger than ordinary and hub nodes
- **AND** the treatment SHALL include a larger footprint, stronger border/halo, and primary-color anchor styling
- **AND** existing selection, confidence, stale, candidate, and pinned indicators SHALL remain readable

#### Scenario: Duplicate persisted node identity renders once

- **WHEN** Project Map data is loaded or merged and the same `ProjectMapNode.id` appears in multiple lens node payloads
- **THEN** the system SHALL normalize the dataset to a single graph node for that id before layout and render
- **AND** the canonical node SHALL preserve valid parent/child topology
- **AND** duplicate sources, detail arrays, related artifacts, and diagram artifacts SHALL be merged with de-duplication
- **AND** React graph keys, layout positions, minimap dots, selection, and drag state SHALL consume the deduplicated node set

### Requirement: Read-only knowledge map panel

The system SHALL render a read-only Project Knowledge Map panel in the center area.

#### Scenario: Mock dataset is not the runtime fact source
- **WHEN** the Project Knowledge Map opens for a real workspace
- **THEN** the panel SHALL read from the workspace project-map persistence directory
- **AND** the panel SHALL show an empty state when no persisted map exists
- **AND** mock `ProjectMapDataset` values MAY only be used as test fixtures or controlled demo input
- **AND** mock data SHALL NOT be displayed as current project fact by default

#### Scenario: Empty map state
- **WHEN** no persisted project map exists for the active workspace
- **THEN** the panel SHALL show an empty state with a global collection action
- **AND** the panel SHALL NOT display inferred placeholder knowledge as fact

#### Scenario: Existing map restore
- **WHEN** persisted map data exists under `.ccgui/project-map/<project-name>-<short-hash>/`
- **THEN** the panel SHALL load the persisted manifest, profile, lenses, and lens nodes
- **AND** the graph SHALL render the available nodes without requiring regeneration

#### Scenario: Manual text editing is unavailable
- **WHEN** the user opens any node detail
- **THEN** the UI SHALL NOT provide manual text editing controls for generated content
- **AND** available actions SHALL be limited to view, generate, calibrate, refresh, and inspect evidence

### Requirement: Project profile and dynamic knowledge lenses

The system SHALL derive a Project Profile for the active workspace and organize project knowledge through dynamic lenses instead of a fixed framework-specific layer enum.

#### Scenario: AI organizer proposes parent moves for unassigned discoveries

- **WHEN** the Project Map contains direct children under the generic unassigned discoveries node
- **THEN** the Project Map UI SHALL provide an AI organize action from the toolbar and the Unassigned Discoveries detail panel
- **AND** the action SHALL ask AI for parent-move suggestions using project-generic node summaries, source paths, child counts, and candidate parents from the existing graph
- **AND** the action SHALL create review candidates instead of directly changing Project Map topology

#### Scenario: Organizer candidate review is explicit

- **WHEN** AI organizer suggestions are available
- **THEN** each suggestion SHALL be reviewable as a pending candidate
- **AND** the review SHALL show the target node, suggested parent, confidence, and reason
- **AND** the top-bar candidate badge SHALL navigate to a pending review candidate even when the target node is not marked as a standalone node candidate
- **AND** confirming the candidate SHALL apply only the parent move
- **AND** rejecting the candidate SHALL leave Project Map topology unchanged

#### Scenario: Organizer remains project-agnostic

- **WHEN** the organizer builds prompts or validates suggestions
- **THEN** it SHALL NOT require repository-specific workflow directories, user-local paths, OpenSpec, Trellis, Codex, Claude, technology names, controller names, or other personal workspace conventions
- **AND** source paths MAY be used only as generic evidence for parent matching
- **AND** validation SHALL rely on graph safety and hierarchy fit rather than project-specific allowlists

#### Scenario: Organizer explains skipped and unsafe suggestions

- **WHEN** an organizer run completes with zero or partial candidates
- **THEN** the task drawer SHALL show candidate, skipped, and unsafe suggestion counts
- **AND** it SHALL list representative skipped and unsafe reasons so the user can understand why nodes were not organized
- **AND** the Unassigned Discoveries detail panel SHALL explain that AI organize creates review candidates and does not directly mutate the map

### Requirement: Structured node detail

The system SHALL provide concise structured details for each selected map node.

#### Scenario: Node detail is shown
- **WHEN** the user selects a map node
- **THEN** the inspector SHALL show a core description, key facts, key logic, risk signals, related artifacts, confidence, stale state, and generation metadata
- **AND** the detail SHALL remain read-only

#### Scenario: Node detail stays concise
- **WHEN** generated detail content is rendered
- **THEN** the core description SHALL be concise
- **AND** each key fact or key logic item SHALL describe one verifiable point
- **AND** long-form narrative SHALL NOT be rendered inside the graph node itself

#### Scenario: Detail facts require evidence
- **WHEN** the node detail includes key facts
- **THEN** each deterministic key fact SHALL be traceable to at least one source
- **AND** unsupported facts SHALL be rejected or marked unknown

#### Scenario: Risk signals require evidence
- **WHEN** the node detail includes risk signals
- **THEN** each risk signal SHALL be traceable to actual project evidence
- **AND** unsupported risk claims SHALL be rejected or marked unknown

### Requirement: Global AI collection

The system SHALL provide a global collection action that generates the project map framework using AI.

#### Scenario: Global collection uses concise framework prompt

- **WHEN** the user confirms a global Project Map collection request
- **THEN** the worker SHALL build a concise prompt for framework-level map generation
- **AND** the prompt SHALL avoid dumping the full existing profile JSON or every existing node id when a compact summary is enough
- **AND** the prompt SHALL still require strict pure JSON output, double-quoted property names, source-backed facts, and low/unknown confidence when evidence is insufficient

#### Scenario: AI output uses object literal syntax

- **WHEN** the AI returns a JSON-shaped object with unquoted property names, bare string values, or trailing commas
- **THEN** the worker SHALL attempt a bounded repair before failing the run
- **AND** the repair SHALL NOT execute arbitrary JavaScript
- **AND** the repaired payload SHALL still flow through the existing profile/node normalization path

#### Scenario: Chinese client locale generates Chinese-first map copy

- **WHEN** the client locale is Chinese and the user confirms a Project Map AI generation request
- **THEN** the generation request SHALL carry a preferred language for Chinese output
- **AND** the worker prompt SHALL require user-visible map copy to use Chinese as the primary language
- **AND** English technical terms, source paths, symbols, API names, commands, package names, and framework names SHALL remain untranslated
- **AND** this language contract SHALL apply to node titles, summaries, core descriptions, key facts, key logic, risk signals, and diagram title/summary fields

### Requirement: Node-level completion and calibration

The system SHALL allow AI generation from any map node to complete, correct, or calibrate that node and its subtree.

#### Scenario: Node-level generation scope
- **WHEN** the user triggers generation from a selected node
- **THEN** the system SHALL scope the run to that node, adjacent nodes, existing sources, and necessary project facts
- **AND** the generated patch SHALL update only that node and its descendants unless the user confirms a wider scope

#### Scenario: Calibration preserves evidence
- **WHEN** calibration changes a node summary or confidence
- **THEN** the system SHALL preserve or update the node's source list
- **AND** the system SHALL record the generation run that caused the change

### Requirement: Local persistence contract

The system SHALL persist project map data under `.ccgui/project-map/<project-name>-<short-hash>/` for the active workspace.

#### Scenario: Lens storage layout
- **WHEN** map data is written
- **THEN** the system SHALL store profile data and lens node data under corresponding profile / lens folders
- **AND** run metadata SHALL be stored under `runs/`
- **AND** evidence metadata SHALL be stored under `evidence/`
- **AND** candidate metadata SHALL be stored under `candidates/`
- **AND** backups SHALL be stored under `backups/`

#### Scenario: Same-name projects are isolated
- **WHEN** a project map storage directory is created
- **THEN** the directory name SHALL include the project name and a short hash derived from the workspace identity
- **AND** two projects with the same display name SHALL NOT share the same active map directory

#### Scenario: Writes are constrained
- **WHEN** the project map persistence layer writes files
- **THEN** writes SHALL be constrained to `.ccgui/project-map/<project-name>-<short-hash>/**`
- **AND** writes SHALL use an atomic write strategy
- **AND** failures SHALL leave the previous valid map readable

#### Scenario: Platform-safe path handling
- **WHEN** the persistence layer builds project-map paths
- **THEN** the system SHALL use platform-safe path join and normalization
- **AND** the implementation SHALL NOT hard-code Windows or POSIX path separators

#### Scenario: Rebuild creates backup
- **WHEN** the user triggers one-click map rebuild
- **THEN** the system SHALL create a backup of the current active map before replacing generated profile or lens data
- **AND** rebuild SHALL require user confirmation before starting

### Requirement: Grounded minimal generation

The system SHALL enforce concise, evidence-backed AI output for all generated map content.

#### Scenario: Deterministic claim requires source
- **WHEN** a node presents a claim as project fact
- **THEN** the node SHALL include at least one source
- **AND** the source SHALL identify a file, symbol, spec, commit, test, or conversation reference

#### Scenario: Evidence priority is enforced
- **WHEN** multiple source types support or conflict on a generated claim
- **THEN** the system SHALL prefer evidence in this order: code, spec, tests, commit, memory
- **AND** memory alone SHALL NOT produce high-confidence code-fact claims

#### Scenario: Unsupported claim is not promoted
- **WHEN** AI output contains a claim without evidence
- **THEN** the system SHALL either reject that claim or mark the node confidence as `unknown`
- **AND** the UI SHALL NOT present the unsupported claim as confirmed fact

#### Scenario: Concise node content
- **WHEN** generated content is rendered as a graph node
- **THEN** the visible summary SHALL be concise
- **AND** extended details SHALL appear only in the node inspector

### Requirement: Conversation knowledge capture

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Candidate review surfaces

- **WHEN** candidates exist
- **THEN** the top bar SHALL show a candidate count badge
- **AND** the selected node inspector SHALL show candidates related to that node
- **AND** the top bar SHALL provide an Accept all action that attempts to accept every current candidate that passes validation
- **AND** after batch confirmation the UI SHALL show how many candidates were accepted and how many were skipped

### Requirement: Project memory auto ingestion settings

The system SHALL provide settings for automatic project-memory ingestion into the Project Knowledge Map.

#### Scenario: Auto ingestion is opt-in
- **WHEN** the user has not enabled automatic ingestion
- **THEN** the system SHALL NOT automatically analyze project memory sessions for map updates

#### Scenario: Auto ingestion configuration
- **WHEN** the user enables automatic ingestion
- **THEN** the system SHALL require engine, model, threshold, interval, and apply mode settings
- **AND** the default new-session threshold SHALL be 5
- **AND** the default apply mode SHALL be `createCandidate`
- **AND** `autoApplyEvidenceBacked` SHALL be treated as an advanced opt-in mode

#### Scenario: Threshold triggers ingestion
- **WHEN** automatic ingestion is enabled
- **AND** the count of unprocessed project memory sessions reaches the configured threshold
- **THEN** the system SHALL create an AI analysis run scoped to those unprocessed sessions and relevant existing map nodes

#### Scenario: Default candidate mode requires confirmation
- **WHEN** an automatic ingestion run completes in `createCandidate` mode
- **THEN** accepted updates SHALL be recorded as candidates
- **AND** the candidates SHALL require user confirmation before being written into active map lenses

#### Scenario: Candidate review surfaces
- **WHEN** candidates exist
- **THEN** the top bar SHALL show a candidate count badge
- **AND** the selected node inspector SHALL show candidates related to that node
- **AND** the top bar SHALL provide an Accept all action that attempts to accept every current candidate that passes validation
- **AND** after batch confirmation the UI SHALL show how many candidates were accepted and how many were skipped

#### Scenario: Auto ingestion is non-blocking
- **WHEN** automatic ingestion creates candidates
- **THEN** the system SHALL update candidate indicators without showing a blocking confirmation dialog

#### Scenario: Auto ingestion writes through evidence gate
- **WHEN** an automatic ingestion run produces map updates
- **THEN** the updates SHALL pass the same evidence gate as manual global or node-level generation
- **AND** accepted updates SHALL be persisted under `.ccgui/project-map/<project-name>-<short-hash>/`

#### Scenario: Auto ingestion update scope
- **WHEN** automatic ingestion generates accepted candidate updates
- **THEN** the update MAY create new nodes
- **AND** the update MAY modify matching nodes
- **AND** the update SHALL NOT modify unrelated nodes

### Requirement: Processed project memory marker

The system SHALL mark project memory sessions that have already been used for map supplementation.

#### Scenario: Successful run marks processed sessions
- **WHEN** an automatic ingestion run successfully applies or records accepted candidate updates
- **THEN** the consumed project memory session id and message hash pairs SHALL be recorded as processed

#### Scenario: Processed messages are not reused
- **WHEN** future automatic ingestion scans project memory
- **THEN** messages already recorded as processed SHALL NOT be used again as new input
- **AND** new messages appended to a previously processed session MAY be processed if their message hashes are new

#### Scenario: Failed run does not mark sessions
- **WHEN** an automatic ingestion run fails before accepted updates are persisted or recorded
- **THEN** the involved project memory messages SHALL remain unprocessed

### Requirement: Staleness awareness

The system SHALL mark map nodes stale when their recorded sources no longer match current project facts.

#### Scenario: Source hash mismatch
- **WHEN** a node source hash differs from the current source hash
- **THEN** the node SHALL be marked stale
- **AND** the inspector SHALL offer node calibration

#### Scenario: Stale node visual treatment
- **WHEN** a node is stale
- **THEN** the graph SHALL visually de-emphasize the node
- **AND** the node confidence SHALL be downgraded or marked stale in the inspector

### Requirement: Internationalization

All user-facing Project Knowledge Map labels SHALL support Chinese and English locales.

#### Scenario: Chinese locale
- **WHEN** the application locale is Chinese
- **THEN** panel labels, tooltips, empty states, actions, confirmation dialogs, and confidence states SHALL display Chinese text

#### Scenario: English locale
- **WHEN** the application locale is English
- **THEN** panel labels, tooltips, empty states, actions, confirmation dialogs, and confidence states SHALL display English text

#### Scenario: AI-generated dynamic labels remain readable
- **WHEN** AI-generated map data contains supported extended node kinds such as `record`, `interface`, `runtime`, `tech-stack`, or `cross-cutting`
- **THEN** the UI SHALL render localized human-readable labels instead of raw `projectMap.nodeKind.*` keys
- **AND** source type badges SHALL render localized labels for supported types
- **AND** unsupported dynamic labels SHALL fall back to readable title-case text rather than raw i18n key paths

### Requirement: Cross-platform compatibility

The Project Knowledge Map SHALL work on Windows, macOS, and Linux.

#### Scenario: Supported desktop platforms
- **WHEN** the app runs on Windows, macOS, or Linux
- **THEN** the Project Knowledge Map panel SHALL open and render the graph
- **AND** persisted map data SHALL be readable and writable under the configured `.ccgui/project-map/<project-name>-<short-hash>/` directory

#### Scenario: Platform-specific manual evidence
- **WHEN** implementation is verified for release
- **THEN** verification notes SHALL record the tested platform coverage for graph rendering and persistence

### Requirement: Node-level AI generation

The system SHALL allow AI generation from any map node to complete, correct, or calibrate that node and its subtree.

#### Scenario: Node completion is scoped to the selected node

- **WHEN** the user starts a Complete Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `completeNode` intent
- **AND** the worker prompt SHALL include the selected node id, title, lens, current summary, confidence, sources, and child summary
- **AND** the prompt SHALL instruct the model to fill missing facts only for the selected node and allowed subtree
- **AND** the prompt SHALL NOT ask the model to rebuild unrelated global or sibling nodes

#### Scenario: Node calibration is scoped to verification

- **WHEN** the user starts a Calibrate Node action from a selected Project Map node
- **THEN** the generation request SHALL carry a `calibrateNode` intent
- **AND** the worker prompt SHALL instruct the model to verify, correct, lower confidence, mark stale/candidate, or improve evidence for the selected node
- **AND** the prompt SHALL treat expansion as secondary to factual correction
- **AND** the prompt SHALL NOT reuse the same task wording as Complete Node

#### Scenario: Legacy node runs remain compatible

- **WHEN** a persisted node generation run lacks an explicit generation intent
- **THEN** the worker SHALL infer a node completion intent from `requestScope.kind === "node"`
- **AND** the run SHALL continue through the existing evidence, AI dispatch, parse, normalize, and scoped merge flow

### Requirement: Conversation-derived project knowledge candidates

The system SHALL support adding verifiable project knowledge from project Q&A into the map through AI-generated candidates.

#### Scenario: Pending candidate can be confirmed from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a confirm candidate action
- **AND** activating confirm SHALL validate the candidate patch through the evidence gate before mutating the active node
- **AND** on success the candidate status SHALL become `confirmed`
- **AND** the candidate evidence SHALL be appended to project map evidence records

#### Scenario: Pending candidate can be rejected from node inspector

- **WHEN** the selected Project Map node has a pending candidate record targeting that node
- **THEN** the inspector SHALL show a reject candidate action
- **AND** activating reject SHALL mark the candidate `rejected`
- **AND** the active node SHALL remain unchanged

#### Scenario: Invalid candidate confirmation is blocked

- **WHEN** a pending candidate patch fails the evidence gate
- **THEN** the inspector confirm action SHALL NOT mutate the active node
- **AND** the UI SHALL expose a readable error message

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

### Requirement: Interactive Project Map node positioning

The Project Knowledge Map SHALL allow users to reposition graph nodes directly while keeping semantic project-map data separate from visual layout state.

#### Scenario: User drags a single node
- **WHEN** the user drags a Project Map node to a new canvas position
- **THEN** the node SHALL move to the dropped position
- **AND** the node layout SHALL be marked pinned
- **AND** the persisted Project Map view-state SHALL store the node position by node id

#### Scenario: Old snapshots have no view-state
- **WHEN** a Project Map snapshot does not contain `viewState`
- **THEN** the graph SHALL render using generated deterministic positions
- **AND** the app SHALL NOT crash or require a migration step

#### Scenario: Deleted nodes remove stale layout entries
- **WHEN** a Project Map node is physically deleted
- **THEN** persisted view-state SHALL remove layout entries for that node and its descendants

### Requirement: Bounded automatic graph layout

The Project Knowledge Map SHALL provide an automatic layout action that moves unpinned nodes into a non-overlapping arrangement while respecting pinned user positions.

#### Scenario: User runs auto layout
- **WHEN** the user activates Auto layout
- **THEN** unpinned visible nodes SHALL settle into a non-overlapping layout
- **AND** pinned nodes SHALL keep their stored positions
- **AND** final positions SHALL be persisted as view-state

#### Scenario: User resets manual layout
- **WHEN** the user activates Reset layout
- **THEN** all manual node layout entries for the current Project Map SHALL be removed
- **AND** the graph SHALL return to deterministic generated layout

### Requirement: Layout presets

The Project Knowledge Map SHALL provide layout presets so the user can switch between radial, tree, and compact force arrangements.

#### Scenario: User switches layout preset
- **WHEN** the user selects a different layout preset
- **THEN** the graph SHALL recompute unpinned node positions using that preset
- **AND** pinned node positions SHALL remain fixed
- **AND** the selected preset SHALL be persisted in Project Map view-state

### Requirement: Multi-select graph movement

The Project Knowledge Map SHALL support lightweight multi-select movement for graph cleanup.

#### Scenario: User toggles multi-select
- **WHEN** the user Shift-clicks or Meta-clicks graph nodes
- **THEN** those nodes SHALL be toggled in the selected group
- **AND** the inspector SHALL continue to show the primary selected node

#### Scenario: User drags a selected group
- **WHEN** multiple nodes are selected
- **AND** the user drags one selected node
- **THEN** all selected nodes SHALL move by the same delta
- **AND** all moved nodes SHALL be pinned in persisted view-state

### Requirement: Project Map mini map

The Project Knowledge Map SHALL provide a compact mini map that shows graph distribution and controls viewport recentering.

#### Scenario: User clicks the mini map
- **WHEN** the user clicks a point in the Project Map mini map
- **THEN** the main graph viewport SHALL recenter around the corresponding graph coordinate
- **AND** the graph selection and inspector state SHALL remain unchanged

#### Scenario: Mini map stays display-only for nodes
- **WHEN** the mini map renders graph dots and viewport bounds
- **THEN** it SHALL NOT expose duplicate node buttons or duplicate inspector controls

### Requirement: Project Map viewport stability

The Project Knowledge Map SHALL preserve the current graph viewport during ordinary node selection and SHALL only auto-fit the viewport for structural graph framing changes.

#### Scenario: User selects another node while details are open
- **WHEN** the detail panel is open
- **AND** the graph has an existing viewport pan and zoom
- **AND** the user selects another visible graph node
- **THEN** the selected node and inspector SHALL update
- **AND** the graph viewport pan and zoom SHALL remain unchanged

### Requirement: Project Map collapsible chrome

The Project Knowledge Map SHALL allow users to collapse the header chrome into a compact toolbar while preserving access to map content and core context.

#### Scenario: User collapses the header chrome
- **WHEN** the user activates the header collapse control
- **THEN** the project map header SHALL render as a compact single-row toolbar
- **AND** the lens summary chrome SHALL be hidden
- **AND** the compact toolbar SHALL keep project identity and map summary visible
- **AND** the graph canvas SHALL move up to use the reclaimed vertical space

#### Scenario: Header action controls share a toolbar height
- **WHEN** the expanded header renders storage, task, profile, candidate, and chrome controls
- **THEN** those controls SHALL use a consistent toolbar height
- **AND** concise i18n labels SHALL be used for visible button text

#### Scenario: Header actions render as toolbar items
- **WHEN** the expanded or collapsed header renders primary chrome actions
- **THEN** those actions SHALL use icon-and-text presentation
- **AND** they SHALL avoid button-shaped borders and heavy filled backgrounds
- **AND** they SHALL preserve semantic button behavior for interactive controls

### Requirement: Node diagram artifact links
The Project Knowledge Map SHALL support evidence-backed Mermaid diagram artifacts for nodes whose relationships or execution order are clearer as a diagram than as text.

#### Scenario: Prompt may request diagram artifacts
- **WHEN** Project Map AI generation asks for node detail content
- **THEN** the prompt SHALL require the model to internally choose between text detail and diagram artifact representation
- **AND** the prompt SHALL allow Mermaid diagram output only when it clarifies flow, state, dependency, layering, sequence, or data movement
- **AND** the prompt SHALL allow no diagram when text is clearer or evidence is weak

#### Scenario: Diagram artifact is stored outside node body
- **WHEN** AI generation returns a Mermaid diagram for a Project Map node
- **THEN** the system SHALL write the Mermaid source into a Markdown file under the Project Map `diagrams/` storage directory
- **AND** the node detail SHALL store only diagram artifact metadata and a link path
- **AND** the Mermaid source SHALL NOT be embedded into `coreDescription`, `keyFacts`, `keyLogic`, or `riskSignals`

#### Scenario: Diagram link opens existing file preview
- **WHEN** a node has diagram artifacts
- **THEN** the node inspector SHALL render a diagram link section
- **AND** activating a diagram link SHALL open the Markdown artifact through the existing workspace file opening path
- **AND** the Markdown preview SHALL remain responsible for Mermaid source/render behavior
- **AND** Project Map storage-root absolute paths SHALL be accepted by the existing external file preview without hard-coded user-specific paths

#### Scenario: Old snapshots remain compatible
- **WHEN** a persisted Project Map snapshot has no diagram artifact fields
- **THEN** the Project Knowledge Map SHALL read and render the snapshot without migration failure
- **AND** the node inspector SHALL omit the diagram section for nodes without diagram artifacts

### Requirement: Diagram storage allowlist
The Project Knowledge Map SHALL constrain diagram artifact writes to safe Project Map storage paths.

#### Scenario: Diagram markdown write is allowed
- **WHEN** Project Map persistence writes `diagrams/<diagram-id>.md`
- **THEN** the Tauri project-map write boundary SHALL allow the write only if `<diagram-id>` is a safe single path segment
- **AND** nested diagram directories, parent traversal, absolute paths, and non-Markdown diagram files SHALL be rejected

#### Scenario: Diagram manifest write is allowed
- **WHEN** Project Map persistence writes `diagrams/manifest.json`
- **THEN** the Tauri project-map write boundary SHALL allow the manifest write
- **AND** other arbitrary files under `diagrams/` SHALL be rejected

#### Scenario: Concurrent diagram writes do not collide
- **WHEN** multiple Project Map completion tasks commit files in the same process
- **THEN** atomic temporary file names SHALL be unique per write attempt
- **AND** concurrent writes to the same diagram or manifest path SHALL NOT fail because another write already moved the temp file

### Requirement: Project memory auto ingestion run lifecycle

The Project Knowledge Map SHALL wire Auto Ingestion settings into the Project Map generation queue rather than using a hidden synchronous write path, and scheduling SHALL be owned by the active workspace lifecycle rather than by the Project Knowledge Map panel mount lifecycle.

#### Scenario: Threshold creates queued auto run
- **GIVEN** Auto Ingestion is enabled
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **WHEN** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use `scope.kind="auto"` and include the consumed message hashes
- **AND** the background task drawer SHALL be able to render the run using the existing run lifecycle

#### Scenario: Hidden Project Map still queues auto run
- **GIVEN** Auto Ingestion is enabled for the active workspace
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **AND** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **AND** the Project Knowledge Map panel is not currently rendered or mounted
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use the existing Auto Ingestion request shape, consumed message hashes, and Project Memory evidence metadata
- **AND** opening the Project Knowledge Map panel later SHALL show the queued, running, completed, or failed run through the existing task drawer

#### Scenario: Interval prevents repeated scans
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** the system SHALL NOT enqueue a duplicate auto run

#### Scenario: Existing auto run prevents duplicate queueing
- **GIVEN** an Auto Ingestion run is already pending or running
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL NOT enqueue another Auto Ingestion run

#### Scenario: View lifecycle does not create duplicate scheduler
- **GIVEN** the workspace-level Auto Ingestion scheduler is mounted
- **AND** the Project Knowledge Map panel is also rendered
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL use a single scheduling owner for the active workspace
- **AND** it SHALL NOT enqueue a duplicate auto run because both the app layer and view layer evaluated the same interval window

#### Scenario: Successful auto run marks memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run completes successfully
- **THEN** the consumed message hashes SHALL be added to `memoryCursor.processedMessages`
- **AND** `memoryCursor.lastRunId` SHALL reference the completed auto run

#### Scenario: Failed auto run does not mark memory processed
- **GIVEN** an Auto Ingestion run was created from unprocessed Project Memory messages
- **WHEN** the run fails or is cancelled
- **THEN** the consumed message hashes SHALL NOT be added to `memoryCursor.processedMessages`
- **AND** the messages SHALL remain eligible for a later retry after the interval gate allows another scan

### Requirement: Auto Ingestion candidate safety

The Project Knowledge Map SHALL keep automatic Project Memory ingestion conservative by default while preserving the advanced evidence-backed apply mode.

#### Scenario: Default candidate mode requires review
- **GIVEN** Auto Ingestion apply mode is `createCandidate`
- **WHEN** an auto run returns generated Project Map nodes or updates
- **THEN** generated updates SHALL remain candidate review items or candidate nodes
- **AND** they SHALL require the existing manual confirm/reject flow before becoming trusted active-map facts

#### Scenario: Advanced apply mode can apply evidence-backed updates
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **WHEN** unprocessed Project Memory reaches the threshold
- **THEN** the system SHALL still enqueue a real auto run
- **AND** updates with sufficient evidence MAY be written into active map lenses through the existing evidence gate
- **AND** weak, unsupported, or memory-only claims SHALL remain candidates rather than being silently trusted

#### Scenario: Auto apply still preserves candidate visibility
- **GIVEN** Auto Ingestion apply mode is `autoApplyEvidenceBacked`
- **AND** a generated update cannot satisfy the evidence gate
- **WHEN** the auto run completes
- **THEN** the unsupported update SHALL remain visible as a candidate or rejected candidate result
- **AND** the run SHALL NOT promote the unsupported update into trusted active-map facts

### Requirement: Auto Ingestion enablement configuration

The Project Knowledge Map SHALL require an explicit engine and model selection before Auto Ingestion becomes enabled.

#### Scenario: Enable flow selects engine and model
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user clicks the Auto Ingestion enable control
- **THEN** the system SHALL show engine and model controls before persisting `enabled=true`
- **AND** confirmation SHALL persist the selected `engine` and `model` together with `enabled=true`

#### Scenario: Cancelled enable flow remains disabled
- **GIVEN** Auto Ingestion is currently disabled
- **WHEN** the user opens the enable configuration flow and cancels it
- **THEN** the system SHALL keep `enabled=false`
- **AND** the scheduler SHALL NOT enqueue auto runs from hidden default engine or model values

### Requirement: Auto Ingestion graph reachability

The Project Knowledge Map SHALL preserve a single navigable root topology after automatic ingestion.

#### Scenario: Auto-generated top-level concepts remain reachable
- **GIVEN** an Auto Ingestion run returns a new node whose parent is the existing project root
- **AND** the AI payload does not repeat the existing project root node
- **WHEN** the generated result is merged into the dataset
- **THEN** the new node SHALL keep its parent link to the existing root
- **AND** the existing root SHALL include the new node in its children

#### Scenario: Persisted orphan roots are repaired on read
- **GIVEN** a persisted Project Map snapshot contains non-root nodes with no parent link
- **WHEN** the snapshot is read into the Project Map dataset
- **THEN** those orphan nodes SHALL be attached to the project root
- **AND** the map SHALL remain navigable from the project root

### Requirement: Project Map structured output repair

The Project Knowledge Map worker SHALL keep strict JSON validation while allowing one bounded repair attempt for invalid AI output.

#### Scenario: Non-JSON first response is repaired
- **GIVEN** a Project Map generation run receives an AI response that does not contain a valid JSON payload
- **WHEN** the worker detects the structured output validation failure
- **THEN** the worker SHALL request one JSON-only repair response from the same configured engine and model
- **AND** the run SHALL continue only if the repaired response validates as a Project Map payload

#### Scenario: Repair failure keeps the run failed
- **GIVEN** a Project Map generation run receives invalid structured output
- **AND** the one repair response is also invalid
- **WHEN** validation completes
- **THEN** the run SHALL remain failed
- **AND** no Project Map dataset write or Auto Ingestion processed marker update SHALL be treated as successful

### Requirement: Project Map generation dialog layout

The Project Knowledge Map SHALL render generation configuration dialogs with compact defaults and content-adaptive desktop width.

#### Scenario: Confirmation dialog expands for wide content
- **GIVEN** the Confirm Generation dialog contains long write paths or multiple read source chips
- **WHEN** the dialog is rendered on a desktop-sized viewport
- **THEN** the dialog SHALL keep the existing compact width as its minimum width
- **AND** the dialog SHALL expand when content needs more horizontal room
- **AND** the dialog SHALL remain bounded by the viewport-safe maximum width
- **AND** labels, title text, source chips, and footer actions SHALL NOT be clipped by the dialog edge

#### Scenario: Narrow viewport remains usable
- **GIVEN** the Confirm Generation dialog is rendered on a narrow viewport
- **WHEN** available width is below the desktop layout threshold
- **THEN** the dialog SHALL use a single-column layout
- **AND** long write paths and source chips SHALL wrap or truncate within the dialog instead of forcing page-level horizontal overflow

#### Scenario: Enable dialog keeps inline model refresh action
- **GIVEN** the Auto Ingestion enable dialog is rendered with engine and model controls
- **WHEN** the model refresh action is visible
- **THEN** the refresh action SHALL share the model control row on desktop
- **AND** the layout SHALL avoid a dedicated blank row for the refresh action

### Requirement: Project Map canvas controls collapsed preference

The Project Knowledge Map SHALL keep canvas layout controls compact by default while preserving the user's explicit expanded/collapsed preference.

#### Scenario: Canvas controls default collapsed
- **GIVEN** no canvas controls preference has been stored
- **WHEN** the Project Map graph canvas is rendered
- **THEN** the canvas controls SHALL render as a compact collapsed entry
- **AND** zoom, reset, auto layout, reset layout, and layout preset controls SHALL remain hidden until the user expands the control group

#### Scenario: User preference is restored
- **GIVEN** the user explicitly expands or collapses the canvas controls
- **WHEN** the Project Map panel remounts or reloads
- **THEN** the controls SHALL restore the user's last explicit collapsed/expanded preference
- **AND** that preference SHALL be stored as local UI chrome state rather than Project Map dataset content

#### Scenario: Graph actions do not mutate toolbar preference
- **GIVEN** the user has expanded the canvas controls
- **WHEN** the user zooms, resets the view, runs auto layout, resets layout, changes layout preset, drills into a node, returns to previous view, or returns to overview
- **THEN** the canvas controls SHALL remain expanded
- **AND** those graph actions SHALL NOT overwrite the stored collapsed/expanded preference

### Requirement: Project Map stabilization preserves renderer dependency boundary
The Project Knowledge Map stabilization work SHALL preserve the existing in-house SVG/HTML rendering boundary.

#### Scenario: No new graph dependency is introduced
- **WHEN** Project Map stabilization is implemented
- **THEN** the graph SHALL continue using the existing in-house SVG/HTML rendering boundary
- **AND** the implementation SHALL NOT add a third-party graph rendering or graph editing dependency

### Requirement: Project Map generation model fallback
The Project Knowledge Map SHALL keep Codex generation entry available when runtime model catalogs are temporarily unavailable.

#### Scenario: Codex catalog outage still exposes fallback models
- **GIVEN** the selected Project Map generation engine is `codex`
- **AND** runtime engine models, Codex model list, and workspace config do not provide any model option
- **WHEN** Project Map generation options are loaded
- **THEN** the UI SHALL expose fallback Codex model options from the canonical Codex model catalog
- **AND** Project Map SHALL NOT maintain a separate hard-coded Codex fallback model list

### Requirement: Project Map Auto Ingestion background scheduler ownership

Project Map Auto Ingestion SHALL evaluate scheduling from the active workspace lifecycle rather than from the Project Knowledge Map view lifecycle.

#### Scenario: Hidden Project Map still queues auto run
- **GIVEN** Auto Ingestion is enabled for the active workspace
- **AND** no Project Map auto run is pending or running
- **AND** the configured interval has elapsed since `memoryCursor.lastCheckedAt`
- **AND** the count of unprocessed Project Memory messages reaches `newSessionThreshold`
- **AND** the Project Knowledge Map panel is not currently rendered or mounted
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL create a queued Project Map run with `kind="auto"`
- **AND** the run SHALL use the existing Auto Ingestion request shape, consumed message hashes, and Project Memory evidence metadata

#### Scenario: Returning to Project Map shows background run
- **GIVEN** a workspace-level Auto Ingestion scheduler queued or started a Project Map auto run while the Project Knowledge Map panel was not visible
- **WHEN** the user opens the Project Knowledge Map panel
- **THEN** the panel SHALL load the persisted dataset
- **AND** the existing task/run UI SHALL be able to render the queued, running, completed, or failed auto run

#### Scenario: View lifecycle does not create duplicate scheduler
- **GIVEN** the workspace-level Auto Ingestion scheduler is mounted
- **AND** the Project Knowledge Map panel is also rendered
- **WHEN** Auto Ingestion evaluates scheduling
- **THEN** the system SHALL use a single scheduling owner for the active workspace
- **AND** it SHALL NOT enqueue a duplicate auto run because both the app layer and view layer evaluated the same interval window

#### Scenario: Background scheduler preserves interval gate
- **GIVEN** Auto Ingestion is enabled
- **AND** `memoryCursor.lastCheckedAt` is newer than the configured interval window
- **WHEN** the workspace-level scheduler evaluates Auto Ingestion
- **THEN** the system SHALL NOT scan Project Memory again
- **AND** it SHALL NOT enqueue a Project Map auto run

#### Scenario: Background scheduler preserves success-only processed markers
- **GIVEN** a workspace-level Auto Ingestion scheduler created an auto run from unprocessed Project Memory messages
- **WHEN** the run fails or is cancelled
- **THEN** the consumed message hashes SHALL NOT be added to `memoryCursor.processedMessages`
- **AND** the messages SHALL remain eligible for retry after the interval gate allows another scan

### Requirement: Project Map SHALL Prioritize The Knowledge Canvas

The Project Map surface SHALL present the graph canvas as the primary user focus, with navigation and secondary workflow affordances arranged around it.

#### Scenario: graph canvas is visually primary

- **WHEN** the user opens Project Map with a valid dataset
- **THEN** the graph canvas SHALL be the dominant surface
- **AND** search, tour, path, repair, evidence, and task controls SHALL NOT visually compete as equal primary panels

#### Scenario: graph command bar groups navigation primitives

- **WHEN** search, guided tour, path finder, lens selection, graph health, or task status are available
- **THEN** Project Map SHALL expose them as a compact graph navigation command surface
- **AND** each command SHALL preserve its existing behavior or clearly indicate why it is unavailable

### Requirement: Node Inspector SHALL Explain Understanding, Evidence, Relations, And Actions

The selected node detail area SHALL be structured around the user's graph-understanding workflow.

#### Scenario: selected node explains trust and relation context

- **WHEN** user selects a node
- **THEN** the inspector SHALL show the node summary, key facts, key logic, risk signals, evidence refs, confidence/stale context, incoming/outgoing relations, and bounded actions in a clear hierarchy
- **AND** relation and evidence entries SHOULD remain navigable when existing callbacks support navigation

#### Scenario: dead or future-only actions are not primary

- **WHEN** an action is not wired to a reliable end-to-end behavior
- **THEN** the UI SHALL hide it or render it disabled with an explicit reason
- **AND** the action SHALL NOT be styled as a primary completed workflow

### Requirement: Graph Health And Work Queue SHALL Be Secondary Affordances

Graph repair and Work Queue SHALL remain accessible without dominating the graph experience.

#### Scenario: graph repair is compact by default

- **WHEN** graph integrity issues or repair actions exist
- **THEN** Project Map SHALL summarize them through a compact health affordance
- **AND** detailed repair information SHALL be available on demand

#### Scenario: Work Queue is downgraded

- **WHEN** orchestration or task affordances are available from Project Map
- **THEN** Project Map SHALL present them as secondary actions or compact status
- **AND** unfinished Work Queue controls SHALL NOT dominate the first-screen Project Map experience

### Requirement: Existing Project Map Data Contracts SHALL Remain Compatible

The experience pass SHALL reuse the current Project Map model and utilities unless a later change explicitly expands the schema.

#### Scenario: no schema migration is required

- **WHEN** an existing Project Map dataset is loaded
- **THEN** the redesigned surface SHALL render using the existing nodes, relations, tours, evidence, repair summary, and view state
- **AND** no dataset migration SHALL be required for this change

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

### Requirement: Project Map git impact source
The Project X-Ray panel SHALL derive Project Map impact input from the active workspace git status when no explicit changed-file input is supplied.

#### Scenario: Active workspace has changed git files
- **WHEN** Project Map is opened for an active workspace and git status returns changed files
- **THEN** the Project Map impact view uses those changed file paths to compute changed, affected, unmapped, and ignored nodes

#### Scenario: Explicit changed files are supplied
- **WHEN** Project Map receives explicit changed file paths from a caller
- **THEN** the explicit changed file paths take precedence over git-derived paths

#### Scenario: Git status unavailable
- **WHEN** git status fails or the workspace is not a git repository
- **THEN** Project Map remains usable and does not show a git-derived impact overlay

### Requirement: Project Map impact source metadata
The Project X-Ray panel SHALL indicate whether the current impact analysis comes from explicit input, git status, or no source.

#### Scenario: Git status supplies impact files
- **WHEN** Project Map impact files are derived from git status
- **THEN** the panel can show source metadata indicating git status and the number of input files

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

### Requirement: Project Map code/spec/task relationships
The Project X-Ray panel SHALL surface deterministic relationships between Project Map code nodes and related specs, tasks, and documents when those relationships are available.

#### Scenario: Code node has spec evidence
- **WHEN** a selected Project Map node has related OpenSpec evidence
- **THEN** the inspector shows the related capability or scenario evidence

### Requirement: Project Map stale reason display
The Project X-Ray panel SHALL display stale reasons and refresh recommendations for Project Map nodes or maps when available.

#### Scenario: Node has stale reason
- **WHEN** a Project Map node is stale with a known reason
- **THEN** the inspector shows the reason and an appropriate refresh recommendation

### Requirement: Project Map repair result display
The Project X-Ray panel SHALL display graph validation and deterministic repair results when validation finds issues.

#### Scenario: Graph repair removes invalid relation
- **WHEN** deterministic repair removes or quarantines an invalid relation
- **THEN** Project Map shows a user-visible repair summary

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

### Requirement: Project Map SHALL Maintain Focused Regression Coverage For Core Derived Behavior

Project Map core derived projections SHALL have focused regression coverage so navigation, evidence, relation, impact, governance, freshness, and graph integrity behavior remains stable across future changes.

#### Scenario: navigation utilities have deterministic coverage

- **WHEN** Project Map navigation utilities are changed
- **THEN** focused tests SHALL cover guided tour generation, node search, shortest path, hierarchy fallback, and no-path results

#### Scenario: impact and governance projections have evidence coverage

- **WHEN** Project Map impact or governance graph utilities are changed
- **THEN** focused tests SHALL cover changed-file impact matching, no-impact fallback, OpenSpec metadata extraction, Trellis task metadata extraction, and Agent Task context source refs

#### Scenario: freshness and integrity helpers cover degraded states

- **WHEN** Project Map freshness or graph integrity utilities are changed
- **THEN** focused tests SHALL cover stale reasons, missing evidence, missing relation endpoints, duplicate relation ids, and repair summaries

#### Scenario: persistence normalization covers legacy relation data

- **WHEN** Project Map relation persistence or normalization is changed
- **THEN** focused tests SHALL cover relation payload roundtrip and legacy datasets without relation payloads where practical

#### Scenario: tests use portable compact fixtures

- **WHEN** Project Map focused tests create dataset fixtures
- **THEN** fixtures SHALL use compact representative nodes and workspace-relative paths
- **AND** fixtures SHALL NOT rely on user-local absolute paths

### Requirement: Project Map Nodes SHALL Create Orchestration Task Drafts

Project Map SHALL allow users to create orchestration task drafts from map nodes without automatically starting agent execution.

#### Scenario: create task draft from selected node

- **WHEN** user triggers create-task from a Project Map node
- **THEN** the system SHALL create an orchestration task draft
- **AND** the draft SHALL reference the selected node id and node label
- **AND** execution SHALL NOT start until user confirms dispatch in Orchestration Center

#### Scenario: node evidence is carried into task draft

- **WHEN** a Project Map node has source files, specs, commits, tests, conversations, or other evidence refs
- **THEN** the task draft SHALL include those evidence refs where available
- **AND** missing evidence SHALL be represented as unavailable rather than invented

#### Scenario: stale or uncertain node creates risk-marked task

- **WHEN** a Project Map node is stale, candidate-only, low-confidence, or unknown-confidence
- **THEN** the created task draft SHALL expose that risk marker
- **AND** Orchestration Center SHALL require user review before marking the task ready

### Requirement: Project Map SHALL Link Back From Orchestration Tasks

Project Map SHALL support navigation from orchestration task details back to the source node when the node is still available.

#### Scenario: task opens source node

- **WHEN** user opens a Project Map source reference from an orchestration task
- **THEN** the system SHALL open the Project Map panel focused on the referenced node when it exists
- **AND** if the node no longer exists, the system SHALL show an explainable missing-source state

### Requirement: Project Map Work Queue SHALL Not Re-Own Graph Capability Expansion

Project Map graph primitives borrowed from Understand-Anything SHALL remain scoped to the dedicated Project Map changes, not this orchestration change.

#### Scenario: graph navigation capabilities are already covered by Project Map changes

- **WHEN** relation graph, guided tour, path finder, impact overlay, Evidence Files, staleness repair, or graph-focused tests are discussed
- **THEN** this orchestration change SHALL refer to the completed Project Map changes as dependencies
- **AND** this change SHALL only specify the execution bridge from Project Map evidence/candidates into OrchestrationTask, TaskRun, and review gate

### Requirement: Project Map graph SHALL remain the primary surface

Project Map SHALL keep the structure graph as the primary visual surface while query, recent activity, association explanation, and evidence navigation are presented as lightweight overlays or collapsible panels.

#### Scenario: Project Map opens to the graph

- **WHEN** the user opens Project Map for a workspace with persisted map data
- **THEN** the graph SHALL remain the primary visible surface
- **AND** newly added query, recent activity, association explanation, and evidence navigation surfaces SHALL NOT replace the graph as the default view

#### Scenario: Auxiliary surfaces are collapsible

- **WHEN** query results, recent activity, association explanation, evidence navigation, or quick filters are available
- **THEN** Project Map SHALL expose them through compact controls, overlays, or collapsible sections
- **AND** the user SHALL be able to collapse or clear those surfaces without mutating Project Map data

### Requirement: Project Map SHALL provide unified project query

Project Map SHALL provide a unified query surface that can search Project Map nodes, evidence files, relations, governance links, stale reasons, and recent activity while preserving graph focus.

#### Scenario: Query matches nodes

- **WHEN** a query matches a node title, summary, node kind, lens, source path, related artifact, or detail text
- **THEN** Project Map SHALL show matching node results with enough matched-field context to explain why they matched
- **AND** selecting a node result SHALL focus or select that node on the graph
- **AND** matching nodes SHALL be highlighted without changing graph layout

#### Scenario: Query matches non-node context

- **WHEN** a query matches an evidence file, relation, spec link, task link, stale reason, or recent activity item
- **THEN** Project Map SHALL show that result in a grouped non-node result section
- **AND** the result SHALL link to relevant nodes or relations when available
- **AND** unmapped results SHALL be shown as degraded or non-node context rather than being silently ignored

#### Scenario: Query searches only dataset-backed artifact references

- **WHEN** Project Map searches spec, task, governance, or artifact context
- **THEN** it SHALL only search references already present in Project Map dataset fields such as node sources, related artifacts, relation evidence, evidence records, or run metadata
- **AND** it SHALL NOT require hard-coded OpenSpec, Trellis, Codex, Claude, or user-local path conventions to produce those query results

### Requirement: Project Map SHALL provide recent activity overlay

Project Map SHALL provide a collapsible recent activity overlay that projects recent workspace activity onto Project Map nodes, files, relations, and risk summaries.

#### Scenario: Recent file changes map to graph nodes

- **WHEN** recent changed files are available from git status or explicit Project Map impact input
- **THEN** Project Map SHALL identify directly changed nodes, affected nodes, affected lenses, unmapped files, and risk summary
- **AND** directly changed and affected nodes SHALL be visually distinguishable on the graph

#### Scenario: Changed-file input is unavailable

- **WHEN** Project Map does not have changed-file or impact input available through the current frontend contract
- **THEN** Project Map SHALL show an honest empty or degraded changed-file activity state
- **AND** it MAY still summarize map-derived activity from runs, stale nodes, candidates, and evidence records
- **AND** it SHALL NOT present map-derived activity as a live git or complete chronological feed

#### Scenario: Recent activity includes map state

- **WHEN** the dataset contains stale nodes, candidate nodes, pending review candidates, or recent Project Map runs
- **THEN** Project Map SHALL be able to summarize those items in recent activity
- **AND** activity items that map to nodes SHALL allow the user to focus those nodes
- **AND** the activity UI SHALL distinguish changed-file input from map-derived run, stale, candidate, and evidence state

#### Scenario: Unmapped activity remains visible

- **WHEN** a recent activity item or changed file cannot be mapped to a Project Map node
- **THEN** Project Map SHALL show it as unmapped or degraded context
- **AND** Project Map SHALL NOT create fake graph nodes for that unmapped context

### Requirement: Project Map SHALL provide quick graph filter chips

Project Map SHALL provide lightweight filter chips for high-signal graph states without replacing the current graph view.

#### Scenario: User filters high-signal states

- **WHEN** the user activates a quick filter such as Changed, Affected, Stale, Candidate, Low Confidence, or Inferred Relations
- **THEN** Project Map SHALL highlight matching nodes or relations on the existing graph
- **AND** the filter SHALL be clearable
- **AND** activating the filter SHALL NOT mutate semantic map data or reset saved node layout

#### Scenario: Multiple graph overlays are active

- **WHEN** selected node, selected relation, path result, search result, recent activity, quick filter, and base graph state overlap on the same graph item
- **THEN** Project Map SHALL render highlight priority deterministically as selected state, path state, search state, recent activity state, quick filter state, then base graph state
- **AND** each overlay SHALL be clearable independently
- **AND** clearing one overlay SHALL NOT reset saved graph layout or mutate Project Map semantic data

### Requirement: Project Map SHALL explain selected-node associations

Project Map SHALL expose association context for a selected node through collapsible detail sections.

#### Scenario: Selected node has relation context

- **WHEN** the selected node has incoming or outgoing relations
- **THEN** Project Map SHALL show relation type, source kind, direction, confidence, stale state, and evidence count
- **AND** activating a related node SHALL focus that node on the graph

#### Scenario: Selected node has inferred or low-confidence relation

- **WHEN** a selected node relation is AI-inferred, low-confidence, unknown-confidence, or stale
- **THEN** Project Map SHALL visibly mark the relation state
- **AND** Project Map SHALL NOT present that relation as deterministic verified truth

#### Scenario: Selected node has recent activity

- **WHEN** recent activity maps to the selected node
- **THEN** Project Map SHALL show that activity in the selected-node detail context
- **AND** the section SHALL be collapsible or compact by default

### Requirement: Project Map SHALL explain paths between nodes

Project Map SHALL extend path finding with an evidence-aware explanation of why two nodes are related.

#### Scenario: Path exists between selected nodes

- **WHEN** the user selects a source and target node with a discoverable hierarchy or relation path
- **THEN** Project Map SHALL show the ordered path
- **AND** Project Map SHALL highlight path nodes and path edges on the graph
- **AND** Project Map SHALL explain each step using relation metadata or hierarchy fallback context

#### Scenario: Path step has relation metadata

- **WHEN** a path step uses a typed relation
- **THEN** the explanation SHALL include relation type, source kind, confidence, stale state, and evidence count
- **AND** inferred or low-confidence relation steps SHALL be clearly labeled

#### Scenario: No path exists between selected nodes

- **WHEN** no path exists between the selected source and target nodes
- **THEN** Project Map SHALL show a clear no-path result
- **AND** the graph SHALL remain usable

### Requirement: Project Map SHALL enhance evidence-file navigation

Project Map SHALL enhance evidence-file navigation so file-backed evidence can be used to reverse lookup related nodes, relations, recent changes, and editor targets.

#### Scenario: Evidence file maps to nodes and relations

- **WHEN** a file is referenced by node sources, related artifacts, relations, or governance links
- **THEN** Project Map SHALL show related nodes, related relations, evidence counts, stale count, and low-confidence count for that file
- **AND** selecting a related node SHALL focus or select it in the graph when it still exists

#### Scenario: Evidence file is recently changed

- **WHEN** an evidence file is included in recent changed files or impact input
- **THEN** Project Map SHALL mark the file as recently changed or impact-relevant
- **AND** the file detail SHALL distinguish mapped and unmapped impact when possible

#### Scenario: User opens evidence file

- **WHEN** the user activates a concrete workspace file reference
- **THEN** Project Map SHALL route the request through the existing evidence file open path
- **AND** available one-based line references SHALL be preserved

### Requirement: Project Map SHALL provide local advisor hints inspired by Understand-Anything

Project Map SHALL borrow useful Understand-Anything agent and skill logic as local Project Map advisor projections without requiring the Understand-Anything plugin, graph schema, dashboard, or `.understand-anything` files at runtime.

#### Scenario: Advisor hints are derived locally

- **WHEN** Project Map produces diff-impact, query-neighborhood, node-explain, guide-topology, or graph-health hints
- **THEN** those hints SHALL be derived from `ProjectMapDataset`, Project Map relations, evidence indexes, impact analysis, graph integrity data, and current UI inputs
- **AND** Project Map SHALL NOT shell out to Understand-Anything skills or agents
- **AND** Project Map SHALL NOT require a `.understand-anything/knowledge-graph.json` file

#### Scenario: Diff-impact advisor explains recent changes

- **WHEN** changed-file or impact input is available
- **THEN** Project Map SHALL be able to summarize changed nodes, affected nodes, affected lenses, impacted relations, unmapped files, and risk hints
- **AND** advisor output SHALL be focusable on the graph when mapped nodes or relations exist

#### Scenario: Query-neighborhood advisor explains search context

- **WHEN** a user query matches Project Map nodes or non-node context
- **THEN** Project Map SHALL be able to show bounded one-hop neighborhood hints around the matched context
- **AND** the hints SHALL include relevant nodes, relations, lenses, artifacts, or degraded references when available
- **AND** the hints SHALL respect result caps and large-file safeguards

#### Scenario: Node-explain advisor summarizes selected node context

- **WHEN** a node is selected
- **THEN** Project Map SHALL be able to summarize children, incoming/outgoing relations, evidence, recent activity, stale/candidate state, and risk flags from existing Project Map data
- **AND** the summary SHALL distinguish deterministic evidence from inferred, degraded, or review-needed context

#### Scenario: Guide-topology advisor suggests next inspection targets

- **WHEN** Project Map has enough graph topology to infer useful next steps
- **THEN** Project Map SHALL be able to suggest next nodes or walkthrough hints using signals such as entry candidates, fan-in, fan-out, path traversal, clusters, or existing tour steps
- **AND** suggestions SHALL focus the existing graph rather than opening a separate dashboard

#### Scenario: Graph-health advisor surfaces review warnings

- **WHEN** Project Map detects graph integrity issues, dangling or degraded references, stale nodes, low-confidence relations, inferred relations, empty evidence, or path normalization issues
- **THEN** Project Map SHALL surface those as reviewable warnings
- **AND** warnings SHALL NOT automatically mutate semantic Project Map data
- **AND** warnings SHALL be clearable or collapsible from the UI

### Requirement: Project Map SHALL handle file paths across supported platforms

Project Map SHALL compare, display, and open file-backed evidence in a way that is compatible with Windows, macOS, and Linux path formats.

#### Scenario: File references use different platform separators

- **WHEN** Project Map compares node sources, related artifacts, relation evidence, changed files, or evidence records that use Windows `\` separators or POSIX `/` separators
- **THEN** Project Map SHALL normalize paths for matching
- **AND** it SHALL preserve the original user-facing display path when useful
- **AND** matching SHALL NOT rely on hard-coded path separators

#### Scenario: File reference includes editor line information

- **WHEN** a workspace file reference includes a one-based line number
- **THEN** Project Map SHALL preserve the one-based line reference when routing the file open request
- **AND** path normalization SHALL NOT drop or reinterpret the line reference

#### Scenario: File reference cannot be safely resolved

- **WHEN** a file reference is absolute, outside the workspace, uses an unsupported platform shape, or cannot be resolved against the active workspace
- **THEN** Project Map SHALL show it as degraded file context
- **AND** it SHALL NOT silently discard the reference
- **AND** it SHALL NOT treat user-local absolute path details as portable semantic project facts

### Requirement: Project Map SHALL handle large files responsibly

Project Map SHALL avoid full-content scanning or full-content rendering for large files and large evidence sets in query, activity, evidence navigation, and local context explanation.

#### Scenario: Query or evidence navigation touches a large file

- **WHEN** a query result, evidence record, recent activity item, or file reverse lookup points to a large or unavailable file
- **THEN** Project Map SHALL represent that file through metadata, matched fields, available evidence snippets, capped previews, counts, or degraded content markers
- **AND** it SHALL NOT require reading or rendering the full file content inside the Project Map panel

#### Scenario: Result groups are large

- **WHEN** query, activity, relation, or evidence result groups contain many items
- **THEN** Project Map SHALL cap or collapse visible results by default
- **AND** it SHALL keep the graph-first view responsive
- **AND** it SHALL provide summarized counts so hidden items are not mistaken for missing data

#### Scenario: Local explain-context uses evidence from large files

- **WHEN** the user activates local explain-context and the selected node references large or unavailable files
- **THEN** Project Map SHALL summarize from existing node metadata, relation metadata, evidence records, snippets, and risk flags
- **AND** it SHALL mark missing or oversized content as degraded context
- **AND** it SHALL NOT start a new AI generation run or full-file read to compensate

### Requirement: Project Map SHALL provide lightweight query history

Project Map SHALL provide lightweight query and navigation history to reduce disorientation in large maps.

#### Scenario: Query history is available

- **WHEN** the user performs project queries or focuses nodes from query results
- **THEN** Project Map SHALL be able to show recent query or navigation chips with a small bounded count
- **AND** selecting a chip SHALL restore the query or focus context
- **AND** the user SHALL be able to clear the visible history

### Requirement: Project Map SHALL explain node context locally

Project Map SHALL provide a lightweight "explain this node context" action derived from existing Project Map data without requiring a new AI generation run.

#### Scenario: User asks to explain selected node context

- **WHEN** the user activates the explain-context action for a selected node
- **THEN** Project Map SHALL summarize the selected node, related nodes, relation highlights, evidence sources, recent activity, stale/candidate state, and risk flags from existing dataset context
- **AND** the explanation SHALL distinguish deterministic evidence from inferred or degraded context

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

### Requirement: relationship file navigation preserves scan reachability
The Project Map relationship dashboard SHALL distinguish bounded graph recommendation surfaces from full scan-backed file navigation.

#### Scenario: graph rail shows bounded top files
- **WHEN** relationship scan data contains more files than the graph rail can render
- **THEN** the graph rail SHALL label itself as a high-relevance Top Files surface rather than a complete File Tree
- **AND** the rail SHALL show count context that makes the cap transparent

#### Scenario: graph rail groups top files
- **WHEN** the Top Files surface contains many files with different roles or modules
- **THEN** the rail SHALL group files by at least one semantic layer such as role, module, or path segment
- **AND** role and module groups SHALL be collapsible
- **AND** each expanded leaf group SHALL support bounded default rendering with an explicit expand affordance

#### Scenario: files explorer uses full scan set
- **WHEN** the user opens the relationship Files Explorer view
- **THEN** the file groups SHALL be derived from all scanned files that match active query, role filter, and noise visibility settings
- **AND** the explorer SHALL NOT derive its only data source from the bounded graph rail list

#### Scenario: large scans remain navigable
- **WHEN** a relationship snapshot contains thousands of scanned files
- **THEN** the Files Explorer SHALL keep matching files reachable through grouping and search
- **AND** the UI SHALL distinguish scanned total, matching total, and currently rendered or highlighted counts

#### Scenario: selecting explorer file focuses graph context
- **WHEN** the user selects a file from the Files Explorer
- **THEN** the dashboard SHALL preserve the existing behavior of selecting that file and focusing the graph or inspector context

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

