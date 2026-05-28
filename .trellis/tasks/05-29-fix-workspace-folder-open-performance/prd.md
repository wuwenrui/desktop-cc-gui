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

- [ ] Workspace file listing uses a blocking-task boundary for local desktop mode.
- [ ] Directory child listing uses a blocking-task boundary for local desktop mode.
- [ ] Daemon file listing paths use the same blocking-task boundary.
- [ ] Session folder commands forward to daemon in remote backend mode.
- [ ] OpenSpec validation passes.

## Technical Notes

OpenSpec change: `fix-workspace-folder-open-performance`.
