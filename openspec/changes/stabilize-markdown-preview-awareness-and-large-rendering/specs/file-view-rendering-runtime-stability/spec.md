## ADDED Requirements

### Requirement: Main File Preview MUST Separate External Change Awareness From Forced Refresh

The main window file preview MUST detect external changes for the active file without forcing a reading snapshot refresh unless the user explicitly requests refresh or an explicit live preview mode is active.

#### Scenario: clean stable preview reports external change without replacing content

- **WHEN** a user has a workspace file open in the main window file view
- **AND** the file buffer is clean
- **AND** live edit preview is disabled
- **AND** the same file changes on disk
- **THEN** the file view MUST expose an external-change notice for that file
- **AND** it MUST NOT replace the current `content` or Markdown preview snapshot automatically

#### Scenario: user refresh applies pending external content

- **WHEN** the main file view has a pending clean external-change notice
- **AND** the user chooses to refresh from disk
- **THEN** the file view MUST apply the pending disk content to the file state
- **AND** the reading preview MAY rebuild from that explicit refresh

#### Scenario: dirty buffer keeps conflict protection

- **WHEN** a user has unsaved local edits in the open file
- **AND** the same file changes on disk
- **THEN** the file view MUST keep the local dirty buffer intact
- **AND** it MUST expose the existing conflict handling path instead of applying disk content automatically

### Requirement: Main File Preview MUST Avoid Refresh-Induced IPC Churn

The main window file preview MUST keep external-change awareness bounded to the active file and MUST NOT introduce new IPC calls from high-frequency render interactions.

#### Scenario: preview interactions do not poll per interaction

- **WHEN** the user scrolls, hovers, selects text, or interacts with Markdown preview controls
- **THEN** the file view MUST NOT issue additional file-content IPC reads for each interaction
- **AND** external-change detection MUST remain governed by the configured monitoring interval or watcher events

#### Scenario: editor startup does not duplicate full file reads for awareness

- **WHEN** a user opens a workspace file in the editor
- **AND** external-change awareness is enabled
- **THEN** the file view MUST use the initial file load as the current content snapshot
- **AND** event-mode external monitoring MUST NOT immediately issue a second full-content read without an external change event

#### Scenario: native metadata fallback does not become JS full-content polling

- **WHEN** native file watching is unavailable or disabled
- **AND** the backend monitor falls back to metadata polling
- **THEN** the frontend MUST continue to consume backend change events
- **AND** it MUST NOT switch to repeated JS-side full-content polling unless backend monitor configuration fails completely
