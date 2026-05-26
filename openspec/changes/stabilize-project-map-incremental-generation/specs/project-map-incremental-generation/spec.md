## ADDED Requirements

### Requirement: Incremental global Project Map generation
The system SHALL merge global Project Map generation output into the existing dataset and SHALL NOT delete existing nodes, lenses, sources, or relationships merely because they are absent from the latest AI output.

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

### Requirement: Evidence-aware merge semantics
The system SHALL merge generated content with existing content using deterministic evidence-aware rules instead of blind replacement.

#### Scenario: Existing sources and generated sources are unioned
- **WHEN** an existing node has source S1
- **AND** generated output for the same node has source S2
- **THEN** the merged node SHALL include S1 and S2 without duplicates

#### Scenario: Confidence is not blindly upgraded
- **WHEN** an existing node has low or medium confidence
- **AND** generated output requests high confidence without sources
- **THEN** the system SHALL NOT upgrade the node to high confidence

#### Scenario: Calibration can lower confidence and mark stale
- **WHEN** calibration evidence contradicts a node
- **AND** generated output marks the node stale or lowers confidence
- **THEN** the system SHALL apply stale and lower confidence within the selected scope

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
