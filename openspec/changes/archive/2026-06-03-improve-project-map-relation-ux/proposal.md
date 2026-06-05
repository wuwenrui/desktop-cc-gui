## Why

Project Map 已经有 typed relations、relation persistence、path finder、context/explain pack 和 impact overlay，但关系仍然更像“后台数据结构”，用户不能系统地审计一个节点的 incoming/outgoing 关系，也不能按 relation type、source kind、confidence、direction 过滤图上关系。

Understand-Anything 的可借鉴点是把知识图谱关系变成可解释的交互对象：关系不仅用于 path finding，也应该能被筛选、点选、解释和反向定位。当前下一步应补 Relation UX，而不是继续盲目增加关系种类。

## 目标与边界

目标：

- Add relation inspector UX for selected Project Map nodes.
- Show incoming and outgoing relations with type, source kind, confidence, stale/degraded markers, and evidence refs.
- Add relation filters and edge legend so users can control graph density.
- Add relation detail/explain behavior tied to existing context, path, impact, and governance evidence.
- Preserve deterministic relation handling; no new AI relation extraction in this change.

边界：

- This change improves relation visibility and interaction, not relation generation.
- The relation model/persistence contract should remain backward-compatible.
- UI filtering/highlighting MUST NOT mutate persisted relations.

## 非目标

- 不做 semantic relation extraction。
- 不做 new graph renderer。
- 不做 automatic relation repair beyond existing graph integrity repair.
- 不做 relation write-back UI 或用户手动编辑 relation。

## What Changes

- Add relation index helpers for incoming/outgoing relation lookup.
- Add relation UX in ProjectMapPanel:
  - selected node incoming/outgoing relation panel
  - relation row detail with type/source/confidence/evidence
  - relation focus/highlight and open related node action
- Add graph-level relation controls:
  - relation type filters
  - source kind filters
  - direction filter for selected node context
  - edge legend and visible relation count
- Integrate relation UX with existing navigation/path features:
  - relation selection can focus source/target nodes
  - path finder can show relation types and source markers
  - relation detail can feed existing Explain Pack where applicable

## 技术方案取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 保持 relations 只服务 path/context | 改动少 | 用户无法审计关系来源和方向 | 不采用 |
| B | 增加 relation index + inspector/filter UX | 复用现有 relations；高用户价值；不改生成管线 | UI 状态和图高亮要处理清楚 | 采用 |
| C | 先做 AI relation extraction | 数据更丰富 | 风险大，且当前 UX 无法承载更多关系 | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map shall expose relation inspector, relation filtering, relation highlighting, and relation legend controls.
- `project-map-incremental-generation`: Existing persisted relations remain backward-compatible; this change does not require new generation output.

## Impact

- Frontend:
  - `src/features/project-map/types.ts`
  - new or updated `src/features/project-map/utils/relationIndex.ts`
  - `src/features/project-map/utils/navigation.ts` if path rendering includes relation metadata
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - Project Map styling and i18n copy
- Storage:
  - No backend change expected.
  - Optional view-state persistence for relation filters may reuse existing view-state pattern if safe.
- Behavior:
  - Relation visibility becomes user-controllable and explainable.

## 验收标准

- Selecting a node shows incoming and outgoing relations when relations exist.
- Each relation row shows relation type, source/target node, source kind, confidence or degraded state when available.
- Users can filter visible relations by type and source kind without mutating dataset relations.
- Users can focus source or target node from a relation row.
- Path Finder output includes relation type labels when a path segment comes from a relation.
- Sparse/no relation datasets render clear empty states.
- Legacy datasets without relations still render normally.
