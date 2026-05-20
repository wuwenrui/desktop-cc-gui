## Context

Current Codex turn settlement has a defensive deferral path: when `turn/completed` arrives while `collabAgentToolCall` or wait-style collaboration tool snapshots still look active, frontend settlement waits for either child terminal evidence or final assistant completion evidence. This protects no-output child-agent flows, but it also creates a hang when assistant output is already visible through stream deltas and the child status snapshot never transitions to terminal.

The screenshot symptom maps to this state: visible assistant text exists, `isProcessing` remains true, and the composer still shows generation progress.

## Goals / Non-Goals

**Goals:**

- Let Codex turns settle when both assistant stream ingress and `turn/completed` are observed.
- Preserve diagnostics for stale collaboration blockers.
- Keep no-output child-agent deferral unchanged.

**Non-Goals:**

- No runtime protocol rewrite.
- No rendering or Markdown fallback.
- No broad collaboration-mode redesign.

## Decisions

### Decision 1: Use assistant stream ingress as terminal-bypass evidence only after `turn/completed`

Alternatives:

- Wait for `item/completed agentMessage`: too strict; this is the missing event in the failing sequence.
- Ignore child blockers for all Codex `turn/completed`: too broad; no-output child-agent flows lose the conservative guard.
- Require `turn/completed` plus prior assistant ingress: narrow and matches the user-visible hang.

Chosen approach: when blockers exist and `assistantCompletedAt` is absent, bypass deferral if `firstDeltaAt !== null` or `deltaCount > 0`.

### Decision 2: Keep a forced diagnostic record instead of deleting blockers

The remaining blockers are still useful evidence. The bypass diagnostic records `remainingBlockers`, `deltaCount`, and `firstDeltaAtMs` so a later backend/runtime investigation can distinguish a real child status leak from frontend settlement behavior.

### Decision 3: Regression test at hook layer

The failing behavior is in `useThreadEventHandlers`, before message rendering. A hook-level Vitest gives the smallest faithful reproduction and avoids needing a full Tauri/runtime simulation.

## Risks / Trade-offs

- [Risk] A child agent may genuinely still be running after assistant text appears. → Mitigation: settlement only bypasses after `turn/completed`, which is the authoritative terminal event for the parent turn; no-output cases still defer.
- [Risk] Stale blocker visibility is reduced. → Mitigation: diagnostics retain blocker details under `turn-completed-deferred-bypassed`.
- [Risk] Runtime may omit both completion and stream ingress. → Mitigation: existing deferral behavior remains unchanged for that path.

## Migration Plan

1. Add hook regression test for assistant delta + stale child blocker + `turn/completed`.
2. Add narrow bypass in Codex deferral logic.
3. Validate with focused Vitest, typecheck, lint, and OpenSpec validation.

Rollback: remove the new bypass branch and its regression test.

## Open Questions

- Should the runtime eventually normalize Codex `turn/completed` with final assistant text into `item/completed agentMessage` for all engines? This is intentionally out of this bugfix because the frontend can already settle safely with existing evidence.
