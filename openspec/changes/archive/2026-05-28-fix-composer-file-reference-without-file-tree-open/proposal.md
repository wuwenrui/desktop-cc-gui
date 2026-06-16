## Why

Issue `desktop-cc-gui#635` reports that typing `@` in the composer cannot reference files unless the right-side file tree has been opened first. The root problem is that the shared workspace file index is currently loaded as a side effect of the file-tree panel visibility, so composer completion has no source data while the file-tree view is closed.

## 目标与边界

- 目标：Composer `@` file-reference completion MUST have access to the active workspace file index without requiring the right-side file tree to be opened.
- 目标：Preserve the existing disconnected-workspace guard: a disconnected workspace MUST NOT call the backend file scan, and a brief disconnect MUST NOT be treated as a reason to couple composer availability back to file-tree visibility.
- 目标：Keep continuous workspace file polling scoped to the visible file-tree panel, so this fix does not introduce unnecessary background refresh work.
- 目标：Preserve the existing `@path` token format, filtering, gitignored exclusion, and completion ordering.
- 边界：只调整 workspace file index loading lifecycle and focused tests; 不改 file tree UI、backend scan API、file open behavior、message send semantics。

## What Changes

- Decouple the initial workspace file-index load from right-panel/file-tree visibility.
- Keep periodic polling tied to the existing file-tree-visible condition.
- Add regression coverage proving disabled polling does not prevent the first connected workspace snapshot from loading.
- Record an OpenSpec capability for composer file-reference index availability.

## Capabilities

### New Capabilities

- `composer-file-reference-index-availability`: Defines that composer file-reference completion can use the active workspace file index even when the file-tree view has not been opened.

### Modified Capabilities

- None.

## Impact

- Frontend shell/hook code:
  - `src/app-shell.tsx`
  - `src/features/workspaces/hooks/useWorkspaceFiles.test.tsx`
- No backend API, storage schema, runtime command, or dependency changes.

## 技术方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A | 打开 `@` dropdown 时自动展开右侧文件树 | 改动直观 | 强迫 UI 跳转，仍把 composer 依赖绑在 file-tree view 上 | 不采用 |
| B | Composer 自己单独调用 `list_workspace_files` | 局部可用 | 复制 workspace file index lifecycle，容易和 file tree drift | 不采用 |
| C | `useWorkspaceFiles` 初始加载与 file-tree visibility 解耦，polling 仍由 file tree visibility 控制 | 共享同一索引，修复根因，后台成本可控 | active workspace 会多一次初始 scan | 采用 |

## 非目标

- 不重写 composer autocomplete engine。
- 不改变 `@` completion filtering/ranking/token insertion。
- 不新增 lazy directory scan contract。
- 不改变 detached file explorer 或 file-tree drag-drop behavior。
- 不引入新依赖。

## 验收标准

- Given an active workspace and the right-side file tree is closed, when the app shell mounts, then the shared workspace file-index lifecycle MUST be enabled for composer/file-tree consumers.
- Given that active workspace is connected, then workspace file index MUST load once for shared consumers.
- Given that index has loaded, when the user types `@` in composer, then matching workspace files/directories MUST be available to existing completion logic.
- Given the file tree remains closed, then periodic file polling MUST remain disabled.
- Given the file tree is opened, then existing polling behavior MUST continue to refresh the shared file index.

## Implementation Closure

- Implemented `workspaceFilesInitialLoadEnabled` in `src/app-shell.tsx` as an active-workspace lifecycle flag independent of file-tree visibility.
- Preserved the existing `workspaceFilesPollingEnabled` condition for periodic refreshes.
- Review follow-up: kept the initial-load flag based on `activeWorkspace.id` instead of `activeWorkspace.connected`, so `useWorkspaceFiles` remains responsible for the connected guard and transient disconnect behavior.
- Added focused regression coverage in `useWorkspaceFiles.test.tsx` for `initialLoadEnabled=true` with `pollingEnabled=false`.
- Validation passed:
  - `npx vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`
  - `npm run typecheck`
  - `openspec validate fix-composer-file-reference-without-file-tree-open --strict --no-interactive`

## Follow-up Closure: Nested Composer File Reference Search

- 用户校准问题：`@App` / `@build` 只是示例，不允许写死具体文件名；真实问题是 Composer `@` completion 对里层文件的候选源不完整。
- Root cause：右侧文件树使用 lazy children 展开，可以看到深层文件；但 Composer 的真实 dropdown 链路在 `ChatInputBoxAdapter.fileCompletionProvider`，其无路径查询只消费 `useWorkspaceFiles` 暴露的 root-only snapshot，因此 `@build` 无法命中 `src-tauri/src/build_config.rs` 等 nested path。
- 修复策略：
  - 无 `/` 的 `@query`：先用已有 root candidates 快速匹配；不足时按 workspace 复用 `getWorkspaceFiles(workspaceId)` full snapshot，并按 basename/stem/path/subsequence score 排序。
  - 有 `/` 的 `@dir/query`：继续走 `getWorkspaceDirectoryChildren(workspaceId, dirPath)` lazy lookup，保持文件树 progressive loading 的性能边界。
  - 保留 malformed payload normalization、dedupe、AbortError 传播和 dropdown recoverability。
- Review 结论：不是 hardcoded `App`，也不是单纯 includes 算法缺陷；这是 file tree root-only snapshot、lazy child source 与 Composer full-workspace search 之间的 contract drift。
- 新增回归：
  - `ChatInputBoxAdapter.test.tsx`: non-scoped query 可命中 full workspace nested files，并复用同 workspace full snapshot cache。
  - `useComposerAutocompleteState.test.tsx`: legacy/parent autocomplete state 对无 `/` 查询支持 nested basename 与 nested directory name 匹配。
- Validation passed on 2026-06-16:
  - `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
  - `git diff --check`
