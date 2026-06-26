## Context

本次改动只影响消息面板渲染入口，不涉及 reducer、网络协议或会话状态。

## Goals / Non-Goals

**Goals:**
- 让 copy 行为回到“最终 assistant 尾部动作组唯一入口”。
- 保留代码块、工具输出等局部 copy 入口。

**Non-Goals:**
- 不引入新状态系统或跨层缓存。
- 不更改消息内容模型。

## Decisions

### Decision 1: 统一在 `MessageRows` 级别移除行内 copy
- 理由：避免在 `assistant/user/unknown` 多分支重复维护 copy 可见性。

### Decision 2: 保持 `MessagesTimeline` 的底部按钮组为唯一消息级 copy 通道
- 理由：当前已有 fork/rewind 的协作语义与“尾部动作组”绑定；复制随组内统一管理可最小化影响。

## Risks / Trade-offs

- [Risk] 用户无法从普通 user 消息行快速复制。
  - [Mitigation] 通过测试确认“最终 assistant tail copy”稳定可达，且不影响特殊 copy 子控件。
- [Risk] 某些旧交互文案依赖行内 copy 统计。
  - [Mitigation] 通过 OpenSpec/测试回写明确“copy 入口收敛”边界。

### Migration Plan

- 无迁移动作：纯前端按钮展示策略变更。

### Open Questions

- 当前阶段无未决问题。
