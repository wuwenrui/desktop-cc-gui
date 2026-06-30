## Why

用户已明确要求删除“用户气泡吸顶条”相关代码。该能力在长对话中额外占用幕布顶部空间，且当前已有消息锚点和正常用户气泡可承担定位语义，继续保留会增加 UI visibility、消息窗口、CSS 和测试链路的复杂度。

## 目标与边界

- 删除对话幕布顶部的 sticky user bubble / history sticky header 能力链路。
- 从 Settings > Basic > Client UI visibility 移除对应开关。
- 保留普通用户消息气泡、消息锚点、上下文来源卡片和消息窗口裁剪能力。
- 旧 client store 中残留的 `curtain.stickyUserBubble` 偏好应被当作 unknown key 忽略。

## 非目标

- 不删除普通用户消息气泡。
- 不删除消息锚点栏。
- 不删除 Composer 上方上下文来源卡片。
- 不引入新的设置项、迁移脚本或后端/Rust contract。

## What Changes

- **BREAKING**: `curtain.stickyUserBubble` 不再是 supported client UI visibility control。
- 对话幕布不再渲染 sticky user bubble / history sticky header。
- 消息 live window 不再为了 sticky header 暴露 latest ordinary user question candidate；若为保持普通用户消息行可见而保留 source row，该行不得产生吸顶 UI。
- 删除对应 CSS、i18n、说明文档和测试引用。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `client-ui-visibility-controls`: supported controls 移除 `curtain.stickyUserBubble`，旧偏好作为 unknown key 忽略。
- `conversation-history-user-bubble-pinning`: 删除 completed history 的 sticky user question header contract。
- `conversation-live-user-bubble-pinning`: 删除 realtime processing 的 sticky user question header contract。

## Impact

- Frontend: `src/features/client-ui-visibility/**`, `src/features/layout/hooks/useLayoutNodes.tsx`, `src/features/messages/components/**`, `src/styles/messages*.css`, `src/features/settings/**`, `src/features/client-documentation/**`, `src/i18n/locales/**`, focused Vitest tests.
- Runtime/API: no Tauri command, storage schema, IPC, or Rust change.
- Dependencies: no new dependency.

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| 推荐：彻底删除能力链路 | 移除 setting control、prop、render JSX、CSS 和 sticky 专属 helper/tests | 符合“删掉相关代码”，减少长期维护面；旧偏好自然被 normalize 忽略 |
| 备选：仅默认隐藏 | 保留代码，只把默认 preference 设为隐藏 | 改动小，但相关代码仍存在，且用户明确要求删除 |

## 验收标准

- Settings 的 Client UI visibility 不再出现 “Sticky user bubble / 用户气泡吸顶”。
- `Messages` 不再接收或渲染 sticky user bubble/header。
- 普通用户消息仍在时间线中正常显示，消息锚点和上下文来源卡片不受影响。
- Focused tests 与 `npm run typecheck` 通过。
