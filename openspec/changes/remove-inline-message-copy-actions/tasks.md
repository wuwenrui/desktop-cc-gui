## 1. 行为与规范落盘

- [x] 1.1 在 `proposal.md` 写清变更动机与影响范围（可回归到“只保留最终尾部动作组”）
- [x] 1.2 在 `design.md` 说明实现路径、替代方案与风险
- [x] 1.3 在 `specs/conversation-message-actions/spec.md` 写入行为 delta（最终行尾 copy、移除行内 copy）

## 2. 代码交付对齐

- [x] 2.1 核对 `MessageRow` 与 `MessagesTimeline` 的渲染入口已收窄到尾部动作组
  - 输入：消息流中 assistant/user 多段场景
  - 输出：无独立 body copy 按钮、尾部动作组保留
- [x] 2.2 对应测试已覆盖按钮数量和用户输入边界场景
  - 输入：`MessagesRows` 与 `Messages` 相关测试
  - 输出：`row copy` 断言与 `extract user input` 断言同步更新
