# design-three-evidence-status-query-reconciliation Design

## Context

Phase 1 has established a pure `evaluateTurnSettlement(evidence, policy, nowMs)` helper and dry-run diagnostics. It can report `wouldRequestReconciliation` when terminal evidence is absent and progress is stale, but it deliberately cannot ask backend/runtime for truth.

The current error log sample does not yet contain `wouldRequestReconciliation` or `wouldCleanupResidue`. It does contain runtime lifecycle failures such as `stale_reuse_cleanup`, `timed out waiting for concurrent runtime acquire`, and `RUNTIME_RECOVERY_QUARANTINED`. Those are useful signals, but they are not enough to safely clean frontend loading state. Phase 2a therefore designs the status-query reconciliation contract only.

## Goals / Non-Goals

**Goals:**

- Define how the frontend lifecycle coordinator requests authoritative scoped status after Phase 1 reports reconciliation-needed.
- Define the future backend/runtime response contract and status enum.
- Define how status results become evidence for the existing pure decision helper.
- Define diagnostics that make status query attempts visible without full content.
- Keep runtime recovery/acquire diagnostics separate from settlement decisions.

**Non-Goals:**

- Do not implement any code in this change.
- Do not clear `isProcessing`, `activeTurnId`, blocker residue, runtime lease state, message content, or history.
- Do not implement terminal replay.
- Do not replace the normal terminal completion path.
- Do not treat timeout, silence, visible text, history content, or stale runtime cleanup as completed settlement.

## Decisions

### Decision 1: Phase 2a is status-query only

Phase 2a starts when the frontend has scoped State Evidence, terminal evidence is absent, and Progress Evidence is stale or absent. The only new action it may design is an authoritative status query. It must not execute cleanup even when a query later confirms terminal state; confirmed terminal status becomes Terminal Evidence and must be re-evaluated by the pure helper first.

Alternatives considered:

| Option | Why not |
| --- | --- |
| Cleanup immediately after `wouldRequestReconciliation` | `wouldRequestReconciliation` means terminal is missing; it is not terminal proof. |
| Cleanup after any `RUNTIME_ENDED` error | Runtime-ended may belong to stale cleanup or unrelated recovery, not necessarily the active turn. |
| Wait for more logs before writing design | Keeps future implementation ambiguous and invites ad hoc cleanup patches. |

### Decision 2: The query is keyed by conversation scope, not by foreground state alone

The future status query request must include:

- `workspaceId`
- `engine`
- `threadId`
- `turnId` or verified alias
- `runtimeSessionId` or `runtimeLeaseId` when available
- `requestSource`
- caller timestamp

The backend/runtime must echo the scope it used to compute the status. The frontend must compare echoed scope to the current lifecycle scope before using the response.

### Decision 3: Response statuses are bounded and conservative

Recommended future status enum:

```ts
type TurnReconciliationStatus =
  | "completed"
  | "running"
  | "failed"
  | "stalled"
  | "runtime-ended"
  | "unknown"
  | "query-failed";
```

Mapping:

| Status | Lifecycle interpretation |
| --- | --- |
| `completed` | Terminal Evidence candidate; re-run pure helper before side effects. |
| `failed` / `stalled` | Terminal Evidence candidate with error/stalled terminal kind; re-run pure helper. |
| `runtime-ended` | Terminal Evidence candidate only if scope and lease match; otherwise defer/reject. |
| `running` | Keep running; no cleanup. |
| `unknown` / `query-failed` | Defer/degraded/reconnect diagnostic; no completed settlement. |

### Decision 4: Runtime recovery failures are diagnostic context, not terminal proof

Signals like `RUNTIME_RECOVERY_QUARANTINED`, concurrent runtime acquire timeout, and `stale_reuse_cleanup` can explain why a status query failed or why terminal delivery may be disrupted. They must not become completed evidence by themselves.

Phase 2a diagnostics should include a bounded recovery context when available:

