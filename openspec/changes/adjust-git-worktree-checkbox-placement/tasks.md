## Tasks

- [x] Update `GitHistoryWorktreePanel` file row markup so file-level `InclusionToggle` renders in the right-side meta/action area.
- [x] Update shared `GitDiffPanelFileSections` file row markup so the visible Git diff file list also renders file-level `InclusionToggle` as the trailing control.
- [x] Remove tree root/folder leading commit checkboxes so tree selection uses trailing file controls consistently.
- [x] Add scoped CSS for Git History worktree row selection control states without changing shared Git Diff panel behavior.
- [x] Add/adjust focused component test coverage for accessible checkbox placement and unchanged toggle behavior.
- [x] Extract shared diff tree builder/compactor so Git tree and Git History/HUB worktree tree use one `buildDiffTree` / `compactDiffTree` contract.
- [x] Render empty folder chains as dotted labels (`a.b.c`) in both Git tree and Git History/HUB worktree tree while preserving branch folders that contain files.
- [x] Add/adjust focused component test coverage for dotted folder display parity and branch-preserving compact behavior.
- [x] Normalize Git and Git History/HUB worktree file tree typography through shared CSS variables, using right-side Git file tree styles as the source of truth.
- [x] Replace Git History/HUB worktree hard-coded status/stat colors with theme variables so theme and custom theme switching remain compatible.
- [x] Restyle Git History/HUB overlay close chip as a `20px * 20px` small-radius square control without changing close behavior.
- [x] Backfill proposal/design/spec with all current workspace changes, including checkbox placement, tree compaction, typography parity, theme compatibility, and close chip style.
- [x] Review multi-platform compatibility risks for Windows/POSIX paths, custom themes, WebView CSS support, pointer/keyboard semantics, and compact folder label collisions.
- [x] Fix compact folder label collision by storing compacted tree children with structural keys instead of dotted display labels.
- [x] Run focused Vitest, TypeScript check, lint, large-file check, and strict OpenSpec validation.
