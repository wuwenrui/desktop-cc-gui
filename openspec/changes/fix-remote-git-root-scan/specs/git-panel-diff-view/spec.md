## ADDED Requirements

### Requirement: Remote Backend Git Diff Panel Reads

The Git Diff panel SHALL execute read-only repository discovery and diff/status reads against the active backend location. In remote daemon mode, desktop Git commands for status, root scanning, diffs, file full diff, and remote URL lookup MUST delegate to daemon RPC instead of reading local desktop workspace state or filesystem paths.

#### Scenario: Remote workspace root scan uses daemon repository state

- **WHEN** the app is in remote daemon mode and the user scans Git roots from the Git Diff panel
- **THEN** the desktop command MUST call daemon RPC `list_git_roots` with the requested `workspaceId` and `depth`
- **AND** the returned repository candidates MUST come from daemon-side workspace paths

#### Scenario: Remote diff panel reads use daemon repository state

- **WHEN** the app is in remote daemon mode and the Git Diff panel refreshes status, changed file diffs, full file diff, or remote URL
- **THEN** the corresponding desktop command MUST call daemon RPC for that Git method
- **AND** it MUST NOT resolve Git repositories from local desktop filesystem state

#### Scenario: Local diff panel behavior remains unchanged

- **WHEN** the app is in local backend mode and the Git Diff panel refreshes Git state
- **THEN** existing local Tauri Git command behavior, return shape, and error semantics MUST be preserved

#### Scenario: Remote scan error settles loading state

- **WHEN** daemon-side Git root scanning returns an error such as `workspace not found`
- **THEN** the Git Diff panel MUST surface the error through the existing scan error state
- **AND** the loading state MUST settle
