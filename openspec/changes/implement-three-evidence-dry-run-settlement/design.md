# implement-three-evidence-dry-run-settlement Design

## 设计摘要

This change implements Phase 1 of `design-three-evidence-turn-settlement`: a frontend-only pure decision helper plus dry-run diagnostics. It deliberately does not change the normal completion path and does not clean lifecycle state.

## Architecture

```text
existing terminal/progress/state observations
  -> build TurnSettlementEvidence snapshot
  -> evaluateTurnSettlement(evidence, policy, nowMs)
  -> record bounded dry-run diagnostic
  -> existing lifecycle behavior continues unchanged
```

The helper is a pure function:

- Input: scoped evidence, rollout policy, caller-provided `nowMs`.
- Output: decision action, reason, scope match, accepted evidence classes, bounded diagnostics.
- No side effects: no store writes, no Tauri/backend calls, no debug-log writes, no wall-clock reads.

## Implementation Shape

Recommended frontend module:

- `src/features/threads/utils/turnSettlementDecision.ts`
- `src/features/threads/utils/turnSettlementDecision.test.ts`

Expected exported types:

- `TurnSettlementEvidence`
- `TurnSettlementPolicy`
- `TurnSettlementDecision`
- `evaluateTurnSettlement`
- `DEFAULT_TURN_SETTLEMENT_POLICY`

Decision action set:

- `settle`
- `reject`
- `defer`
- `keep-running`
- `request-reconciliation`
- `cleanup-residue`

For Phase 1 integration, callers MUST treat all actions as dry-run observations. Even if the helper returns `cleanup-residue`, the integration records `wouldCleanupResidue` only.

## Decision Order

1. **Scope gate**
   - Verify workspace, engine, thread, foreground owner.
   - Verify turn id or alias where required.
   - Verify runtime lease when both incoming and current leases are known.
   - Missing or mismatched scope returns `reject` or `defer`.

2. **Progress protection**
   - If no terminal evidence exists and progress is fresh, return `keep-running` with `progress-protected`.

3. **Terminal arbitration**
   - Matched terminal evidence with matching active state returns `settle`.
   - Matched terminal evidence with state still busy returns `cleanup-residue`.
   - Runtime-ended may return `settle` only when policy permits degraded runtime-ended settlement and scope is matched.

4. **Missing terminal handling**
   - No terminal + stale/absent progress returns `request-reconciliation` when policy permits status-query reconciliation.
   - If reconciliation is disabled, return `defer`, not `settle`.

## Dry-Run Integration

Candidate existing hooks:

- `src/features/threads/hooks/useThreadTurnEvents.ts`
- `src/features/threads/hooks/useThreadEventHandlers.ts`

Integration should be minimal:

- Build evidence from already available thread/session/turn diagnostics.
- Call the helper where terminal settlement attempts or suspected foreground residue are already observed.
- Emit a bounded debug entry and rely on existing error-log persistence rules.
- Avoid adding high-volume logs for ordinary stream chunks.

## Content Safety

Dry-run records may include:

- ids, engine, source method, action, reason, booleans, status enum, timestamps, age, sequence, bounded reason.

Dry-run records must not include:

- full user prompt, assistant output, tool output, command stdout/stderr, file diff, auth files, secrets.

## Rollout Boundary

This change is Phase 1 only:

- No feature flag for cleanup is needed because cleanup is not executed.
- No backend status query is executed.
- No missed terminal replay is executed.
- Existing normal completion path is not blocked or replaced.

## Validation

- Focused unit tests for pure helper decision matrix.
- Existing focused thread/debug tests if integration touches hooks.
- `npm run typecheck`.
- Focused `vitest` for touched frontend files.
