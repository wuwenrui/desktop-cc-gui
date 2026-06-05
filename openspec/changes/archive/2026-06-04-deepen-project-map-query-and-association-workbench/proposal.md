## Why

Project Map 的初心是让用户在客户端里看见“这个项目最近发生了什么、这些变化影响哪里、我接下来该看哪一块”。现在代码已经证明 Project Map 不只是一个静态结构图：它有 `ProjectMapDataset`、AI generation、persistence、typed relations、evidence records、stale/candidate/confidence、impact analysis、evidence-file index、graph repair、auto ingestion 和 Project Map -> Orchestration Task bridge。

真正的问题不是“数据不够”，而是产品入口还不够顺手。用户看到一张图后，还需要用大白话回答这些问题：

- 我最近改了哪些东西？
- 这些文件对应图上的哪些节点？
- 某个节点为什么重要，证据在哪里？
- 两个模块为什么有关联？
- 搜索一个词时，相关节点、文件、关系、过期原因和活动能不能一起出来？
- 哪些提示是确定事实，哪些只是推断或需要复核？

所以本变更的主线是：继续把结构图作为主体，把查询、近期活动、关联解释、证据反查和 Advisor Hints 做成节俭、可折叠、可清除的图上辅助能力。它不是另起一个 dashboard，也不是把 Project Map 改成文件浏览器或活动流。

> 深度推演：Project Map 的产品价值不应该是“展示更多列表”，而是给结构图加几盏灯。查询是一盏灯，近期活动是一盏灯，关系解释是一盏灯，证据反查是一盏灯。灯可以同时亮，但不能把地图本身盖住。

## Code Reading Baseline

本提案基于当前工作区代码阅读后回写，事实来源包括：

- `src/features/project-map/types.ts`
  - 当前 dataset 已包含 nodes、relations、tours、refreshState、graphRepair、runs、candidates、evidenceRecords、diagramDocuments、autoIngestionSettings、memoryCursor。
  - `ProjectMapRelation` 已是一等模型，支持 relation type、direction、confidence、stale、sourceKind、evidence。
  - `ProjectMapActivity*`、`ProjectMapQuery*`、`ProjectMapAdvisor*`、`ProjectMapHighlight*` 这类 runtime projection 类型已经具备承接 MVP 的基础。
- `src/features/project-map/services/projectMapPersistence.ts`
  - schema version 为 `2`，已有读取、写入、sanitize、legacy label/path 兼容、ownership 和 storage location 支持。
  - MVP 应优先用 runtime projection，不强制新增持久化迁移。
- `src-tauri/src/project_map.rs`
  - backend 已有 Project Map snapshot 读写、storage key、global/project storage、allowed write path 和 ownership 校验。
  - 文档和实现都要继续遵守跨平台路径与安全写入边界。
- `src/features/project-map/services/projectMapGenerationWorker.ts`
  - generation worker 已有 evidence prompt cap、context file cap、structured JSON parse/repair、organizer candidate merge。
  - 查询和 Advisor 不能重新读取大文件或绕过已有 bounded evidence 设计。
- `src/features/project-map/utils/navigation.ts`
  - 已有 grouped query、shortest path、association explanation。
  - 下一步应强化“搜索结果怎么分组、为什么命中、点了以后图上怎么亮”，而不是先上 embedding search。
- `src/features/project-map/utils/activityProjection.ts`
  - 已有 changed files、map runs、stale state、candidate state、evidence state 的 projection。
  - 近期活动必须明确来源，不伪装成完整实时审计日志。
- `src/features/project-map/utils/advisorProjections.ts`
  - 已有 diff-impact、query-neighborhood、node-explain、guide-topology、graph-health advisor。
  - 这些是从 Understand-Anything 借鉴来的“本地推理形状”，不是 UA runtime 迁移。
- `src/features/project-map/utils/highlightProjection.ts`
  - 已有 selected/path/search/activity/advisor/filter/base 的 deterministic priority。
  - 多个 overlay 可以共存，但必须能独立清除。
- `src/features/project-map/utils/evidenceFileIndex.ts`
  - 已有文件证据反查、node/relation/governance links、line refs、stale/low confidence/degraded counts。
  - 文件证据展示要去重、保持文件名可读，并把低价值重复信息折叠。
