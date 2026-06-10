# Design: Project Map Relationship Dashboard

## 中文导读

本设计把 Project Map 的关系能力定义为一条 `scan -> persist -> view -> consume` 的闭环链路。
技术上以“分层持久化 + immutable snapshot + deterministic source 标记 + repair quarantine”为核心，避免关系事实随 AI 输出漂移。

## Context / 当前系统背景

mossx 已有 Project Map 的基础关系与分析能力，但关系资产在本次需求下要满足 4 个强约束：
1. 一键扫描当前 workspace。
2. 本地磁盘落盘（全局 sibling root）。
3. 前端仪表盘快速展示。
4. 能为 Agent 提供可执行的上下文输入。

## System goals（系统目标）

- 建立 `project-map-relations` 关系扫描子系统。
- 提供关系 Dashboard 的读取体验，不牺牲现有性能。
- 与现有 AI generation 形成 clear boundary。
- 为未来的 explain/diff/onboard/chat/domain 动作提供事实底座。

## Non-goals（明确不做）

- 不依赖 UA schema。
- 不将关系扫描直接写入现有 semantic dataset。
- 不替代现有 tests/style/spec 的现成能力。
- 不在本轮扩展到 Browser Dock。

## Architecture overview

```text
[Frontend UI]
  -> [project-map panel command invoker]
  -> [Tauri command: project_map_relationship_scan]
     -> [Ignore/Walker]
     -> [Language parsers]
     -> [Relation builder]
     -> [Validation + Repair]
     -> [Layered persistence]
  -> [Persistence read API]
  -> [Dashboard state]
  -> [Impact + Read Plan service]
  -> [Composer/Agent context bridge]
```

## 关系数据契约（Data Contract）

### 命名约束

- `ProjectMapRelationshipManifest`
- `ProjectMapScannedFile`
- `ProjectMapFileRelation`
- `ProjectMapRelationDashboardIndex`
- `ProjectMapRepairSummary`
- `ProjectMapImpactSummary`
- `AgentReadPlan`

### 主动声明字段群

- 所有关系 edge 都应有 `sourceKind: deterministic`。
- 每条关系有 `evidence[]`，包含文件路径、行号、证据片段。
- `generatedAt`, `scanRunId` 必须携带。
- `language/layer/role` 允许 `unknown`，但要记录 `parseStatus`。

## Backend design（Backend）

### 模块分解（建议）

- `src-tauri/src/project_map_relations/`
  - `mod.rs`: 对外入口、command 注册。
  - `commands.rs`: scan/read/clear。
  - `scanner.rs`: 文件遍历 + ignore。
  - `classifier.rs`: language/layer/role 分类。
  - `import_parser.rs`: TS/JS imports/exports。
  - `rust_parser.rs`: use/mod、module 分析。
  - `relation_builder.rs`: 文件关系组装。
  - `indexes.rs`: by-file/by-type 模块索引。
  - `impact.rs`: changed files 影响计算。
  - `persistence.rs`: atomic write/read/clear。
  - `validation.rs`: dangling / duplicate / inverted / unresolved。

### Storage design（存储）

- 采用目录化 artifact：manifest + files + relations + indexes + impact + repair + runs + context-packs。
- 使用固定 root：`project-map-relations/<storage-key>/`。
- `runs/latest.json` 指向最近一次扫描元数据。
- 文件内容分片（chunks）与 manifest 组合，前端按需加载。

### 命令 API（Tauri command）

- `project_map_relationship_scan(workspace_id, options)`
  - 入参包含：`forceFull`, `maxFiles`, `includeIgnoredHints`, `scanTimeoutMs`, `paths`。
- `project_map_relationship_read(workspace_id)`
  - 返回 summary/index + latest scan run。
- `project_map_relationship_clear(workspace_id)`
  - 安全清理关系数据。

### 错误模型

