## Context

The existing Codex settlement path assumes that `turn/completed` eventually reaches the same frontend thread that owns the active turn. The earlier `fix-codex-deferred-completion-after-assistant-ingress` change made that event strong enough to bypass stale child-agent blockers after assistant ingress, but it still depends on the terminal event being observed and routed correctly.

The new symptom points to a different failure mode: in multi-session runs, a background Codex thread can receive visible assistant completion evidence while another thread is highlighted. Some realtime branches can fall back to the active highlighted thread when the event payload lacks `threadId`, while assistant completion evidence only flushes an already-deferred `turn/completed`; it does not create a recovery path when no matching terminal event was deferred. Switching back later can also preserve the stale `isProcessing` state because processing threads intentionally skip normal refresh/resume.

## Goals / Non-Goals

**Goals:**

- Keep Codex terminal and reconciliation decisions owned by event `threadId` / `turnId` evidence.
- Recover background turns that have assistant completion evidence but never receive a matching foreground terminal settlement.
- Allow one lightweight reconcile when activating a Codex thread that is still processing with terminal-drift evidence.
- Preserve existing long-running/no-output Codex behavior and stale collaboration child-agent protection.

**Non-Goals:**

- Do not change non-Codex engine behavior.
- Do not reduce Codex no-progress or execution-active timeout windows.
- Do not settle a turn solely because assistant text is visible.
- Do not introduce new runtime IPC or persistence unless current frontend event identity is insufficient.

## Decisions

### Decision 1: Terminal ownership is event-scoped, not active-thread-scoped

Codex terminal-like realtime events must resolve their target thread from explicit event identity, active turn mapping, or an existing thread-owned diagnostic record. They must not use the currently highlighted thread as a fallback for terminal settlement or terminal reconciliation.

Alternatives considered:

- Use active thread fallback consistently: simple, but it explains the multi-session bug because focus is not runtime ownership.
- Drop events without `threadId`: safe for mutation, but misses recovery opportunities when the event contains a usable `turnId` already mapped to a thread.
- Maintain a narrow ownership map keyed by turn/event identity: best compatibility because it avoids cross-thread mutation and still recovers known background turns.

### Decision 2: Assistant completion starts bounded reconcile, not terminal success

When Codex receives `completeAgentMessage` or equivalent assistant completion evidence for a processing thread, the frontend records that evidence and schedules a short delayed terminal reconciliation if no matching `turn/completed` has settled the turn. The reconcile must reuse the existing history-detail path and clear processing only after authoritative history/terminal evidence confirms the turn is no longer active.

Alternatives considered:

- Immediately clear `isProcessing`: too broad; a parent turn can still have running tool or child-agent work.
- Wait for the 600-second no-progress window: preserves safety but keeps the user-facing stuck state for already-finished replies.
- Schedule one thread-owned reconcile: bounded, idempotent, and aligned with existing terminal history reconciliation.

### Decision 3: Activation can trigger one lightweight stale-processing reconcile

When a user switches back to a Codex thread that remains `isProcessing=true`, the app should not run the full normal refresh path blindly, but it can run a lightweight terminal-drift reconcile if the thread has assistant completion evidence, suspected terminal drift, or a stale processing diagnostic.

Alternatives considered:

- Keep skipping all refresh when processing: protects active work, but preserves already-stuck states indefinitely.
- Always refresh processing threads on activation: risks disrupting live long-running work.
- Gate activation reconcile on terminal-drift evidence: targeted and compatible with active-work protection.

## Risks / Trade-offs

- [Risk] Assistant completion can arrive before tool work truly finishes. → Mitigation: assistant completion schedules reconcile only; it does not clear processing by itself.
- [Risk] Late terminal events for an old turn could clear a successor turn. → Mitigation: all settlement and reconcile checks must compare `turnId` when available and ignore stale old-turn evidence for a different active successor.
- [Risk] Missing `threadId` events become dropped rather than routed to active session. → Mitigation: only terminal-like mutation is denied active fallback; non-terminal existing rendering paths may keep their current compatibility behavior.
- [Risk] Reconcile can duplicate existing terminal history refresh. → Mitigation: keep an idempotent per-thread/per-turn scheduling key and reuse current delayed history reconcile infrastructure.

## Migration Plan

1. Add tests that reproduce background A / highlighted B completion drift.
2. Add thread-owned identity lookup and deny active-thread fallback for Codex terminal/reconcile paths.
3. Add assistant-complete follow-up reconcile scheduling with a bounded delay and idempotent key.
4. Add activation-time lightweight reconcile for stale processing Codex threads with terminal-drift evidence.
5. Run focused Vitest suites plus `openspec validate fix-codex-background-turn-terminal-reconciliation --strict --no-interactive`.

Rollback: remove the new reconcile scheduling and activation hook while retaining the previous `turn/completed` stale-child bypass. This reverts to the last known behavior without affecting non-Codex engines.

## Open Questions

- Whether every relevant Codex `completeAgentMessage` normalized event currently includes `turnId`; if not, implementation should fall back to thread-owned assistant evidence but must not fall back to the highlighted thread for terminal settlement.
