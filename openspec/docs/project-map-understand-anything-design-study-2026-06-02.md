# Project Map 借鉴 Understand-Anything 设计研究

- Date: 2026-06-02
- Scope: Project Map / Project X-Ray 扩展与交互优化研究
- Reference project: `/Users/chenxiangning/code/AI/github/Understand-Anything`
- Target project: `mossx`
- Output type: research note, not implementation spec

## TL;DR

Understand-Anything 的核心价值不在于“有一张更漂亮的图”，而在于它把 codebase 压缩成一个可搜索、可导航、可讲解、可做 diff impact 的 typed knowledge graph。

mossx Project Map 当前更强的是 evidence-backed 项目智能：`source refs`、`confidence`、`stale`、`candidate`、AI generation、organizer、auto ingestion、diagram artifacts、Project Map -> orchestration task bridge 方向。Understand-Anything 更强的是 graph interaction model：typed edges、layer overview/drill-down、container 展开、guided tour、search、diff overlay、file explorer、path finder、schema repair。

建议方向：不要克隆 Understand-Anything 的独立 dashboard；要把它的 graph interaction primitives 融入 mossx 现有 Project Map，让 Project Map 从“项目结构知识面板”升级成“证据驱动的工程导航地图”。

## 当前判断

### 值得借鉴

1. `Typed edge taxonomy`：把节点关系从隐式 children / sources 扩展为显式 relation graph。
2. `Layer overview -> detail drill-down`：顶层先看 architecture layer，点进去再看局部节点和跨层连接。
3. `Guided tour`：自动生成学习路线，按 dependency / architecture order 带用户理解项目。
4. `Search + navigation history`：搜索节点、跳转节点、保留 node history，降低大图迷失感。
5. `Diff impact overlay`：把 changed nodes 与 affected nodes 可视化，服务 PR review 和变更风险判断。
6. `File explorer + node inspector`：一边是图，一边是文件树和节点详情，双入口互相定位。
7. `Path finder`：寻找两个节点之间的最短关系路径，回答“这两个模块怎么连上的？”。
8. `Graph validation / repair`：对 LLM 输出做 schema sanitize、alias repair、dangling edge drop、layout input repair。

### 不建议照搬

1. 不照搬独立 web dashboard：mossx 是 Tauri 工程工作台，Project Map 应嵌在工作流里。
2. 不把 Project Map 降级成纯 static-analysis graph：mossx 的优势是会话、memory、spec、task、runtime evidence。
3. 不默认引入 auto-update post-commit hook：mossx 已有 Trellis session record / OpenSpec 流程，后台 hook 易制造治理漂移。
4. 不把图做成唯一入口：Project Map 应与 Orchestration Center、TaskRun、SpecHub、Session Catalog 互相跳转。
5. 不急着引入 React Flow 全套依赖：当前 Project Map 已有自定义 interactive layout，先补 relation model 和交互语义。

## Understand-Anything 架构速读

### 产品心智

Understand-Anything 的一句话定位是：把 codebase / knowledge base / docs 转成 interactive knowledge graph，用户可以 pan、zoom、search、click、ask questions。

它强调的不是复杂度展示，而是教学：让用户知道每个部分如何拼在一起。

### 数据模型

核心模型是 `KnowledgeGraph`：

```ts
KnowledgeGraph = {
  version: string;
  kind?: "codebase" | "knowledge";
  project: ProjectMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: Layer[];
  tour: TourStep[];
}
```

关键点：

- `GraphNode` 有 `type`、`name`、`filePath`、`lineRange`、`summary`、`tags`、`complexity`。
- `GraphEdge` 有 `source`、`target`、`type`、`direction`、`description`、`weight`。
- `Layer` 是逻辑分组。
- `TourStep` 是学习路径。

### Node taxonomy

Understand-Anything 支持 21 类节点：

| Category | Types |
|---|---|
| Code | `file`, `function`, `class`, `module`, `concept` |
| Non-code | `config`, `document`, `service`, `table`, `endpoint`, `pipeline`, `schema`, `resource` |
| Domain | `domain`, `flow`, `step` |
| Knowledge | `article`, `entity`, `topic`, `claim`, `source` |

这套分类对 Project Map 很有启发，但不应原样搬运。mossx 现有 `ProjectMapNodeKind` 已覆盖 `module`、`capability`、`api`、`interface`、`data`、`dependency`、`quality`、`build`、`runtime`、`flow`、`risk`、`timeline`、`cross-cutting`、`concept`。更合理的做法是补 `relation type`，而不是先扩 `node kind`。

### Edge taxonomy

Understand-Anything 的 edge 类型很完整：

| Category | Edge types |
|---|---|
| Structural | `imports`, `exports`, `contains`, `inherits`, `implements` |
| Behavioral | `calls`, `subscribes`, `publishes`, `middleware` |
| Data flow | `reads_from`, `writes_to`, `transforms`, `validates` |
| Dependencies | `depends_on`, `tested_by`, `configures` |
| Semantic | `related`, `similar_to` |
| Infra / Schema | `deploys`, `serves`, `provisions`, `triggers`, `migrates`, `documents`, `routes`, `defines_schema` |
| Domain | `contains_flow`, `flow_step`, `cross_domain` |
| Knowledge | `cites`, `contradicts`, `builds_on`, `exemplifies`, `categorized_under`, `authored_by` |

这是 Project Map 当前最值得借鉴的地方。mossx Project Map 现在更多依赖 `children`、`parentId`、`sources` 和 `relatedArtifacts`，缺少一等公民的 relationship graph。因此很多问题无法自然回答：

