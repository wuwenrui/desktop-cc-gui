# intent-canvas-workspace-files Specification

## Purpose
TBD - created by archiving change add-intent-canvas-workspace-files. Update Purpose after archive.
## Requirements
### Requirement: Project canvas files SHALL be durable independent artifacts

The system SHALL store Intent Canvas documents as app-global files under `~/.ccgui/project-canvas/<project-storage-key>/` and SHALL maintain an index file for listing and management. The project storage key SHALL partition canvases by workspace identity and SHALL use the same identity rule as Project Map.

#### Scenario: Create a new canvas

- **GIVEN** an active connected workspace
- **WHEN** the user creates an Intent Canvas
- **THEN** the system writes `~/.ccgui/project-canvas/<project-storage-key>/<canvas-id>.intent-canvas.json`
- **AND** updates `~/.ccgui/project-canvas/<project-storage-key>/index.json`
- **AND** the document contains title, mode, summary, links, scene, aiContext, createdAt, and updatedAt.

#### Scenario: Missing project index

- **GIVEN** `~/.ccgui/project-canvas/<project-storage-key>/index.json` does not exist
- **WHEN** the manager loads canvases
- **THEN** it shows an empty collection instead of crashing.

#### Scenario: Legacy workspace-local canvases exist

- **GIVEN** a previous version wrote `index.json` and `canvas-*.intent-canvas.json` under `<workspace>/.mossx/canvases`
- **WHEN** the manager loads canvases for the active project
- **THEN** the system migrates safe legacy canvas files into `~/.ccgui/project-canvas/<project-storage-key>/`
- **AND** future writes use only the global project-canvas directory.

#### Scenario: Legacy documents exist without index

- **GIVEN** a previous version left valid `canvas-*.intent-canvas.json` files under `<workspace>/.mossx/canvases` without `index.json`
- **WHEN** the manager loads canvases for the active project
- **THEN** the system synthesizes `~/.ccgui/project-canvas/<project-storage-key>/index.json` from valid canvas documents
- **AND** invalid or unsafe files are ignored.

#### Scenario: Reject unsafe global storage path

- **GIVEN** a compromised or malformed client sends an absolute path, a path containing `..`, a nested directory, or an unsupported filename
- **WHEN** Project Canvas storage command receives the path
- **THEN** the command rejects the operation before filesystem IO
- **AND** generic workspace file commands remain unchanged.

#### Scenario: Remote mode storage is unsupported

- **GIVEN** the app is running in remote backend mode
- **WHEN** Project Canvas storage command is called
- **THEN** the command fails closed with a readable unsupported error
- **AND** it does not forward ambiguous app-global storage writes to the remote backend.

#### Scenario: Malformed canvas document

- **GIVEN** a canvas document contains invalid JSON or invalid required fields
- **WHEN** the manager loads canvases
- **THEN** the invalid document is excluded from trusted UI state
- **AND** the user sees a readable warning.

#### Scenario: Nullable Excalidraw selection maps

- **GIVEN** a saved canvas scene contains `appState.selectedElementIds` or `appState.selectedGroupIds` as `null` or another malformed non-object value
- **WHEN** the editor opens the canvas
- **THEN** those fields are normalized to empty object maps before Excalidraw receives initial data
- **AND** the editor does not crash during initialization.

### Requirement: Canvas Manager SHALL be a standalone module

The system SHALL provide an Intent Canvas management surface separate from Project Map.

#### Scenario: Open manager from app navigation

- **GIVEN** an active workspace
- **WHEN** the user opens the Canvas module
- **THEN** the app switches to the Canvas management surface
- **AND** lists existing canvases from global project-canvas storage for the active project partition.

#### Scenario: Manage canvas records

- **GIVEN** one or more existing canvas documents
- **WHEN** the user searches, opens, renames, duplicates, or deletes a canvas
- **THEN** the index and document files remain consistent with the selected action.

#### Scenario: Batch delete canvas records

- **GIVEN** multiple canvas documents appear in the manager grid
- **WHEN** the user selects multiple canvases and confirms batch delete
- **THEN** all selected canvas files are moved to trash
- **AND** the index is written once with the deleted records removed
- **AND** index-unreachable orphan canvas documents and stale atomic index temp files are physically removed from the Project Canvas partition
- **AND** canceling keeps every selected canvas unchanged.

### Requirement: Canvas Editor SHALL support mainstream whiteboard interactions

The editor SHALL provide a drawing experience comparable to mainstream whiteboard tools for the MVP scope.

