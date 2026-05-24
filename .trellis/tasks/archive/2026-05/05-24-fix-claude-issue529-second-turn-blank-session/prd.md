# Fix Claude issue529 second turn blank session

## Goal

修复 GitHub issue #529 中 Claude 第二次消息后白板、会话无法切回的问题，并用本地制造的 issue-shaped session 样本覆盖 parser、catalog、frontend activation 链路。

## Linked OpenSpec Change

- `fix-claude-issue529-second-turn-blank-session`

## Requirements

- Claude issue-shaped JSONL restore 必须保留 second user、tool-use、assistant final rows。
- 缺少 per-line `session_id` 时，必须通过 filename + cwd evidence 保持 canonical session identity。
- sidebar/history reopen 过程中，已加载 readable rows 不得被 late reconcile 清空为 blank surface。
- Codex 路径不得被改动或降级。

## Acceptance Criteria

- [ ] Focused Rust test 覆盖 Issue #529 shape restore。
- [ ] Focused Rust test 覆盖 list -> load canonical identity continuity。
- [ ] Focused Vitest 覆盖 Claude reopen late reconcile 不清空 readable rows，或证明无需 frontend 修改。
- [ ] `openspec validate fix-claude-issue529-second-turn-blank-session --type change --strict --no-interactive` 通过。
- [ ] 记录验证命令与 Codex 影响边界。

## Technical Notes

- 重点文件预计在 `src-tauri/src/engine/claude_history*` 与 `src/features/threads/hooks/useThreadActions*`。
- 先测试定位，再做最小修复；避免把全局 UI fallback 当成根因修复。
