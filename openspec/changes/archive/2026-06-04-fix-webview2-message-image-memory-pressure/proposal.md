## Why

Windows 用户在包含图片的长会话中观察到 `Microsoft Edge WebView2` 内存上涨、卡顿甚至假死；现有性能优化主要覆盖 streaming 派生、composer 输入和 long-list proxy evidence，没有覆盖图片资源进入 renderer 后的生命周期。需要在不改变图片展示、原图查看、发送 payload 和历史恢复语义的前提下，收口 message image 的 renderer memory pressure。

## 目标与边界

- 保持用户可见功能语义不变：图片仍显示 preview，点击仍可查看原图，历史图片仍可按需 hydrate。
- 保持 canonical conversation item 与模型发送 payload 不变。
- 将大图 full data URL 的持有从长期 state/DOM 改为按需、可释放的 transient resource。
- 让 timeline virtualization 考虑图片和长内容重量，而不是只看 row count。

## 非目标

- 不压缩、不裁剪、不丢弃用户图片或生成图片。
- 不改变 Claude/Gemini/Codex 的图片发送协议。
- 不把图片数量限制作为本次修复手段。
- 不重构整个 conversation reducer 或 history loader。

## What Changes

- Message image timeline preview 将优先使用轻量展示路径，full image 仅在 lightbox 或显式 hydrate 时短期持有。
- Claude deferred image hydrate 后的 full data URL 不再永久留存在 message row state；关闭预览或 row unmount 后释放 transient 引用。
- Timeline virtualization 增加 image/long-content weight 判断，图片重负载可早于 200 rows 启用 virtualization。
- 补充 focused tests 覆盖图片资源释放、原图 lightbox 功能保留、weighted virtualization 触发条件。

## 技术方案选项

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 仅降低图片尺寸 | timeline 直接压缩图片或限制大小 | 内存改善明显，但属于功能降级，不能采用 |
| B. 保持原图，改为按需 full-resource 生命周期 | preview 常驻，full data URL 只在打开/可见期间持有，关闭后释放 | 推荐；功能语义不变，局部改动可控 |
| C. 后端统一生成 thumbnail handle | Rust 侧新增 thumbnail/cache API | 长期最好，但第一轮跨层成本高，可能扩大风险 |

本次采用 B，必要时为 C 留接口空间。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `long-list-virtualization-performance`: virtualization trigger must account for row content weight such as message images, generated images, deferred images, and long Markdown.
- `conversation-realtime-client-performance`: realtime/client performance must include message image resource lifecycle so renderer memory pressure does not block input or controls.

## Impact

- Affected frontend files:
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/messages/components/MessageMediaBlocks.tsx`
  - `src/features/messages/components/messagesTimelineVirtualization.ts`
  - related focused tests
- No new dependency.
- No model payload or backend command signature change in first implementation pass.

## 验收标准

- 图片消息 preview 仍显示。
- 点击图片仍可打开原图 lightbox。
- 关闭 lightbox 或 row unmount 后不再持有 transient full data URL。
- 图片重负载 timeline 能更早启用 virtualization。
- canonical conversation item 和 send payload 不被修改。
