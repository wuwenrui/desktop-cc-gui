## Why

Project Map now has a context/explain foundation, but users still need stronger navigation primitives for large maps. The research document identifies Guided Tour, Search/history enhancement, and Path Finder as the next user-facing interaction layer.

This change adds navigation affordances that help users answer: where should I start, how did I get here, and how are two nodes connected?

## 目标与边界

目标：

- Add Project Map guided tour steps for onboarding, architecture review, risk review, and task planning.
- Add node search and navigation history improvements for large maps.
- Add a path finder that resolves a relationship path between two Project Map nodes.
- Use existing hierarchy, optional relations, and evidence as the path source.

边界：

- This change is a Project Map navigation feature, not a graph data-generation overhaul.
- Tours can be generated from existing dataset structure first, with AI-generated tours left optional.
- Path Finder starts with shortest-path over available hierarchy/relations only.

## 非目标

- 不实现 docs/wiki graph ingestion。
- 不实现 new dashboard server。
- 不实现 relation extraction generation。
- 不改变 Project Map persistence format except optional tour state if needed.

## What Changes

- Add `ProjectMapTourStep` and optional dataset/panel state for guided tours.
- Add a Guided Tour panel/section with next/previous/focus behavior.
- Add Path Finder modal or panel section for source node and target node selection.
- Add search and navigation history UX enhancements tied to focus/selection.
- Preserve layout state while search/tour/path visual state changes.

## 技术方案取舍

| 选项 | 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | Build Guided Tour only | Simple onboarding improvement | Does not answer connection questions | 不采用为完整方案 |
| B | Build Search + Tour + Path Finder on existing graph primitives | Strong navigation improvement with limited model changes | Requires careful UI composition | 采用 |
| C | Wait for full relation extraction before navigation | More accurate paths later | Delays immediate usability | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map shall expose guided tour, search/history navigation, and node path discovery.
- `project-map-incremental-generation`: Project Map datasets may carry optional tour metadata without breaking legacy datasets.

## Impact

- Project Map types and utilities.
- ProjectMapPanel navigation UI.
- Possible i18n additions for tour/path/search labels.
- No backend API change expected.

## 验收标准

- Users can start a guided tour and focus nodes step by step.
- Users can search nodes and navigate back through prior selections/focus states.
- Users can choose two nodes and see a shortest available path or a clear no-path result.
- Search, tour, and path visual states do not trigger expensive layout recomputation.
- Existing Project Map maps still render without tour metadata.
