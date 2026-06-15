# workspace-tree-and-large-file-listing-budget

## Why

roadmap `P1-13 Workspace 文件树与打开路径性能` 指出打开大 workspace 时 file tree 不应一次性把全树和全部 metadata 传给 renderer。当前仓库已经有 `src-tauri/src/workspaces/files.rs` 的 `limit_hit` / `scan_state` / partial response 语义、`useWorkspaceFiles` 的 snapshot cache、`FileTreePanel` 的 virtual rows 和 lazy directory children hook 入口，也有 `npm run perf:long-list:*` 作为长列表 proxy baseline。本 change 的目标不是从零重写 file tree，而是把现有 partial 能力升级为明确的 listing budget、subtree on-demand contract、shared index 与 evidence gate。本 change 严格依赖 Step 3 先落地 `ScanCache`、blocking helper 与 `payloadBudget`；这些 substrate 不存在时不得动 `workspaces/files.rs` 实质逻辑。

## Code Facts / 现状事实

- `src-tauri/src/workspaces/files.rs` 已有 `MAX_WORKSPACE_FILE_ENTRIES`、`limit_hit`、`scan_state: partial|complete` 和多组 Rust tests。
- 当前没有已落地 `ScanCache` / `payloadBudget` 公共抽象；本 change 不负责发明这些底座，只消费 Step 3 暴露的实现。
- `src/features/workspaces/hooks/useWorkspaceFiles.ts` 已缓存 workspace file snapshot，并维护 `scanState` / `limitHit` / `directoryMetadata`。
- `src/features/files/components/FileTreePanel.tsx` 已使用 virtualizer、expanded folder state 和 `loadLazyDirectoryChildren`，但 listing budget 仍未成为跨前后端契约。
- `search-index-and-bounded-hydration` 是独立 active change，本 change 只能定义与它共享 per-workspace file index 的 contract，不能假装其未完成部分已经存在。

## Problem / 问题

- 大 workspace 初次打开时，file listing 的 depth / item / payload budget 没有稳定契约，前端难以区分完整、partial、subtree missing。
- 展开目录时如果缺 subtree contract，容易退回全树刷新或重复 scan。
- File tree 与 search hydration 各自维护候选来源时，会产生重复 IO 与 stale 结果分叉。
- 当前 perf evidence 偏 long-list UI proxy，缺 file listing duration、item-count、payload-size、cache hit/miss 的 structured fields。

## Goals / 目标

- 将 workspace file listing 明确为 bounded initial listing + on-demand directory children 两段 contract。
- 保留现有 `scan_state` / `limit_hit` 语义，并补充 `sourceVersion`、`budget`、`payloadBytes`、`cacheState` metadata。
- Directory expand 只加载 requested subtree，不触发 full-tree refresh。
- File watcher 或 mtime signature 变化时，仅失效 affected subtree / sourceVersion；漏报时有 full refresh fallback。
- File tree 与 search hydration 共享 per-workspace file index contract：path tokens、directory tokens、sourceVersion、freshness。
- 将 workspace listing metrics 接入 `runtime-performance-evidence-gates`，区分 proxy UI evidence 与 backend listing measured/proxy evidence。

## Non-Goals / 非目标

- 不重做 file tree 视觉、拖拽、rename、context menu 或 detached file tree。
- 不替换 watcher implementation。
- 不做全文搜索；shared index 仅覆盖 path / filename / directory tokens。
- 不在本 change 完成 `search-index-and-bounded-hydration` 的全部 backlog。

## Delivery Boundaries / 交付边界

1. **Contract audit**：盘点当前 `list_workspace_files`、directory children、`useWorkspaceFiles` snapshot cache 和 FileTreePanel partial UI。
2. **Preflight gate**：确认 Step 3 的 `ScanCache`、cache key signature、blocking helper、`payloadBudget` metadata 已合入；未合入则只允许继续审计和契约文档，不落业务代码。
3. **Budget metadata**：给现有 response 增加 budget / sourceVersion / payload metrics，保持 backward-compatible。
4. **Subtree loading**：把 expand directory contract 固化为 requested subtree only，并添加 stale guard。
5. **Shared index bridge**：定义并接入 file tree/search 共用 index 的最小字段；若 search change 未完成，则以 adapter + feature flag 连接。
6. **Evidence gate**：将 duration、item-count、payloadBytes、partial/full、cacheState 输出到 runtime evidence。

## Initial Budgets / 初始预算

