## MODIFIED Requirements

### Requirement: Workspace Session Folder Commands Shall Follow Active Backend Location
Workspace session folder list, mutation, deletion, and assignment commands SHALL execute against the active backend location. In remote backend mode, desktop Tauri commands MUST forward to daemon RPCs instead of reading or mutating desktop-local session folder metadata.

#### Scenario: remote session folder list uses daemon state
- **WHEN** backend mode is remote
- **AND** the client lists workspace session folders
- **THEN** the desktop command SHALL request `list_workspace_session_folders` from the daemon
- **AND** it MUST NOT read desktop-local catalog metadata as fallback

#### Scenario: remote session folder mutations use daemon state
- **WHEN** backend mode is remote
- **AND** the client creates, renames, moves, deletes, or assigns workspace session folders
- **THEN** the desktop command SHALL forward the matching daemon RPC with equivalent parameters
- **AND** daemon errors SHALL surface through the existing command error path

#### Scenario: local backend behavior remains unchanged
- **WHEN** backend mode is local
- **THEN** workspace session folder commands SHALL continue using local workspace state and catalog metadata
- **AND** frontend service API shape SHALL remain unchanged
