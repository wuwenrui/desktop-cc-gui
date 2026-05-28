## ADDED Requirements

### Requirement: Remote Backend Git Operations

Git write operations SHALL execute against the active backend location. In remote daemon mode, desktop commands for stage, unstage, revert file/all, commit, pull, push, sync, fetch, update branch, cherry-pick, revert commit, and reset MUST delegate to daemon RPC and preserve existing confirmation, progress, locking, and error UI semantics.

#### Scenario: Remote write operation uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user confirms a Git write operation
- **THEN** the desktop command MUST call the matching daemon RPC with equivalent parameters
- **AND** the operation MUST execute against daemon-side repository state

#### Scenario: Remote operation preserves UI settlement

- **WHEN** a remote Git write operation succeeds or fails
- **THEN** existing operation progress, success refresh, retry guidance, and error display semantics MUST settle exactly as they do for local operations

#### Scenario: Remote operation does not use local filesystem paths

- **WHEN** the app is in remote daemon mode and a Git operation references a file path or branch/worktree path
- **THEN** desktop-side Git command logic MUST NOT resolve that path against the local desktop filesystem
- **AND** path interpretation MUST remain daemon-side

#### Scenario: Local operation behavior remains unchanged

- **WHEN** the app is in local backend mode and the user performs Git write operations
- **THEN** existing local Git command behavior, validation, return shape, and error semantics MUST be preserved
