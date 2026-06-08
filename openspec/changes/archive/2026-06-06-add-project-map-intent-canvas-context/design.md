# Design: Project Map Intent Canvas Context

## Boundary / 边界

本设计把 Intent Canvas 定义为 `conversation context surface`，不是 `project-map persistent graph`。

这样做的原因是：用户当前最需要的是“让 AI 理解我画出的意图”，而不是立即引入复杂的模型驱动代码生成和持久化同步。

## User flow / 用户流程

1. 用户打开 Project Map。
2. 用户选中任意节点。
3. 详情面板提供两个动作：
   - `自由搭建 Architect`
   - `从节点展开 Spotlight`
4. 用户在 overlay canvas 中编辑节点和连线。
5. 用户点击提交。
6. app 将结构化 prompt 发送到当前 workspace 的当前会话；若无当前会话则创建新会话。

## Implementation / 实现

- `ProjectMapPanel` 持有 Intent Canvas open state，将 selected Project Map node 映射为 `sourceSeed`，并渲染 overlay。
- `ProjectMapPanelSurfaces.DetailPanel` 暴露两个入口按钮，按 optional callback 控制是否显示。
- `useLayoutNodes` 增加 `onSubmitProjectMapIntentCanvas` option 并透传。
- `useAppShellLayoutNodesSection` 将 `ProjectMapIntentCanvasPayload` 格式化为当前会话消息。
- `ProjectMapIntentCanvas` 保持轻量 local UI state，不引入 persistence。

## Prompt shape / 会话上下文格式

会话消息包含：

- 模式：`architect` 或 `spotlight`
- 来源节点：node id/title/kind/summary
- 用户摘要
- 节点清单
- 连线清单
- JSON payload

AI 需要把它当作用户意图图，而不是已落地代码事实。

## Risk / 风险

- 当前画布只在 overlay 内存中存在，关闭后不保留。
- 当前 `spotlight` 只从 Project Map 选中节点 seed，不自动解析代码调用图。
- 当前提交是普通 user message，不是独立 attachment 类型。