- 这个风险影响哪些能力？
- 这个 runtime 节点被哪些 feature 依赖？
- 这个 spec 对应哪些实现文件和测试？
- 当前改动会波及哪些 layer？
- 两个节点之间的关系路径是什么？

### Pipeline

Understand-Anything 的 pipeline 分层清晰：

1. `project-scanner`：扫描文件、语言、框架、import map。
2. `file-analyzer`：对文件 batch 做结构抽取和语义分析。
3. `architecture-analyzer`：识别 layer。
4. `tour-builder`：生成 guided tour。
5. `graph-reviewer`：验证完整性和 referential integrity。
6. `domain-analyzer`：可选生成 domain graph。
7. `article-analyzer`：可选生成 knowledge graph。

工程上有两个关键原则：

- deterministic structural extraction 与 LLM semantic analysis 分离。
- agent 中间产物写入磁盘，不把所有上下文堆回主会话。

mossx Project Map 已经有 AI generation worker、structured output normalization、organizer、auto ingestion。下一步可借鉴的是 deterministic evidence reader / relation extractor，而不是再堆一个纯 LLM generator。

### Dashboard interaction

Understand-Anything 的 dashboard 有几个成熟交互：

- `GraphView`：结构图主视图。
- `DomainGraphView`：业务 domain / flow / step 横向视图。
- `KnowledgeGraphView`：force-directed knowledge graph。
- `SearchBar`：节点搜索。
- `NodeInfo`：节点详情、关系、源码入口。
- `FileExplorer`：从文件树反向定位 graph node。
- `LayerLegend`：layer 信息。
- `FilterPanel`：按 node type、complexity、layer、edge category 过滤。
- `PathFinderModal`：节点间最短路径。
- `CodeViewer`：文件节点代码查看。
- `LearnPanel`：guided tour 学习路径。
- `DiffToggle`：changed / affected overlay。

Project Map 不需要照搬所有 UI，但应吸收这些“导航原语”。

## 与 mossx Project Map 的差异矩阵

| 维度 | mossx Project Map | Understand-Anything | 判断 |
|---|---|---|---|
| 核心目的 | evidence-backed 项目智能、风险、候选、治理桥接 | codebase graph onboarding / navigation | mossx 更偏工程工作台，UA 更偏学习 dashboard |
| 数据关系 | `parentId` / `children` / `sources` / artifacts | explicit typed `edges[]` | Project Map 应补 relation graph |
| 证据能力 | 强：source refs、confidence、stale、candidate、evidence gate | 中：filePath、lineRange、summary、schema validation | mossx 保持优势 |
| 生成方式 | AI structured output + organizer + memory ingestion | static analysis + LLM agents + reviewer | mossx 可补 deterministic extraction |
| UI 架构 | 自定义 graph layout + detail panel + generation controls | React Flow graph-first dashboard | 不建议照搬 React Flow |
| 导航 | 节点选择、focus、mini map、detail | search、history、path finder、file explorer、tour | Project Map 可补 search/history/path/tour |
| 更新 | generation run / auto ingestion / persistence | fingerprint + incremental update + staleness | 可借鉴 structural fingerprint 和 impact update |
| 任务连接 | 正在规划 Project Map -> OrchestrationTask | 无任务中心，偏理解 | mossx 应把 map 连接执行闭环 |

## 可借鉴设计 1：Typed Relation Graph

### 现状

Project Map 的节点信息丰富，但关系表达偏树状。`children` 能表达层级，`sources` 能表达证据，`relatedArtifacts` 能表达产物。但缺少统一 relation model。

### 建议

新增 `ProjectMapRelation`，作为 `ProjectMapDataset` 的 optional 字段，兼容旧数据：

```ts
type ProjectMapRelationType =
  | "contains"
  | "depends_on"
  | "calls"
  | "configures"
  | "documents"
  | "tested_by"
  | "implements"
  | "serves"
  | "triggers"
  | "reads_from"
  | "writes_to"
  | "risk_affects"
  | "evidence_for"
  | "task_candidate_for"
  | "related";

type ProjectMapRelation = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: ProjectMapRelationType;
  direction: "forward" | "backward" | "bidirectional";
  confidence: ProjectMapConfidence;
  stale?: boolean;
  weight?: number;
  label?: string;
  evidence: ProjectMapEvidenceRecord[];
  generatedBy?: ProjectMapGeneratedBy;
};
```

### 为什么不是直接复用 UA edge schema

UA edge 更偏代码结构，Project Map 还需要表达项目治理和执行语义：

- `risk_affects`
- `evidence_for`
- `task_candidate_for`
- `spec_defines`
- `run_validates`

Project Map 的 edge 必须带 evidence 和 confidence，否则会削弱当前可信度体系。

## 可借鉴设计 2：Layer Overview -> Detail Drill-down

### UA 做法

- 顶层展示 layer cluster。
- 进入 layer 后只展示该 layer 内节点。
- 跨层关系用 aggregated edges / portals 表达。
- container 可展开，避免一次渲染所有子节点。
- selected/search/tour/focus 不触发布局重算，只改变视觉态。

### Project Map 可做

把当前 lens / node hierarchy 调整成三层导航：

1. `Overview`：显示 lens / domain / capability clusters。
2. `Cluster detail`：显示某个 lens 或 capability 下的节点与关系。
3. `Node focus`：显示 1-hop neighborhood + evidence + actions。

### 关键原则