- `runtimeRecoveryState`
- `runtimeAcquireState`
- `runtimeEndedSource`
- `queryFailureReason`
- `retryAfterMs`

They must not include full stderr, prompt, output, command text, file diff, credentials, or secrets.

### Decision 5: Frontend initiates reconciliation, backend/runtime answers truth

The frontend lifecycle coordinator owns the busy UI state, so it decides when reconciliation is needed. Backend/runtime owns authoritative status, so it answers only scoped truth and does not directly mutate frontend lifecycle state.

## Proposed Flow

```text
Phase 1 dry-run
  -> decision.action = request-reconciliation
  -> Phase 2a policy allows status query
  -> frontend builds scoped status query request
  -> backend/runtime returns scoped status response
  -> frontend validates echoed scope
  -> frontend converts response into reconciliation evidence
  -> evaluateTurnSettlement(evidence, policy, nowMs)
  -> diagnostics only in Phase 2a design/observer mode
```

## Future API Shape

This proposal does not implement the API, but future implementation should converge on a shape like:

```ts
type TurnStatusQueryRequest = {
  workspaceId: string;
  engine: "claude" | "codex" | "gemini" | "opencode";
  threadId: string;
  turnId: string | null;
  runtimeSessionId: string | null;
  runtimeLeaseId: string | null;
  requestSource: "three-evidence-reconciliation";
  requestedAtMs: number;
};

type TurnStatusQueryResponse = {
  workspaceId: string;
  engine: "claude" | "codex" | "gemini" | "opencode";
  threadId: string;
  turnId: string | null;
  runtimeSessionId: string | null;
  runtimeLeaseId: string | null;
  status: TurnReconciliationStatus;
  statusSource: "runtime" | "backend-cache" | "session-summary" | "recovery-state";
  observedAtMs: number | null;
  boundedReason: string;
};
```

Hard constraints:

- Missing `workspaceId`, `engine`, or `threadId` means response is diagnostic-only.
- Missing `turnId` requires a verified alias or matching runtime lease before it can become terminal evidence.
- A stale `runtimeLeaseId` means defer/reject, not cleanup.
- Query failure must not become `completed`.

## Diagnostics

Phase 2a should reserve distinguishable labels:

- `three-evidence-reconciliation:query-requested`
- `three-evidence-reconciliation:query-resolved`
- `three-evidence-reconciliation:query-rejected`
- `three-evidence-reconciliation:query-failed`

Payloads may include ids, status enum, timestamps, age, booleans, bounded reason, scope match, recovery/acquire state enum, and retry delay. Payloads must not include full content.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Query races with a newer turn | Echo scope and re-run scope gate against current lifecycle before interpreting status. |
| Backend cannot answer status | Return `unknown` or `query-failed`; frontend defers or reports degraded state. |
| Runtime recovery errors look like terminal state | Treat recovery/acquire errors as context only unless scoped status confirms terminal. |
| Too much logging | Persist only abnormal outcomes and bounded payloads; do not persist normal `completed` consistency by default. |
| Engines have uneven status support | Make unsupported status explicit as `unknown` and track parity gaps in specs/tests. |

## Migration Plan

1. Keep Phase 1 running to collect `wouldRequestReconciliation` / `wouldCleanupResidue` samples.
2. Use this design to create a later implementation change for status-query observer behavior.
3. Implement status query behind a conservative policy flag, with diagnostics only first.
4. Only after real samples prove terminal-confirmed busy residue should Phase 2b guarded cleanup be designed and implemented.

Rollback is simple for this design-only change: do not implement the later status query change.

## Open Questions

- Which runtime layer should be the first authoritative source for Codex: active runtime controller, session summary, or backend cache?
- Should status query be synchronous on suspicion, throttled per turn, or scheduled with jitter?
- What is the minimum runtime lease identity available across Claude, Codex, Gemini, and OpenCode?
- Should recovery quarantine expose retry timing through the same status query or a separate runtime health query?
