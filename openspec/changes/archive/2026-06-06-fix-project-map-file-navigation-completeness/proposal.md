## Why

Project Map 的 File Relationship Explorer 当前把 Graph 视图左侧的 Top N 高相关文件 rail 命名为 `File Tree`，同时 Files 工作区也复用被裁剪后的 `relationshipDashboardFilteredFiles`。在几千文件项目中，scan summary 显示已有数千个文件，但导航区只展示 32/120 个文件，用户会误判为“文件没扫全”或“导航丢文件”。

这个问题不是单纯文案 bug，而是信息架构 bug：推荐列表可以裁剪，但导航必须保持全局可达性。

## 目标与边界

- Graph 视图左侧 rail SHALL 表达为 `Top Files` / 高相关文件，而不是完整 File Tree。
- Files Explorer 视图 SHALL 基于完整 `relationshipDashboardData.files` 构建文件导航，不得复用 Top N 裁剪结果作为唯一数据源。
- 大项目 SHALL 通过智能分组、查询过滤、懒渲染或虚拟化保持交互可用，而不是静默隐藏文件。
- UI SHALL 明确展示当前渲染数、匹配数、扫描总数之间的关系，避免用户误解。
- 当前实现优先修复 frontend 信息架构；backend storage chunk/page API 保留为后续扩展，不在本变更中强行引入。

## What Changes

- Rename Graph rail semantics from full `File Tree` to high-relevance `Top Files`.
- Split file list derivation into two independent projections:
  - graph/top projection: bounded and ranked for relationship graph readability.
  - explorer projection: full scan-backed, queryable, grouped file navigation.
- Build Files Explorer groups from the full visible scan set, not from the bounded Top Files list.
- Add explicit counts such as rendered / matching / scanned total so capped graph surfaces are transparent.
- Preserve current role filter, noise toggle, selected file behavior, and relationship inspector behavior.
- No breaking changes to Tauri command payloads or relationship snapshot schema.

## 非目标

- 不在本变更中实现 backend 分页 command、multi chunk reader 或 storage schema migration。
- 不把 deterministic relationship scan 注入 Project Map semantic graph。
- 不改变 scanner 的 ignore policy、`maxFiles` 默认值或 relation extraction 规则。
- 不引入第三方 graph/tree 组件库；先复用现有 React/CSS 结构完成语义拆分。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: relationship dashboard file navigation must distinguish bounded Top Files surfaces from full scan-backed Files Explorer navigation, and large scan snapshots must remain transparently reachable through grouping/search/lazy rendering.

## 技术方案选项

### Option A: 只改文案，把 `File Tree` 改成 `Top Files`

- 优点：改动最小，风险低。
- 缺点：Files 视图仍然最多显示 120 个文件，用户依旧无法完整导航。
- 结论：不足以修复设计 bug，只能作为局部补丁。

### Option B: 前端拆分 Top projection 与 Explorer projection（推荐）

- 优点：不改 backend contract，修复用户可见问题；Graph 保持轻量，Files Explorer 保持全量可达。
- 优点：可复用已有 scan snapshot、role/noise/query/filter 逻辑，改动集中在 `ProjectMapRelationshipSection`。
- 缺点：几千文件仍在前端内存中处理，需要谨慎控制默认渲染量与分组展示。
- 结论：当前阶段最合适，符合 YAGNI，不引入不必要的 backend API。

### Option C: backend 增加 relationship files pagination / lazy chunk API

- 优点：更适合几万文件级别项目，可降低 frontend payload 和内存压力。
- 缺点：涉及 Tauri command、Rust storage reader、frontend service contract、测试面扩大。
- 结论：作为后续性能增强，不阻塞本轮修复。

## Impact

- Affected frontend code:
  - `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
  - `src/i18n/locales/en.part5.ts`
  - `src/i18n/locales/zh.part5.ts`
- Affected behavior:
  - Project Map Relationship Graph rail copy/counts.
  - Relationship Files Explorer grouping/list data source.
  - Large scan snapshot navigation transparency.
- Affected APIs/dependencies:
  - No Tauri API change.
  - No new runtime dependency.

## 验收标准

- Given a relationship scan with thousands of files, Graph view SHALL show a bounded Top Files rail with honest capped counts.
- Given the same scan, Files Explorer SHALL allow navigation/search/grouping over the full scan-backed file set, not only the first 120 ranked files.
- When filters or search are active, UI SHALL distinguish matching total from currently rendered rows/groups.
- Selecting a file from Files Explorer SHALL continue to focus the graph/inspector on that file.
- Existing scan, stale refresh, role filter, noise toggle, relationship inspector, and API view interactions SHALL remain available.

## Stage update: Top Files hierarchy correction（2026-06-06）

### 中文导读

用户复核第一版修复后指出：Graph rail 虽然已经从 `File Tree` 改名为 `Top Files`，并按 role/module 做了分组，但默认仍然展开成大面积平铺，缺少真实导航层级与组内分页感。

本提案因此补充一条产品校准：Top Files 不能只是 bounded flat list，也不能只是视觉分组；它必须是可折叠的信息架构。

### Updated acceptance focus

- Top Files SHALL use semantic hierarchy instead of flat file cards.
- Role-level groups such as `controller` / `service` / `test` SHALL be collapsible.
- Module or path-segment groups under a role SHALL also be collapsible.
- The default rail state SHOULD only expand the first role/module path to avoid flooding the rail.
- The selected file's role/module path SHALL remain visible so selection does not lose context.
- Leaf file groups MAY still use bounded render plus `show more / collapse` as a lightweight pagination mechanism.

### Design decision

Use `role -> module/path segment -> files` as the first implementation because it matches how users reason about code relationships:

- `role` answers “这批文件承担什么职责？”
- `module/path segment` answers “它属于哪个业务域或包？”
- `files` answers “我要打开哪个具体文件？”

Flat pagination was rejected because it only splits a long list into pages without adding information scent. A full directory tree was deferred to the Files Explorer view because Graph rail is still a high-relevance relationship surface, not the complete project explorer.
