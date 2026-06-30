# Proposal: 修复 Git Diff 统计显示漂移

## Why

右侧 Git Diff 面板的文件行统计依赖 `get_git_status` 返回的
`stagedFiles` / `unstagedFiles`。remote daemon 路径当前会把 additions/deletions
写成 `0`，导致同一份 `CHANGELOG.md` 在消息侧显示 `+6 -0`，右侧 Git 面板却显示
`+0 -0`。

同时，右侧文件行 diff badge 在过万数字下容易被布局压缩或不显示，影响大变更文件的
可读性。

## What Changes

- daemon `get_git_status` 与 local Tauri 路径保持一致，按 staged/workdir 分别计算
  file stats，并保留 heavy path / large file guard。
- frontend canonical Git change merge 在 status stats 为 `0/0` 且 matching diff 有非零统计时，
  使用 diff 内容补齐 stats，作为跨 backend 的兼容兜底。
- Git Diff 文件行 badge 对过万数字使用 compact display，并通过 `aria-label` / `title`
  保留精确计数。

## Impact

- Affected spec: `git-panel-diff-view`
- Affected code:
  - `src-tauri/src/bin/cc_gui_daemon/git.rs`
  - `src/features/git/utils/gitChangeModel.ts`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/git/components/GitDiffPanelFileSections.tsx`
  - `src/styles/diff.css`