- `InvalidWorkspace`：未选择 active workspace。
- `PathViolation`：非法路径。
- `ParseFailure`：局部 parser 失败，不应中断整个扫描。
- `PersistenceFailure`：写入失败，返回可恢复信息，保留旧快照。
- `ValidationFailure`：记录到 repair，不阻塞主展示。

## Frontend design（前端）

### 交互流

1. 打开 Project Map。
2. 若未扫描，显示空态 CTA。
3. 点击 `Scan Relationships`。
4. 扫描中：状态条 + 阶段提示 + workspace 信息。
5. 扫描完成：刷新 dashboard data。
6. 选择文件：展示 neighborhood。
7. 可切换 filter/search。
8. 展示 impact/stale/repair。

### 组件与状态模型

- `ProjectMapRelationshipsPanel`（主容器）
- `RelationshipsScanButton`（按钮 + confirm/threshold）
- `RelationshipSummaryBanner`（generatedAt、runId、fileCount）
- `RelationshipTree`（files + module 按照索引树）
- `SelectedNeighborhoodView`
- `RelationFilterBar`
- `RelationshipHotspotPanel`
- `ImpactStaleRepairPanel`

### 性能约束

- Dashboard 优先读取 summary/index，不一次性加载所有 chunks。
- 支持分页/虚拟滚动（文件很多时）。
- 大文件展示采用渐进加载。

### Dashboard separation rules（Dashboard 隔离规则）

- Relationship Dashboard SHALL be a read-only scan snapshot surface, not a direct mutation path for the existing Project Map semantic graph.
- Scanned file relations SHALL NOT be automatically injected into the current Project Map canvas, hierarchy relation index, or semantic dataset.
- The relationship panel SHALL visually separate `Scan Snapshot / 扫描快照` from `Project Map Graph / 语义图谱`, using independent filters, selection state, and empty states.
- The panel SHALL render capped lists or indexed summaries first; large relation sets SHALL NOT be pushed into the main canvas to avoid visual noise and layout cost.
- Cross-surface actions MAY exist later, but they MUST be explicit user actions such as `promote`, `explain`, `create read plan`, or `open evidence`.
- The default experience SHALL make the scan result readable without requiring graph layout recalculation.
- When existing Project Map semantic relations and scanned relationship snapshot are both available in the Project Map investigation area, they SHALL be exposed through separate entries with explicit source labels.
- The semantic relation section represents the current Project Map dataset; the scan snapshot section represents deterministic file relationship artifacts from `project-map-relations`.
- The semantic relation section SHOULD be collapsed by default after scan snapshot data exists, because it is a different source layer and can otherwise create visual noise.
- Impact, hotspot, and read-plan summaries SHALL be rendered as capped scan snapshot cards; they SHALL NOT trigger graph layout recalculation or push all scan edges into canvas.
- The scan snapshot dashboard SHOULD live under a dedicated `File Relations / 文件关系` investigation entry, while `Inspect Relations / 检查关系` SHOULD remain reserved for existing Project Map semantic relations.
- Triggering `Scan Relationships` MAY open the `File Relations / 文件关系` entry after success, but it SHALL NOT auto-open or pollute `Inspect Relations / 检查关系`.

### Multi-view dashboard model（多视图展示模型）

- Default view SHOULD be `Board / 文件节点看板`, inspired by UA-style file tiles and node-type lanes.
- `Board` groups scanned files by role / node type, such as controller, service, repository, entity, component, hook, test, manifest, config, docs, and noise.
- `List` keeps a dense searchable file list for precision lookup.
- `Neighborhood` prioritizes selected-file relation inspection, evidence, incoming/outgoing context, and later read-plan actions.
- These views SHALL share the same scan snapshot state and filters, but each view SHOULD optimize for a different task: scan-reading, lookup, or reasoning.
- Large projects SHALL use lane caps, list caps, or virtualization; the board SHALL NOT render every file as a tile by default.

