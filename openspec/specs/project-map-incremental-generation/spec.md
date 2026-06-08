# Project Map Incremental Generation Specification

## Purpose

Project Map incremental generation preserves existing map knowledge while merging AI output, node-scoped corrections, evidence links, task metadata, and robust model-output normalization into the persisted Project Knowledge Map.
## Requirements
### Requirement: Incremental global Project Map generation

The system SHALL merge global Project Map generation output into the existing dataset and SHALL NOT delete existing nodes, lenses, sources, or relationships merely because they are absent from the latest AI output.

#### Scenario: Auto merge keeps root children structural

- **WHEN** automatic Project Map ingestion merges generated nodes into an existing map
- **AND** generated nodes are missing valid parents
- **THEN** durable structural or capability nodes MAY be attached under the project root
- **AND** task, bugfix, risk, workflow, test, artifact, and evidence discoveries SHALL NOT be blindly attached under the project root
- **AND** those non-structural orphan discoveries SHALL be grouped under a stable generic unassigned discoveries node when no better parent is available

#### Scenario: Model prompt avoids root-level task flattening

- **WHEN** the worker builds an automatic ingestion prompt
- **THEN** the prompt SHALL instruct the model to attach task, risk, test, artifact, and workflow discoveries to the nearest existing structural parent
- **AND** the prompt SHALL allow a generic unassigned discoveries fallback when no reliable parent exists
- **AND** the prompt SHALL NOT instruct every new top-level concept to use the root node id

#### Scenario: Repeated global collection preserves existing nodes
- **WHEN** a Project Map already contains nodes A and B
- **AND** a new global generation output contains only node A and new node C
- **THEN** the resulting Project Map SHALL contain A, B, and C
- **AND** node B SHALL keep its existing sources, detail, parent relationship, and generated metadata

#### Scenario: Global collection merges lenses without dropping old lenses
- **WHEN** an existing lens has nodes or evidence
- **AND** the latest global generation omits that lens
- **THEN** the lens SHALL remain in the dataset
- **AND** lens stats SHALL be recalculated from the merged node set

### Requirement: Scoped node generation merge
The system SHALL constrain Complete node and Calibrate node generation to the selected node scope and SHALL preserve unrelated nodes and relationships.

#### Scenario: Complete node preserves unrelated graph
- **WHEN** a user completes node N
- **AND** the model returns updates for N and a new child C
- **THEN** the system SHALL merge N, append C under N when source-backed, and preserve unrelated nodes unchanged

#### Scenario: Calibrate node updates verification fields only in scope
- **WHEN** a user calibrates node N
- **AND** the model returns corrected summary, confidence, stale, or risk signals for N
- **THEN** the system SHALL apply those scoped corrections
- **AND** the system SHALL NOT rebuild global lenses, sibling nodes, or unrelated children

#### Scenario: Calibration completion does not imply candidate confirmation
- **WHEN** a user calibrates node N
- **AND** the completed calibration output still marks N as `candidate=true`
- **THEN** the system SHALL keep N as a candidate
- **AND** the detail panel SHALL explain that calibration completed but manual confirmation, rejection, or pruning is still required
- **AND** the user SHALL be able to resolve the node-level candidate state even when no separate candidate review record exists

### Requirement: Evidence-aware merge semantics

The system SHALL merge generated content with existing content using deterministic evidence-aware rules instead of blind replacement.

#### Scenario: Parent-move candidate confirmation is topology-safe

- **WHEN** a pending Project Map candidate represents a parent move
- **THEN** confirmation SHALL verify that the target node exists, the suggested parent exists, the source parent still matches, and the move does not create a cycle
- **AND** confirmation SHALL reject moves that assign the node as its own parent or assign it below its own descendant
- **AND** confirmation SHALL reject stale moves whose source parent no longer matches the current dataset
- **AND** confirmation SHALL update the old parent `children`, new parent `children`, target `parentId`, manifest update time, and lens stats atomically
- **AND** confirmation SHALL NOT modify node title, summary, detail, sources, confidence, stale, or candidate flags

