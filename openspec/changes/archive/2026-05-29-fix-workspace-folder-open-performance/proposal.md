## Why

Opening a workspace or expanding a folder can feel slow because the app performs bounded but synchronous filesystem and git-ignore scans on the active workspace path as part of the initial file index lifecycle. The same area also has remote backend parity gaps for session folder commands, which is especially visible in Windows GUI + macOS/Linux daemon or WSL path combinations.

## 目标与边界

- Improve perceived workspace/folder open speed by moving blocking filesystem scans off the async command runtime.
- Preserve current workspace file response shape and progressive file tree metadata.
- Keep remote backend mode behavior aligned for session folder management.
- Improve Windows/macOS app-open compatibility without changing user-facing command names.

## 非目标

- Do not rewrite the file tree UI.
- Do not introduce a persistent file index or watcher-backed cache.
- Do not change the workspace path storage model or invent cross-machine path mapping beyond existing remote path normalization.
- Do not introduce new dependencies.

## What Changes

- Move workspace file listing and directory-child listing heavy filesystem work to blocking tasks in both desktop Tauri and daemon paths.
- Preserve existing `files`, `directories`, `gitignored_*`, `scan_state`, `limit_hit`, and `directory_entries` response fields.
- Add remote forwarding for workspace session folder commands whose daemon RPCs already exist.
- Adjust non-macOS GUI app opening so app targets can launch without waiting for the GUI process to exit, while explicit command targets keep current wait/error semantics.

## Implementation Backfill

Current workspace code now reflects this proposal through:

- `src-tauri/src/workspaces/commands.rs`: desktop workspace file and directory-child scans run behind a blocking-task boundary; non-macOS GUI app opens use spawn semantics for app targets.
- `src-tauri/src/bin/cc_gui_daemon/file_access.rs`: daemon workspace file and directory-child scans use the same blocking-task boundary.
- `src-tauri/src/shared/workspaces_core.rs`: workspace root resolution is shared so command layers can resolve before spawning blocking work.
- `src-tauri/src/session_management.rs`: session folder list/create/rename/move/delete/assign commands forward to daemon RPC in remote backend mode.
- `src-tauri/src/bin/cc_gui_daemon.rs`: daemon build compatibility shim prevents daemon-side shared modules from attempting nested remote forwarding.

## 技术方案选项

| 选项 | 方案 | 取舍 |
|---|---|---|
| A | 只调大扫描预算或减少文件数量 | 不能解决 runtime blocking；大仓库和网络盘仍慢；不采用 |
| B | 将现有 bounded scan 包进 `spawn_blocking`，保持协议不变 | 风险低、收益直接、兼容现有 progressive loading；本次采用 |
| C | 引入持久 watcher/index cache | 长期能力强，但需要一致性、恢复、跨平台 watcher 策略；超出本次范围 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-filetree-progressive-scan-protocol`: Workspace file tree scanning remains bounded/progressive but MUST NOT block the async runtime while doing filesystem traversal.
- `workspace-session-folder-tree`: Session folder commands SHALL execute against the active backend location in remote backend mode.

## Impact

- Backend:
  - `src-tauri/src/workspaces/commands.rs`
  - `src-tauri/src/bin/cc_gui_daemon/file_access.rs`
  - `src-tauri/src/session_management.rs`
- Frontend:
  - Existing `src/services/tauri/sessionManagement.ts` API shape remains unchanged.
- Dependencies:
  - No new dependency.

## 验收标准

- Opening or switching an active workspace MUST NOT run the workspace file scan directly on the async command task.
- Expanding a directory MUST NOT run the directory-child scan directly on the async command task.
- Remote backend mode MUST forward session folder list/create/rename/move/delete/assign commands to daemon RPC instead of local desktop storage.
- Non-remote local mode MUST preserve existing behavior and response shapes.
- `openspec validate fix-workspace-folder-open-performance --strict --no-interactive` MUST pass.
