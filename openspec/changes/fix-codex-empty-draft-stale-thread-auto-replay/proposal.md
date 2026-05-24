## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 11/11 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `codexConversationLiveness`、`useThreadMessaging` stale-thread retry、thread action stale recovery 与 related diagnostics tests 已存在。
- **Next action**: 归档前确认 stale thread recovery focused tests、liveness guard 与 strict validation。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Newly created Codex conversations can occasionally keep a provisional `threadId` that was never durably accepted by Codex state. When the user sends the first prompt later, `thread not found` currently may surface as a stale-session recovery card even though the source is only an empty draft.

This change makes the existing first-turn draft contract executable across the send and recovery-card paths: empty drafts may be replaced; durable conversations must remain conservative.

## 目标与边界

- Fix only Codex first-turn empty draft stale binding failures.
- Preserve durable stale-thread recovery for conversations with accepted turns, assistant responses, tool activity, approvals, generated images, or unknown durable state.
- Reuse existing Codex liveness and stale-thread recovery helpers where possible.

## 非目标

- Do not change Claude, Gemini, OpenCode, or mail-session behavior.
- Do not globally auto-create a new Codex thread for every `thread not found`.
- Do not alter Codex runtime acquisition, proxy handling, or websocket retry policy.
- Do not persist a durable stale alias for an unverified empty draft replacement.

## What Changes

- Extend empty Codex draft replacement so first-send `thread not found` can create a fresh Codex thread and replay the current prompt once.
- Ensure the recovery-card / resume path does not bypass first-turn draft semantics when no durable local activity exists.
- Keep existing stale-thread recovery card semantics for durable or unknown conversations.
- Add focused regression tests for empty draft replacement and durable-session non-replacement.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-conversation-liveness`: Clarify that first-turn draft fallback applies to recovery/resume surfaces that occur before the current prompt is accepted.
- `codex-stale-thread-binding-recovery`: Clarify that automatic fresh replacement is limited to disposable first-turn drafts and must replay at most once.

## Impact

- Frontend Codex thread messaging and recovery hooks.
- Runtime reconnect card behavior only through existing callbacks and classified recovery state.
- Focused Vitest coverage for thread messaging/actions and reconnect UI.
- No new dependencies.

## 技术方案取舍

| 方案 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- |
| 全局 `thread not found` 自动新建 | 实现最快 | 会误伤已有历史会话，可能隐藏真实数据恢复失败 | 拒绝 |
| 只在 Codex empty first-turn draft 上 fresh-create + replay | 影响面小，符合现有 liveness spec | 需要严格事实判断与测试 | 采用 |
| 只改 UI copy 让用户手动点恢复 | 风险低 | 没解决第一条 prompt 的可用性问题 | 不采用 |

## 验收标准

- 空 Codex draft 的 first prompt 遇到 `thread not found` 时自动 fresh-create 并发送，不展示 stale old-session recovery card 作为主路径。
- 有 durable activity 或 accepted-turn fact unknown 的 Codex 会话仍走保守 stale recovery。
- Fresh fallback 不记录“旧 thread 已恢复”的 durable alias。
- Focused Vitest 覆盖新旧边界并通过。
