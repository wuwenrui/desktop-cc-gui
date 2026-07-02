# Design: Thread Hover Preview

## Context

`ThreadSummary` 当前只包含会话标题、更新时间、engine/provider 元数据和状态，不包含完整消息摘要。因此第一版预览卡只展示可验证的线程元信息，避免为了“摘要”临时读取完整历史导致侧栏 hover 卡顿。

## UX

- 普通和置顶线程行在 hover/focus 后弹出右侧预览卡。
- 卡片使用项目现有 sidebar token，视觉上保持轻量：小圆角、弱边框、浅阴影、两段信息。
- 标题最多两行，meta 使用短标签，路径单行截断。
- 运行/复核状态优先显示；空闲时显示最近更新时间。

## Component Boundary

- 新增 `ThreadHoverPreviewCard`：纯 UI 组件，只接收已计算好的 label。
- `ThreadList` 与 `PinnedThreadList` 只负责把已有 `thread/status/time/workspacePath` 映射给卡片。
- 不读取历史文件、不新增 backend command。

## Accessibility

- Tooltip trigger 保留 row 的 button 语义。
- hover 与 keyboard focus 都可触发预览。
- 预览卡内容通过现有 Tooltip portal 呈现，不改变行点击目标。

## Testing

- `ThreadList.test.tsx` 覆盖普通线程 hover 后显示富预览。
- `PinnedThreadList.test.tsx` 覆盖置顶线程 hover 后显示富预览。
- 运行 focused tests 与 typecheck。