#### Scenario: Parent-move candidate confirmation preserves hierarchy fit

- **WHEN** a pending Project Map candidate represents an organizer parent move
- **THEN** confirmation SHALL reject detail or evidence nodes that would be flattened directly under the project root
- **AND** confirmation SHALL allow broad overview or category nodes to be restored near the project root
- **AND** confirmation SHALL reject broad overview or category nodes that would be placed below a narrower cross-lens parent
- **AND** the validation SHALL use generic Project Map node shape such as children, node kind, lens id, and graph depth rather than repository-specific names or technologies

#### Scenario: Unsafe organizer suggestions fail closed

- **WHEN** AI organizer output proposes a missing parent, invalid parent, root-level detail flattening, self parent, cycle, stale source parent, hierarchy mismatch, or malformed move
- **THEN** the system SHALL ignore or reject that suggestion
- **AND** the Project Map topology SHALL remain unchanged
- **AND** the run metadata SHALL preserve enough skip or unsafe-suggestion reason text for the task history to explain why no candidate was created

#### Scenario: Batch candidate confirmation uses existing gates

- **WHEN** the user chooses to accept all current Project Map candidates
- **THEN** the system SHALL confirm pending review candidates through the same candidate confirmation rules used by single-candidate confirmation
- **AND** standalone node candidates SHALL be confirmed through the same standalone node-candidate rules used by single-node confirmation
- **AND** candidates that fail validation SHALL be skipped rather than forced through
- **AND** the accepted changes SHALL be persisted as one dataset update after the batch is evaluated

### Requirement: Manual Project Map pruning
The system SHALL provide an explicit user action to physically delete invalid Project Map nodes and SHALL keep destructive pruning out of AI generation output.

#### Scenario: User deletes a non-root node
- **WHEN** a user activates Delete node for node N
- **THEN** the system SHALL remove N and all descendants from the dataset
- **AND** the system SHALL remove N from every parent `children` array
- **AND** candidates targeting deleted nodes SHALL be rejected or removed from active pending review

#### Scenario: User deletes a root or overview node
- **WHEN** the selected node is the root Project Map node
- **THEN** the delete-node action SHALL be available
- **AND** confirming deletion SHALL physically remove all Project Map nodes from the persisted dataset
- **AND** lens stats SHALL be recalculated to zero nodes

### Requirement: Evidence trace file navigation
The system SHALL make evidence and related artifact chips with workspace file paths openable in the existing center editor surface.

#### Scenario: User opens a file-backed evidence source
- **WHEN** a user clicks an evidence chip with `path` and `line`
- **THEN** the system SHALL open that file through the workspace editor surface
- **AND** the editor SHALL receive the 1-based line navigation target
- **AND** when the click originates from Project Map, the editor split SHALL keep Project Map as the left companion surface

#### Scenario: User closes the last Project Map evidence file
- **WHEN** a user closes the last editor tab that was opened from Project Map evidence navigation
- **THEN** the workspace SHALL return to the Project Map surface
- **AND** it SHALL NOT fall back to the conversation canvas

#### Scenario: User sees non-file evidence as inert context
- **WHEN** an evidence or related artifact item has only `ref`, `hash`, or conversation metadata
- **THEN** the item SHALL render as a non-clickable chip
- **AND** the UI SHALL NOT fake a file link

#### Scenario: User opens path-like related artifacts
- **WHEN** a related artifact has an explicit workspace file `path`
- **OR** its label/ref is clearly a workspace file path such as `src/main/resources/application.yml`, `README.md`, or `pom.xml`
- **THEN** the related artifact chip SHALL use the same trace link interaction as evidence chips
- **AND** clicking it SHALL open the file in the center editor through the Project Map evidence navigation path

#### Scenario: Generic file open keeps the default editor companion
- **WHEN** a user opens a workspace file from a non-Project Map surface
- **THEN** the editor split SHALL keep the existing chat companion behavior
- **AND** the Project Map companion SHALL NOT be shown unless the open event explicitly requests it

