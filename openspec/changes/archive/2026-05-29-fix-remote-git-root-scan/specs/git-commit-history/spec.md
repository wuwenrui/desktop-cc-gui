## ADDED Requirements

### Requirement: Remote Backend Git History Reads

Git history surfaces SHALL read commit, branch comparison, and worktree comparison data from the active backend location. In remote daemon mode, desktop commands for history, commit details, commit diffs, ref resolution, branch compare, branch diffs, and worktree diffs MUST delegate to daemon RPC.

#### Scenario: Remote commit history uses daemon repository state

- **WHEN** the app is in remote daemon mode and Git history loads commits or commit details
- **THEN** desktop commands MUST call daemon RPC for history/detail/diff/ref-resolution methods
- **AND** returned commit data MUST reflect the daemon-side repository

#### Scenario: Remote branch compare uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user compares branches
- **THEN** branch compare and branch diff commands MUST execute through daemon RPC
- **AND** local desktop repository discovery MUST NOT be used

#### Scenario: Remote worktree diff uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user opens a worktree diff against a branch
- **THEN** worktree diff commands MUST execute through daemon RPC
- **AND** daemon-side path semantics MUST be preserved in the returned diff payload

#### Scenario: Local history behavior remains unchanged

- **WHEN** the app is in local backend mode and Git history loads data
- **THEN** existing local history, compare, and worktree diff behavior MUST be preserved