## Cross-layer consistency（跨层一致性）

- `storage summary` 与 `UI state` 应共享 `schemaVersion`。
- 若前端读到的 manifest 无法解析，不回退到旧数据。
- 失败退化：显示“重新扫描建议”，不展示虚假关系。

## UA lessons 复用点（实施映射）

- `understand` -> `scan action`
- `dashboard` -> `relationship panel`
- `diff` -> impact overlay
- `explain` -> selected neighborhood explain pack（关系证据）
- `onboard` -> guided read plan（Alpha action）
- `chat` -> relationship-aware query input（Ask Map Alpha action）
- `domain` -> capability lens（Domain Lens Alpha action）

## Security & safety（安全）

- 只读扫描，不执行任意代码。
- 严格路径白名单。
- 对非法路径/非法文件名直接拦截。
- 写入失败必须可恢复且幂等。

## Rollout / Migration

- 初始只支持 ts/js/rust 的关系解析；其他语言先进入 unknown/skip。
- 关系类型逐步扩展，不破坏既有 artifact contract。
- 前向兼容：解析器版本 + schema version 在 manifest 与每个文件中记录。

## Implementation close notes（2026-06-05）

- `project_map_relationship_read` now returns dynamic `stale` summary and injects stale reason into context-pack consumer payload without mutating deterministic relation artifacts.
- `File Relations / 文件关系` exposes explicit UA-style actions: Explain, Diff Impact, Guided Read, Ask Map, and Domain Lens.
- `useProjectMapDataset` now carries `relationshipContextPack` and `relationshipStaleSummary` so cross-surface consumers can reuse relationship artifacts.
- Agent orchestration `project-map` provider consumes relationship context-pack as a deterministic resource discovery candidate before broad scan fallback.
- Focused validation completed: OpenSpec strict validate, frontend typecheck, and backend cargo check passed.


## 中文+English 术语对照（Design Glossary）

- Atomic Snapshot / 原子快照
- Relationship Graph / 关系图
- Evidence-anchored Edges / 证据锚定边
- Scan Pipeline / 扫描流水线
- Repair Pipeline / 修复流水线
- Dashboard Index / 看板索引
- Stale Reason / 陈旧原因
- Change Impact / 变更影响
- Bridge Relation / 桥接关系
- Context Pack / 上下文包
- Schema Contract / schema 契约

## Corrective design note：File Relationship Explorer（2026-06-05）

### 中文导读

真实项目测试暴露了一个核心偏差：原 `Relationship Dashboard` 更像扫描统计面板，而不是工程师需要的关系阅读工具。
因此本阶段将默认 UX 校准为 `File Relationship Explorer`：以文件为入口，以文件链路和方法调用关系为主视图，以 evidence line 作为可信依据。

### Product correction

- 默认视图 MUST prioritize `selected file -> incoming/outgoing/calls -> evidence inspector`。
- Impact、Hotspot、Agent Read Plan MAY remain as advanced signals, but MUST NOT dominate the default reading surface。
- Refresh semantics MUST distinguish true stale from scan scope warning. A changed file outside scan scope SHOULD NOT make full refresh appear broken forever。
- The feature MUST remain language-general. Java/Spring Boot is only one smoke-test case, not the scanner center。

### Universal extractor strategy

- Lightweight extractor 先做 deterministic symbol inventory：file stem、class/type/function/method declaration。
- Generic call extractor 从 `foo.bar()`、`Foo::bar()`、`foo->bar()`、`foo_bar()`、`ClassName()` 等调用形态提取 candidate。
- Resolver 通过 symbol/file stem alias 建立 file-level `calls` relation，并在 evidence excerpt 中记录调用候选。
- Language-specific import extractor 作为增强层：TS/JS/Vue/Svelte import、Rust use/mod、Java import、Python import、C/C++ include。
- Low-confidence 或无法解析的内容不得污染主链路；保留 scanned file inventory 和 repair/scope warning。

