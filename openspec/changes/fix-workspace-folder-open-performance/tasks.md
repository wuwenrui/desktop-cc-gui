## 1. Workspace File Scan Runtime

- [x] 1.1 Move desktop `list_workspace_files` scan work to `spawn_blocking` while preserving response shape.
- [x] 1.2 Move desktop `list_workspace_directory_children` scan work to `spawn_blocking` while preserving error semantics.
- [x] 1.3 Apply the same blocking-task boundary to daemon file-access workspace listing paths.

## 2. Remote Session Folder Parity

- [x] 2.1 Add remote forwarding to session folder list/create/rename/move/delete commands.
- [x] 2.2 Add remote forwarding to single and batch session-folder assignment commands.
- [x] 2.3 Preserve local backend behavior and existing frontend service API shape.

## 3. Cross-Platform Open Compatibility

- [x] 3.1 Adjust non-macOS GUI app opening to spawn app targets without waiting for GUI process exit.
- [x] 3.2 Keep explicit command-target opening wait/error behavior unchanged.

## 4. Validation

- [x] 4.1 Run focused Rust tests for workspace file and session management behavior.
- [x] 4.2 Run `openspec validate fix-workspace-folder-open-performance --strict --no-interactive`.
- [x] 4.3 Run frontend typecheck/test only if TypeScript code changes.
