## ADDED Requirements

### Requirement: Remote Backend Branch Management

Branch management commands SHALL execute against the active backend location. In remote daemon mode, desktop commands for branch list, checkout, create, delete, rename, merge, rebase, update, and related branch-derived actions MUST delegate to daemon RPC.

#### Scenario: Remote branch list uses daemon repository state

- **WHEN** the app is in remote daemon mode and branch lists are loaded
- **THEN** the desktop command MUST call daemon RPC `list_git_branches`
- **AND** branch data MUST reflect the daemon-side repository

#### Scenario: Remote branch mutation uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user confirms checkout, create, delete, rename, merge, rebase, or update branch
- **THEN** the desktop command MUST call the matching daemon RPC with equivalent parameters
- **AND** the mutation MUST execute on the daemon-side repository

#### Scenario: Local branch behavior remains unchanged

- **WHEN** the app is in local backend mode and branch management commands run
- **THEN** existing local validation, execution, return shape, and error semantics MUST be preserved