- `src/features/project-map/components/ProjectMapPanel.tsx`
  - 主面板已接入 grouped query、recent activity、advisor hints、quick filters、navigation history、highlight projection、relation panel、detail panel。
  - UI 方向应保持现状：少新增 chrome，多用折叠和现有视觉语言。
- `src/features/agent-orchestration/providers/projectMapProvider.ts`
  - Project Map 节点已经能生成 OrchestrationTask draft，且带 evidence refs 和 risk markers。
  - 本 MVP 只做“看懂和规划”，不自动派发任务。

## Product Direction

MVP 从用户角度看，核心不是“多了几个面板”，而是 Project Map 变成一个能查、能解释、能定位变化的工程地图。

### 1. 结构图仍然是主体

用户打开 Project Map，第一眼仍然应该看到结构图。Lens、节点层级、关系线、mini map、右侧节点详情继续是主舞台。新增功能只作为图上的辅助灯光：

- 查询命中后，相关节点在图上亮起来。
- 近期活动进来后，changed / affected 节点在图上亮起来。
- 找路径时，路径节点和边在图上亮起来。
- Advisor 只提示“建议看哪里”，不替用户改图。

### 2. 统一查询：用户只搜一次，系统按上下文分组

统一查询要从“搜节点标题”升级为“搜项目上下文”。同一个搜索框应该能覆盖：

- 节点：title、summary、kind、lens、detail。
- 文件证据：source path、artifact path、evidence file。
- 关系：relation type、label、source kind、confidence、两端节点。
- 治理引用：spec、task、document，但只搜索 dataset 里已经有的引用。
- 状态信息：stale reason、candidate、low confidence。
- 近期活动：changed files、map runs、stale/candidate/evidence activity。

结果展示要分组，不要一坨列表。用户需要知道“这是节点命中、文件命中、关系命中，还是活动命中”。点结果后，能定位图上节点或关系；没有图节点的结果要标成 degraded/unmapped，不要偷偷造假节点。

### 3. 近期活动：不是时间线，是变化投影

用户最早想要的是“客户端告诉我近期都干啥了”。这个方向保留，但产品语义要校准：

- Project Map 的近期活动不是完整审计日志。
- 它是把可用输入投影到结构图上。
- 有 git status 或显式 changed-file input，就显示 changed / affected / unmapped。
- 没有 changed-file input，就诚实显示 degraded 或空状态。
- dataset 中已有 runs、stale nodes、pending candidates、evidence records，也可以作为 map-derived activity。

用大白话说：它不是“所有历史记录”，而是“当前这张地图能解释的近期变化”。

### 4. 关联解释：回答“为什么这俩有关系”

Project Map 已有 relation graph 和 shortest path。MVP 要把它产品化：

- 路径查找能展示 source -> target 的节点链路。
- 每一步说明来自 relation 还是 hierarchy fallback。
- 如果是 relation，要显示 type、sourceKind、confidence、stale、evidence count。
- `llm-inferred`、low/unknown confidence、stale 关系必须明确标记。

这块的重点是“让用户敢相信，也知道哪里不能全信”。

### 5. 节点详情：把证据、活动、关系收进一个地方

节点详情应该是用户点一个节点后的“解释页”，但要节俭：

- 先显示节点 title、summary、kind、confidence、stale/candidate。
- 折叠显示理解、关键事实、关键逻辑、风险信号。
- 折叠显示 Associations：入边、出边、层级关系、证据数量、置信度。
- 折叠显示 Recent Activity：当前节点相关的 changed/stale/candidate/run/evidence。
- 折叠显示 Related Artifacts 和 Evidence：文件证据要去重，文件名优先展示，后面的 path/snippet 可以省略。
- Explain Context 只基于本地 dataset，不触发新 AI run。

### 6. Advisor Hints：借 UA 的“智能体思路”，不借 UA runtime

Understand-Anything 值得借鉴的不是 dashboard，而是它的工作方式：先确定性整理，再给用户建议。Project Map 的 Advisor Hints 应保持本地纯函数投影：

