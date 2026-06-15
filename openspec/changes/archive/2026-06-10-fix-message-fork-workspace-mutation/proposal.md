# Fix Message Fork Workspace Mutation

## Problem

消息幕布里的 Fork action 允许用户从某条历史 user message 创建分支，并在 Codex 场景下选择不同 provider。该入口复用了 `forkSessionFromMessageForWorkspace`，但没有传入 rewind mode，于是下游默认使用 `messages-and-files`。

结果是：Fork 之前会执行 workspace restore 逻辑。该逻辑会基于目标消息后的 file-change facts 写回文件、删除文件，或在无法反向应用 patch 时调用 `revertGitFile`。当当前工作区存在未提交变更时，用户会看到“Fork 把文件重置/改没了”的效果。

这不是 Git reset 链路触发，而是 message-level Fork 误走了 Rewind 的文件恢复默认策略。

## Goals

- Message-tail Fork MUST be a conversation/session operation and MUST NOT mutate workspace files.
- Codex provider selection during message Fork MUST only affect the child conversation provider binding.
- Explicit Rewind flow keeps its existing `messages-and-files` / `messages-only` / `files-only` behavior.

## Non-Goals

- Do not remove workspace restore support from explicit Rewind.
- Do not change backend `fork_thread` provider binding semantics.
- Do not change Git panel reset/revert commands.

## Approach

- Force the message-tail Fork adapter to call `forkSessionFromMessageForWorkspace` with `mode: "messages-only"`.
- Add a focused adapter contract check so provider-selected message Fork cannot silently fall back to default `messages-and-files`.

## Risks

- Users who expected Fork from message to also restore files now need to use explicit Rewind. This is the safer boundary: the Fork dialog does not present file mutation review or dirty-worktree warnings.
