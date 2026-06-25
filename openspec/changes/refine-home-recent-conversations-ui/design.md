## Overview

本次只调整首页 `HomeChat` 的 Recent presentation：从首页删除最近会话入口。数据 props 仍保留在组件 API 中，避免本次页面级 UI 调整扩散到上游 shell wiring。

## Architecture

- `HomeChat.tsx`
  - 删除 recent conversations section render。
  - 不再消费 `latestAgentRuns` / `isLoadingLatestAgents` / `onSelectThread`。
  - 保留 props type 以兼容当前父层调用。
- `home-chat.css`
  - 删除 `home-chat-recent-*` selectors。
- i18n
  - 删除本次新增的 recent project count / untitled 文案。

## Data Flow

```text
latestAgentRuns
  -> ignored by HomeChat render
  -> no recent section
```

## Error Handling

- `HomeChat` 不渲染该入口，因此不需要对 recent row 做空值 fallback。
- 上游仍可继续维护 recent data 给其他 surfaces 使用。

## UI Notes

首页不展示 Recent 区，主视觉回到 engine mark、title、workspace selector、branch label 与 Composer。

## Testing

- 更新 focused test，传入 `latestAgentRuns` 时断言首页不展示 recent conversation 文案和会话标题。
- 保留 workspace picker virtualization 等既有测试。