- 大图不要一口气全展开。
- 用户当前关注的是局部系统，不是整个宇宙。
- layout state 与 visual state 分离：selection、hover、search、risk chip 不应触发 expensive layout。

## 可借鉴设计 3：Guided Tour

### UA 做法

`tour[]` 是一等字段，每个 step 包含：

- `order`
- `title`
- `description`
- `nodeIds`
- `languageLesson`

### Project Map 可做

新增 `ProjectMapTourStep`：

```ts
type ProjectMapTourStep = {
  id: string;
  order: number;
  title: string;
  summary: string;
  nodeIds: string[];
  lensId?: string;
  intent: "onboarding" | "architecture" | "risk-review" | "release-review" | "task-planning";
  sourceRefs: ProjectMapSource[];
};
```

### 价值

Project Map 可以回答：

- 新人应该按什么顺序理解这个项目？
- 当前 release 改动应该从哪些节点开始 review？
- 高风险链路有哪些？
- 哪些节点最适合变成 OrchestrationTask？

这比“展示一个图”更有工程价值。

## 可借鉴设计 4：Diff Impact Overlay

### UA 做法

`/understand-diff` 会：

1. 找 changed files。
2. 在 graph 中找到对应 changed nodes。
3. 找 1-hop affected nodes。
4. 写 `diff-overlay.json`。
5. Dashboard 高亮 changed / affected。

### Project Map 可做

Project Map 可以新增 workspace diff projection：

```ts
type ProjectMapImpactOverlay = {
  id: string;
  generatedAt: string;
  baseRef?: string;
  changedSources: ProjectMapSource[];
  changedNodeIds: string[];
  affectedNodeIds: string[];
  riskNodeIds: string[];
  relationIds: string[];
};
```

### 和 mossx 的结合点

mossx 已有 Git history、workspace status、TaskRun、SpecHub。Impact Overlay 可以成为：

- PR review 入口。
- task draft 风险依据。
- release closure 的 evidence。
- Project Map stale marker 的驱动源。

## 可借鉴设计 5：Search / Semantic Search

### UA 做法

- fuzzy search 基于 `Fuse`。
- semantic search 有 embedding engine 预留。
- search results 会映射到节点高亮和 layer match count。

### Project Map 可做

P0 先做 deterministic fuzzy search：

- 搜 `title`
- 搜 `summary`
- 搜 `nodeKind`
- 搜 `sources.path`
- 搜 `relatedArtifacts.path`
- 搜 `detail.keyFacts/keyLogic/riskSignals`

P1 再做 semantic search：

- 使用 Project Memory / Context Ledger 中已有语义摘要。
- 或后续加 embedding provider。

关键是搜索结果要驱动：

- focus node
- highlight matching nodes
- sidebar result list
- lens match count

## 可借鉴设计 6：File Explorer + Node Inspector

### UA 做法

右侧 sidebar 有 `Info` / `Files` tab。File Explorer 从 structural graph 建文件树，点击文件定位节点。NodeInfo 则展示 node summary、tags、关系、children、open code。

### Project Map 可做

Project Map detail panel 可以增加 `Evidence Files` tab：

- 按文件路径聚合 source refs。
- 每个文件列出相关 node。
- 点击文件可以 open editor。
- 点击 node 可以 focus map。

这能把“图上的抽象节点”和“真实代码文件”重新接起来。

## 可借鉴设计 7：Path Finder

### UA 做法

PathFinder 用 BFS 在 graph edges 上找两个节点之间的最短路径。

### Project Map 可做

在引入 relation graph 后，Project Map 可提供：

- `Find relation path`
- `Show why related`
- `Explain dependency chain`
- `Find blast radius`

### 工程意义

用户常问的不是“节点有哪些”，而是：

- A 为什么会影响 B？
- 这个风险和这个 runtime 模块有什么关系？
- 这个 spec 怎么连到测试？
- 这个 TaskRun 产物验证了哪个 Project Map 节点？

Path Finder 是把 graph 从装饰变成工具的关键能力。

## 可借鉴设计 8：Graph Validation / Repair

### UA 做法

Understand-Anything 对 LLM graph 做了多层防御：

- schema validation
- alias mapping
- missing field default
- type coercion
- edge/node dangling reference drop
- ELK layout input repair
- warning banner

### Project Map 可做

Project Map 现在已有 structured output normalization 和 evidence gate，可以继续增强：

1. `ProjectMapRelation` validator。
2. `ProjectMapTourStep` validator。
3. layout input repair 报告进入 run logs。
4. invalid relation 不写 trusted dataset，只落 candidate / warning。
5. repair action 必须可追踪，不 silently mutate。

## 与 Orchestration Center 的关系

当前 active OpenSpec change `add-agent-task-orchestration-center` 已定义 Project Map create-task bridge：

- 从 Project Map node 创建 orchestration task draft。
- 保留 node id、source evidence、confidence、stale marker。
- 不自动启动执行。
- 从 task detail 能回跳 Project Map node。

Understand-Anything 的启发是：Project Map 不只应能创建任务，还应能解释“为什么这个节点值得成为任务”。这需要：

- risk relation
- affected nodes
- evidence file tree
- confidence/stale chip
- guided action summary
- source path back-navigation

所以建议 Project Map 优化和 Orchestration Center 不要割裂：

```text
Project Map node / relation / impact overlay
  -> task draft sourceRefs + evidenceRefs + risk marker
  -> Orchestration Center dispatch gate
  -> TaskRun / session
  -> review_needed
  -> Project Map node updated / candidate generated
```