#### Scenario: User toggles Project Map from the right toolbar
- **WHEN** the user clicks the Project Map toolbar icon while Project Map is closed
- **THEN** the Project Map surface SHALL open
- **WHEN** the user clicks the same toolbar icon while Project Map is the active center surface or editor companion
- **THEN** the Project Map surface SHALL close without closing the current workspace
- **AND** shell adapter layers SHALL forward the center mode and editor companion setters required by this toggle

#### Scenario: User opens Project Map while an editor file is active
- **WHEN** the user clicks the Project Map toolbar icon while the center editor is active
- **AND** Project Map is not already the editor companion
- **THEN** the editor SHALL remain open
- **AND** Project Map SHALL open as the editor companion surface instead of replacing the editor
- **AND** a maximized editor SHALL be restored so the Project Map companion is visible

#### Scenario: User reviews generation task cards
- **WHEN** the Project Map task drawer shows active, queued, or recent generation runs
- **THEN** each task card SHALL show the generation action such as Collect profile, Complete node, or Calibrate node
- **AND** node-scoped runs SHALL show the target node title and node id when the node still exists
- **AND** the card layout SHALL use compact spacing so action, target, engine/model, scope, started time, run id, and path can be scanned without excessive vertical whitespace

### Requirement: Button-specific generation prompts
The system SHALL use concise, action-specific prompts for Collect profile, Complete node, and Calibrate node.

#### Scenario: Collect profile prompt requests incremental global merge input
- **WHEN** a user starts Collect profile
- **THEN** the prompt SHALL ask for high-signal missing or changed project structure
- **AND** the prompt SHALL state that absence from output is not deletion

#### Scenario: Complete node prompt requests selected-node enrichment
- **WHEN** a user starts Complete node
- **THEN** the prompt SHALL target the selected node and optional descendants only
- **AND** the prompt SHALL ask for missing facts, key logic, risks, sources, and source-backed children

#### Scenario: Calibrate node prompt requests verification
- **WHEN** a user starts Calibrate node
- **THEN** the prompt SHALL ask for correction, confidence adjustment, stale/candidate marking, and unsupported-claim removal
- **AND** the prompt SHALL NOT ask for broad map expansion

### Requirement: Robust model output and generic evidence path normalization
The system SHALL treat model output envelopes and evidence references as untrusted, project-agnostic inputs and SHALL normalize them without relying on repository-specific paths, node ids, or project names.

#### Scenario: Path-like source labels are preserved as readable workspace evidence
- **WHEN** a generation request contains a source or related artifact whose explicit `path` is missing
- **AND** its `label` or `ref` is clearly a workspace file path, such as an extension-bearing path or an important root filename
- **THEN** the normalized request SHALL set that value as the source `path`
- **AND** the original source type and label SHALL remain available for traceability

#### Scenario: Calibration reads legacy path-like source labels
- **WHEN** a persisted calibration run has `readSources` with a path-like `label` or legacy `ref` but no `path`
- **THEN** the worker SHALL read that workspace file as evidence before prompting the model
- **AND** the worker SHALL apply the same generic readable-file checks used for explicit paths

#### Scenario: Codex thread output is extracted from final assistant channels
- **WHEN** a Codex-backed Project Map run completes with valid JSON in a final assistant field such as `last_agent_message`, `agent_message`, or nested turn/result output
- **THEN** the worker SHALL extract and parse that Project Map payload before declaring JSON failure
- **AND** unrelated or non-Project Map JSON snippets SHALL still be ignored

### Requirement: Project Map generation preserves workspace ownership
The system MUST bind each Project Map generation run to the workspace, storage key, and storage location that were active when the run started, and MUST NOT let later workspace or storage-view switches redirect that run's dataset updates, persistence writes, or UI state into another workspace or storage view.

#### Scenario: In-flight run completes after workspace switch
- **WHEN** a Project Map generation run starts for workspace A
- **AND** the user switches to workspace B before the run emits progress, completion, or failure
- **THEN** the run SHALL continue using workspace A's storage key and worker-local dataset for any persisted run update
- **AND** workspace B's Project Map dataset and UI state SHALL NOT receive nodes, sources, relationships, or run metadata from workspace A

