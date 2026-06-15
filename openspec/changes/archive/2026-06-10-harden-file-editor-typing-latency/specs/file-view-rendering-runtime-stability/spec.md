## MODIFIED Requirements

### Requirement: Main File Preview MUST Separate External Change Awareness From Forced Refresh

The main window file preview and editor MUST detect external changes for the active file without forcing a reading snapshot refresh or editor content replacement unless the user explicitly requests refresh, resolves a conflict, or an explicit live preview mode is active.

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

#### Scenario: self-save watcher feedback does not force editor reload

- **WHEN** the app saves the active editor buffer to disk
- **AND** the file watcher reports the same saved snapshot
- **THEN** the file view MUST suppress redundant full-content reload or high-cost reparse
- **AND** the editor MUST keep the saved buffer visible without treating that event as an external conflict