## 推荐路线

### P0：交互导航增强，不改核心存储大模型

目标：用最小改动提升可用性。

任务：

1. 增加 Project Map 节点搜索。
2. 增加 search result list 和 node focus。
3. 增加 node history / back。
4. 增加 evidence files 聚合 tab。
5. 调整 detail panel：把 sources、artifacts、risk、actions 分区。
6. 保持现有 `ProjectMapDataset` 兼容，不新增 relation graph。

验收：

- 用户能从关键词找到节点。
- 用户能从文件路径找到相关 Project Map node。
- 用户在大图中不迷失。

### P1：引入 ProjectMapRelation

目标：让 Project Map 具备关系图能力。

任务：

1. 新增 optional `relations?: ProjectMapRelation[]`。
2. 补 relation validator / sanitizer。
3. 从现有 `parentId/children/sources/relatedArtifacts` 派生 baseline relations。
4. UI 支持 relation edge rendering / filtering。
5. Node detail 展示 incoming/outgoing relations。

验收：

- 旧 snapshot 可读。
- 新 relation 不破坏现有 tree layout。
- dangling relation 不 crash。
- low-confidence relation 不能伪装成 verified relation。

### P2：Guided Tour + Impact Overlay

目标：让 Project Map 从静态地图变成学习和 review 工具。

任务：

1. 新增 `tourSteps?: ProjectMapTourStep[]`。
2. 支持 onboarding / risk-review / task-planning 三种 tour intent。
3. 新增 diff impact overlay projection。
4. changed / affected / risk nodes 高亮。
5. 可从 overlay 创建 task draft。

验收：

- 用户能按 tour 理解项目。
- 用户能看到当前变更影响哪些节点。
- 用户能从 impact node 创建任务草案，但不会自动执行。

### P3：关系路径与任务闭环

目标：把 Project Map 接入工程执行闭环。

任务：

1. Path finder。
2. Relation explanation。
3. Project Map node -> OrchestrationTask draft。
4. OrchestrationTask -> Project Map node back-navigation。
5. TaskRun completion -> Project Map candidate update / review cue。

验收：

- 用户能解释两个节点的关系路径。
- 用户能从 map 创建任务并保留 evidence。
- TaskRun 完成后不会自动修改 map truth，只生成 candidate 或 review cue。

## 技术风险

| 风险 | 描述 | 缓解 |
|---|---|---|
| Relation hallucination | LLM 生成错误关系会误导用户 | relation 必须带 evidence/confidence；低置信只作 candidate |
| 大图性能 | relation edge 增多后 layout 变慢 | overview/detail/focus 分层；selected/search 不触发布局重算 |
| 存储兼容 | 新字段破坏旧 snapshot | 所有新增字段 optional；reader normalize |
| UI 复杂化 | Project Map 变成按钮堆 | action rail 分层；默认只展示核心动作 |
| 与 Orchestration 重叠 | Project Map 变成任务中心 | Project Map 负责 evidence/navigation，Orchestration Center 负责 execution/review |
| 过度照搬 UA | 产品心智漂移到独立 dashboard | 保持 Tauri workspace workbench 语义 |

## 设计原则

1. Project Map 的核心不是图，而是 evidence-backed project understanding。
2. Graph relation 必须可追溯，不可信就别装可信。
3. 大图只适合总览，真正可用的是局部 focus 和路径解释。
4. AI run 完成不等于项目事实更新；必须进入 candidate / review。
5. Project Map 与 Orchestration Center 是双向桥，不是同一个模块。

## 借鉴优先级

| Priority | Borrowed idea | Reason |
|---|---|---|
| P0 | Search + node focus + evidence file tab | 低风险、高收益，直接改善导航 |
| P1 | Typed relation graph | Project Map 进入 graph intelligence 的基础 |
| P1 | validation / repair for relations | 防止 LLM graph 污染 truth |
| P2 | guided tour | 把 map 变成 onboarding / review 工具 |
| P2 | diff impact overlay | 连接 Git / PR / task planning |
| P3 | path finder | 让关系可解释 |
| P3 | Project Map -> task bridge deepening | 与 0.5.5 Orchestration Center 闭环 |

## 最小 MVP 草图

```text
ProjectMapDataset
  manifest
  profile
  lenses
  nodes
  relations?        <- new optional relation graph
  viewState
  runs
  candidates
  evidenceRecords
  diagramDocuments
  tourSteps?        <- new optional learning/review paths
  impactOverlays?   <- new optional changed/affected projection
```

```text
UI
  Toolbar
    Search
    Filter
    Tour
    Impact

  Canvas
    Overview clusters
    Detail graph
    Focus neighborhood

  Detail panel
    Summary
    Evidence
    Relations
    Files
    Actions
```

## 建议下一步

如果进入实现，不建议一次做完。建议先开一个 OpenSpec change：`improve-project-map-navigation-and-relation-model`。

第一版只做：

1. Project Map 搜索。
2. Evidence files 聚合 tab。
3. Node history / focus 改进。
4. relation model 只定义 schema 和从现有数据派生，不接 AI 生成。

这样风险最低，也为后续 guided tour / diff impact / orchestration bridge 铺路。

## Audit Trail

Refers to:

- `/Users/chenxiangning/code/AI/github/Understand-Anything/README.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/CLAUDE.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/types.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/schema.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/search.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/embedding-search.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/fingerprint.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/staleness.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/change-classifier.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/App.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/store.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/GraphView.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/DomainGraphView.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/KnowledgeGraphView.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/NodeInfo.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/FileExplorer.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/SearchBar.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/PathFinderModal.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/components/FilterPanel.tsx`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/edgeAggregation.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/elk-layout.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/layout.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/containers.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/filters.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/utils/layerStats.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-diff/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-chat/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-explain/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-onboard/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-domain/SKILL.md`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/types.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/components/ProjectMapPanel.tsx`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/hooks/useProjectMapDataset.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/services/projectMapGenerationWorker.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/services/projectMapPersistence.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/utils/interactiveLayout.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/utils/incrementalGeneration.ts`
- `/Users/chenxiangning/code/AI/github/mossx/src/features/project-map/utils/display.ts`
- `/Users/chenxiangning/code/AI/github/mossx/openspec/changes/add-agent-task-orchestration-center/proposal.md`
- `/Users/chenxiangning/code/AI/github/mossx/openspec/changes/add-agent-task-orchestration-center/design.md`
- `/Users/chenxiangning/code/AI/github/mossx/openspec/changes/add-agent-task-orchestration-center/tasks.md`
- `/Users/chenxiangning/code/AI/github/mossx/openspec/changes/add-agent-task-orchestration-center/specs/project-xray-panel/spec.md`
- `/Users/chenxiangning/code/AI/github/mossx/openspec/changes/add-agent-task-orchestration-center/specs/agent-task-orchestration-center/spec.md`

Impact:

- 本文档仅为设计研究记录。
- 未修改代码。
- 未创建 OpenSpec change。
- 未运行测试或验证命令。

## Known limitation

`xp-study-web` 的 `content_ingester.py` 在当前本机 skill 路径中包含非 Python 内容，执行 `python3` 时报 `SyntaxError`。本研究按 skill fallback 直接读取关键源码文件完成。

---

## 第二步源码深挖：可借鉴功能点定位

> 本节目标：不再泛泛评价 Understand-Anything，而是把可借鉴功能点定位到源码机制、交互入口和 mossx Project Map 的迁移方式。

### 0. 结论先行

Understand-Anything 第二轮源码里最值得借鉴的，不是独立 dashboard，也不是某个 graph layout，而是这条产品逻辑：

```text
code/document scan
  -> deterministic graph base
  -> LLM implicit relationship enrichment
  -> graph-backed explain/chat/diff/onboarding context
  -> dashboard as one种表现层
```

对 mossx 来说，Project Map 更适合升级为：

```text
证据驱动的工程导航地图
  -> 支持搜索 / 定位 / 解释
  -> 支持 diff impact / stale 风险
  -> 支持 agent task 的上下文裁剪
  -> 支持源码 + OpenSpec + Trellis 文档的统一工程图谱
```

换句话说，Project Map 不应该只是“更漂亮的图”，而应该成为 mossx 的 `Engineering Context Router`。

---

### 1. Graph as Context Router：把图谱变成 agent/task 上下文裁剪器

#### 源码定位

- `understand-anything-plugin/src/context-builder.ts`
- `understand-anything-plugin/src/understand-chat.ts`

#### 它做了什么

`buildChatContext(graph, query, maxNodes)` 的核心流程：

```text
用户 query
  -> SearchEngine 搜索 relevant nodes
  -> 对 matched nodes 做 1-hop edge expansion
  -> 收集 relevant edges
  -> 收集包含这些节点的 relevant layers
  -> formatContextForPrompt 输出给 LLM
```

这不是 UI 功能，而是 LLM context building 功能。它把 graph 从“看图工具”升级成“对话和 agent 的上下文路由器”。

#### mossx 可借鉴点

Project Map 现在已经有 node、evidence、candidate、stale、task bridge 等更强的工程语义。可以新增一个内部能力：

```ts
buildProjectMapContext(queryOrNode, options)
```

建议输出：

```text
- matched symbols / files / candidates
- 1-hop related nodes
- evidence files
- stale/confidence 状态
- related OpenSpec changes / Trellis task
- recommended next agent action
```

#### 迁移优先级

`P0`。

这是 Project Map 后续所有 explain、search、task orchestration 的底座。比先做复杂关系图更重要。

---

### 2. Explain Context：节点详情页不只是展示，而是生成“解释包”

#### 源码定位

- `understand-anything-plugin/src/explain-builder.ts`

#### 它做了什么

`buildExplainContext(graph, path)` 支持：

```text
file path
path:function
```

然后收集：

```text
- targetNode
- childNodes: contains edges 下的内部组件
- connectedNodes: 1-hop 相关节点
- relevantEdges
- layer
```

再由 `formatExplainPrompt` 生成结构化解释 prompt：

```text
1. What it does and why it exists
2. How data flows through it
3. How it interacts with connected components
4. Patterns / idioms / design decisions
5. Gotchas / complexity
```

#### mossx 可借鉴点

Project Map 目前的 inspector 可以继续增强为 `Explain Pack`：

```text
点击一个 Project Map node
  -> 右侧 inspector 展示 summary/evidence/confidence/stale
  -> 一键生成 Explain Pack
  -> Explain Pack 可直接投递给 agent/task