#### Scenario: In-flight run completes after storage view switch
- **WHEN** a Project Map generation run starts for the global storage view of workspace A
- **AND** the user switches to the project storage view of the same workspace before the run emits progress, completion, or failure
- **THEN** the run SHALL continue writing only to the global storage location it started with
- **AND** the project storage view's UI state SHALL NOT receive nodes, sources, relationships, or run metadata from the global run

#### Scenario: Worker write requires matching manifest storage key
- **WHEN** a Project Map worker attempts to persist a dataset for a workspace
- **THEN** the dataset manifest `storageKey` MUST match the storage key derived for that target workspace
- **AND** a mismatch MUST reject the write instead of rewriting ownership or silently falling back to the active workspace

### Requirement: Project Map storage rejects ownership mismatches
The Project Map storage boundary MUST treat persisted snapshot ownership as a contract and MUST reject reads or writes whose manifest storage key does not match the requested workspace storage key.

#### Scenario: Backend rejects mismatched manifest on write
- **WHEN** the frontend calls the Project Map snapshot write command for workspace A
- **AND** the incoming files include a `manifest.json` whose `storageKey` belongs to workspace B
- **THEN** the backend MUST reject the write with an ownership mismatch error
- **AND** the backend MUST NOT write any snapshot files into workspace A's Project Map directory

#### Scenario: Frontend quarantines mismatched persisted snapshot on read
- **WHEN** the Project Map read path loads files for workspace A
- **AND** the persisted `manifest.json` has a `storageKey` that does not match workspace A's expected storage key
- **THEN** the frontend MUST NOT render that persisted snapshot as a valid Project Map dataset
- **AND** the user-visible dataset SHALL fall back to an empty or error/quarantined state for workspace A

### Requirement: Project Map structured-output failure visibility
The Project Map worker SHALL treat model output as untrusted and SHALL expose parse or repair failures as visible run failures instead of writing incomplete datasets.

#### Scenario: Malformed output fails closed
- **WHEN** a generation, completion, calibration, or auto-ingestion run receives malformed model output
- **AND** structured-output repair cannot produce a valid Project Map payload
- **THEN** the run SHALL enter a failed state with a diagnostic reason
- **AND** the worker SHALL NOT write partial lenses, partial candidates, or partial manifest data as trusted Project Map knowledge

#### Scenario: Failure diagnostics are visible without blocking review
- **WHEN** a Project Map run fails because output parsing, ownership validation, evidence reading, or persistence fails
- **THEN** the task drawer SHALL expose the failure category and latest diagnostic message
- **AND** existing persisted Project Map data SHALL remain reviewable

### Requirement: Project Map Automatic Sessions SHALL Declare Visibility By Purpose
Project Map AI sessions SHALL declare automatic session visibility according to whether they are traceable generation runs or pure internal helper runs.

#### Scenario: Project Map generation is system-auto
- **WHEN** Project Map global generation, node completion, calibration, or auto-ingestion creates a new session or thread
- **THEN** the session SHALL be classified with `sessionPurpose=project-map-generation`
- **AND** the session SHALL use `visibility=system-auto`

#### Scenario: Project Map organizer is hidden
- **WHEN** Project Map organizer creates a new session or sync engine helper to propose parent moves
- **THEN** the session SHALL be classified with `sessionPurpose=project-map-organizer`
- **AND** the session SHALL use `visibility=hidden`

#### Scenario: Project Map task history remains traceable
- **WHEN** a Project Map system-auto generation run completes, fails, or is archived
- **THEN** run metadata SHALL preserve enough thread/session reference for audit or recovery
- **AND** the session SHALL NOT appear at workspace root

### Requirement: Project Map uses shared model structured-output normalization

Project Map generation and organizer runs SHALL normalize untrusted model responses through the shared model structured-output path before applying map payloads or organizer candidates.

#### Scenario: Main generation uses shared normalization

