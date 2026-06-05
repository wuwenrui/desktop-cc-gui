## Context

Project Map 当前通过 dataset、interactive layout、node detail、generation worker 与 persistence 组成 Project X-Ray 的工程理解入口。它已经具备 evidence、confidence、stale、candidate 与 generation 状态，但关系和上下文能力仍偏弱：节点之间主要通过 parent/children、sources、related artifacts 间接表达，无法稳定支持 explain、agent task context、diff impact 或扫描噪音控制。

Understand-Anything 源码研究提供了一个可借鉴模式：graph 不只是 dashboard，而是 context router。它通过 search + 1-hop expansion 生成 chat context，通过 selected path 生成 explain context，通过 changed files 生成 diff impact context，并通过 deterministic scan + LLM enrichment 降低图谱幻觉。

mossx 不应复制独立 dashboard，而应把这些能力嵌入现有 Project Map 与 Project X-Ray 工作流。

## Goals / Non-Goals

**Goals:**

- Project Map dataset 支持可选 typed relation，用于上下文、解释和影响分析。
- Project Map 能从 selected node 或 query 构建 ProjectMapContextPack。
- Node inspector 能展示 Explain Pack，包括 evidence、邻接节点、risk flags 与可执行动作。
- Project Map 能根据 changed file paths 计算最小 impact result。
- context/impact 构建遵守 ignore policy，避免 generated/runtime/dependency 噪音。

**Non-Goals:**

- 不替换现有 ProjectMapPanel 或 interactive layout。
- 不引入 React Flow、新 dashboard server 或外部访问 token gate。
- 不实现完整 docs/wiki graph。
- 不引入自动 post-commit 更新 hook。
- 不强制迁移历史 Project Map dataset。

## Decisions

### Decision 1: Keep relation graph optional

ProjectMapDataset 新增 `relations?: ProjectMapRelation[]`，不把 relation 设为必填。

Alternatives considered:

- Required relation graph: 模型更统一，但会破坏旧 dataset 和 persistence。
- Derive all relations at render time: 兼容性好，但无法表达 relation source/evidence/confidence。

Rationale:

Optional relation 能逐步落地，并允许 generation worker、manual inference、future deterministic extractor 分阶段补充。

### Decision 2: Use ProjectMapContextPack as product-facing adapter

新增 context builder，而不是让 UI、agent bridge、explain action 各自遍历 dataset。

Alternatives considered:

- UI 直接拼上下文：短期快，但会复制逻辑。
- 后端 IPC 构建上下文：当前没有必要，Project Map 数据主要在前端。

Rationale:

ContextPack 是 Project Map 成为 Engineering Context Router 的核心边界。它可以被 inspector、task bridge、future chat/explain 复用。

### Decision 3: Implement minimal impact analysis first

Impact calculation 先支持 changed file paths -> changed nodes / affected nodes / affected lenses / unmapped files / risk summary。

Alternatives considered:

- 完整 dependency graph blast radius：价值高，但需要更强 relation extraction。
- 只显示 changed files：实现简单，但不足以回答风险影响。

Rationale:

最小 impact 已能服务 PR review、agent patch review 和 Project Map stale 判断，并且能在无完整 relation 时回退到 sources/filePath matching。

### Decision 4: Ignore policy is a service-level filter, not a tracked config first

先实现默认 ignore pattern + `.gitignore` aware filtering + existing runtime artifact rules，不立即新增 repo-tracked config。

Alternatives considered:

- 新增 `.projectmapignore`：清晰，但会引入团队契约和维护成本。
- 完全依赖 `.gitignore`：不够，因为一些 tracked docs/spec 是事实源，runtime artifact 规则也不一定都在 `.gitignore`。

Rationale:

Project Map 的扫描范围仍在演进，先用 service-level policy 控制噪音，未来需要团队契约时再落 tracked config。

## Risks / Trade-offs

- [Risk] Optional relations may be sparse initially → Mitigation: context and impact builders must fallback to existing parent/children/sources/artifacts.
- [Risk] Impact overlay can overstate risk with weak relation evidence → Mitigation: include source kind and confidence; distinguish direct changed from inferred affected.
- [Risk] Ignore policy may hide useful files → Mitigation: keep policy conservative and expose unmapped/ignored summary for debugging.
- [Risk] UI inspector can become crowded → Mitigation: Explain Pack is a grouped section/action, not always-expanded content.

## Migration Plan

1. Add optional types and pure utility services.
2. Wire ProjectMapPanel inspector to consume context/explain/impact outputs.
3. Keep old dataset loading path unchanged.
4. Mark tasks complete only after each behavior is wired.

Rollback strategy:

- Remove UI entry points for Explain Pack / Impact Overlay.
- Keep optional type additions harmless if already persisted.
- Since no required migration is introduced, rollback does not need data conversion.

## Open Questions

- Should future relation extraction come from Project Map generation worker, deterministic source scan, or both?
- Should OpenSpec/Trellis docs become first-class Project Map nodes in a follow-up change?
- Should ContextPack be exposed to Agent Task Orchestration immediately or only after the Orchestration Center change stabilizes?
