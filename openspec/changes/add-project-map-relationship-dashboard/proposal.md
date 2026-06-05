# Proposal: Project Map Relationship Dashboard

## 中文导读

这份 proposal 的核心是定义“Project Map Relationship Dashboard”的产品与工程边界：
我们不做体验上的花架子，先把关系事实变成可以稳定消费的 `deterministic substrate`。
按钮、扫描、持久化、仪表盘、impact、stale、repair、Agent Read Plan 都是同一主线的连续链路，不允许做成“有 UI 没有闭环”。

## Context / 背景

当前 Project Map 关系能力虽然已有部分基础，但与实际执行需求（agent read 优先级、变更影响、跨层桥接）之间存在差距：
- 多数关系是非确定性来源。
- 无全局统一扫描入口。
- Dashboard 目前更偏展示，不足以支撑 execution surface。

## Why now / 为什么现在做

- `Task Center`、`Project Map`、`AI generation` 需要统一关系底座，否则上层动作会出现“读文件集合不稳定”。
- 项目规模增长时，LLM-based 推断容易引入不可重复关系。
- 用户明确要求 `Project Map` 深挖，不做 Browser Dock 的支线。

## Goals / 目标

1. 在 Project Map 视图中增加 `Scan Relationships` action。
2. 实现 deterministic scan pipeline（files / imports / exports / tests / styles / specs / docs / bridge）。
3. 将扫描结果写入磁盘 `project-map-relations`，采用分层存储。
4. 显示 relationship dashboard（selected file neighborhood, module/hotspot, impact, stale, repair）。
5. 产出 Agent Read Plan 并持久化。
6. 保留 UA 的有价值 skill 观念（understand/dashboard/diff/explain/onboard/chat/domain）但不引入 UA schema。
7. 实现 full scope（分批交付），不缩范围。

## Non-goals / 非目标

- 不处理 Browser Dock trusted observation。
- 不引入 Understand-Anything 的持久化 schema。
- 不引入第三方 graph storage。
- 不在本轮实现全量行为能力（只做关系 substrate + consumption contracts 的完整闭环）。

## Solution summary / 方案摘要

采用 `storage + scanner + dashboard + context pack` 的四层实现：
- Scanner 产出 deterministic facts。
- Storage 进行 atomic 写入与 repair。
- Dashboard 消费 index summary。
- Agent Context 使用 context-pack 作为默认输入。

## 关键能力映射（Capability Mapping）

- `project-map-relationship-storage`
  - 定义 storage root、manifest、写入边界、schema 与 artifact 集合。
- `project-xray-panel`
  - 提供关系扫描按钮与交互状态、文件邻域、impact 与 stale/repair。
- `project-map-incremental-generation`
  - 将关系 scan 作为 generation 的事实输入，禁止覆写。
- `composer-context-project-resource-discovery`
  - 复用 context packs，避免重复广域扫描。

## Design options（方案对比）

### Option 1: 全量复用现有 `project-map` dataset

- 优点：改动最小。
- 风险：事实与语义混合，难做 repair/stale/incremental。

### Option 2: 引入 UA `knowledge-graph.json`

- 优点：可快速拿到 graph model。
- 风险：绑定外部 schema、维护耦合、迁移负担。

### Option 3: 自有 `project-map-relations` 层（推荐）

- 优点：保持 mossx 领域契约，分层存储。
- 优点：关系事实可单独治理，稳定驱动 dashboard 与 Agent。
- 缺点：初期实现量略大，但可控且可分批。

### 选择

选择 Option 3。

## Product behavior（用户体验）

- 空态：无扫描数据时 dashboard 显示引导 CTA。
- 扫描中：显示运行阶段、文件扫描计数、忽略数量。
- 扫描失败：分类错误（permission/path/parser/storage/timeout）。
- 有数据：展示 selected-file graph neighborhood + filters + hotspots + impact。

## Risk control / 风险控制

- Path safety：强制 root 白名单，拒绝越界。
- ID 稳定性：canonical id。
- Dangling edge：repair quarantined，不污染主索引。
- Stale：manifest + fingerprint + commit。
- 错误处理：可恢复错误给出重试建议。