- **WHEN** a Project Map generation, completion, calibration, or auto-ingestion run receives model text
- **THEN** the worker MUST parse and validate the response through the shared structured-output normalization path before applying the Project Map payload

#### Scenario: Organizer uses shared normalization

- **WHEN** a Project Map AI organizer run receives model text for parent move suggestions
- **THEN** the organizer MUST parse and validate the response through the shared structured-output normalization path before creating parent-move candidates, skipped records, or unsafe records

#### Scenario: Organizer malformed JSON gets bounded repair

- **WHEN** an organizer response is malformed and initial normalization fails
- **THEN** the organizer MUST request one JSON-only repair attempt using the original organizer prompt and the invalid response
- **AND** it MUST use the repaired payload only if it satisfies the organizer payload validator

#### Scenario: Organizer repair failure remains fail-closed

- **WHEN** both organizer initial normalization and repair normalization fail
- **THEN** the organizer run MUST fail with a visible parse diagnostic
- **AND** the worker MUST NOT write partial organizer candidates or map metadata from the failed response

### Requirement: Project Map relation context support
Project Map generation and persistence SHALL tolerate optional typed relations between nodes, including relation type, source/target node IDs, confidence, stale state, source kind, and supporting evidence.

#### Scenario: Dataset contains optional relations
- **WHEN** a Project Map dataset includes relation records between existing nodes
- **THEN** generation, persistence, and display preparation preserve those relations without breaking existing node rendering

#### Scenario: Dataset omits relations
- **WHEN** a Project Map dataset does not include relation records
- **THEN** existing Project Map loading and incremental generation continue to work without requiring migration

### Requirement: Project Map context ignore policy
Project Map context and impact construction SHALL apply an ignore policy that excludes dependency folders, generated outputs, runtime artifacts, binary assets, and other non-source paths before matching files to nodes.

#### Scenario: Ignored file path is provided to impact analysis
- **WHEN** changed file paths include dependency, generated, runtime, or binary paths covered by the ignore policy
- **THEN** those paths are excluded from node matching and do not create changed or unmapped Project Map nodes

#### Scenario: Source file path is not ignored
- **WHEN** a changed file path is a source or specification file not covered by the ignore policy
- **THEN** Project Map context and impact construction can use it for node matching

### Requirement: Project Map relation snapshot round trip
Project Map storage SHALL allow optional relation snapshots to be written and read as part of the existing Project Map snapshot contract.

#### Scenario: Relation snapshot exists
- **WHEN** Project Map storage contains `relations/latest.json` for a workspace map
- **THEN** reading the Project Map returns relation data to the frontend dataset builder

#### Scenario: Relation snapshot is absent
- **WHEN** Project Map storage has no `relations/latest.json`
- **THEN** reading the Project Map succeeds and returns an empty or omitted relation collection without requiring migration

### Requirement: Project Map relation write path safety
Project Map snapshot writes SHALL permit `relations/latest.json` and continue rejecting relation files outside the allowed Project Map storage contract.

#### Scenario: Safe relation path is written
- **WHEN** a Project Map snapshot includes `relations/latest.json`
- **THEN** the backend accepts the path as part of the constrained snapshot contract

#### Scenario: Unsafe relation path is written
- **WHEN** a Project Map snapshot includes a relation file path with nested directories, parent traversal, uppercase reserved segments, or unsupported extensions
- **THEN** the backend rejects the write path

### Requirement: Project Map optional tour metadata
Project Map datasets SHALL tolerate optional tour metadata without requiring migration for existing datasets.

#### Scenario: Dataset includes tour steps
- **WHEN** a Project Map dataset includes tour steps
- **THEN** Project Map generation and persistence preserve those steps

#### Scenario: Dataset omits tour steps
- **WHEN** a Project Map dataset omits tour steps
- **THEN** Project Map continues to load and render normally

### Requirement: Deterministic spec task document graph extraction
Project Map generation SHALL support deterministic extraction of OpenSpec, Trellis task, and documentation relationships before applying any LLM-inferred enrichment.

