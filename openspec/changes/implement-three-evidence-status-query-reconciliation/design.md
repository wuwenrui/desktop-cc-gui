# implement-three-evidence-status-query-reconciliation Design

## Summary

Phase 2a is a reconciliation observer with a real backend/runtime query. The frontend remains the lifecycle coordinator, but it does not decide terminal truth from elapsed time. The backend/runtime returns a bounded status for the requested workspace/engine/thread/turn scope.

## Request / Response

Frontend request:

- `workspaceId`
- `engine`
- `threadId`
- `turnId`
- `runtimeSessionId`
- `runtimeLeaseId`
- `requestSource = "three-evidence-reconciliation"`
- `requestedAtMs`

Backend response:

- echoed request scope
- `status`: `running`, `completed`, `failed`, `stalled`, `runtime-ended`, `unknown`, or `query-failed`
- `statusSource`: `runtime`, `runtime-end-context`, `backend-cache`, `session-summary`, or `recovery-state`
- `observedAtMs`
- `boundedReason`

## Backend Interpretation

The first implementation uses runtime manager truth:

- active turn lease, stream lease, or foreground work matching the request means `running`
- a recent runtime-ended context matching the requested thread/turn means `runtime-ended`
- runtime error/failure without matching affected thread/turn remains `unknown`
- unsupported engines or missing required scope return `unknown`/`query-failed`, not completed

This intentionally does not synthesize `completed` yet. A future engine-specific status source may return `completed` if it can prove that exact turn finished.

## Frontend Interpretation

When Phase 1 returns `request-reconciliation`, frontend emits `query-requested`, calls the service, validates echoed scope, and re-runs `evaluateTurnSettlement`.

- `running` -> `keep-running`
- `runtime-ended` / `failed` / `stalled` / `completed` -> terminal candidate, helper decides diagnostics only
- `unknown` / `query-failed` / rejected scope -> defer

Phase 2a does not call `markProcessing(false)`, does not clear `activeTurnId`, and does not mutate messages.

## Race Control

- Query key includes workspace, engine, thread, turn, runtime lease/session when available.
- In-flight duplicate query for the same key is skipped.
- Response scope must match current lifecycle scope before evidence is accepted.
- A newer active turn rejects an older response through the existing pure helper scope gate.

## Diagnostics

Labels:

- `thread/session:turn-diagnostic:three-evidence-reconciliation-query-requested`
- `thread/session:turn-diagnostic:three-evidence-reconciliation-query-resolved`
- `thread/session:turn-diagnostic:three-evidence-reconciliation-query-rejected`
- `thread/session:turn-diagnostic:three-evidence-reconciliation-query-failed`

Payloads contain ids, status enum, scope booleans, timestamps, stale progress age, bounded reason, and decision action. They exclude prompt/output/stderr/file diff content.

## PHASE2B_HANDOFF_MARKER

Start Phase 2b only after a real post-Phase2a reproduction writes all of these signals for the same scoped turn in `~/.ccgui/error-log/YYYY-MM-DD.jsonl`:

- `label = "thread/session:turn-diagnostic:three-evidence-reconciliation-query-resolved"`
- `payload.scopeMatch.matched = true`
- `payload.status` is one of `runtime-ended`, `failed`, `stalled`, or `completed`
- `payload.decisionAction = "cleanup-residue"`

Do not start Phase 2b from any of these signals alone:

- `three-evidence-dry-run` with `decisionAction = "request-reconciliation"`
- `payload.status = "running"`
- `payload.status = "unknown"`
- `payload.status = "query-failed"`
- `three-evidence-reconciliation-query-rejected`
- any response whose `scopeMatch.matched` is not `true`

Phase 2b should implement scoped guarded cleanup only. Its cleanup may clear frontend loading residue such as `isProcessing` and the matching `activeTurnId`, but only after the pure helper accepts the authoritative status-query evidence for the current workspace/engine/thread/turn. Phase 2b must not infer completion from elapsed time, visible/history text, or stale progress alone, and must continue to protect normal long-running turns.
