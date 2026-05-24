# Proposal: Preserve Editor Split On Topbar Session Switch

## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 7/7 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `threadEditorPreservation`、`selectedComposerSession` 与 workspace-flow/layout tests 覆盖同 workspace session switch 保留 editor split。
- **Next action**: 归档前补 topbar/session switch focused test evidence；本 change 无 design.md 属可接受轻量变更但 archive 前应说明。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

desktop workspace chat 支持“左侧聊天 + 右侧文件编辑器”的 editor split。用户在该状态下通过顶部 session tabs 切换同一 workspace 内的会话时，预期只是切换聊天上下文；已打开的文件、编辑器 tab 和 split layout 都应该继续保留。

此前 `onSelectThread` 复用了 `exitDiffView()`。这个函数名看起来只是在退出 diff，但实际会把 `centerMode` 强制切回 `chat`。结果是同 workspace 切换 session 时，右侧打开文件被隐藏，体验上等价于“切 session 自动关闭文件”。这是一个交互契约缺失，不应该依赖实现细节偶然保留。

## Goals

- 同一 workspace 内，通过 topbar session tab 切换会话时，如果当前处于 desktop editor split 且已有 active editor file，系统 MUST 保留 editor split 和已打开文件 tabs。
- 保留 editor split 时，系统只清理 diff selection，不得调用会把 `centerMode` 切回 `chat` 的 full diff exit path。
- session 切换仍必须正常更新 active workspace/thread、topbar highlight、engine selection 与 chat app mode。
- compact / phone / tablet、非 editor split、无 active editor file、跨 workspace 切换等场景保持原有保守行为，避免把旧 workspace 文件错误绑定到新 workspace。

## Non-Goals

- 不改变 session lifecycle，不删除 thread，不终止 runtime。
- 不持久化 editor tabs。
- 不实现跨 workspace editor split 保留；跨 workspace 文件归属需要独立 workspace-bound editor state 设计。
- 不改变 Git diff 列表点击打开文件的既有行为。

## What Changes

- `workspace-topbar-session-tabs` 新增一条交互约束：same-workspace topbar session switch MUST preserve active desktop editor split.
- 代码实现已落地在 commit `e4479078`：
  - 在 `onSelectThread` 中先判断是否应该保留 editor。
  - 保留 editor 时只执行 `setSelectedDiffPath(null)`。
  - 不保留 editor 时继续走原来的 `exitDiffView()` 和回 chat 行为。
- 新增 helper 和单测，防止后续把 `exitDiffView()` 重新放回 preserve-editor 分支。
- Follow-up：将同一保护扩展到非 topbar 的 session navigation 入口，包括 notification / status panel navigation、latest/sidebar-style selection、search result navigation、keyboard session cycling，避免 Codex 多会话切换时 center surface 被先打回 chat 造成闪烁。

## Capabilities

### Modified Capabilities

- `workspace-topbar-session-tabs`: 增加同 workspace session tab 切换时对 editor split 的保留契约。

## Impact

- Frontend layout orchestration:
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/app-shell-parts/threadEditorPreservation.ts`
- Tests:
  - `src/app-shell-parts/useAppShellLayoutNodesSection.test.ts`

## Acceptance Criteria

- Given desktop editor split is visible with an active file, when selecting another topbar session in the same workspace, then the file editor remains visible and keeps its open tabs.
- The same interaction must still switch the active thread and show the selected session as active.
- The preserve-editor branch must not call a full diff exit path that changes `centerMode` to `chat`.
- When no editor file is active, when in compact layout, or when switching across workspaces, existing fallback behavior remains intact.
- Regression tests cover preserve and fallback branches.
- Notification / status-panel / keyboard-cycle 等非 topbar 入口复用同一 preservation policy，不得在同 workspace editor split 切 session 时 collapse right panel 或 full exit editor/diff path。