### UX correction

```text
File Relationship Explorer
  left: File Board / File List
  center: File & method chain
  right: Evidence Inspector + optional UA-style actions
```

这个结构借鉴 UA 的节点平铺和链路聚焦，但不复用 UA schema，也不引入三方 graph storage。

## Corrective design note：Chain-first Explorer closure（2026-06-05）

### 中文导读

13C 的设计方向正确，但实现层仍保留了 Dashboard-era 的视觉惯性：Board 容易成为默认入口，metrics 过重，refresh 容易被 partial changed scope 影响。
13D 将体验 contract 收紧为 `Chain-first`：扫描关系后的第一屏必须回答“当前文件和哪些文件/方法有链路，证据在哪”。

### Updated UX contract

- `Scan Relationships` default action MUST mean full workspace scan unless a caller explicitly passes partial scope.
- After scan success or latest snapshot load, the relationship surface MUST open `Chain` view by default.
- View switch order MUST present `Chain` before `Board` and `List`.
- `Board` is an auxiliary node overview inspired by UA-style tile lanes; it MUST NOT dominate the default reasoning path.
- The Chain center column MUST prioritize `calls` and show method/function candidate when the scanner has evidence.
- The Evidence Inspector MUST show source file, target file, call candidate, and evidence line/excerpt.

## Corrective design note：UA-like File Relationship Workspace（2026-06-05）

### 中文导读

真实 UI 对比显示：当前实现虽然有 Graph，但整体仍是 dashboard chrome + 多 tab 列表，和 UA 的“图谱工作台”差距较大。
本设计更新将关系面板重心从 `Dashboard / Chain` 迁移到 `Workspace / Graph + Files + Read`。

### Interaction architecture

```text
File Relationship Workspace
  Header: compact scan status + metrics + rescan
  Controls: optional collapsed search/filter chrome
  Main switch: Graph / Files / Read

  Graph:
    left rail: high-signal file navigation
    center canvas: selected one-hop relationship graph
    right inspector: selected node/edge details

  Files:
    path/module tree with all filtered files
    each file row shows role/language/in/out/all counts
    click selects file and returns to Graph

  Read:
    selected file profile
    current calls/outgoing/incoming summary
    context-pack must-read/related/tests/contracts
    impact and risk flags
```

### State contract

- `relationshipDashboardViewMode` SHOULD narrow to `graph | files | read`.
- `selectedRelationshipFileId` remains the single selection source for all three views.
- `selectedRelationshipRelationId` remains the edge selection source and feeds Inspector.
- Search, role filter, type filter, and noise toggle MUST affect Graph rail, Files tree, and Read context consistently.

### Rendering contract

- Graph view MUST NOT render old Project Map canvas underneath when file relations are expanded.
- Files view MUST NOT cap by role lane; it MAY cap very large folder groups with explicit count copy, but the page itself should scroll.
- Read view MUST treat `contextPack` as first-class content, not hidden action output.
- Inspector MAY keep action buttons, but those actions are secondary to persistent Info/Read content.

### Accessibility / i18n

- New view labels and section headings MUST be translated in `zh.part5.ts` and `en.part5.ts`.
- File tree buttons MUST expose full path through `title`.
- Empty states MUST describe whether the cause is filter/search/no snapshot.
- Metrics SHALL be compact status chips, not large dashboard cards, to reduce visual noise and preserve reading space.

### Product boundary

This remains a mossx-native deterministic scanner. It does not import UA schema and does not mutate the existing Project Map semantic graph.

### Chain ordering rule

- The Chain column SHOULD rank `calls` relations before generic imports/config/docs relations.
- For non-call relations, outgoing edges from the selected file SHOULD appear before incoming edges, because they better answer "what does this file depend on / call next".
- This is a UX ordering rule only; it MUST NOT mutate stored relation artifacts or relation confidence.

### Chain grouping rule

