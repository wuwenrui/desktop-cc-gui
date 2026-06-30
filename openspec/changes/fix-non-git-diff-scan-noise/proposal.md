# Proposal: 非 Git 工作区不触发 Git Diff 扫描噪声

## Why

非 Git workspace 当前仍可能触发 `get_git_diffs`，daemon/Tauri command 返回
`not a git repository` 后会进入 runtime notice，形成重复的“内部命令失败”提示。
这类 workspace 没有 Git diff 语义，重复扫描和错误写入都没有用户价值。

## What Changes

- Git status 明确返回 `isGitRepository: false` 后，Git Diff preload / panel diff hook
  不再调用 `get_git_diffs`。
- `get_git_diffs` 在 local Tauri 和 daemon 路径中遇到无 `.git` marker 的 workspace
  时返回空 diff 列表，而不是冒泡为 command failure。
- 前端如果收到 legacy/non-git diff error，也将其折叠为空 diff，不写入 hook error，
  不输出 `console.error`，并记住该 workspace 后续不重复扫描。
- Git Diff 依赖的 Git status polling 前台与 background 检测间隔统一为 15s，
  避免不同模式刷新 cadence 不一致。

## Impact

- Affected spec: `git-panel-diff-view`
- Affected code:
  - `src/features/git/hooks/useGitDiffs.ts`
  - `src/features/git/hooks/useGitStatus.ts`
  - `src/features/app/hooks/useGitPanelController.ts`
  - `src-tauri/src/git/commands.rs`
  - `src-tauri/src/bin/cc_gui_daemon/git.rs`
