## ADDED Requirements

### Requirement: Live Edit Preview File Refresh MUST Be Debounced

When live edit preview is enabled and the currently opened file changes on disk, automatic content application MUST be debounced or equivalently coalesced to avoid visible refresh storms.

#### Scenario: burst writes coalesce into one visible refresh

- **WHEN** live edit preview is enabled
- **AND** an AI or external process writes the currently opened file multiple times within a short interval
- **THEN** the file view MUST coalesce those clean external updates before applying them to the preview
- **AND** the user MUST NOT see one full preview rebuild per individual write

#### Scenario: live preview still follows final disk state

- **WHEN** a burst of external file writes settles while live edit preview is enabled
- **THEN** the file view MUST eventually apply the latest detected disk content for the active file
- **AND** the applied content MUST use the existing dirty-buffer conflict protection when local edits exist