## Success criteria（验收标准）

- 成功扫描 active workspace 并持久化关键 artifact。
- Dashboard 可展示 selected file neighborhood。
- Impact overlay 可标注 changed / affected / unmapped。
- Stale/repair 可见且可理解。
- Composer 可消费 context pack。
- 与现有 Project Map 数据兼容，不出现高风险破坏。

## 规模与交付承诺 / Scope & Commitment

- 这不是 MVP 裁剪版。虽然可分 batch 并行推进，但 scope 保持完整。
- 文档层面同步后，下一步可直接进入 implementation。

## 阶段性评估 / Stage Assessment（2026-06-05）

### 中文导读

本节记录当前 implementation 与原 proposal/design/tasks 的对齐校准。
结论：当前方向没有跑偏，仍然围绕 `scan -> persist -> dashboard -> impact/read-plan -> consume` 主链路推进。
截至 2026-06-05 本轮收口，implementation 已覆盖 stale、UA-style actions 与 Composer/Agent consumption；focused validation 已完成。

### 当前完成度 / Current progress

- OpenSpec task progress：`23 / 23`。
- 已完成主链路：
  - `Scan Relationships` action 已进入 Project Map 视图。
  - deterministic scan artifacts 已落盘到 `project-map-relations/<storage-key>/`。
  - storage artifact 已覆盖 `manifest/profile/runs/scans/files/relations/modules/impact/context-packs/repair`。
  - Relationship Dashboard 已支持 `Board / List / Neighborhood` 多视图。
  - Scan Snapshot 与现有 Project Map Semantic Relations 已视觉隔离；Semantic Relations 默认收起，避免把两个 source layer 混成一套关系图。
  - Impact summary、Hotspots、Agent Read Plan 已以 capped scan snapshot cards 方式展示。
  - `context-packs/latest.json` 已从占位 artifact 推进为 conservative Agent Read Plan artifact。
  - `read` response 已动态返回 stale summary，并把 stale reason 注入 context-pack consumer contract。
  - `File Relations` 已提供 Explain / Diff Impact / Guided Read / Ask Map / Domain Lens 五类 UA-style action。
  - Agent orchestration 的 `project-map` provider 已消费 relationship context-pack，作为 resource discovery candidate。

### 对齐确认 / Alignment check

| Proposal target | Current status | Calibration |
|---|---|---|
| 一键扫描 active workspace | 已实现 | 对齐。按钮、running/success/failure 基本状态已具备。 |
| deterministic scan pipeline | 已实现 Alpha | 对齐。已覆盖通用 inventory、manifest/config/docs/convention 关系和多语言增强 extractor。 |
| layered local storage | 已实现 | 对齐。仍保持 mossx-native schema，不引入 UA schema。 |
| dashboard selected neighborhood + filters | 已实现 | 对齐。并补充 UA-like board/list/neighborhood 多视图。 |
| impact overlay | 已实现 Alpha | 对齐但需注明：当前是 summary card + one-hop/transitive artifact，不是 canvas overlay。 |
| Agent Read Plan | 已实现 Alpha | 对齐但需注明：当前是 conservative context-pack artifact，还未接入 Composer/Agent 自动消费。 |
| stale/repair visibility | 已实现 | repair/read issues 已显示；stale detection 支持 git commit、fingerprint、refresh suggestion。 |
| UA lessons 内化 | 已实现 Alpha | dashboard/diff/read-plan 已借鉴；explain/guided read/ask/domain 以 mossx-native action panel 落地。 |
| Composer resource discovery | 已实现 Alpha | Agent orchestration provider 消费 relationship context-pack；无 context-pack 时保持原 fallback。 |

### 校准发现 / Calibration findings

