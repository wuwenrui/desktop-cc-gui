## MODIFIED Requirements

### Requirement: Remote Backend Git Diff Panel Reads

The Git Diff panel SHALL display file-level additions and deletions consistently
with the available diff payload across local Tauri and remote daemon backends.

#### Scenario: status stats are filled from diff evidence

- **WHEN** Git status reports a changed file with `0` additions and `0` deletions
- **AND** the matching Git diff payload contains non-zero line changes
- **THEN** the Git Diff panel SHALL display the non-zero additions/deletions from the diff payload.

#### Scenario: daemon status reports line stats when safe

- **WHEN** the active workspace is a Git repository served by the remote daemon
- **AND** the changed file set is below the guarded stats threshold
- **THEN** daemon `get_git_status` SHALL return file-level additions/deletions for staged and unstaged entries.

#### Scenario: large line counts remain visible

- **WHEN** a Git Diff file row has additions or deletions greater than or equal to `10000`
- **THEN** the row SHALL render a visible compact count
- **AND** the row SHALL retain the exact additions/deletions in accessible text or tooltip metadata.
