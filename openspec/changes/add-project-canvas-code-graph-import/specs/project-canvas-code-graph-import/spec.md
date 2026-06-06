## ADDED Requirements

### Requirement: Canvas source anchors
系统 SHALL 为每个 imported fact-backed Project Canvas node/edge 保存 `source anchor`，用来标识它来自 code symbol、relationship node，还是 relationship edge。

#### Scenario: imported relationship node has anchor
- **WHEN** 用户把一个 `project-map-relations` node 导入 Project Canvas
- **THEN** 导入后的 Canvas node SHALL 保存 source anchor，包含 workspace identity、scan run id、node id、node kind，以及可用的 file path 或 symbol id

#### Scenario: imported relationship edge has anchor
- **WHEN** 用户把一个 `project-map-relations` edge 导入 Project Canvas
- **THEN** 导入后的 Canvas edge SHALL 保存 source anchor，包含 workspace identity、scan run id、edge id、relation kind、source node id、target node id、evidence ids

#### Scenario: imported code selection has anchor
- **WHEN** 用户把代码里的 method/function selection 导入 Project Canvas
- **THEN** 导入后的 Canvas graph SHALL 保存 code-symbol source anchor，包含 workspace identity、file path、symbol name、symbol kind，以及可用的 source range

### Requirement: Relationship graph node import
系统 SHALL 允许用户把 `project-map-relations` graph 中选中的 node 导入 Project Canvas，生成 bounded semantic graph projection。

#### Scenario: node import creates centered graph
- **WHEN** 用户选择 relationship graph node 并执行 import to Canvas
- **THEN** 系统 SHALL 创建或追加 Canvas graph，并把 selected node 放在中心
- **AND** 系统 SHALL 默认包含 bounded one-hop neighborhood

#### Scenario: node import respects graph limits
- **WHEN** selected relationship node 的 neighbors 超过 Canvas import limit
- **THEN** 系统 SHALL 只渲染 bounded subset
- **AND** 系统 SHALL 明确提示还有额外 neighbors 被 summarized 或 omitted

### Requirement: Relationship graph edge import
系统 SHALL 允许用户把 `project-map-relations` graph 中选中的 edge 导入 Project Canvas，生成 traceable source-target relation。

#### Scenario: edge import creates source target relation
- **WHEN** 用户选择 relationship graph edge 并执行 import to Canvas
- **THEN** 系统 SHALL 创建或追加 edge source / target 的 Canvas nodes
- **AND** 系统 SHALL 创建 directed Canvas edge，并保留 relation kind 和 evidence reference

#### Scenario: edge import preserves evidence access
- **WHEN** 用户选中 imported Canvas edge
- **THEN** 系统 SHALL 暴露 edge evidence summary，或提供 inspect source relationship evidence 的 action

### Requirement: Code selection method import
系统 SHALL 允许用户在 selected code 可以解析成 symbol 时，把 method/function 导入 Project Canvas。

#### Scenario: selected method resolves through relationship symbols
- **WHEN** 用户选中的代码位于 method/function 内，并且 latest relationship symbols artifact 中存在对应 symbol
- **THEN** 系统 SHALL 把 selection resolve 到该 symbol
- **AND** 系统 SHALL 把该 symbol 的 caller/callee relationships 导入 Project Canvas

#### Scenario: selected code cannot resolve symbol
- **WHEN** selected code range 无法解析成 method/function symbol
- **THEN** 系统 SHALL 显示 clear unresolved-symbol message
- **AND** 系统 SHALL NOT 使用 AI guesses 生成 fact-backed call graph

### Requirement: Deterministic projection before AI annotation
系统 SHALL 先把 source anchors 和 relationship neighborhoods 投影成 Canvas semantic nodes/edges，再允许 AI 做 explanation 或 annotation。

#### Scenario: graph imports without AI
- **WHEN** 用户导入 relationship node、relationship edge，或 resolved code symbol
- **THEN** 系统 SHALL 能在不依赖 AI 的情况下创建 Canvas semantic graph

#### Scenario: AI annotations stay separate
- **WHEN** AI 对 imported Canvas graph 做 summary、grouping 或 risk annotation
- **THEN** 系统 SHALL 把 AI output 保存为 annotation metadata 或 chat context，并与 fact-backed nodes/edges 分离

### Requirement: Source backlinks
系统 SHALL 为 imported Project Canvas graph nodes/edges 提供 source backlinks。

#### Scenario: node opens source location
- **WHEN** 用户激活带 file path 或 symbol source range 的 imported Canvas node
- **THEN** 系统 SHALL 提供打开 source file 到相关 range 的 action，前提是 range available

#### Scenario: edge opens relationship evidence
- **WHEN** 用户激活带 relationship evidence ids 的 imported Canvas edge
- **THEN** 系统 SHALL 提供 inspect relationship evidence 或 source-target relation detail 的 action

### Requirement: Stale and unresolved source state
系统 SHALL 检测并展示 imported Canvas graph 的 stale / unresolved source state，同时不删除用户画布内容。

#### Scenario: source snapshot is stale
- **WHEN** Canvas graph 来自旧 relationship scan run，而当前已有更新的 scan run
- **THEN** 系统 SHALL 显示 graph source snapshot is stale
- **AND** 系统 SHALL 保持现有 Canvas drawing 可编辑

#### Scenario: source anchor no longer resolves
- **WHEN** imported Canvas node/edge 的 source anchor 无法在当前 relationship/code artifacts 中解析
- **THEN** 系统 SHALL 标记 anchor as unresolved
- **AND** 系统 SHALL NOT 自动删除现有 Canvas element

### Requirement: Storage remains projection-only
系统 SHALL 只保存 Project Canvas import metadata 的 projection references 和 summaries，不保存完整 Project Map 或 relationship snapshots。

#### Scenario: imported graph is saved
- **WHEN** 包含 imported code graph data 的 Canvas 被保存
- **THEN** Canvas document SHALL 持久化 semantic graph nodes、semantic graph edges、source anchors、layout references、evidence summaries
- **AND** 它 SHALL NOT 把完整 `project-map-relations` snapshot 复制成新的 fact store

### Requirement: Cross-platform source identity
系统 SHALL 使用 cross-platform-safe source identity 记录 code graph imports。

#### Scenario: Windows path separators
- **WHEN** source anchor 来自 Windows workspace path
- **THEN** 系统 SHALL normalize path identity，并且 SHALL NOT 假设 `/` 是唯一 separator

#### Scenario: range identity
- **WHEN** code selection 被持久化为 source anchor
- **THEN** 系统 SHALL 在 available 时保存 line/column range data
- **AND** 它 SHALL NOT 把 byte offsets 当成唯一 source identity

### Requirement: AI graph explanation context
系统 SHALL 允许用户把 imported Project Canvas graph 作为 structured AI context，用于 explanation、grouping、risk marking 或 next-step suggestions。

#### Scenario: explain imported graph
- **WHEN** 用户要求 AI explain imported Canvas graph
- **THEN** 系统 SHALL 在 AI context 中包含 graph nodes、graph edges、source anchors、relation kinds、evidence summaries、stale state

#### Scenario: AI output is not authoritative fact
- **WHEN** AI 返回 imported Canvas graph 的 explanation 或 annotation
- **THEN** 系统 SHALL 在视觉或结构上区分 AI output 与 fact-backed imported nodes/edges