- 未跑偏：没有把 scan result 自动注入现有 Project Map semantic graph，符合“不污染主图谱、不制造性能噪音”的边界。
- 未跑偏：没有引入 Understand-Anything schema，也没有引入第三方 graph storage。
- 已补充：`changedFiles` override contract 已校准为 `None -> git status fallback`，`Some([]) -> explicit empty scope`，避免 optional collection 语义漂移。
- 已补充：扫描结果不再挂在 `Inspect Relations / 检查关系` 里上下平铺；`File Relations / 文件关系` 承载 deterministic scan snapshot，`Inspect Relations / 检查关系` 回归现有 Project Map semantic graph。
- 需要保留为风险：large scan confirmation、扫描阶段 progress、错误类型细分目前仍不完整，不能作为最终验收完成项。
- 需要保留为风险：hotspot 当前以 `many-dependents` 为主，`cross-layer-hub / missing-test / stale / large-file` 还未完整成为 hotspot reason；其中 `missing-test` 已先进入 risk flag。
- 需要保留为风险：module summary 当前偏 `fileCount/relationCount`，尚未完整覆盖 `cross-module count / stale flag / relation density`。
- 已完成 focused validation：`openspec validate add-project-map-relationship-dashboard --strict --no-interactive`、`npm run typecheck`、`cargo check --manifest-path src-tauri/Cargo.toml` 均通过。

### 当前阶段判断 / Phase judgement

当前实现可定义为：

`MVP-2 Closure Candidate: deterministic scan snapshot + relationship dashboard + stale/actions/context consumption`

它已经满足“用户可以扫描、读取、选择文件、查看关系、看到 impact/read-plan 摘要、识别 stale、触发 UA-style action，并让 Agent resource discovery 消费 context-pack”的阶段目标；
归档前仍建议做一次用户真实项目 smoke test，但跨层 contract 与 strict typecheck 已完成 focused validation。

### 下一阶段建议 / Next calibrated batch

1. 用户在真实项目上做一次 scan -> stale/action -> Agent resource discovery smoke test。
2. 若 smoke test 无阻塞，提交本轮实现。
3. 提交后再执行 OpenSpec verify / sync / archive。


## 中文+English 术语对照（Proposal Glossary）

- Deterministic Scan / 确定性扫描
- Relationship Substrate / 关系事实底座
- Scan Source of Truth / 关系真相源
- Project Resource Discovery / 项目资源发现
- Agent Context / 代理上下文
- Storage Root / 持久化根目录
- Run Metadata / 运行元数据
- Repair Quarantine / 修复隔离区
- Fresh / 最新可用
- Stale / 过期
- Incremental Generation / 增量生成

## Corrective stage update：Dashboard -> Explorer（2026-06-05）

### 中文导读

用户真实测试后确认：仅展示扫描统计、hotspot、impact、read plan 不足以支撑代码理解。
本提案的产品目标已校准为：先让用户看懂“文件和文件之间、方法和方法之间为什么有关”，再谈高级 impact / guided read / domain lens。

### Updated acceptance focus

- 用户点击刷新后，应能看到新的 scanRunId 和 fresh relationship snapshot；若文件不在扫描范围，应显示 scope warning，而不是 stale blocking banner。
- 默认视图应回答：这个文件调用谁、谁调用它、证据在哪一行。
- UI 文案必须完整 i18n；中文界面使用中文 + English professional terms。
- scanner 必须是 universal project scanner，不得绑定 Java / Spring Boot。
- Java、C/C++、JS/TS/Vue/Svelte、Python、Go、Rust 等语言都应先进入 inventory，并尽可能产出 imports / calls / includes / symbol relations。

## Stage correction：Chain-first closure（2026-06-05）

### 中文导读

本轮根据重新扫描后的用户反馈继续校准：`File Relationship Explorer` 不能只是改标题，必须让默认体验从统计 dashboard 切到文件链路阅读。
因此 acceptance focus 更新为：扫描后默认 Chain、刷新默认 full、方法调用候选可见、Board 降级为辅助视图。

### Updated acceptance checklist

- 普通扫描按钮必须执行 full workspace scan，不应隐式携带 `changedFiles` partial scope。
- 扫描成功或读取 latest snapshot 后，默认打开 `Chain` 主视图。
- 主视图展示 file-to-file chain，并在 `calls` relation 上显示 method/function `call candidate`。
- Evidence Inspector 展示 source、target、call candidate、evidence line/excerpt。
- Board/List 保留，但作为辅助定位视图。
- 统计 metrics 只能作为轻量状态，不再占用主要信息层。