- The Chain column SHOULD group relations into `Calls`, `Outgoing`, `Incoming`, and `Other` sections.
- `Calls` MUST appear first because it most directly answers method/function-level relationship questions.
- Grouping is presentation-only and MUST preserve the underlying persisted relation order, ids, evidence, and confidence values.

## Corrective design note：UA-like Graph Dashboard（2026-06-05）

### 中文导读

13D 的 Chain-first 修复解决了“关系列表更清楚”的问题，但没有满足用户对图形化 dashboard 的期望。
UA 的核心不是具体 schema，而是 `Graph first, Inspector second, File navigation third` 的信息架构。
因此 13E 将默认关系视图校准为图形化 dashboard：文件节点、关系边、选中高亮、一跳邻域、右侧 evidence inspector。

### UA reference points to learn / 复刻学习点

- `GraphView`：主区域是图画布，带 background grid、controls/minimap 语义和节点/边交互。
- `CustomNode`：节点卡片通过 type color bar、badge、summary、selected ring 表达类型与状态。
- `NodeInfo`：右侧 Inspector 解释当前选中节点或边的 connections/evidence。
- `FileExplorer`：文件树是辅助导航，不是主叙事。
- `FilterPanel`：过滤器是辅助控件，不占用主图谱空间。
- `edgeAggregation / containers`：大项目需要聚合、分层和按需展开，不能全量平铺所有边。

### Updated UX contract

- Relationship Dashboard MUST default to `Graph` after scan success or latest snapshot load.
- Graph nodes SHALL represent scanned files from `project-map-relations`.
- Graph edges SHALL represent deterministic relations, especially `calls`, `imports`, `tested_by`, `documents`, and `configures`.
- Selecting a file node SHALL focus its one-hop neighborhood and update Inspector.
- Selecting an edge SHALL update Inspector with source, target, relation type, call candidate, and evidence line/excerpt.
- Board/List/Chain MAY remain as auxiliary views, but MUST NOT be the default relationship dashboard experience.
- The graph projection is presentation-only. It SHALL NOT mutate persisted relation artifacts or the existing Project Map semantic graph.
- The implementation SHOULD avoid introducing UA schema or third-party graph storage.

### Current implementation note

The first 13E implementation uses a lightweight SVG/absolute-position graph renderer inside mossx, rather than importing ReactFlow from UA. This keeps dependency risk low and lets the visual model be replaced later if mossx decides to adopt a graph rendering library.

## 13E visual supplement：graph lanes and relation legend（2026-06-05）

### 中文导读

仅有节点和边还不够。UA 的可读性来自空间语义：当前节点、incoming、outgoing、关系类型图例都很明确。
因此 13E 继续补充 lane labels 与 edge legend，让用户一眼看懂图谱方向和边的含义。

### Visual rules

- Canvas SHOULD show three semantic lanes: `Incoming`, `Current file`, `Outgoing`.
- Relation edges SHOULD use distinct visual classes:
  - `calls`: strongest accent, highest salience.
  - `imports`: dependency blue/teal.
  - `tested_by`: test green.
  - other relations: muted default.
- Edge labels SHOULD inherit the relation visual priority.
- Legend SHOULD stay inside the canvas and not replace Inspector.
- These visual rules are presentation-only and MUST NOT alter persisted relation confidence or type.

### Lightweight minimap rule

- Graph canvas SHOULD include a compact minimap-like overview for spatial orientation.
- The minimap SHOULD show selected and neighbor nodes with stronger visual weight.
- This minimap is a presentation aid only; it MUST NOT become a second persisted graph model.

### High-density aggregation rule

- Graph projection SHOULD cap visible incoming/outgoing neighbor nodes per focused file.
- Hidden neighbors SHOULD be represented as aggregate nodes such as `+N incoming` or `+N outgoing`.
- Aggregate nodes and dashed aggregate edges are presentation-only; they MUST NOT be persisted as real relation artifacts.
- This rule keeps the dashboard readable on large projects and follows UA's principle of aggregating before expanding.

