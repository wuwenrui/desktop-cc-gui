## Why

The research document concludes that Project Map should evolve from a code structure map into a Code + Spec + Task engineering knowledge graph. mossx stores critical project truth across `src/**`, `openspec/**`, `.trellis/**`, AGENTS.md, docs, and task artifacts; keeping these separate prevents Project Map from answering which spec defines a node, which task changed it, and which implementation validates it.

This change proposes the next major graph expansion: integrate code, OpenSpec, Trellis task, and documentation knowledge into one evidence-backed Project Map model.

## 目标与边界

目标：

- Add first-class spec/task/document node support where needed.
- Link code nodes to OpenSpec capabilities, scenarios, Trellis tasks, and related docs.
- Add deterministic extraction for OpenSpec/Trellis/docs before any LLM enrichment.
- Keep LLM inferred relations explicitly marked and lower priority than deterministic evidence.
- Prepare Project Map context packs for Agent Task Orchestration and Spec Hub use cases.

边界：

- This is an engineering knowledge graph expansion, not a standalone knowledge-base product.
- The first version should ingest OpenSpec and Trellis metadata deterministically.
- Wiki/doc semantic enrichment can be phased after deterministic links are stable.

## 非目标

- 不复制 Understand-Anything standalone dashboard。
- 不直接实现 full domain graph 或 arbitrary wiki graph。
- 不自动修改 specs/tasks based on graph inference。
- 不将 LLM inferred relation 作为事实源。

## What Changes

- Extend Project Map dataset semantics to include spec/task/document relationships.
- Add deterministic extractors for OpenSpec capabilities, requirements, scenarios, active changes, and Trellis task links.
- Add relation types such as `specified_by`, `implements`, `validated_by`, `task_candidate_for`, `documents`, and `generated_from` where not already covered.
- Add Code+Spec+Task graph sections in Project Map inspector/context packs.
- Add bridge-ready context output for Agent Task Orchestration.

## 技术方案取舍

| 选项 | 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | Treat specs/docs as related artifacts only | Minimal change | Cannot support graph traversal or task/spec impact | 不采用 |
| B | Add deterministic Code+Spec+Task graph layer | Evidence-backed and aligned with mossx workflow | More implementation work | 采用 |
| C | Use pure LLM extraction over all docs | Fast to prototype | High hallucination risk and weak governance | 不采用 |

## Capabilities

### New Capabilities

- 无。This expands existing Project Map, Project X-Ray, Spec Hub, and Agent Task Orchestration surfaces.

### Modified Capabilities

- `project-xray-panel`: Project Map shall show code/spec/task/document relationships in context and inspector views.
- `project-map-incremental-generation`: Project Map generation shall support deterministic spec/task/doc relationship extraction.
- `agent-task-orchestration-center`: Agent tasks may consume Project Map context packs that include spec/task evidence.
- `spec-hub-adapter-openspec`: OpenSpec capability/scenario metadata may be used as Project Map evidence.

## Impact

- Project Map generation and context services.
- OpenSpec/Trellis parsers or adapters.
- ProjectMapPanel inspector and context views.
- Agent Task Orchestration bridge input contract.

## 验收标准

- Project Map can represent OpenSpec capability/scenario nodes or relationships without breaking code nodes.
- Project Map can link a code node to relevant spec/task/document evidence where deterministic evidence exists.
- Context packs include spec/task evidence when available.
- LLM inferred relations are visually or structurally distinguishable from deterministic/spec/task links.
- Existing Project Map datasets without spec/task graph data still load normally.
