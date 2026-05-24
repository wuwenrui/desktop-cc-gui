## Why

Issue #529 still reports that Claude sessions can turn into a blank, non-reopenable conversation after the second message in v0.5.1, while Codex remains usable. Existing coverage proves one JSONL shape can be parsed, but it does not yet prove that the sidebar/catalog activation path keeps the same Claude session identity and a readable transcript surface.

## 目标与边界

- 修复 Claude second-or-later turn 后的 blank session / cannot switch back regression.
- 保护 session catalog、native Claude truth、frontend active thread binding 三段链路的一致性.
- 只处理 Claude history / sidebar reopen / visible transcript recovery；Codex behavior 作为对照组保持不变.

## 非目标

- 不重写 workspace session catalog 架构.
- 不引入新的全局状态库或持久化事实源.
- 不把所有 Claude 会话永久降级到重型 render fallback.
- 不修改 Codex runtime、Gemini、OpenCode 的 session loading contract.

## What Changes

- Add regression coverage for issue-shaped Claude transcripts beyond parser-only assertions.
- Harden Claude history/session activation so second-turn sessions keep readable user, tool, and assistant rows after reopen.
- Preserve catalog/sidebar session identity when Claude JSONL lacks explicit `session_id` but filename and `uuid`/`cwd` evidence are valid.
- Ensure blanking recovery stays Claude-scoped and does not clear existing readable history during late reconcile.

## 技术方案选项

| 选项 | 方案 | 取舍 |
|---|---|---|
| A | 在 UI 层遇到空消息时强制显示 fallback 文案 | 实现快，但掩盖 catalog/thread identity 断裂，容易让真实 transcript 丢失 |
| B | 在 backend Claude history + frontend activation 边界补 identity/visibility contract | 改动更精准，能解释“Codex 正常、Claude 第二轮白板”，推荐 |
| C | 重建 workspace session catalog 数据流 | 理论彻底，但风险大，超出当前 bug 修复范围 |

本变更采用 B：先用 issue-shaped 样本锁定 backend restore 与 frontend activation 的可见性，再做最小修复。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-repeat-turn-blanking-recovery`: second-or-later Claude turn blanking must preserve a readable session surface after sidebar/history reopen.
- `claude-history-transcript-visibility`: issue-shaped Claude JSONL with user/tool/assistant rows must not restore as an empty thread.
- `claude-session-sidebar-state-parity`: sidebar activation must converge to native Claude session truth without clearing readable rows during late reconcile.

## Impact

- Backend: `src-tauri/src/engine/claude_history*` tests and, if needed, parser/source fact helpers.
- Frontend: `src/features/threads/**` loader/action tests and, if needed, activation fallback logic.
- Specs: OpenSpec delta requirements and Trellis-linked task evidence.
- Validation: focused Rust tests for Claude history, focused Vitest for thread activation, `npm run typecheck` where impacted.

## 验收标准

- A locally manufactured Issue #529-style Claude session restores with the second user message, tool-use row, and final assistant text.
- A sidebar/history activation test proves the selected Claude thread remains non-empty after reopen.
- Codex path remains unchanged in focused tests.
- Strict OpenSpec validation for this change passes.
