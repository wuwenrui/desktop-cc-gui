## MODIFIED Requirements

### Requirement: Remote Backend Git Diff Panel Reads

The Git Diff panel SHALL treat non-Git workspace diff reads as an empty,
non-error state across local Tauri and remote daemon backends.

#### Scenario: non-Git workspace does not emit diff command failures

- **WHEN** the active workspace root has no `.git` marker
- **THEN** Git status SHALL report `isGitRepository: false`
- **AND** automatic Git Diff preload SHALL NOT call `get_git_diffs`
- **AND** local Tauri and remote daemon `get_git_diffs` SHALL return an empty diff list if called
- **AND** the client SHALL NOT write a runtime/internal command failure notice for the non-Git diff path.

### Requirement: Git Diff Status Polling Cadence

The Git Diff panel SHALL use a 15s Git status polling cadence for both active
and background modes.

#### Scenario: active and background polling use the same cadence

- **WHEN** a Git workspace remains open in active or background polling mode
- **THEN** the next Git status refresh SHALL be scheduled after 15s
- **AND** heavy changesets SHALL NOT extend the cadence beyond 15s.
