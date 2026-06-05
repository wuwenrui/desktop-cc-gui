## Why

Project Map 已经具备 evidence chips、source refs、context pack、impact overlay 和 governance links，但 Evidence 仍然停留在“节点详情里的零散 chip”。用户在大图里想回答“哪些文件支撑了这张图”“某个文件影响了哪些节点”“打开文件后怎么回到地图证据”，现在缺少一个按文件聚合的入口。

Understand-Anything 的可借鉴点不是独立 dashboard，而是 Evidence Files tab / File Explorer 的交互心智：以文件为主轴组织知识证据，再把文件和图谱节点互相定位。这个能力应该成为 Project Map 内部 evidence layer，而不是新的外部服务。

## 目标与边界

目标：

- Add a Project Map Evidence Files explorer that groups file-backed evidence by workspace file path.
- Allow users to inspect which nodes, relations, governance links, and impact signals reference the same file.
- Support file -> node reverse focus so a user can select a file and jump to related Project Map nodes.
- Preserve existing evidence chip open-file behavior while adding a higher-level file aggregation view.
- Keep the explorer derived from current Project Map dataset and related in-memory projections; do not require new AI generation.

边界：

- This is a Project Map UX/data-index change, not a semantic embedding search feature.
- The file explorer MUST be read-only for source files and Project Map semantic data.
- The derived file index MAY be recomputed from loaded dataset state and does not need to be persisted as a new truth source in MVP.
- Non-file evidence remains visible as non-file evidence; the UI MUST NOT fake a file path.

## 非目标

- 不做 external dashboard。
- 不做 source code editor replacement。
- 不做 semantic file ranking 或 embedding search。
- 不自动修改 Project Map nodes、relations、OpenSpec、Trellis、source files。
- 不新增后台 watcher 来持续扫描整个仓库。

## What Changes

- Add derived Evidence File Index utilities for Project Map datasets:
  - group evidence refs by normalized workspace-relative file path
  - collect node links, relation links, governance links, stale/confidence markers, line refs, and source kinds where available
  - preserve non-file evidence as a separate explainable bucket
- Add Evidence Files tab/section in ProjectMapPanel:
  - file list with counts, source-kind chips, stale/confidence/risk markers
  - selected file detail with related nodes and source snippets/line refs when available
  - actions: open file, focus related node, filter graph to related nodes, clear filter
- Add reverse navigation behavior:
  - selecting a file can highlight all related nodes
  - selecting a related node focuses the graph and inspector
  - missing/deleted node references render as degraded links rather than crashing
- Add i18n copy for zh/en labels and empty/degraded states.

## 技术方案取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 只继续展示 evidence chips | 改动最少 | 用户无法按文件审计图谱证据 | 不采用 |
| B | 在 ProjectMapPanel 内新增 derived Evidence Files explorer | 利用现有 dataset/source refs；低风险；不引入新事实源 | 需要整理 file index 和 UI 状态 | 采用 |
| C | 做全仓库 File Explorer + semantic graph server | 想象力大 | 超出当前 Project Map MVP；引入后台扫描和权限复杂度 | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map shall expose an Evidence Files explorer for file-backed evidence aggregation and file-to-node reverse navigation.
- `project-map-incremental-generation`: Existing evidence refs remain the input source; generation output is not expanded by this change.

## Impact

- Frontend:
  - `src/features/project-map/types.ts`
  - new or updated `src/features/project-map/utils/evidenceFileIndex.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/styles/project-map.css` or existing Project Map styling surface
  - i18n resources if Project Map copy is centralized there
- Storage:
  - No new backend path expected.
  - MVP should avoid persisting derived file index as semantic truth.
- Behavior:
  - Adds evidence review and reverse navigation without changing graph data.

## 验收标准

- Users can open an Evidence Files view from Project Map.
- File-backed evidence is grouped by normalized workspace-relative path.
- Each file entry shows related Project Map nodes and evidence counts.
- User can focus a related node from a selected file entry.
- User can open a file-backed evidence path through the existing editor navigation path.
- Non-file evidence is visible as non-file/degraded context and is not rendered as fake file links.
- Missing node/file refs do not crash the panel and show explainable degraded state.
- Evidence file filtering/highlighting does not mutate Project Map semantic data.