## Stage correction：UA-like Graph Dashboard（2026-06-05）

### 中文导读

用户重新校准：期望关系 dashboard 更接近 Understand-Anything 的图形化表达，而不是列表化 Explorer。
因此本提案最终验收更新为 `Graph-first`：文件节点 + 关系边 + 选中高亮 + Inspector。Chain/List/Board 作为辅助，不作为默认主视图。

### Updated acceptance checklist

- 扫描完成后默认进入 `Graph 图谱`。
- Dashboard 第一视觉必须是文件节点和关系边，而不是关系列表。
- 点击文件节点后显示该文件一跳邻域。
- 点击关系边后展示 source、target、call candidate、evidence line/excerpt。
- 左侧文件导航只作为定位辅助。
- Board/List/Chain 保留为辅助视图。
- 不引入 UA schema，不引入第三方 graph storage，不污染现有 Project Map semantic graph。

## Proposal supplement：UA-like Graph Dashboard detailed contract（2026-06-05）

### 中文导读

这段是对 13E 的补强说明：用户目标不是“多一个 graph tab”，而是把文件关系 dashboard 的默认认知方式改成 Understand-Anything 风格。
也就是说，用户打开关系扫描结果时，应该先看到“节点、边、聚焦、关系证据”的图形化结构，而不是统计、列表或纯链路文本。

### Problem correction / 问题纠偏

- 13C 解决了 refresh、i18n、calls extractor，但默认仍像扫描结果面板。
- 13D 解决了 chain readability，但把产品带到了 list-first 方向。
- 用户明确偏好 UA 的 graph-first dashboard，因此 13E MUST replace list-first as default UX。
- Chain/List/Board 仍有价值，但它们只能作为辅助视图，不能作为第一视觉。

### UA-like product contract / 产品契约

- Default surface：`Graph 图谱`。
- Left rail：文件导航 / role navigation，用于定位节点。
- Center canvas：文件节点 + 关系边 + 背景网格 + selected-neighborhood focus。
- Right inspector：解释当前选中的 file node 或 relation edge。
- Edge labels：优先显示 call candidate；没有 candidate 时显示 relation type。
- Visual hierarchy：`calls` > `imports` > `tested_by` > docs/config/other。
- De-noise rule：默认只展示 selected file 的 one-hop neighborhood + high-signal files，不全量铺开所有边。
- Source boundary：图形投影只消费 `project-map-relations` snapshot，不写回主 Project Map semantic graph。

### UA reference mapping / UA 复刻映射

| UA element | mossx mapping | 说明 |
|---|---|---|
| `GraphView` canvas | `Graph 图谱` center canvas | 复刻图形为第一视觉，不复用 UA schema。 |
| `CustomNode` | file node card | role color bar、badge、selected ring、neighbor state。 |
| `NodeInfo` | Relationship Inspector | 解释 selected node/edge、证据与连接。 |
| `FileExplorer` | left file rail | 文件定位辅助，不抢主视觉。 |
| `FilterPanel` | search/type/role controls | 控制图谱可见范围。 |
| `edgeAggregation` | capped one-hop projection | 先做降噪投影，后续可扩展聚合容器。 |

### Acceptance update / 新验收标准

- 重新扫描后，默认打开 Graph，而不是 Chain/List/Board。
- Graph 必须有明确的节点、边、箭头、edge label、selected/neighbor/faded 状态。
- Graph 必须有 relation legend，让用户知道不同颜色边代表什么。
- Graph 必须有 lane/region label，让用户理解 incoming/current/outgoing 的空间结构。
- Inspector 必须同时支持 node summary 和 edge evidence。
- 不得引入 UA schema；不得污染主 Project Map；不得全量渲染大项目所有边。

### Remaining follow-up / 后续仍需推进

- 更接近 UA 的 minimap / controls。
- role/layer aggregation container。
- edge bundling 或 relation count aggregation。
- method/function symbol node expansion。
- graph interaction smoke test。

