# Add Thread Hover Preview

## Why

左侧会话列表目前只展示单行标题和少量状态。用户需要类似 Codex app 的轻量悬浮预览，在不进入会话、不扩大侧栏密度的情况下快速判断会话内容和状态。

## What Changes

- 在线程行 hover/focus 时展示富预览卡片。
- 预览卡复用普通线程与置顶线程，显示标题、状态、模型/来源、时间与工作区路径。
- 保持现有点击、右键菜单、pin/delete popover 行为不变。

## Impact

- Frontend only: `src/features/app/components/*` and `src/styles/sidebar.css`.
- No DB/backend changes.
