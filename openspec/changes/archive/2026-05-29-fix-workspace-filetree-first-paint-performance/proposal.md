## Why

Opening a workspace folder can still show `正在加载文件` for several seconds because the visible file tree is still coupled to complete recursive workspace file snapshots and the resulting large tree rebuilds. The previous performance fix moved filesystem traversal off the async runtime, but it did not remove full-tree scan pressure from workspace switching. The issue is visible in both desktop and Web service modes, especially when users switch workspaces frequently.

## 目标与边界

- Make the file tree first paint use a shallow root-directory snapshot so users see root entries quickly.
- Stop automatic full workspace scans from running as part of file tree startup, manual refresh, polling, or workspace switching.
- Preserve the existing full workspace file snapshot command for file reference, search, Spec Hub, Project Map, and compatibility callers.
- Keep existing `WorkspaceFilesResponse` fields and progressive directory metadata semantics.
- Keep Web service and desktop behavior aligned by using the same daemon/Tauri command contract.

## 非目标

- Do not remove or rename `list_workspace_files`.
- Do not introduce a persistent file index, filesystem watcher, or cache database.
- Do not change file open, file preview, drag, mention insertion, or git decoration behavior.

## What Changes

- Allow `list_workspace_directory_children` to accept an empty path as a workspace-root child query.
- Change `useWorkspaceFiles` visible file tree load to request root direct children and not call `getWorkspaceFiles()` automatically.
- Keep polling shallow by default so foreground UI does not repeatedly trigger full recursive scans.
- Preserve `getWorkspaceFiles()` as a source-compatible explicit API for downstream consumers that truly require full file lists.
- Defer root-level gitignore marker computation in directory-child first paint to avoid hidden Git status scan pressure.
- Cache recent shallow root snapshots and reuse in-flight root requests so frequent workspace switching avoids duplicate RPCs and loading-only flashes.
- Add a one-shot legacy full snapshot fallback only when the root directory-child query fails before any root data exists.
- Add focused tests for root-first loading and root directory-child backend behavior.

## 变更记录

- Implemented root-first file tree loading through `getWorkspaceDirectoryChildren(workspaceId, "")`.
- Removed automatic file-tree startup/switch/poll calls to `getWorkspaceFiles()` from the normal success path.
- Added bounded per-workspace shallow root snapshot cache and in-flight root request reuse for fast workspace switch-back.
- Added one-shot legacy full snapshot fallback only for root-sentinel compatibility failures before any usable active snapshot exists.
- Tightened root sentinel compatibility so only an exact empty directory path means workspace root; whitespace-only directory paths stay invalid.
- Kept fallback UI recovery source-compatible, but cached only a root-only projection of legacy full snapshots to avoid storing recursive trees in root cache.
- Added mounted-state guard so late async responses cannot update hook state after the file tree consumer unmounts.
- Deferred root-level gitignore marker computation for root directory-child first paint while preserving nested directory marker behavior.

## Review 记录：兼容性与性能

- Compatibility reviewed: `list_workspace_files` and `getWorkspaceFiles()` remain full snapshot APIs, and no downstream service wrapper shape changed.
- Compatibility reviewed: the empty root sentinel is scoped to directory-child listing only; file read/write paths still reject empty paths.
- Compatibility fix applied: whitespace-only directory paths no longer widen into root sentinel behavior.
- Performance reviewed: normal file tree load, manual refresh, polling, and workspace switching now use bounded root child queries instead of recursive scans.
- Performance fix applied: legacy fallback no longer writes complete recursive snapshots into the bounded root cache.
- Async safety reviewed: stale workspace responses and post-unmount responses are guarded before mutating visible state.
- Remaining trade-off: old daemon/backends that reject the root sentinel can still pay one legacy full scan once to recover UI, but this is restricted to compatibility errors and is not the normal loading path.

## 技术方案选项

| 选项 | 方案 | 取舍 |
|---|---|---|
| A | 继续优化 `list_workspace_files` 递归扫描速度 | 能降低后台耗时，但首屏仍等待完整递归响应；不解决 Web 版 loading 体感；不采用 |
| B | 新增独立 root snapshot command | 语义清晰，但会扩展 command surface 并重复目录-child 查询能力；暂不采用 |
| C | 兼容性扩展 `list_workspace_directory_children(workspaceId, "")` 表示 root children | 复用现有 one-level lazy protocol，改动小，旧调用方不受影响；本次采用 |
| D | root-first 后继续后台 full hydration | loading 可能消失，但仍在频繁切换时制造磁盘/CPU/daemon 压力；不采用 |

## 兼容性写法

- `list_workspace_files` 保持完整快照语义，既有调用方无需修改。
- `getWorkspaceFiles()` service wrapper 保持原 API 与返回 shape。
- 文件树首屏新增使用 `getWorkspaceDirectoryChildren(workspaceId, "")`；空字符串只在 directory-child command 中表示 workspace root，不改变文件读写路径校验。
- 文件树 `useWorkspaceFiles` 不再自动调用 `getWorkspaceFiles()`；需要完整文件列表的功能必须显式调用兼容 API，而不是借文件夹 UI 的启动路径顺带 hydration。
- 若 root directory-child 新协议失败且当前没有缓存/可见数据，允许一次性 fallback 到 `getWorkspaceFiles()`，用于兼容旧 daemon 或未重启后端；这不是常规加载路径。
- 文件树只缓存 bounded root snapshot，不缓存完整递归文件树；缓存用于快速切回已访问 workspace，不改变 `list_workspace_files` 的兼容语义。
- 返回字段继续使用 `files`, `directories`, `gitignored_files`, `gitignored_directories`, `scan_state`, `limit_hit`, `directory_entries`，避免新增 frontend/backend payload mapping 风险。
- Web service runtime 不需要新增 JS bridge shim；它继续通过现有 `/api/rpc` 转发同名 daemon RPC。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-filetree-progressive-scan-protocol`: Directory-child queries support a root sentinel and file tree first paint can be backed by shallow root data.
- `client-startup-orchestration`: Visible file tree startup and workspace switching must not start or wait for complete workspace tree hydration before showing root entries.

## Impact

- Frontend:
  - `src/features/workspaces/hooks/useWorkspaceFiles.ts`
  - `src/features/workspaces/hooks/useWorkspaceFiles.test.tsx`
- Backend:
  - `src-tauri/src/workspaces/files.rs`
  - `src-tauri/src/bin/cc_gui_daemon/workspace_io.rs`
- Service contract:
  - Existing `src/services/tauri.ts` wrappers remain source-compatible.
- Dependencies:
  - No new dependency.

## 验收标准

- Opening or switching to a workspace with the file tree visible SHALL render root-level files/directories after a one-level root child query, without starting or waiting for full recursive `list_workspace_files` completion.
- Switching back to a recently loaded workspace SHOULD restore its cached shallow root snapshot without issuing a duplicate root query first.
- Existing non-filetree callers of `getWorkspaceFiles()` SHALL keep receiving the full workspace snapshot contract.
- `list_workspace_directory_children` SHALL treat `path: ""` as the workspace root and still reject traversal / escaped paths.
- Root directory-child queries SHALL avoid synchronous gitignore marker computation; nested directory-child queries SHALL preserve gitignore marker behavior.
- Web service mode SHALL use the same root child RPC behavior as desktop local/remote modes.
- Focused frontend tests, focused Rust tests, and strict OpenSpec validation SHALL pass.
