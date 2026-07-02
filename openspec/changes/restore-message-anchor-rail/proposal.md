# Restore Message Anchor Rail

## Why

上游 f763bbf7 删除了消息区左缘的锚点导航条（MessagesAnchorRail）与长回复大纲浮层（MessagesOutlineFloater）的接线，随合并进入本 fork 后用户端丢失该能力。律师用户在长对话中依赖左缘刻度尺快速回看/跳转某轮提问，需求方要求恢复。

## What Changes

- Revert f763bbf7 的锚点/大纲接线删除：恢复 MessagesAnchorRail 组件、Messages 的 RAF 活跃锚点追踪、MessagesTimeline 的大纲浮层接线与相关测试。
- 保留 f763bbf7 之后落地的 explore-inline 视觉改版与 ToolMarkerShell 展开箭头（该提交捆绑的无关改动不回退）。
- 样式与 i18n 键在 fork 拆分文件（messages.status-shell.css、messages-outline-floater.css、locales part1）中原本未被删除，直接复用。

## Impact

- Frontend only: `src/features/messages/components/*`。
- No DB/backend changes.
- 后续上游合并需警惕该删除被再次带入（合并半丢失检测清单已含 messages 组件）。
