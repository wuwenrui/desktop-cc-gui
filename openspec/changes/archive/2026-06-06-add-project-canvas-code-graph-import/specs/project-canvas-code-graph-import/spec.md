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
系统 SHALL 允许用户把 `project-map-relations` graph 中选中的 file node 导入 Project Canvas，生成以该文件为中心的 bounded direct relationship semantic graph projection。

#### Scenario: node import creates centered graph
- **WHEN** 用户选择 relationship graph node 并执行 import to Canvas
- **THEN** 系统 SHALL 创建或追加 Canvas graph，并把 selected node 放在中心
- **AND** 系统 SHALL 默认包含该文件 direct incoming / outgoing relationship neighborhood
- **AND** 系统 SHALL 使用当前 Relationship Inspector 已解析出的 direct relation set，保持 Canvas 导入结果与 inspector 计数一致
- **AND** 用户 SHALL 能选择新建 Canvas 或追加到某个具体已有 Canvas 作为导入目标
- **AND** 系统 SHALL 在视觉上区分 incoming、current file、outgoing 三个关系区域
- **AND** 这种区域区分 SHALL 通过布局和节点关系表达，不得导出没有 source anchor 的 `Incoming`、`Current File`、`Outgoing` 独立标题文本
- **AND** Canvas node 的 title/path 文本 SHALL 绑定在 node container 内，而不是作为未绑定的独立文本散落在画布上
- **AND** Canvas relation arrow SHALL 绑定到 source/target node containers

#### Scenario: node import respects graph limits
- **WHEN** selected relationship node 的 neighbors 超过 Canvas import limit
- **THEN** 系统 SHALL 只渲染 bounded subset
- **AND** 系统 SHALL 明确提示还有额外 neighbors 被 summarized 或 omitted

### Requirement: Relationship graph edge import
系统 SHALL 允许用户把 `project-map-relations` graph 中选中的 edge 导入 Project Canvas，生成 traceable source-target relation；该能力是 evidence-level secondary import，不替代 file node relationship graph import。

#### Scenario: edge import creates source target relation
- **WHEN** 用户选择 relationship graph edge 并执行 import to Canvas
- **THEN** 系统 SHALL 创建或追加 edge source / target 的 Canvas nodes
- **AND** 系统 SHALL 创建 directed Canvas edge，并保留 relation kind 和 evidence reference
- **AND** source/target node labels SHALL be container-bound and the directed edge SHALL attach to both node containers
- **AND** 用户 SHALL 能选择新建 Canvas 或追加到某个具体已有 Canvas 作为导入目标
- **AND** 如果 relationship evidence 中存在 method/function call candidate，Canvas edge label SHALL 显示该方法/函数名，而不是只显示 relation kind
- **AND** method/function label SHALL be bound to the Canvas arrow element rather than rendered as an unrelated free-floating text element

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

### Requirement: Deterministic projection before AI context handoff
系统 SHALL 先把 source anchors 和 relationship neighborhoods 投影成 Canvas semantic nodes/edges，再允许这些 imported graph 作为 structured AI context 发送。

#### Scenario: graph imports without AI
- **WHEN** 用户导入 relationship node、relationship edge，或 resolved code symbol
- **THEN** 系统 SHALL 能在不依赖 AI 的情况下创建 Canvas semantic graph

#### Scenario: structured context uses imported graph facts
- **WHEN** 用户把包含 imported semantic graph 的 Canvas 作为上下文发送给 AI
- **THEN** 系统 SHALL 在 transmission payload 中包含 semantic nodes、semantic edges、source anchors、evidence summaries 和 visual text 摘要
- **AND** 系统 SHALL NOT 把 raw Canvas scene 全量作为默认模型上下文发送

#### Scenario: send audit card is replayable when payload evidence exists
- **WHEN** 历史 user turn 中保留 compact JSON payload 或 explicit Intent Canvas attachment metadata
- **THEN** 系统 SHALL 在历史消息中恢复 Intent Canvas send-audit card
- **AND** 缺少 payload evidence 的旧历史 SHALL NOT 被前端猜测补卡

### Requirement: Source backlinks
系统 SHALL 为 imported Project Canvas graph nodes/edges 提供 source backlinks。

#### Scenario: node opens source location
- **WHEN** 用户激活带 file path 或 symbol source range 的 imported Canvas node
- **THEN** 系统 SHALL 提供打开 source file 到相关 range 的 action，前提是 range available

#### Scenario: edge opens relationship evidence
- **WHEN** 用户激活带 relationship evidence ids 的 imported Canvas edge
- **THEN** 系统 SHALL 提供 inspect relationship evidence 或 source-target relation detail 的 action

#### Scenario: imported graph returns to project knowledge map
- **WHEN** 用户打开包含 `project-map-relations` imported graph 的 Canvas
- **THEN** 系统 SHALL 在 Canvas editor topbar 提供返回 Project Knowledge Map 的 navigation link

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

### Requirement: AI output remains non-authoritative
系统 SHALL 保证 AI output 不会被写成 fact-backed imported graph node/edge；Canvas 内 explain/group/risk/next-step annotation actions 属于后续变更范围。

#### Scenario: AI output is not authoritative fact
- **WHEN** AI 返回 imported Canvas graph 的 explanation 或 annotation
- **THEN** 系统 SHALL NOT 把该 output 作为 fact-backed imported node/edge 写入 `CanvasSemanticGraph`
- **AND** 如果后续变更把该 output 保存为 `CanvasAiAnnotation` 或 chat-only result，它 SHALL 与 fact-backed nodes/edges 保持结构分离

### Requirement: Sequenced dependency with API contract proposal
系统 SHALL 以 relation projection 为 Project Canvas code graph import 的主链路；API contract 仅作为 optional additive context source，MUST NOT 成为关系图导入的前置事实条件。

#### Scenario: Canvas import without API artifacts
- **WHEN** 用户触发 relationship node / edge / code method 导入 Project Canvas
- **AND** API contract artifact 不存在或扫描失败
- **THEN** Canvas 导入 SHALL 基于 `project-map-relations` source anchors 正常完成
- **AND** 系统 SHALL 显示 API context 状态为 unavailable，而非阻断导入主链路

#### Scenario: API contract failure does not block import
- **WHEN** API contract branch 显式失败
- **AND** Canvas projection pipeline 已经拿到稳定的 relationship snapshot
- **THEN** Canvas import SHALL 继续完成
- **AND** AI explanation context SHALL 标记 API context 为 unavailable，projection context 保持可用
