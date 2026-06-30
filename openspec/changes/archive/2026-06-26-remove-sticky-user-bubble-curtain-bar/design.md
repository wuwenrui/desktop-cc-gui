## Context

当前实现把“用户气泡吸顶条”拆在四层：Client UI visibility control 提供开关，`useLayoutNodes` 派生 `showStickyUserBubble`，`Messages` 和 `MessagesTimeline` 渲染 history sticky header，`messages.history-sticky.css` 提供视觉样式。另有 OpenSpec 主线 specs 明确要求 history/realtime pinning。

用户要求删除该能力，因此不能只在 UI 上隐藏开关；必须同步删除规范契约和实现链路，避免后续开发按旧 spec 把能力加回来。

## Goals / Non-Goals

**Goals:**

- 移除 sticky user bubble/header 的可见 UI 和控制入口。
- 让旧 preference 中的 `curtain.stickyUserBubble` 自动成为 unknown key 并被忽略。
- 保持消息列表、普通用户气泡、消息锚点、上下文来源卡片、history collapse/windowing 的基本行为不变。

**Non-Goals:**

- 不重构整个 `Messages` 大组件。
- 不改变消息锚点的 jump/active anchor 行为。
- 不新增 storage migration 或后端命令。

## Decisions

1. 选择彻底删除，而不是默认隐藏。
   - 方案 A：删除 control id、prop、sticky render/CSS/helper/tests。
   - 方案 B：保留能力但默认隐藏。
   - 取舍：A 更符合用户“删掉相关代码”的语义，也减少后续维护面；B 会留下 dead code 和规范冲突。

2. 旧偏好不做显式迁移。
   - `clientUiVisibility` 已通过 known id set normalize unknown keys。
   - 移除 id 后，旧 `curtain.stickyUserBubble` 会自然被丢弃。
   - 这比新增一次性 migration 更简单且无数据风险。

3. 消息窗口保留普通用户 source row，但不再输出 sticky candidate。
   - `buildLiveTailWorkingSet` 可继续保留 latest ordinary user row，避免超长 realtime 输出把当前用户问题从普通幕布流里裁掉。
   - `buildRenderedItemsWindow` 只负责普通渲染窗口与 collapsed count，不再驱动 sticky header。
   - 保留 source row 不得产生 `.messages-history-sticky-header`、`showStickyUserBubble` 或 visibility control。

## Risks / Trade-offs

- [Risk] 删除 sticky helper 可能影响 live window trimming 测试预期。
  - Mitigation: focused 更新 `messagesLiveWindow.test.ts`，保留裁剪计数和普通渲染断言。
- [Risk] 文档或 i18n 残留导致用户仍能搜到已删除功能。
  - Mitigation: `rg "curtain.stickyUserBubble|Sticky user bubble|用户气泡吸顶|history-sticky"` 做残留检查。
- [Risk] OpenSpec 主线仍要求 sticky pinning。
  - Mitigation: delta specs 用 REMOVED Requirements 明确移除两个 sticky capabilities。

## Migration Plan

1. 写入 OpenSpec proposal/design/spec delta/tasks。
2. 删除前端 control、prop、render、CSS、文档和测试引用。
3. 运行 focused tests、typecheck、large-file check。
4. 回滚时恢复本 change touched files 即可；不涉及 runtime state 迁移。

## Open Questions

- None.
