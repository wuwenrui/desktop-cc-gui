## Why

Project Map 已具备 evidence、confidence、stale、candidate 与生成控制，但当前更偏“结构展示面板”，缺少将图谱转化为 agent/task 上下文、节点解释包、变更影响分析和扫描噪音控制的产品能力。

Understand-Anything 源码研究表明，最有价值的不是独立 graph dashboard，而是将 typed graph 作为 codebase explain/chat/diff/onboarding 的 context router。mossx 应把 Project Map 升级为证据驱动的工程导航地图，服务 Project X-Ray、OpenSpec/Trellis 与 Agent Task Orchestration 的闭环。

## 目标与边界

目标：

- 让 Project Map 能从 query 或 selected node 构建可交给 agent/task 的工程上下文包。
- 让节点详情从静态展示升级为 Explain Pack，包含 evidence、邻接节点、stale/confidence 风险与可执行动作。
- 让 Project Map 对 changed files 提供最小 impact overlay，标记 changed、affected、stale、unmapped 节点。
- 让 Project Map 扫描和上下文构建遵守显式 ignore policy，避免 runtime/generated/test 噪音污染。

边界：

- 本变更优先实现 Project Map P0/P1 能力，不重写整体图渲染架构。
- 本变更复用现有数据集、generation worker、persistence 与 panel，不引入独立 dashboard。
- 本变更允许新增轻量 relation/context/impact 类型，但不强制所有历史 dataset 迁移。

## 非目标

- 不引入 React Flow 或替换现有 interactive layout。
- 不实现完整 docs/wiki graph、domain graph 或外部 graph server。
- 不增加自动 post-commit graph update hook。
- 不把 LLM inferred relation 伪装成 deterministic evidence。
- 不改变 OpenSpec/Trellis 的现有执行流程。

## What Changes

- Project Map dataset 新增可选 relation graph 能力，用于表达节点之间的 typed relationship，并保留 evidence/confidence/source kind。
- Project Map 新增 context builder，从 query 或 node 生成 Project Map context pack，包含 matched nodes、1-hop related nodes、evidence files、risk flags 与 related artifacts。
- Project X-Ray / Project Map panel 新增 Explain Pack 入口，在 node inspector 中展示或生成节点解释所需上下文。
- Project Map 新增 changed files impact 计算服务，支持直接变更节点、影响节点、受影响 lens/layer、unmapped files 与风险摘要。
- Project Map 新增 scan/context ignore policy，默认排除 dependency、generated、runtime artifact 与仓库规则指定的非事实源。
- 研究文档作为设计依据保留在 `openspec/docs/project-map-understand-anything-design-study-2026-06-02.md`。

## 技术方案取舍

| 选项 | 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | 复制 Understand-Anything 独立 dashboard | 交互成熟、图谱能力完整 | 脱离 mossx 工作流，重复 UI，和 Tauri/Project X-Ray 割裂 | 不采用 |
| B | 在现有 Project Map 内增量加入 context/explain/impact/ignore | 保持产品闭环，复用 evidence/stale/candidate，风险可控 | 需要逐步补 relation/context 类型 | 采用 |
| C | 先完整重构为 typed relation graph | 长期模型统一 | 初期改动大，容易阻塞 P0 使用价值 | 暂缓，仅新增 optional relation |

采用选项 B：先让 Project Map 成为 Engineering Context Router，再逐步扩展 graph visualization。

## Capabilities

### New Capabilities

- 无。该变更增强既有 Project Map / Project X-Ray 能力，不新增独立 capability。

### Modified Capabilities

- `project-xray-panel`: Project X-Ray panel 中 Project Map 的节点解释、上下文构建、impact overlay 与 ignore policy 行为发生变化。
- `project-map-incremental-generation`: Project Map 生成/刷新过程需要支持 relation/context/impact 所需的可选字段和忽略策略。

## Impact

- Frontend types and services:
  - `src/features/project-map/types.ts`
  - `src/features/project-map/services/*`
  - `src/features/project-map/utils/*`
  - `src/features/project-map/hooks/*`
  - `src/features/project-map/components/ProjectMapPanel.tsx`

- Behavior specs:
  - `openspec/specs/project-xray-panel/spec.md`
  - `openspec/specs/project-map-incremental-generation/spec.md`

- No backend API change expected.
- No new npm dependency expected.
- No breaking migration required; new dataset fields remain optional.

## 验收标准

- Project Map can build a context pack from a selected node without requiring a full graph rebuild.
- Node inspector exposes an Explain Pack view/action containing evidence, related nodes, confidence/stale risk and related artifacts.
- Impact calculation can map changed file paths to changed nodes, affected nodes and unmapped files.
- Ignore policy excludes obvious generated/runtime/dependency paths from context and impact calculations.
- Existing Project Map datasets without relation fields still load normally.