## 13F corrective design：Graph Fidelity / 图谱拟真度补强（2026-06-05）

### 中文导读

13E 已经把默认体验从 list-first 改成 Graph-first，但图谱还需要具备 UA-like exploration 的基本动作。
本阶段不引入 ReactFlow、不迁移 UA schema，也不改变 storage contract；只在 frontend view model 层增强 graph projection 和 interaction。

### Interaction contract

- Aggregate nodes SHALL be rendered as graph controls.
- Clicking `+N incoming` SHALL expand incoming side capacity for the selected file.
- Clicking `+N outgoing` SHALL expand outgoing side capacity for the selected file.
- Clicking an expanded aggregate control again SHALL collapse that side back to the default capped density.
- Changing selected file SHALL reset graph expansion state to avoid carrying a previous file's density decision into a new focus context.
- Relation legend buttons SHALL update the same relationship type filter used by the existing filter bar.
- Legend filters SHALL be redundant with the select control, not a separate hidden state, to avoid split-brain UI.

### Density model

- Default side limit remains conservative to prevent large project line noise.
- Expanded side limit SHALL be larger but still capped, because “expand” means reveal more useful neighborhood, not render all workspace edges.
- Hidden counts SHALL be recalculated after expansion and remain visible when the relation set is still too large.
- Aggregate nodes are view-only projection nodes; they MUST NOT appear in `relations/latest.json`, `by-file`, `context-packs`, or Project Map semantic graph.

### UA reference learning

- UA 的核心价值不是某个具体 schema，而是 `focus node -> visible neighborhood -> inspector evidence -> explicit controls` 的阅读闭环。
- mossx 复刻的是这个 UX pattern，而不是 UA 的存储格式、ReactFlow dependency 或 node model。
- File rail / legend / aggregate node / inspector 必须共同服务于“先看图，再读证据”的主线。

## 13G corrective design：Graph Workspace Layout / 图谱工作台布局（2026-06-05）

### 中文导读

Graph-first 不是把图谱塞进一个固定面板，而是让图谱成为主要工作区。
当前 File Tree、Inspector 与底部 Project Map 主图同时占位，会导致图谱视口过小。
13G 将辅助模块改为可折叠，并给 graph canvas 增加自适应和 drag-to-pan，让用户能在视图内探索关系。

### Layout contract

- File rail and Inspector SHALL be optional visible modules inside the Graph view.
- Collapse controls SHALL live close to the Graph canvas header, not in global Project Map toolbar.
- When a side module is collapsed, the Graph layout SHALL reclaim its grid column.
- Collapsed state SHALL remain local UI state and SHALL NOT be persisted until the UX is validated.

### Canvas interaction contract

- Graph uses a fixed logical coordinate system for deterministic node/edge projection.
- The visible viewport SHALL apply presentation-only transform for scale and pan.
- Dragging an empty canvas area SHALL pan the relationship graph.
- Clicking graph nodes, aggregate nodes, edge labels, legend filters, file rail items, or inspector items SHALL NOT start panning.
- The implementation SHOULD keep MiniMap read-only in this phase to avoid introducing a second navigation contract.

### Auto-fit contract

- The graph canvas SHALL use responsive CSS sizing to occupy available height and width.
- Logical graph content MAY be scaled to fit the visible viewport.
- Auto-fit is a visual transform only; it MUST NOT change relation coordinates, stored relations, confidence, or evidence provenance.

### Chrome collapse refinement

- Relationship scan chrome SHALL default to collapsed in Graph-first reading mode.
- Collapsed chrome SHALL preserve a compact status summary instead of disappearing completely.
- Compact summary SHALL include file count, relation count, and freshness state.
- Stale snapshots SHALL keep a lightweight refresh action in the collapsed chrome.
- Search, type filter, role filter, stale details, and snapshot rule remain available after expansion.
- This rule treats search/filter as secondary controls; the primary default surface remains the graph canvas.