#### Scenario: Draw and save intent logic

- **GIVEN** a user is editing a canvas
- **WHEN** the user draws boxes, text, arrows, and freehand marks
- **THEN** the scene is preserved in the canvas document
- **AND** saving updates the document file and index metadata.

#### Scenario: Edit context metadata

- **GIVEN** a canvas is open
- **WHEN** the user edits title, summary, linked files, linked Project Map nodes, or linked threads
- **THEN** those fields are saved as structured metadata separate from raw drawing elements.

### Requirement: Project Map SHALL create or open real canvas files

Project Map node and file/evidence actions SHALL open the standalone Canvas module with a persisted canvas document rather than a temporary modal payload.

#### Scenario: Create canvas from Project Map node

- **GIVEN** a selected Project Map node
- **WHEN** the user chooses Architect or Spotlight canvas
- **THEN** the app opens a canvas document linked to the selected Project Map node
- **AND** the canvas can be saved and reopened later.

#### Scenario: Create canvas from Project Map file evidence

- **GIVEN** a Project Map node has a source/evidence file path
- **WHEN** the user chooses to create a canvas for that file
- **THEN** the created canvas includes that file path in `links.filePaths`.

#### Scenario: Import request is one-shot

- **GIVEN** Project Map sends an Intent Canvas open/import request
- **WHEN** the Canvas manager receives the request
- **THEN** the manager consumes that request id exactly once
- **AND** React rerenders, editor activation, or index refreshes SHALL NOT create another canvas from the same request.

### Requirement: Chat sessions SHALL accept canvas structured context

The system SHALL let the user send a saved Intent Canvas as structured context to the current conversation.

#### Scenario: Attach canvas before sending

- **GIVEN** a saved canvas and an active workspace thread
- **WHEN** the user chooses to attach it to the current session
- **THEN** the app stages the canvas above the Composer instead of immediately sending a message
- **AND** the staged card shows a graphical preview, title, summary, and element/file/node metrics
- **AND** the user can remove the staged canvas before sending.

#### Scenario: Send canvas to active thread

- **GIVEN** a saved canvas staged above the Composer
- **WHEN** the user sends the Composer draft
- **THEN** the app sends a user message containing a clear intent-context disclaimer, canvas summary, links, semantic context packet, and JSON snapshot.
- **AND** the packet prioritizes semantic nodes, semantic edges, evidence clues, linked files, linked Project Map nodes, and user-authored text over low-value visual coordinates or styling.
- **AND** the packet includes completeness counts for total, sent, and omitted semantic nodes, semantic edges, evidence clues, visual text blocks, and visual arrows.
- **AND** any compression or truncation is explicit rather than silent.

#### Scenario: Send large canvas to active thread

- **GIVEN** a saved canvas contains more visual or semantic data than the send budget allows
- **WHEN** the user sends the Composer draft
- **THEN** the app compresses low-value drawing details before semantic clues
- **AND** the structured payload sets `truncated=true`
- **AND** the omitted counts tell the user and AI which categories were compressed.

#### Scenario: No active thread exists

- **GIVEN** a saved canvas and no active thread
- **WHEN** the user attaches the canvas to session
- **THEN** the app creates or activates a workspace thread before staging the canvas.

### Requirement: Canvas Editor SHALL respect app theme and workspace ergonomics

The editor SHALL remain readable in both light and dark theme and SHALL let users collapse metadata/context rails.

#### Scenario: Theme changes

- **GIVEN** the app is using light or dark theme
- **WHEN** the user opens Intent Canvas
- **THEN** the manager, editor rails, controls, context preview, and composer attachment card use project theme colors
- **AND** the Excalidraw surface uses the matching light or dark theme.

#### Scenario: Collapse editor rails

- **GIVEN** a canvas is open
- **WHEN** the user collapses the left or right rail
- **THEN** the rail narrows to a restore affordance
- **AND** the central drawing area expands
- **AND** the user can expand the rail again.

### Requirement: Canvas deletion SHALL use app-local confirmation

The system SHALL confirm destructive Canvas deletion through the app's local UI pattern rather than global/browser/platform dialogs.

#### Scenario: Delete canvas from manager

- **GIVEN** a canvas appears in the manager grid
- **WHEN** the user clicks delete
- **THEN** an inline app-local confirmation popover appears
- **AND** the canvas is deleted only after explicit confirmation
- **AND** canceling keeps the canvas unchanged.

