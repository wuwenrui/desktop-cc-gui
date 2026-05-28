## Context

`useWorkspaceFiles` performs an initial `getWorkspaceFiles()` call whenever a connected workspace becomes active. That command eventually reaches `list_workspace_files_inner`, which performs synchronous root listing, recursive `WalkBuilder` traversal, and git-ignore checks. Directory expansion uses the same pattern through `list_workspace_directory_children_inner`.

The scan is already bounded and progressive, so the issue is not unbounded recursion. The sharper failure mode is that synchronous filesystem work runs inside async command handlers, making the desktop feel blocked under large repositories, network-backed folders, OneDrive/iCloud locations, Windows Defender scanning, WSL UNC paths, and remote daemon combinations.

## Decisions

### Decision 1: Keep the existing progressive scan protocol

The response contract already supports `partial`, `unknown`, `has_more`, and on-demand directory child loading. This change keeps that protocol and changes execution placement, not payload semantics.

### Decision 2: Use `tokio::task::spawn_blocking` at command/facade boundaries

Desktop Tauri and daemon file-access paths will clone the resolved `PathBuf` and execute `list_workspace_files_inner` / `list_workspace_directory_children_inner` in a blocking task. This keeps heavy filesystem work off the async runtime while preserving the existing shared scanner.

### Decision 3: Forward session folder commands in remote mode

The daemon already exposes `list_workspace_session_folders`, `create_workspace_session_folder`, `rename_workspace_session_folder`, `move_workspace_session_folder`, `delete_workspace_session_folder`, `assign_workspace_session_folder`, and `assign_workspace_session_folders`. Desktop Tauri commands should route to these RPCs in remote mode and only use local storage in local mode.

### Decision 4: Do not fallback from remote to local

Remote errors must surface as errors. Falling back to local desktop storage or filesystem reintroduces the Windows/macOS/Linux path-space mismatch that caused related Git remote scan failures.

## Error Handling

- Blocking task join failures return a readable `failed to join workspace file scan task` style error.
- Remote RPC serde failures propagate as command errors.
- Local filesystem validation remains inside existing scanner functions.

## Testing

- Focused Rust tests should cover workspace file scan wrappers where practical through existing file tests and command compilation.
- Session folder remote forwarding is primarily contract-level and can be verified by compile plus existing daemon dispatch coverage.
- OpenSpec strict validation must pass.

## Rollback

Reverting the command/facade wrapper changes returns local mode to the previous synchronous scan behavior. Remote folder forwarding can be reverted independently if a daemon compatibility issue appears.

## Implementation Notes

- Desktop and daemon file listing paths now resolve the workspace root before entering `spawn_blocking`, then execute the existing scanner unchanged. This preserves response shape while moving filesystem traversal out of the cooperative async command path.
- Directory-child scans use the same boundary and keep path validation inside the existing scanner, so traversal protection and `has_more` semantics remain centralized.
- Remote session folder commands do not fallback to local metadata. This is intentional because fallback would reintroduce cross-machine workspace/path drift.
- Non-macOS app-target opening only changes GUI app launch behavior; explicit command targets still wait for process status and preserve error semantics.
