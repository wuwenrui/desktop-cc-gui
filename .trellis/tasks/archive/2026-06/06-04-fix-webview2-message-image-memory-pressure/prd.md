# Fix WebView2 Message Image Memory Pressure

## Goal
修复 Windows WebView2 在长会话、图片消息、历史图片 hydrate 场景下内存上涨、卡顿、假死的问题，同时保持图片展示、原图查看、发送 payload、历史恢复、message actions 的功能语义不变。

## Requirements
- 普通 timeline 不应因为大图长期持有 full data URL 而持续推高 WebView2 renderer 内存。
- deferred Claude history image hydrate 后必须有明确释放路径。
- inline `data:image` 和 generated image 的 timeline 展示应以轻量 preview 为主，原图按需打开。
- timeline virtualization 不能只按 row count 判断，应考虑图片/长内容重量。
- 不改变 canonical conversation item、发送给模型的 images payload、历史解析语义。

## Acceptance Criteria
- [ ] 图片消息仍显示 preview。
- [ ] 点击图片仍可打开原图 lightbox。
- [ ] 关闭 lightbox 或 row unmount 后释放 transient full image 引用。
- [ ] Windows/图片重负载时更早启用 timeline virtualization。
- [ ] 不压缩、不裁剪、不丢弃图片数据。

## Technical Notes
OpenSpec change: fix-webview2-message-image-memory-pressure

第一轮优先修 frontend resource lifecycle，不改模型发送链路。
