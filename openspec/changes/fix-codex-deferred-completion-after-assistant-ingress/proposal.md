## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 7/7 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `useThreadEventHandlers` 记录 deferred completion，assistant stream ingress 到达后释放 completion；测试覆盖 Codex assistant stream ingress before turn completion。
- **Next action**: 归档前补 realtime/codex event focused tests 与 OpenSpec validation。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Codex long turns can leave the UI in `isProcessing=true` after the visible assistant answer has arrived when `turn/completed` is deferred behind stale collaboration child-agent blockers. The symptom is an already-rendered final-looking reply with the composer still showing "generating response", which becomes more likely in long conversations that use `spawn_agent` / `wait_agent`.

## 目标与边界

- Goal: ensure a Codex turn settles when `turn/completed` arrives after assistant stream ingress, even if collaboration child status snapshots remain stale.
- Boundary: keep the existing conservative defer behavior for turns with no assistant output evidence.
- Boundary: preserve diagnostic evidence for remaining blockers instead of hiding stale child-agent state.

## What Changes

- Treat Codex `turn/completed` plus prior assistant stream ingress (`delta` or snapshot) as sufficient terminal evidence to bypass deferred-completion blockers.
- Keep existing `assistant completed` and child terminal update paths unchanged.
- Add a focused regression test covering assistant delta + stale child blocker + `turn/completed`.
- No breaking changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-realtime-canvas-message-idempotency`: terminal Codex realtime settlement must not remain blocked by stale collaboration child-agent snapshots once assistant stream ingress and `turn/completed` are both observed.

## 非目标

- No Rust runtime event rewrite.
- No Markdown or message rendering change.
- No broad collaboration-mode policy redesign.
- No change to turns that have no assistant text ingress before `turn/completed`.

## 技术方案选项与取舍

| Option | Summary | Trade-off |
|---|---|---|
| A | Wait only for `item/completed agentMessage` or child terminal updates | Matches current behavior, but reproduces the spinner hang when completion evidence is missing. |
| B | Never defer Codex `turn/completed` behind child blockers | Strongly terminal, but loses the existing conservative protection for no-output child-agent flows. |
| C | Bypass defer only when `turn/completed` arrives after assistant stream ingress | Fixes the visible-answer spinner hang while preserving no-output deferral semantics. |

Chosen: Option C.

## 验收标准

- Given a Codex turn with active `collabAgentToolCall`, assistant stream delta, and `turn/completed`, the thread must call `markProcessing(threadId, false)` and clear `activeTurnId`.
- Given a Codex turn with active `collabAgentToolCall` and no assistant stream ingress, existing deferral behavior must remain unchanged.
- Diagnostic log must retain `remainingBlockers` for stale child-agent evidence.

## Impact

- Frontend hook: `src/features/threads/hooks/useThreadEventHandlers.ts`
- Regression test: `src/features/threads/hooks/useThreadEventHandlers.test.ts`
- No dependency, API, or database impact.
