## Context

`useQueuedSend` owns queued follow-up dispatch. For Codex, queued follow-ups can be sent directly to the current thread after the previous turn ends. The frontend needs a visible local continuity row because the authoritative history user message can lag behind the runtime send.

`useThreadRealtimeHistoryReconcile` schedules post-turn refreshes. If it refreshes while an optimistic queued user bubble is pending, a stale history snapshot can replace the local state and temporarily remove the just-sent user bubble.

## Design Goals

- Keep the latest queued follow-up visible from dispatch until authoritative history catches up.
- Preserve idempotency: one visible user bubble, not duplicate optimistic and history rows.
- Keep the logic feature-local and pure where possible.
- Avoid putting extra work into the Messages live rendering hot path.

## Decisions

### Decision 1: create a thread-scoped queued handoff bubble

When a non-command Codex queued message is flushed, `useQueuedSend` stores a `queued-handoff-*` user message projection for the active thread. The projection includes text, images, collaboration mode, selected agent metadata, and browser context attachment metadata when present.

### Decision 2: append only if no equivalent user observation exists

`appendQueuedHandoffBubbleIfNeeded` compares the queued bubble against existing user observations using normalized comparable user-message keys. If canonical history already contains an equivalent user message, the optimistic row is not appended.

### Decision 3: defer Codex history reconcile while optimistic user bubble is pending

`useThreadRealtimeHistoryReconcile` checks `hasPendingOptimisticUserBubble` before the first reconcile attempt. If a pending optimistic user bubble exists, reconcile is delayed to a retry window instead of replacing state with a stale snapshot.

### Decision 4: canonical history wins when it catches up

When the refreshed history contains the matching user message, reconciliation replaces the optimistic row with the authoritative history item. The final state must contain exactly one matching user message and no `optimistic-user-*` residue.

## Risks

- Optimistic bubble could linger if history never catches up. Mitigation: handoff bubble has a TTL and reconcile retries remain bounded by existing scheduling.
- Overmatching could hide a distinct user message. Mitigation: matching uses normalized text/images semantics rather than raw substring-only checks.