```

Explain Pack 应包含：

```text
- 节点自身：type/name/summary/status/confidence
- 证据：evidence files / snippets / source type
- 子结构：child symbols 或 sub-candidates
- 周边关系：依赖它 / 它依赖谁 / 同层相关节点
- 风险：stale、low confidence、missing evidence
- 推荐动作：refresh / ask agent / create task / attach to OpenSpec
```

#### 迁移优先级

`P0`。

这是最直接提升 Project Map 可用性的功能。UI 上不需要大改，只需强化 inspector 和 action menu。

---

### 3. Diff Impact：从 changed files 推导影响半径

#### 源码定位

- `understand-anything-plugin/src/diff-analyzer.ts`
- `understand-anything-plugin/hooks/auto-update-prompt.md`

#### 它做了什么

`buildDiffContext(graph, changedFiles)` 的核心流程：

```text
changed files
  -> 映射 changedNodes
  -> contains children 一并算 changed
  -> 1-hop neighbors 算 affectedNodes
  -> impactedEdges
  -> affectedLayers
  -> unmappedFiles
  -> risk assessment
```

风险评估规则很朴素，但有效：

```text
- complex component changed -> high complexity
- affected layers > 1 -> cross-layer impact
- affected nodes > 5 -> wide blast radius
- unmapped files > 0 -> graph stale / need re-analysis
```

#### mossx 可借鉴点

mossx 的 Project Map 已经有 stale/candidate/evidence，比 Understand-Anything 更适合做 diff impact overlay。

建议新增 `Project Map Impact Mode`：

```text
输入：git changed files / current task touched files / agent patch files
输出：
- directly changed nodes
- impacted candidate nodes
- stale related nodes
- confidence drop candidates
- unmapped files
- affected OpenSpec capabilities
```

UI 表现：

```text
- changed nodes: 高亮蓝色
- affected nodes: 高亮橙色
- stale nodes: 斜纹或 warning badge
- unmapped files: inspector 顶部风险提示
```

#### 迁移优先级

`P1`。

推荐在 P0 的 context/explain 能力之后做。原因：impact mode 需要稳定的 node/file mapping，否则容易误报。

---

### 4. Onboarding Tour：把 Project Map 变成新人导览和架构导游

#### 源码定位

- `understand-anything-plugin/src/onboard-builder.ts`
- `understand-anything-plugin/agents/tour-builder.md`（第一轮已读）

#### 它做了什么

`buildOnboardingGuide(graph)` 直接从 graph 生成 Markdown：

```text
- project overview
- architecture layers
- key concepts
- getting started tour
- file map
- complexity hotspots
```

这里的关键不是 Markdown，而是 `tour` 字段：它把 graph 节点组织成一条理解路径。

#### mossx 可借鉴点

Project Map 可以新增 `Guided Tour`：

```text
- 新手路线：从入口模块到关键流程
- 任务路线：从当前 OpenSpec change 到相关实现点
- 风险路线：从 stale/low-confidence 节点开始排查
- 架构路线：按 layer/domain 逐步展开
```

这对 mossx 特别适合，因为 mossx 有 Trellis/OpenSpec 上下文，可以生成比 Understand-Anything 更工程化的 tour：

```text
OpenSpec proposal
  -> capability spec
  -> related Project Map nodes
  -> implementation files
  -> tests / validation gates
```

#### 迁移优先级

`P1`。

可作为 Project Map 的“导览模式”，不用先引入复杂新数据模型。

---

### 5. Docs/Wiki Knowledge Graph：把工程文档纳入 Project Map

#### 源码定位

- `understand-anything-plugin/skills/understand-knowledge/SKILL.md`
- `understand-anything-plugin/skills/understand-knowledge/parse-knowledge-base.py`
- `understand-anything-plugin/skills/understand-knowledge/merge-knowledge-graph.py`
- `understand-anything-plugin/agents/article-analyzer.md`

#### 它做了什么

`understand-knowledge` 支持 Karpathy-pattern wiki：

```text
raw sources
wiki markdown
schema files: CLAUDE.md / AGENTS.md
index.md
log.md
wikilinks
```

扫描方式分两层：

```text
deterministic parser:
  - frontmatter
  - headings
  - wikilinks
  - index categories
  - log timeline

LLM article-analyzer:
  - entities
  - claims
  - implicit relationships