### Collision avoidance and pan refinement

- Relationship graph SHALL use an expanded logical canvas for dense project views.
- The logical canvas MAY be larger than the visible viewport; users SHALL explore it with drag-to-pan.
- Incoming and outgoing lanes SHALL calculate node Y positions from available lane height, not from a fixed dense row formula.
- Expanded lanes SHALL remain capped to avoid immediate overlap after the user expands an aggregate node.
- Aggregate nodes SHALL be placed in a reserved bottom area, separate from regular file nodes.
- SVG edges, edge labels, nodes, aggregate controls, legend filters, file rail, and inspector controls SHALL keep their click semantics and SHALL NOT accidentally start pan.
- Pan is presentation-only and MUST NOT mutate file relation ids, evidence, confidence, persisted storage, or Project Map semantic graph.

### Search and zoom refinement

- Graph toolbar SHALL expose file search even when the advanced scan chrome is collapsed.
- Search query SHALL filter file candidates and focus the graph on the first matching file.
- If the selected file is no longer visible under the active search/filter, the graph SHALL fallback to the first visible match.
- Graph toolbar SHALL provide zoom in, zoom out, and reset view actions.
- User zoom SHALL multiply the responsive auto-fit scale instead of replacing it.
- Reset view SHALL restore pan and user zoom while keeping the current selected file.

## 13H corrective design：Explorer Chrome / Navigation Intent Split / Editor Line Feedback（2026-06-06）

### 中文导读

13G 解决了 Graph workspace 空间问题，但真实使用中又暴露出更细的交互契约问题：顶部 chrome 仍混杂 semantic Project Map 与 file relationship snapshot，节点点击语义过载，源码打开缺少 target definition 定位和视觉确认。

13H 的设计原则是：`File Relationship Explorer` 是 deterministic scan snapshot 的工作区。用户进入这个工作区后，chrome、graph、inspector、editor feedback 都必须服务于“看懂文件/方法关系”这一条主线。

### Header and chrome contract

- Project Map relationship active state SHALL replace the left primary breadcrumb/summary slot with `File Relations / 文件关系 Explorer`.
- In relationship-focused mode, old semantic-map counters such as nodes, Lens, and candidates SHALL be hidden from the same header row.
- Relationship inline summary SHALL be rendered as compact status content, not a bordered card.
- Relationship inline summary SHALL NOT duplicate the global `Scan Relationships` action.
- The global/top scan action remains the canonical scan/recovery entry.
- The relationship header summary MAY show scan run id, file count, relation count, ignored count, repair count, and freshness state as metadata.
- Header compaction MUST NOT remove stale/failure recovery affordance from the global toolbar.

### View switch icon contract

- The `Graph 图谱` switch SHOULD use a relationship/graph glyph.
- The glyph MUST NOT look like an unselected radio indicator, because the active state already has underline/selected styles.
- The icon is visual affordance only and MUST NOT introduce a separate selected-state model.

### Node interaction contract

- A graph file node has two distinct interaction targets:
  - node body: inspect file details
  - node jump icon: navigate graph focus / relationship chain
- Node body click SHALL set the inspected file shown in the right Inspector.
- Node body click SHALL NOT change graph focus, selected relationship, or relationship chain by itself.
- Node jump icon click SHALL:
  - stop propagation from node body click
  - set selected graph focus to the clicked file
  - set inspected file to the clicked file
  - clear selected relationship edge
- Node keyboard handling SHOULD preserve inspect behavior for Enter/Space on the node body.
- Jump icon SHOULD remain a real button with accessible title/label semantics.

### Edge direction contract

