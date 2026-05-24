## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 8/8 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `useFileExternalSync`、external change state machine、FileViewPanel external-change banner/tests 与 live preview debounce/manual refresh path 已存在。
- **Next action**: 归档前确认 file external sync focused tests 与 live edit preview smoke。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Markdown 文件预览在主窗口文件模块中会被后台 external-change polling 定时刷新，导致阅读位置和渲染状态被周期性扰动。该行为把“打开文件阅读”和“显式 live preview/外部同步”混为一谈，需要收敛到稳定阅读默认值。

## 目标与边界

- 修复主窗口文件模块默认开启外部变更监控导致的 `.md` preview 周期刷新。
- 保留显式 live edit preview 开启时的文件变更感知能力。
- 保留 detached file explorer 既有外部变更检测契约，本次不扩大到 backend watcher 机制重构。

## 非目标

- 不重写 Markdown renderer、KaTeX、Mermaid 或代码高亮链路。
- 不修改 Tauri watcher / polling backend 实现。
- 不改变脏 buffer 的外部变更冲突保护语义。

## What Changes

- 主窗口 file view 的 external-change monitoring 默认关闭。
- 主窗口 file view 仅在 live edit preview 等显式意图开启时启用 external-change monitoring。
- 增加回归测试，防止“只要打开文件就开始 polling readWorkspaceFile”的行为回退。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-view-rendering-runtime-stability`: 主窗口 file preview 默认必须保持稳定阅读快照，不能因打开文件本身触发后台文件内容 polling。
- `codex-chat-canvas-live-edit-preview`: live edit preview 继续作为显式 opt-in 能力，并可作为主窗口外部变更监控的启用条件。

## Impact

- Affected frontend code:
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - focused file-view/app-shell tests
- APIs/dependencies:
  - No new dependency.
  - No Tauri command signature change.
- Systems:
  - 主窗口文件模块默认阅读体验更稳定。
  - detached file explorer 外部同步行为保持原 contract。

