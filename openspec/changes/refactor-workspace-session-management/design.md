# Design: Refactor Workspace Session Management

## Architecture

会话管理改为三层 contract：

```text
Disk Session Truth
  -> WorkspaceSessionIndexEntry
  -> Catalog Projection + Metadata Overlay
  -> Settings / Sidebar / Workspace Home UI
```

`Disk Session Truth` 来自 engine-specific storage：Codex JSONL、Claude projects transcript、Gemini history、OpenCode datastore。它决定 session 是否真实存在。`WorkspaceSessionIndexEntry` 是后端统一结构，负责承载 owner、engine、canonical id、parent id、cwd、physical path evidence、existence 和 inconsistency。`Catalog Projection + Metadata Overlay` 只叠加 archive、folder assignment、user organization state。

核心原则：metadata 不能证明 session 存在。metadata 只能让已存在或刚被确认 missing 的 session 进入“可清理”状态。

## Backend Contract

扩展 `WorkspaceSessionCatalogEntry`：

- `existsOnDisk: boolean`
- `inconsistencyCode?: "missing-on-disk" | "owner-unresolved" | "metadata-orphaned" | "source-degraded"`
- `deleteMode?: "physical" | "metadata-cleanup" | "unsupported"`
- `physicalPath?: string`
- `childrenCount?: number`

删除返回扩展：

- `code: "DELETED" | "ALREADY_MISSING_CLEANED" | "DELETE_FAILED" | "UNSUPPORTED"`
- `deletedFromDisk?: boolean`
- `metadataCleaned?: boolean`

实现策略：

1. listing 时先构建 engine entries，再用 metadata overlay 补 archive/folder。
2. 若 metadata 中有 archive/folder 但 index 无 disk entry，产生 orphan cleanup candidate；默认不混入 active strict list，但在 all/archived 或 explicit management surface 中可显示为 inconsistent row。
3. delete 先 resolve owner workspace，再 engine-specific physical delete。
4. `session not found` / `session file not found` / `thread not found` 不再作为普通失败，而是 cleanup success，并返回 `ALREADY_MISSING_CLEANED`。
5. 删除成功后统一清理 `archived_at_by_session_id` 与 `folder_id_by_session_id`。

## Frontend Contract

Settings 会话管理页从“顶部 picker + list”演进为“两栏布局”：

```text
左栏 Project Tree
  Project
    Worktree
    Session Folders
右栏 Session Catalog
  Filters
  Parent/Child Session Rows
  Batch Actions
  Inconsistency Notices
```

左栏选择 project/worktree 仍只改变 scope；folder 选择只改变 organization filter，不改变 membership。右栏仍通过 backend catalog 读取 strict project/worktree result。

UI 行为：

- `missing-on-disk` row 显示清理提示，delete 后从列表移除。
- parent/child rows 用 `parentSessionId` 构建轻量树；若 parent 不在当前 page，child 保持普通 row 并标注 parent id。
- folder tree 复用 `buildWorkspaceSessionFolderProjection` 的 deterministic ordering。
- 删除按钮文案仍双击确认，但 partial success 必须按 code 分类展示。
- 默认 session row 只展示标题、更新时间和 icon-only 操作；engine/workspace/source/attribution/parent 等低频信息进入详情 icon 的展开面板。
- 相邻的幕布 icon 打开独立只读 dialog，用于查看当前 session history；本变更不展示 composer，也不发送 follow-up message。
- Codex 幕布加载同时尝试 local history 与 `resumeThread` history：任一来源先返回可见消息即可先渲染，后到来源可合并补齐。
- Codex history 首屏加载必须设置 10s hard timeout，超时只解除 loading 并显示可刷新提示，不能永久卡在“正在加载会话”。

## Performance

First page 默认走 bounded scan。以下情况允许 exhaustive，但必须可解释：

- keyword search
- status 非 `all`
- projection summary
- folder assignment ownership validation

如果 engine 没有 cursor，使用 bounded cap + partial source。前端不得把 partial result 渲染成完整事实。

## Error Handling

- `OWNER_WORKSPACE_UNRESOLVED`：不可 mutation，提示需要从全局历史定位。
- `ALREADY_MISSING_CLEANED`：成功，但提示“磁盘会话已不存在，已清理项目索引”。
- `DELETE_FAILED`：保留选中，允许重试。
- `UNSUPPORTED`：保留选中，说明当前 engine/session kind 不支持物理删除。

## Testing

- Rust:
  - orphan metadata delete cleanup
  - physical delete success cleans archive/folder metadata
  - child delete does not delete parent metadata
  - parent delete does not silently delete child
  - bounded first page keeps cursor semantics
- Vitest:
  - Tauri mapping for new fields
  - project tree selection changes scope only
  - missing-on-disk cleanup success removes row with notice
  - parent/child projection rendering
  - partial failure keeps failed rows selected

## Rollback

Backend fields are additive. Existing frontend can ignore new fields. If UI two-column layout causes regression, keep service/backend changes and revert Settings layout to picker mode temporarily; physical delete consistency remains beneficial independently.