- Relationship edges SHALL preserve the existing SVG line renderer.
- Each visible relationship edge SHOULD render a direction arrow aligned to the line direction.
- Aggregate/dense edges SHOULD also show direction where possible, while staying visually quieter than selected direct edges.
- Arrow rendering is presentation-only and MUST NOT alter relation direction, relation type, confidence, or evidence.

### Inspector source/target opening contract

- Source and target open actions SHALL use the existing `onOpenEvidenceFile(path, location?)` boundary.
- Source opening MAY use evidence line when the evidence path matches the source file path.
- Target opening SHALL prefer a resolved target symbol definition line when available.
- Target symbol resolution SHALL use this input:
  - selected `ProjectMapFileRelation`
  - `relationshipDashboardData.symbols`
  - relation call candidate parsed into a likely target symbol name
- Target symbol resolution SHALL match by `targetFileId` first and symbol name second.
- Exact symbol-name match SHOULD be preferred.
- Case-insensitive symbol-name fallback MAY be used for scanner/language differences.
- If no symbol match exists, target opening SHALL fall back to the previous evidence-line behavior.
- If no line is available, the action SHALL still open the target file without a location.
- The UI MUST NOT invent a target line without a symbol or matching evidence.

### Editor navigation feedback contract

- File opening at a line uses the existing editor navigation target state.
- After CodeMirror successfully focuses the requested location, the editor SHOULD apply a transient line decoration to the target line.
- The target line SHOULD flash 3 times over 2 seconds.
- The flash SHALL be single-line only.
- The flash SHALL clear itself after the animation window.
- The flash SHALL clear when changing file or when the editor navigation surface unmounts.
- The flash MUST NOT use persistent Git line markers, annotation markers, diff markers, or file content changes.
- The flash SHOULD use theme-aware CSS tokens so light, dark, dim, and custom VS Code themes remain readable.

### Theme and i18n contract

- Relationship visible copy MUST use i18n keys rather than hardcoded strings.
- Relationship graph/read/inspector/action copy SHOULD keep Chinese UI readable while preserving precise English professional terms where appropriate.
- Relationship-specific colors SHOULD be exposed through Project Map CSS variables:
  - relation call/import/test/other colors
  - inspected file state
  - info/core/accent states
- Components SHOULD reference variables rather than hardcoded naked hex colors for active, hover, selected, inspected, edge, and arrow states.
- CSS fallbacks MAY keep safe default colors, but the primary path must remain theme-token driven.

### Good / Base / Bad cases

- Good: clicking `WebUserController.java` node only changes Inspector; clicking its jump icon recenters/focuses graph and keeps Inspector on the same file.
- Good: selecting a `calls` edge shows edge evidence; `Open Target` lands on the target method definition line if the symbol artifact contains it.
- Good: opened target line flashes briefly and then returns to normal editor rendering.
- Base: target symbol is unavailable; `Open Target` opens the file and uses matching evidence line if available.
- Base: custom theme maps accent tokens differently; arrows, selected node, inspected node, and line flash remain visible.
- Bad: node body click both changes Inspector and jumps graph focus, making detail browsing feel unstable.
- Bad: `Open Target` always uses source evidence line and therefore opens the target file at the wrong row.
- Bad: line feedback is implemented as a Git marker and stays visible forever.
- Bad: relationship header duplicates scan buttons and semantic Project Map counters, making the active relationship workspace visually noisy.

### Tests / validation points

- Component interaction SHOULD cover node click inspect-only and jump-icon graph focus behavior.
- Component interaction SHOULD cover edge selection still updates Inspector edge evidence.
- Relationship action coverage SHOULD assert `Open Target` uses target symbol line before evidence fallback.
- Editor navigation coverage SHOULD assert a line-flash decoration is applied after navigation and cleared after the timeout.
- Theme review SHOULD inspect dark/light/custom theme tokens for relationship arrows, inspected state, active view switch, and editor flash visibility.
- i18n review SHOULD search relationship UI copy for hardcoded visible strings.
