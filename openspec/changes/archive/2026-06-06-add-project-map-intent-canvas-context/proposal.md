# Proposal: Project Map Intent Canvas Context

## 中文导读

这次变更只落地用户明确确认的核心：Project Map 里提供一个可自由搭建的 Intent Canvas，并允许当前会话引用这张图。

它不是代码生成器，也不是模型驱动架构的完整闭环。第一阶段先解决“我能画出意图逻辑图，并让 AI 对话精确引用它”。

## Context / 背景

用户重新校准后明确提出两个核心模式：

- 架构师的白板：用户可以自己通过方框和连线画出意图逻辑图。
- 代码的探照灯：从当前 Project Map 节点展开，让会话基于该节点上下文继续追问。

现有代码中已经有 `ProjectMapIntentCanvas` 组件雏形，但它没有接入 Project Map 面板、详情动作、会话发送链路、样式与 i18n，因此用户不可用。

## Goals / 目标

1. 在 Project Map 节点详情中提供自由搭建和从当前节点展开两个入口。
2. 允许用户在画布里新增节点、拖动节点、连接节点、删除节点/边。
3. 提交画布时，将模式、摘要、节点、连线和来源节点作为结构化上下文发送给当前会话。
4. 补齐中文和英文文案、基础视觉样式与响应式布局。

## Non-goals / 非目标

- 不在本轮生成代码。
- 不在本轮把画布持久化为 Project Map dataset。
- 不在本轮实现代码反向工程自动展开函数调用图。
- 不在本轮实现语义模型与代码的双向同步。

## Success criteria / 验收标准

- 用户在 Project Map 选中节点后可以打开 Intent Canvas。
- `Architect` 模式从空白设计起步。
- `Spotlight` 模式以当前节点作为初始中心节点。
- 用户提交后，当前会话收到可读且结构化的 Intent Canvas 上下文。
- 无 active workspace 或无法创建 thread 时，界面给出可读错误。
