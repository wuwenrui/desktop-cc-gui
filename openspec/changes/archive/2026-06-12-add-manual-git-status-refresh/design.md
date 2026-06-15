# Design: Add Manual Git Status Refresh

## Context

Git status 已由 `useGitStatus(activeWorkspace)` 统一管理，内部封装：

- `getGitStatus(workspaceId)` bridge read
- active/background polling cadence
- workspace cache
- stale response guard
- non-git repository fallback

侧边 Git Diff panel 已经通过 `useLayoutNodes` 接收 `queueGitStatusRefresh`，并将其作为 `onRefreshGitStatus` 传入 `GitDiffPanel`，但 `GitDiffPanel` 只把该 callback 继续传给 editable diff review surface，没有在用户截图中的仓库摘要行提供直接入口。

## Decision

在 Git Diff panel 的 compact repository header 中增加一个 refresh icon button：

```text
root folder name -> refresh icon -> section count -> additions/deletions -> section actions
```

按钮点击只调用现有 `onRefreshGitStatus()`，不引入新的 state machine。

## Data Flow

```text
User clicks refresh icon
  -> GitDiffPanel.onRefreshGitStatus
  -> useLayoutNodes options.queueGitStatusRefresh
  -> useGitPanelController.queueGitStatusRefresh
  -> useGitStatus.refresh
  -> services/tauri.getGitStatus
```

## UI Contract

- Button uses `RefreshCw` from `lucide-react`.
- Button exposes `aria-label` and `title` from `git.refreshStatus`.
- Button is rendered inside each compact repository header so the affordance stays visible next to the shown repository root regardless of staged/unstaged section ordering.
- Button stops click propagation so tree folder expand/collapse is not triggered accidentally.
- Button is visually icon-only and replays a short spin animation when clicked.

## Alternatives Considered

### Add a new Tauri command

Rejected. `get_git_status` already exists and `useGitStatus.refresh()` already handles the request/cache/stale response contract.

### Shorten the polling interval

Rejected. This increases background load and does not give the user deterministic control. Manual refresh solves the observed latency without changing cadence.

### Place refresh in the hover toolbar

Rejected. The screenshot asks for the repo summary row location, and a hover-only control would be harder to discover when status is stale.

## Validation

- Component test clicks the refresh button and asserts callback invocation.
- TypeScript typecheck validates prop expansion.
- OpenSpec strict validation validates artifacts.
