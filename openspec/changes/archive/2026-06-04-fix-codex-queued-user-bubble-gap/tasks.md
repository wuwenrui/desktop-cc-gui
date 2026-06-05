## 1. OpenSpec Contract

- [x] 1.1 Create proposal for queued Codex user bubble continuity.
- [x] 1.2 Create design for handoff bubble and history reconcile delay.
- [x] 1.3 Add delta spec for `codex-queued-user-bubble-continuity`.

## 2. Frontend Continuity Behavior

- [x] 2.1 Build a visible queued handoff user bubble for non-command Codex queued follow-ups.
- [x] 2.2 Preserve queued message metadata on the handoff bubble.
- [x] 2.3 Avoid appending the handoff bubble when canonical history already contains an equivalent user message.
- [x] 2.4 Delay Codex realtime history reconcile while a pending optimistic user bubble exists.
- [x] 2.5 Replace optimistic bubble with authoritative history item once history catches up.

## 3. Regression Coverage

- [x] 3.1 Cover queued handoff bubble creation and direct Codex thread send.
- [x] 3.2 Cover handoff bubble equivalence and metadata preservation utilities.
- [x] 3.3 Cover history reconcile keeping exactly one visible queued follow-up user bubble.
- [x] 3.4 Run focused queued send and reconcile tests.
- [x] 3.5 Run `npm run typecheck`.
- [x] 3.6 Run strict OpenSpec validation.