- Diff Impact Advisor：changed files -> changed nodes -> affected nodes -> risk summary。
- Query Neighborhood Advisor：query results -> one-hop neighborhood -> nearby nodes/relations/artifacts。
- Node Explain Advisor：selected node -> children/relations/evidence/activity/risk flags。
- Guide Topology Advisor：entry/fan-in/fan-out/root/evidence signals -> suggested nodes to inspect。
- Graph Health Advisor：integrity/stale/low-confidence/inferred/degraded path -> review warnings。

这些 hint 是“建议看哪里”，不是任务、不是聊天、不是自动修复。

### 7. 文件证据反查：从文件回到图

用户看到一个文件，应该能知道它在图里关联了什么：

- 这个文件被哪些节点引用。
- 这个文件参与哪些关系证据。
- 有没有 governance link。
- 有没有 stale / low confidence / degraded。
- 能不能打开到原文件，且保留 one-based line。

展示原则：文件名要完整优先，后面的 path/snippet 才可省略；同一区域重复文件要去重；类型文案不要抢文件名位置。

## MVP Scope

### User-Facing Functions

- 结构图主视图：保持 graph-first，新增面板默认折叠或紧凑。
- 导航地图 + 统一查询：同一个入口负责搜索、路径、历史和图上定位。
- 统一查询结果：按 nodes、evidence files、relations、artifact references、stale reasons、activity 分组。
- 近期活动：显示 changed files、map runs、stale state、candidate state、evidence state，并标记 degraded/unmapped。
- 快速过滤：Changed、Affected、Stale、Candidate、Low Confidence、Inferred Relations。
- 关联解释：路径查找 + 每一步证据/置信度/来源解释。
- 节点详情增强：Associations、Evidence、Recent Activity、Explain Context 全部可折叠。
- Advisor Hints：diff-impact、query-neighborhood、node-explain、guide-topology、graph-health。
- 文件证据反查：文件 -> 节点/关系/governance/evidence/open file。
- 本地历史：query history 和 navigation history 小上限保存，降低大图迷路。

### Engineering Functions

- Runtime projection 优先，不新增强制持久化迁移。
- Query、activity、advisor、highlight 都放在 Project Map utils 层，组件只消费结果。
- Highlight priority 必须确定：selected > path > search > activity changed > activity affected > advisor > filter > base。
- Path matching 要兼容 Windows、macOS、Linux：比较时 normalize，展示时尽量保留用户可读字符串。
- 大文件和大图只展示 metadata、count、bounded preview、degraded marker，不做 UI 侧全文扫描。
- 所有新增 UI 文案必须走 i18n。
- 所有新增面板都要支持折叠，不能压过第一屏 graph。

## Goals and Boundaries

- Keep the structure graph as the visual center of Project Map.
- Deepen query and association display as the main product line.
- Add recent activity as map projection, not as a full timeline.
- Make relationship explanations evidence-aware and confidence-aware.
- Make search and recent activity drive graph highlights rather than replacing the graph with a list.
- Treat Advisor Hints as local deterministic guidance, not as an autonomous agent UI.
- Preserve the existing Project Map visual language and avoid a full dashboard rewrite.
- Keep file, evidence, and editor navigation behavior compatible across Windows, macOS, and Linux path formats.
- Handle large files and large maps through indexed metadata, bounded previews, capped result sets, and non-blocking UI behavior.
- Search governance/spec/task context only when those references already exist in Project Map data.

## Non-Goals

- Do not rewrite Project Map with React Flow.
- Do not clone the Understand-Anything dashboard.
- Do not turn Project Map into an activity feed, task center, or standalone code browser.
- Do not add embedding-based semantic search in this MVP.
- Do not automatically execute orchestration tasks from Project Map.
- Do not present AI-inferred relations as deterministic project truth.
- Do not default-expand every new surface.
- Do not embed or shell out to Understand-Anything agents/skills at runtime.
- Do not replace Project Map generation with UA's full multi-agent scan pipeline.
- Do not scan OpenSpec/Trellis/Codex/Claude folders directly from query; only query dataset-backed references.

## What Changes

- Add a graph-first query and association workbench around existing Project Map.
- Merge navigation map and unified query into one interaction group.
- Project recent activity onto graph nodes, relations, files, and risk summaries.
- Add grouped query results across nodes, evidence files, relations, artifact references, stale reasons, and activity.
- Add compact quick filter chips for changed, affected, stale, candidate, low confidence, and inferred relations.
- Add association explanation on top of path finder.
- Extend selected-node detail with collapsible associations, evidence, recent activity, and explain-context sections.
- Add evidence-file reverse lookup and editor navigation with line preservation.
- Add local Advisor Hints inspired by UA skill logic.
- Add deterministic highlight projection so multiple overlays can coexist.
- Add cross-platform path normalization and large-file safeguards as explicit constraints.
- Keep new UI surfaces frugal, folded, and aligned with the current Project Map style.

