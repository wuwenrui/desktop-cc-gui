## 1. OpenSpec Contract

- [x] 1.1 Create proposal/design/spec tasks for root-first file tree first paint.
- [x] 1.2 Record compatibility writing: full `list_workspace_files` semantics remain unchanged.

## 2. Backend Root Directory Query

- [x] 2.1 Allow desktop `list_workspace_directory_children` to treat empty path as workspace root.
- [x] 2.2 Apply the same empty-path root behavior to daemon directory-child listing.
- [x] 2.3 Preserve traversal and `.git` rejection for non-empty paths.

## 3. Frontend File Tree Loading

- [x] 3.1 Change `useWorkspaceFiles` initial visible load to use root directory-child response.
- [x] 3.2 Remove automatic `getWorkspaceFiles()` hydration from file tree startup, manual refresh, polling, and workspace switching.
- [x] 3.3 Keep polling shallow to avoid recurring recursive scan pressure.
- [x] 3.4 Preserve stale workspace guards, retry behavior, and error reporting.
- [x] 3.5 Defer root-level gitignore marker computation on directory-child first paint.
- [x] 3.6 Cache bounded root snapshots per workspace for fast switch-back rendering.
- [x] 3.7 Reuse in-flight root directory requests across A/B/A workspace switches.
- [x] 3.8 Restore cached/empty workspace state before paint on workspace id changes.
- [x] 3.9 Add one-shot legacy full snapshot fallback when root directory-child fails before any snapshot exists.

## 4. Validation

- [x] 4.1 Update focused hook tests for root-first loading, cache restore, in-flight reuse, fallback recovery, and absence of automatic full scans.
- [x] 4.2 Add focused Rust tests for empty root directory-child queries and root gitignore deferral.
- [x] 4.3 Run focused frontend tests and typecheck.
- [x] 4.4 Run focused Rust tests.
- [x] 4.5 Run `openspec validate fix-workspace-filetree-first-paint-performance --strict --no-interactive`.

## 5. Review Fixes

- [x] 5.1 Tighten root sentinel compatibility so whitespace-only directory paths remain rejected.
- [x] 5.2 Ensure legacy fallback writes only root-level projected data into the bounded root snapshot cache.
- [x] 5.3 Guard late async responses from mutating hook state after unmount.
- [x] 5.4 Record compatibility and performance review outcomes in proposal/design/spec artifacts.