- Initial listing default depth SHOULD be `2` 或等价 visible-first 层级；超过 budget MUST return `scan_state=partial`。
- Initial listing item target `<= 2000` entries，hard fail `> 5000` entries unless explicit debug opt-out。
- Single invoke payload target `<= 1 MiB`, hard fail `> 4 MiB` for listing metadata.
- Directory expand SHOULD request only one subtree and target `<= 500` returned entries per response, large subtree MAY paginate.
- `S-LL-1000` scroll evidence remains proxy unless browser/CDP scroll gate reports measured evidence.

## Risks / 风险

- Budget 过严会让用户误以为目录为空，partial UI 必须清晰展示 loading / truncated / retry。
- Shared index 若 sourceVersion guard 不严格，会让 file tree/search 显示已删除或已移动文件。
- Watcher 漏报不可完全避免，mtime signature fallback 和 manual refresh 必须保留。
- Existing tests may assume full tree availability; migration must keep compatibility path until UI is fully partial-aware.

## Acceptance Criteria / 验收口径

- 打开大 workspace 时 initial file listing response 带有 budget metadata，并能在 partial state 下先渲染 visible tree。
- 展开目录只请求该 subtree，未触发全树刷新；stale subtree response 不覆盖新 sourceVersion。
- File tree/search 共享 index contract 生效或在 feature flag 关闭时明确记录 unsupported/adapter-only evidence。
- File watcher changed paths 使 affected subtree/index 失效；漏报 fallback 可通过 mtime/full refresh 恢复。
- `runtime-performance-evidence-gates` 输出 file listing duration、item-count、payloadBytes、cacheState、partial/full 与 evidence class。

## Validation / 验证

- Rust tests 覆盖 listing budget、partial response、directory subtree response、payload metadata。
- Frontend tests 覆盖 FileTreePanel partial UI、expand subtree stale-drop、workspace switch cleanup。
- Shared index contract test 覆盖 file tree/search 同 sourceVersion 一致性。
- `npm run perf:long-list:baseline`
- `npm run perf:long-list:browser-scroll`
- `npm run check:runtime-evidence-gates`
- `npm run typecheck`
- `npm run lint`
- `openspec validate workspace-tree-and-large-file-listing-budget --strict --no-interactive`

## Execution Order / 执行顺序

- **Position**: Step 4 of 5
- **Predecessors**（硬依赖，全部必须先落地）:
  - Step 1 `composer-and-message-row-render-budget` —— `rendererDiagnostics` schema 命名约定已就位。
  - Step 2 `renderer-resource-backpressure` —— `app-shell.tsx` listener owner registry 与 `useFocusRefresh` 已就位（`FileTreePanel` 是 panel-level owner）。
  - Step 3 `backend-io-cache-and-bridge-payload-budget` —— **`ScanCache<K, V>` 抽象、统一缓存键规范、`spawn_blocking` helper、Tauri invoke `payloadBudget` 注解格式**全部必须先有。
- **Successors**:
  - Step 5 `markdown-off-main-thread-pipeline` 不依赖本 change，本 change 完成后 Step 5 仍可独立推进。
- **Reused Artifacts / 本 change 必须复用**:
  1. `ScanCache<K, V>` —— `workspaces/files.rs` 的 file tree snapshot cache 直接实例化此抽象。
  2. 统一缓存键规范（`rootHash + ignoreConfigHash + maxMtime`）—— 沿用 Step 3 范式。
  3. `spawn_blocking` helper —— `list_workspace_files` 的分页 / 子树 on-demand 走此 helper。
  4. Tauri invoke `payloadBudget` 注解 —— `list_workspace_files` 的 IPC 响应套用此注解。
  5. `useFocusRefresh` hook —— file tree 焦点刷新复用 Step 2 的合并 wave。
  6. `rendererDiagnostics` 字段命名（`workspaces.file.*`）—— 与 Step 1 / 2 / 3 前缀对齐。
- **Required Public Artifacts / 本 change 必须对外暴露**:
  1. **Per-workspace 共享 file index**（file tree 与 search 共享）—— 在 `useWorkspaceFiles` 与 P0-09 的 normalized file index 之间建立桥接。
  2. `list_workspace_files` 分页 / 子树 on-demand 契约（depth / offset / limit）。
  3. `runtime-performance-evidence-gates` 新增 `workspaces.file.listing.*` 字段。
- **Cross-Change Constraint**: `workspaces/files.rs` 的修改需与 Step 3 的 ScanCache 接入 commit 严格分离（先 Step 3 commit，再本 change commit），避免物理文件 `workspaces/files.rs` 的同一段被两次串行改动交叉 review。
- **Blocking Rule**: Step 3 `ScanCache` 抽象、统一 cache key signature、blocking helper 与 `payloadBudget` metadata 未落地，本 change 不应启动 `workspaces/files.rs`、`src/services/tauri.ts` 或 `useWorkspaceFiles` 的任何实质改动；只允许审计与契约补充。
