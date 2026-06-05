## ADDED Requirements

### Requirement: Workspace Root Node SHALL Act As A File Management Target
The workspace root node SHALL act as a valid target for file management actions that operate on a directory target.

#### Scenario: Root accepts new file action
- **WHEN** the user opens the workspace root context menu and selects New File
- **THEN** the file tree SHALL create the file relative to the workspace root directory
- **AND** the backend MUST enforce workspace boundary validation before writing the file

#### Scenario: Root accepts new folder action
- **WHEN** the user opens the workspace root context menu and selects New Folder
- **THEN** the file tree SHALL create the folder relative to the workspace root directory
- **AND** the backend MUST enforce workspace boundary validation before creating the folder

#### Scenario: Root accepts paste action
- **WHEN** the user has a valid internal file tree clipboard item and selects Paste on the workspace root node
- **THEN** the file tree SHALL paste the copied item into the workspace root directory
- **AND** the backend SHALL return the created workspace-relative path

#### Scenario: Root rejects dangerous item actions
- **WHEN** the user opens management actions for the workspace root node
- **THEN** Duplicate, Rename, and Move to Trash MUST NOT be offered as root actions
- **AND** those actions MUST NOT be dispatched against the workspace root path

### Requirement: Root Management Actions SHALL Use Shared File Operation Feedback
Root-node file management actions SHALL use the same operation pending, success, and error feedback path as regular file and folder rows.

#### Scenario: Root paste failure is visible
- **WHEN** a Paste action from the workspace root node fails
- **THEN** the file tree SHALL show a recoverable operation error
- **AND** the system MUST NOT silently swallow the failure

#### Scenario: Root create success refreshes tree
- **WHEN** a New File, New Folder, or Paste action from the workspace root node succeeds
- **THEN** the file tree SHALL refresh workspace file data
- **AND** the resulting item SHOULD be selected or made discoverable in the refreshed tree
