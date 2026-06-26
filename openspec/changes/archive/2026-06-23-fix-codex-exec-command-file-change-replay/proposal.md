## Why

Codex provider sessions can record real file mutations as `exec_command` tool calls instead of `apply_patch` tool calls. A MiniMax-backed Codex session in `springboot-demo` wrote eight files through shell heredoc / inline shell commands, while the conversation curtain only replayed ordinary command cards. The right-side Git panel still showed the working tree changes because it reads Git state directly, but the message curtain did not show the corresponding `File changes` cards.

This created a cross-surface mismatch: Git diff state was correct, while local Codex history replay lost mutation semantics for successful shell-write commands.

## 目标与边界

- Restore Codex local session replay parity for shell-backed file mutations.
- Keep the change limited to conversation item normalization / local history replay.
- Reuse the existing shell command file-change inference helper rather than adding a second parser.
- Preserve read-only command cards such as `git status`, `rg`, `cat`, and test commands as `commandExecution`.

## 非目标

- 不解析所有 shell 语法，不尝试成为完整 shell interpreter。
- 不从 arbitrary command output 推断文件变更，避免 `git status --short`、日志或测试输出被提升为 mutation fact。
- 不改变右侧 Git panel 的 working tree diff 数据源。
- 不改变 Codex CLI / provider / model 的工具调用格式。

## What Changes

- `commandExecution` conversion now treats successful non-`apply_patch` commands as `File changes` only when command text itself contains recognized mutation signals:
  - write redirection such as `cat > path`, `printf ... > path`, heredoc target writes
  - append redirection as `modified`
  - delete commands such as `rm path`
  - existing narrow create command support such as `touch path`
- `apply_patch` remains on the existing richer path so patch diffs and success markers keep current behavior.
- Temporary patch artifacts such as `.diff`, `.patch`, `_patch.diff`, and `_patch.patch` are filtered in the shell-mutation path so "write patch file, but do not apply it" remains an ordinary command card.
- Focused Vitest coverage locks the converter and Codex local replay behavior.

## 技术方案取舍

| Option | 方案 | 取舍 |
|---|---|---|
| A | 只依赖 `apply_patch` / native file-change tool | 最保守，但无法覆盖 MiniMax / shell heredoc 写文件的真实 mutation。 |
| B | 从成功 `exec_command` 的命令文本推断 narrow mutation tokens | 覆盖真实问题，复用已有 parser，误报面可控。采用。 |
| C | 从命令 output / Git status output 推断所有 changed files | 表面更完整，但容易把只读 `git status`、测试输出、日志输出提升为 mutation fact。放弃。 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-tool-card-persistence`: Codex local session replay must preserve mutation semantics for successful shell-backed file writes/deletes while keeping read-only command output as command cards.

## Impact

- Frontend normalization:
  - `src/utils/threadItems.ts`
  - `src/utils/threadItemsFileChanges.ts`
- Tests:
  - `src/utils/threadItems.test.ts`
  - `src/features/threads/loaders/historyLoaders.test.ts`
- Backend / Tauri commands: no change.
- UI layout / Git panel: no change.

## 验收标准

- Codex local history containing successful `exec_command` heredoc writes replays a `File changes` card with the target path.
- Successful `apply_patch` command replay keeps existing file-change diff enrichment.
- A command that only writes a temporary patch artifact without applying it remains a `commandExecution` card.
- `git status` / read-only command output is not promoted to `File changes`.
- Focused Vitest suites pass for `threadItems`, `threadItemsFileChanges`, and `historyLoaders`.
