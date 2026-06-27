# Tasks

- [x] Add frontend guard so `useGitDiffs` skips known non-Git workspaces.
- [x] Suppress legacy non-Git diff failures as empty diffs without `console.error` or hook error state.
- [x] Return empty diff lists from local Tauri and daemon `get_git_diffs` when the resolved workspace root has no `.git` marker.
- [x] Return `isGitRepository: false` from daemon `get_git_status` for non-Git roots.
- [x] Set Git Diff status polling cadence to 15s for active and background modes.
- [x] Add focused Vitest coverage for non-Git diff suppression.
- [x] Validate with focused tests, `npm run typecheck`, `npm run lint`, `cargo fmt --check`, and `cargo check`.