## Corrective stage update：Graph Fidelity / 图谱拟真度补强（2026-06-05）

### 中文导读

用户继续校准：当前实现已经从 list-first 拉回到 `Graph-first`，但还不够像 Understand-Anything 的“可探索图谱”。
问题不在于有没有节点和边，而在于图谱还缺少可操作的 exploration affordance：聚合点不能展开、legend 不能作为过滤入口、高密度关系只能被动折叠。

本阶段目标是把 `File Relationship Graph Dashboard` 从“图谱截图”推进为“图谱工作台”：

- 用户先看图，不先读列表。
- 用户点击聚合点即可展开 incoming / outgoing dense neighborhood。
- 用户点击 relation legend 即可按 `calls / imports / tested_by` 过滤图谱。
- Graph 仍只消费 `project-map-relations` snapshot，不写回 Project Map semantic graph。
- Board / List / Chain 继续保留为辅助视图，但不重新抢占默认主视觉。

### Updated acceptance checklist

- Graph aggregate node MUST be interactive；`+N incoming/outgoing` 不是静态提示，而是可展开/折叠的 graph control。
- Relation legend SHOULD double as visual filter；用户不需要回到下拉框才能筛选 `calls/imports/tested_by`。
- Graph high-density de-noise MUST preserve readability；默认 capped one-hop，用户显式展开后才增加节点密度。
- Graph UI copy MUST remain localized；中文界面使用中文 + English professional terms。
- Graph interaction MUST remain universal；不得假设 Java/Spring 项目，calls/imports/includes/docs/config 等关系都来自通用扫描层。

## Corrective stage update：Graph Workspace Layout / 图谱工作台布局（2026-06-05）

### 中文导读

用户测试后确认方向正确，但 Graph Dashboard 的可视空间仍被左侧 File Tree、右侧 Inspector、底部 Project Map 主图挤压。
本阶段目标不是继续增加数据，而是把图谱变成可操作 workspace：辅助模块可折叠、画布可自适应、视图内可拖拽平移。

### Updated acceptance checklist

- Graph Dashboard MUST provide module collapse controls for file rail and inspector.
- Collapsing auxiliary modules MUST give graph canvas more space instead of leaving empty columns.
- Graph canvas SHOULD auto-fit its logical graph surface to the available visible area.
- Graph canvas MUST support drag-to-pan inside the relationship view.
- Pan behavior MUST NOT steal clicks from file nodes, edge labels, legend filters, aggregate controls, or inspector buttons.
- These layout controls are presentation-only and MUST NOT mutate relationship storage or Project Map semantic graph.

### Latest UI calibration / 最新 UI 校准

- In Graph view, the scan control chrome SHOULD default to collapsed mini-header to maximize graph canvas space.
- The collapsed mini-header MUST still expose scan freshness summary, including file count, relation count, and `fresh/stale` state.
- If the snapshot is stale, the collapsed mini-header SHOULD keep a lightweight refresh action, so space optimization does not hide the most important recovery path.
- Search/filter controls remain available after expanding the chrome area; they are secondary to graph exploration by default.

### Collision avoidance calibration / 防重叠校准

- Graph projection MUST leave enough vertical gap between visible file nodes.
- Expanded incoming/outgoing sides SHOULD still be capped; expansion means revealing more context, not rendering every relation.
- The logical graph canvas SHOULD be larger than the visible viewport, with drag-to-pan for exploration.
- Drag-to-pan MUST be visible and predictable: empty canvas drags move the graph, while node/edge/legend clicks remain selection actions.
- Aggregate nodes MUST sit in reserved space and MUST NOT overlap visible file nodes.

### Graph navigation polish / 图谱导航打磨

- File search SHOULD be directly available in the Graph toolbar even when advanced chrome is collapsed.
- Searching files SHOULD update the graph focus to the first matched file instead of only filtering the side list.
- Graph view SHOULD provide explicit zoom in / zoom out / reset controls in addition to drag-to-pan.
- Zoom controls MUST be presentation-only and MUST NOT mutate relationship storage, evidence, or Project Map semantic graph.