#### Scenario: OpenSpec capability is linked deterministically
- **WHEN** deterministic evidence links a Project Map node to an OpenSpec capability
- **THEN** the generated graph records the relationship with deterministic or spec-link source kind

### Requirement: Project Map fingerprint refresh classification
Project Map incremental generation SHALL classify source changes before recommending skip, partial refresh, architecture refresh, or full refresh.

#### Scenario: Cosmetic or ignored changes are detected
- **WHEN** changed files are cosmetic or ignored by Project Map policy
- **THEN** Project Map does not require a refresh recommendation

### Requirement: Project Map graph integrity validation
Project Map generation SHALL validate node references, relation endpoints, and evidence references before using graph data for rendering or context packs.

#### Scenario: Relation endpoint is missing
- **WHEN** a relation references a missing source or target node
- **THEN** Project Map reports or removes the invalid relation before using it

### Requirement: Project Map generation consumes API contract evidence without flattening

The system SHALL allow Project Map generation and scan flows to consume API contract artifacts as source-backed evidence while preserving API contracts as a separate fact layer.

#### Scenario: API contract artifacts enrich Project Map generation

- **WHEN** Project Map generation builds context for a workspace that has API contract artifacts
- **THEN** the generation flow SHALL be able to read API endpoint summaries, API groups, and method chain evidence as source-backed context
- **AND** the generation flow SHALL NOT delete existing Project Map nodes merely because an API endpoint is absent from the latest API scan

#### Scenario: API contracts are not flattened into semantic nodes

- **WHEN** API contract scan artifacts contain many endpoints
- **THEN** Project Map generation SHALL NOT blindly create one semantic node per endpoint under the project root
- **AND** API contract hierarchy SHALL remain available through the API contract view or source-backed grouped evidence

#### Scenario: API evidence keeps provenance

- **WHEN** Project Map generation references API contract information
- **THEN** generated or enriched Project Map content SHALL keep provenance linking back to API contract artifacts, source files, schema files, or evidence lines when available
- **AND** weak API inference SHALL remain distinguishable from strong schema-backed API evidence

#### Scenario: API evidence consumed by generation is redacted

- **WHEN** Project Map generation consumes API contract evidence containing examples, headers, cookies, tokens, passwords, secrets, credentials, or api keys
- **THEN** the generation context SHALL use redacted evidence values
- **AND** unredacted sensitive values SHALL NOT be injected into prompts or generated Project Map content

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

### Requirement: Deterministic relationships are authoritative substrate
Project Map generation SHALL treat relationship scan data as authoritative facts for graph-like reasoning.

#### Scenario: relationship scan exists
- **WHEN** generation starts and fresh relationship artifacts exist
- **THEN** generator MAY consume `files`, `relations`, `modules`, `impact`, and `context-packs`
- **AND** generated outputs SHALL preserve relation provenance fields (`scanRunId`, relation ids)

#### Scenario: relationship conflict
- **WHEN** generated relation conflicts with deterministic relation
- **THEN** deterministic edge SHALL win and generator output SHALL be flagged as conflicting

### Requirement: generation must not overwrite deterministic edge
The generation system SHALL never overwrite deterministic relation artifacts.

#### Scenario: generator emits relation
- **WHEN** generator proposes new relation edges
- **THEN** it SHALL write only semantic overlays or suggestions, not modify `relations/*.json` directly

### Requirement: stale context awareness in generation
Generation SHALL reflect stale state in prompts and confidence.

#### Scenario: stale scan
- **WHEN** scan is stale by commit/fingerprint
- **THEN** generator SHALL include stale warning and optional refresh path

### Requirement: no redundant broad scans
The system SHALL reuse existing relationship context packs to avoid duplicate scanning.

#### Scenario: fresh context pack exists
- **WHEN** generation needs project-resource discovery
- **THEN** generator SHALL first read context packs rather than re-scan all files

### Requirement: provenance traceability for calibrated nodes
Calibrations and candidates SHALL keep source links to relationship artifacts.

#### Scenario: candidate calibration
- **WHEN** a map node is calibrated
- **THEN** candidate SHALL reference evidence relation/file/run identifiers

