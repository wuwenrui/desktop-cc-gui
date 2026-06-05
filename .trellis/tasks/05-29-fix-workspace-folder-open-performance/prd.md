# Fix Workspace Folder Open Performance

## Goal

Improve perceived speed when opening a workspace folder and expanding folders, with special attention to Windows/macOS/remote backend compatibility.

## Requirements

- Keep existing file tree protocol and UI shape.
- Move heavy filesystem scans off async command tasks.
- Preserve local mode behavior.
- Route session folder commands through daemon RPC in remote mode.
- Avoid new dependencies.

## Acceptance Criteria

- [x] Workspace file listing uses a blocking-task boundary for local desktop mode.
- [x] Directory child listing uses a blocking-task boundary for local desktop mode.
- [x] Daemon file listing paths use the same blocking-task boundary.
- [x] Session folder commands forward to daemon in remote backend mode.
- [x] OpenSpec validation passes.

## Technical Notes

OpenSpec change: `fix-workspace-folder-open-performance`.
