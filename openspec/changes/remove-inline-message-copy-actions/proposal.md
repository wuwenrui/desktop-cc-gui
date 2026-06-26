## Why

当前对话幕布在同一会话中会为多个消息行渲染独立复制入口，尤其在流式输出分段时更明显。用户反馈“可复制按钮多端重复”，影响阅读聚焦。

## 目标与边界

### Goal
将正文内独立的行级复制入口统一收敛到最新 assistant 尾部按钮组（copy / fork / rewind），并保持现有特殊 copy 功能不变。

### Non-Goal
- 不新增复制能力。
- 不修改后台命令、会话协议、文件持久化格式。
- 不改写代码块/工具输出/mermaid 的内置复制逻辑。

## What Changes

- 移除 `MessageRow`/body 内用于行内复制的独立 copy 按钮。
- 保留尾部 `AssistantTailActions` 的 copy 操作：仅在**最后一条 assistant 可见行**展示。
- 保留 Markdown/fenced code block、Mermaid、tool output、轻量摘要区块的已有复制入口。

## 技术方案对比与取舍

方案 A（选中）
- 直接在 `MessageRow` 渲染层统一去除行内 copy 按钮，并由 `MessageTimeline` 的尾部动作组兜底。
- 优点：最小改动、影响面集中、回归成本低。

方案 B（未采用）
- 保留行内 copy 并在不同消息类型按规则过滤。
- 风险：策略分散在多处渲染分支，仍可能留有边界漏斗。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `conversation-message-actions`: copy affordance 的展示边界收敛为仅最终 assistant 行尾动作组，正文独立按钮不再展示。

## Impact

- 变更文件（已落盘）：
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/messages/components/MessagesTimeline.tsx`
  - 相关测试文件（行内 copy 断言同步更新）
- 行为影响：
  - 同一 turn 内非最终行不会出现独立 copy 按钮。
  - 复制能力依旧在最终 assistant 尾部 action 组可达。

## Acceptance

- 仅保留“最后 assistant 尾部按钮组”中的 copy/fork/rewind。
- 多段 assistant 回复中间行不再渲染行内 copy。
- 代码块、tool/output/summary 特殊入口不受影响。