## MVP Implementation Slices

The MVP can be broad, but work should stay sliced and verifiable:

- Projection layer first: query, activity, association explanation, advisor hints, highlight sets.
- Graph lighting second: selected/path/search/activity/advisor/filter priority.
- Collapsible UI third: navigation/query, recent activity, relation panel, advisor panel, detail sections.
- Evidence polish fourth: file chip display, dedupe, reverse lookup, one-line file names, bounded previews.
- Navigation polish fifth: query history, navigation history, focus/clear behavior.
- Validation last: focused utils tests, Project Map panel tests, typecheck, OpenSpec validation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Adds graph-primary unified query, recent activity projection, association explanation, Advisor Hints, lightweight filtering, evidence-file navigation, cross-platform path handling, large-file safeguards, and collapsible UI requirements for Project Map.

## Impact

- Frontend Project Map panel and related surfaces:
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/features/project-map/components/ProjectMapPanelSurfaces.tsx`
  - `src/features/project-map/components/ProjectMapWorkbenchPanels.tsx`
  - `src/features/project-map/components/ProjectMapTraceChips.tsx`
- Project Map derived utilities:
  - `src/features/project-map/utils/navigation.ts`
  - `src/features/project-map/utils/activityProjection.ts`
  - `src/features/project-map/utils/advisorProjections.ts`
  - `src/features/project-map/utils/highlightProjection.ts`
  - `src/features/project-map/utils/projectionGuards.ts`
  - `src/features/project-map/utils/evidenceFileIndex.ts`
  - `src/features/project-map/utils/impactAnalysis.ts`
  - `src/features/project-map/utils/contextBuilder.ts`
- Project Map schema/types:
  - `src/features/project-map/types.ts`
- i18n and styles:
  - `src/i18n/locales/en.part5.ts`
  - `src/i18n/locales/zh.part5.ts`
  - `src/styles/project-map.css`
  - `src/styles/project-map.inspector.css`
  - `src/styles/project-map.overlays.css`
- Orchestration bridge remains related but not expanded by this proposal:
  - `src/features/agent-orchestration/providers/projectMapProvider.ts`
- Backend impact:
  - No new Rust backend behavior is expected for the MVP.
  - Existing `src-tauri/src/project_map.rs` storage, ownership, allowed path, and atomic write constraints remain the boundary.
- Dependencies:
  - No new external dependency is required.
  - Fuzzy search can be evaluated later only after grouped deterministic query proves insufficient.

## Acceptance Criteria

- Opening Project Map still shows the structure graph as the primary visual surface.
- Navigation map and unified query are one product entry, not two competing search areas.
- Search results are grouped and can focus matching graph nodes or show degraded non-node context.
- Search results for specs, tasks, and governance artifacts come only from references already present in Project Map data.
- Recent activity highlights changed and affected nodes when changed-file input exists.
- Recent activity distinguishes changed-file input from map-derived runs, stale nodes, candidates, and evidence records.
- Recent activity shows honest empty/degraded states when changed-file input is unavailable.
- Selected node details show relation metadata, evidence, recent activity, stale reasons, and inferred/low-confidence labels in collapsible sections.
- Path explanation highlights graph path nodes/edges and describes relation evidence step by step.
- Advisor Hints are derived locally from Project Map data and clearly label deterministic, inferred, degraded, and warning states.
- Multiple overlays follow deterministic highlight priority and can be cleared independently.
- File matching and editor navigation work with Windows, macOS, and Linux style paths without hard-coded separators or user-local absolute path assumptions.
- Large files are represented through metadata, capped snippets, counts, and degraded states instead of full-content reads or full-content rendering in Project Map.
- Evidence and artifact file chips prefer complete visible file names, de-duplicate repeated file evidence within the same display area, and truncate lower-priority path/snippet text first.
- All new panels are collapsible and do not dominate the first-screen Project Map experience.