```

`merge-knowledge-graph.py` 再做：

```text
- node/edge type normalization
- alias mapping
- entity deduplication
- dangling edge dropping
- layer generation from categories
- tour generation from index order
```

#### mossx 可借鉴点

Project Map 不应只扫描源码。mossx 的真实工程知识分布在：

```text
- src/**
- openspec/**
- .trellis/spec/**
- .trellis/tasks/**
- AGENTS.md
- README / docs
```

建议把 Project Map 扩展成 `Code + Spec + Task Graph`：

```text
Spec node:
  - OpenSpec capability / scenario / requirement

Task node:
  - Trellis task / active change / agent task

Code node:
  - feature / component / hook / service / util

Edges:
  - implements
  - specified_by
  - validated_by
  - depends_on
  - stale_with
  - generated_from
```

这会让 Project Map 从“源码地图”升级为“工程知识地图”。

#### 迁移优先级

`P2`。

这属于能力升级，价值很大，但要谨慎。建议先完成 P0/P1 的节点上下文和 impact，再扩展文档图谱。

---

### 6. Deterministic Base + LLM Enrichment：降低图谱幻觉

#### 源码定位

- `parse-knowledge-base.py`
- `merge-knowledge-graph.py`
- `article-analyzer.md`
- `assemble-reviewer.md`
- `graph-reviewer.md`（第一轮已读）

#### 它做了什么

Understand-Anything 的知识库图谱生成不是纯 LLM：

```text
deterministic scan 先产出稳定 base graph
LLM agent 只补隐式实体 / claim / relationship
merge script 做 normalization / dedupe / validation
reviewer agent 只处理脚本无法判断的问题
```

这是很重要的工程边界。

#### mossx 可借鉴点

mossx 已经有 evidence/candidate/confidence，所以更应该坚持：

```text
事实来源优先级：
1. deterministic source evidence
2. explicit spec/task link
3. git/file relation
4. LLM inferred relation
```

建议新增关系置信来源：

```ts
relation.sourceKind:
  | 'deterministic'
  | 'spec-link'
  | 'task-link'
  | 'git-diff'
  | 'llm-inferred'
```

并且 UI 上明确标记 inferred relation，不要把 LLM 推断伪装成事实。

#### 迁移优先级

`P1`。

如果要引入 relation graph，这个 guardrail 必须同步设计，否则 Project Map 会变成漂亮但不可信的图。

---

### 7. Ignore Policy：扩展扫描前先控制噪音

#### 源码定位

- `understand-anything-plugin/packages/core/src/ignore-filter.ts`
- `understand-anything-plugin/packages/core/src/ignore-generator.ts`
- `auto-update-prompt.md` Phase 0

#### 它做了什么

核心设计：

```text
DEFAULT_IGNORE_PATTERNS
  + .understand-anything/.understandignore
  + root .understandignore
```

默认排除：

```text
node_modules, .git, dist, build, coverage, .next, lock files,
binary assets, generated files, editor dirs, logs 等
```

`ignore-generator.ts` 还会从 `.gitignore` 和常见目录生成 starter ignore file。

#### mossx 可借鉴点

Project Map 如果要纳入更多源码和文档，必须有自己的 scan policy。否则 `.omx`、runtime artifact、generated file、test fixture 都会污染地图。

建议不是新增一个完全独立 `.projectmapignore`，而是先复用既有仓库规则：

```text
- .gitignore
- AGENTS.md 中 runtime artifact 约束
- Trellis/OpenSpec 规则中明确的 source of truth
- Project Map 自己的默认 exclude list
```

如需落盘配置，可考虑：

```text
.omx/project-map-ignore.json
```

不要轻易放到 repo tracked config，除非 Project Map 的扫描策略成为团队契约。

#### 迁移优先级

`P0`。

这是“扩展扫描范围”的前置条件。

---

### 8. Auto-update / Staleness：借鉴机制，不照搬 hook

#### 源码定位

- `understand-anything-plugin/hooks/hooks.json`
- `understand-anything-plugin/hooks/auto-update-prompt.md`
- `understand-anything-plugin/packages/core/src/fingerprint.ts`（第一轮已读）
- `understand-anything-plugin/packages/core/src/change-classifier.ts`（第一轮已读）
- `understand-anything-plugin/packages/core/src/staleness.ts`（第一轮已读）

#### 它做了什么

Hook 触发点：

```text
PostToolUse Bash: git commit / merge / cherry-pick / rebase
SessionStart: current HEAD != meta.gitCommitHash
```

增量更新流程：

```text
changed files
  -> ignore filter
  -> fingerprint structural check
  -> classify: SKIP / PARTIAL_UPDATE / ARCHITECTURE_UPDATE / FULL_UPDATE
  -> only structural changes invoke LLM agent
  -> patch graph / update meta / update fingerprints
```

#### mossx 可借鉴点

这个机制很强，但不建议照搬成自动 post-commit 改图。原因：

```text
mossx 已有 PlanFirst / OpenSpec / Trellis record workflow，自动改图容易和用户确认边界冲突。
```

更适合 mossx 的方案：

```text
- Project Map 顶部 stale badge
- 显示 stale reason: HEAD changed / files changed / spec changed / evidence outdated
- 用户点击 refresh / rescan selected
- agent task 完成后，可显式触发 Project Map update
```

也就是说：借鉴 `fingerprint + change classifier`，不借鉴“无需确认自动执行”。

#### 迁移优先级

`P1`。

mossx 已有 stale 语义，下一步可以把 stale 从“节点状态”升级成“可解释的更新建议”。

---

### 9. Dashboard token gate：不值得直接迁移，但安全意识可借鉴

#### 源码定位

- `understand-anything-plugin/skills/understand-dashboard/SKILL.md`
- `understand-anything-plugin/packages/dashboard/src/App.tsx`（第一轮已读）

#### 它做了什么

Dashboard 启动时要求带 `?token=`，否则显示 token gate。

这是因为它用本地 Vite server 暴露 graph JSON，需要基本访问保护。

#### mossx 可借鉴点

mossx 的 Project Map 是产品内模块，不需要复制这个 token gate。但如果未来 Project Map 支持：

```text
- external dashboard
- browser preview graph server
- shareable local graph URL
```

就必须考虑访问控制和敏感信息过滤。

#### 迁移优先级

`P3`。

当前不做。

---

## 可借鉴功能点优先级总表

| 优先级 | 功能点 | Understand-Anything 源码依据 | mossx 迁移方式 |
|---|---|---|---|
| P0 | Project Map Context Router | `context-builder.ts`, `understand-chat.ts` | 给 agent/task/explain 提供裁剪后的工程上下文 |
| P0 | Explain Pack / Node Inspector 增强 | `explain-builder.ts` | 节点详情页输出 evidence + neighbors + risks + actions |
| P0 | Ignore Policy | `ignore-filter.ts`, `ignore-generator.ts` | 扩展扫描范围前先建立噪音控制 |
| P1 | Diff Impact Overlay | `diff-analyzer.ts` | changed files -> changed/affected/stale/unmapped nodes |
| P1 | Guided Tour | `onboard-builder.ts`, `tour-builder.md` | 新手导览 / 任务导览 / 风险导览 |
| P1 | Relation source guardrail | `merge-knowledge-graph.py`, `article-analyzer.md` | 区分 deterministic/spec/task/git/llm-inferred 关系来源 |
| P1 | Fingerprint-based refresh | `auto-update-prompt.md`, `fingerprint.ts` | 显式 stale badge + 一键 refresh，不照搬自动 hook |
| P2 | Code + Spec + Task Graph | `understand-knowledge/*` | 把 OpenSpec/Trellis/README 纳入 Project Map |
| P2 | Graph validation/repair | `assemble-reviewer.md`, `graph-reviewer.md` | dangling edge、orphan node、missing evidence 修复 |
| P3 | External dashboard security | `understand-dashboard/SKILL.md` | 仅在未来外部 graph server 时考虑 |

---

## 建议的下一步 OpenSpec 变更范围

建议 change id：

```text
improve-project-map-context-and-impact-navigation
```

建议 scope：

```text
1. P0: Project Map Context Router
2. P0: Explain Pack / Node Inspector 增强
3. P0: Ignore Policy
4. P1: Diff Impact Overlay 的最小版本
```

不建议第一阶段做：

```text
- 完整 domain graph
- 完整 docs/wiki graph
- 外部 dashboard server
- 自动 post-commit graph update
- 大规模 React Flow 重写
```

原因：这些会扩大边界，但不一定立刻提高 Project Map 的核心使用价值。

---

## 第二轮 Audit Trail

### Refers to: Understand-Anything 第二轮新增阅读

- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/src/context-builder.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/src/understand-chat.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/src/explain-builder.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/src/diff-analyzer.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/src/onboard-builder.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-dashboard/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-knowledge/SKILL.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-knowledge/parse-knowledge-base.py`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/skills/understand-knowledge/merge-knowledge-graph.py`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/hooks/hooks.json`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/hooks/auto-update-prompt.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/ignore-filter.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/core/src/ignore-generator.ts`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/agents/knowledge-graph-guide.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/agents/assemble-reviewer.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/agents/article-analyzer.md`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/.claude-plugin/plugin.json`
- `/Users/chenxiangning/code/AI/github/Understand-Anything/understand-anything-plugin/packages/dashboard/src/main.tsx`

### Impact: 对 mossx Project Map 的判断变化

第一轮结论偏“交互和产品形态”。第二轮源码确认后，判断升级为：

```text
Project Map 应优先成为 Engineering Context Router，
其次才是 graph visualization。
```

这意味着后续实现应该先做上下文、解释、影响分析、ignore/stale 策略，再考虑更大的图谱重构。


## 2026-06-03 减法校正：从编排中心回到 Project Map 理解工具

### 触发原因

手工测试暴露出一个关键问题：当前 `AI 任务编排中心` 对开发者不可理解。`创建草案`、`已计划`、`准备派发`、`运行中`、`打开 Run`、`打开会话` 等概念混在一起，但真实 TaskRun / session 闭环没有完全打通，导致用户看到的是“点了没效果”“运行中卡住”“没有真实会话”。

这说明实现方向偏离了 Understand-Anything 的核心启发。UA 的核心不是任务执行后台，而是让用户通过 graph、search、node inspector、file explorer、guided tour、path finder 去理解项目。

### 新原则

1. Project Map 负责理解、定位、证据和收纳，不负责伪装成完整 runtime。
2. Task Center 负责执行，只有真实创建 TaskRun 后才进入执行态。
3. 没有 linked run 的任务不得显示为运行中。
4. 没有 linked session 的任务不得展示灰色“打开会话”假入口。
5. UI 只暴露用户能理解的状态，不暴露 provider/candidate/planned/ready 等内部状态。

### 简化后的用户态状态

```text
待处理 -> 已派发 -> 待验收 -> 已完成
        \-> 已归档
```

内部状态映射：

| 内部状态 | 用户态 |
|---|---|
| candidate / planned / ready | 待处理 |
| running / waiting_input / blocked 且有 linkedRunIds | 已派发 |
| running / waiting_input / blocked 但没有 linkedRunIds | 待处理，并提示未绑定 Run |
| review_needed 或 needs_review | 待验收 |
| completed | 已完成 |
| archived | 已归档 |

### 简化后的动作原则

只显示真正可执行的动作：

| 条件 | 显示动作 |
|---|---|
| 有可打开 source ref | 打开来源 |
| 待处理且执行入口已接入 | 派发到 Task Center |
| 有 linked run | 打开 Run |
| 有 linked session | 打开会话 |
| 待验收 | 接受结果 / 要求修改 / 创建后续任务 |
| 非已派发态 | 归档 |

被砍掉的 UI：

- `配置派发` 面板
- 空的 `验收`按钮
- provider 写回按钮
- 没有真实 linked target 的灰色 `打开 Run` / `打开会话`
- provider / engine / source kind / risk 多维筛选

### 后续方向

下一步应优先回到 UA 的 graph interaction primitives：

1. Project Map 节点搜索与聚焦。
2. Evidence Files 聚合视图。
3. Guided Tour 学习路径。
4. Typed Relation Graph。
5. Path Finder / Why related。
6. Diff Impact Overlay。

Orchestration 只保留轻量桥接：Project Map node 收纳为待处理项，派发到 Task Center 后通过真实 linked run 回跳。
