# fix-foreground-turn-settlement-phase2b Design

## Summary

Phase2b turns the existing three-evidence `cleanup-residue` decision from diagnostic-only into a guarded foreground cleanup transaction. The cleanup is scoped to the current conversation identity and is allowed only when lifecycle arbitration has already accepted terminal evidence or authoritative terminal reconciliation evidence.

## Evidence Baseline

The change starts from two concrete evidence paths in `~/.ccgui/error-log/2026-06-01.jsonl`.

### GO path B: matched terminal evidence with busy residue

- `label = "thread/session:turn-diagnostic:three-evidence-reconciliation-query-skipped"`
- `skipReason = "decision-not-reconciliation"`
- `scopeMatch.matched = true`
- `acceptedEvidence.terminal = true`
- `acceptedEvidence.state = true`
- `decisionAction = "cleanup-residue"`
- `decisionReason = "busy-residue"`
- `isProcessing = true`
- `activeTurnId = turnId`

Interpretation: reconciliation query did not run because the helper already had enough terminal and state evidence. The remaining defect is lifecycle residue.

### Watchdog interrupted race

- `codex-no-progress-watchdog-fired` reports `isProcessing = true`.
- The following `codex-no-progress-watchdog-skipped` reports `reason = "interrupted"` and `activeTurnId = null`.

Interpretation: interruption can clear or abandon active identity while another recovery path still observes busy lifecycle state. The cleanup path must be idempotent and scope-aware.

## Settlement Contract

Introduce or consolidate a single Phase2b settlement helper with this semantic shape:

```text
settleForegroundTurnResidue(input)
  require current workspace/engine/thread scope
  require matching turn identity or verified abandoned interrupted identity
  require accepted terminal evidence OR authoritative terminal reconciliation evidence
  reject running/unknown/query-failed/stale/mismatched evidence
  clear only matching processing/active-turn/busy residue
  emit bounded applied/skipped diagnostics
```

The helper is a lifecycle transaction, not a new evidence source. It consumes the pure helper's `cleanup-residue` decision and applies the smallest safe state mutation.

## Guard Rules

- Scope MUST include workspace, engine, thread, and turn when available.
- The cleanup MUST be idempotent.
- A newer active turn MUST block cleanup for an older turn unless the old turn is already detached from active foreground state.
- Runtime lease/session mismatch MUST be treated as stale unless an existing alias contract verifies the old event belongs to the current turn.
- `running`, `unknown`, `query-failed`, query rejected, stale scope, and missing scope MUST produce no cleanup.
- `interrupted` MAY clean the matching foreground residue only when the interrupted turn is the current active turn or the immediately abandoned turn captured by the lifecycle evidence.

## Integration Points

- Existing three-evidence dry-run/reconciliation path remains the arbiter.
- Phase2b applies cleanup after `evaluateTurnSettlement(...)` returns `cleanup-residue`.
- Watchdog interrupted skip path should route through the same settlement helper instead of clearing a different subset of fields.
- Diagnostics should reuse existing `turn-diagnostic` shape and remain low-volume.

## Diagnostics

Add bounded diagnostics only if they materially improve triage:

- `thread/session:turn-diagnostic:three-evidence-cleanup-applied`
- `thread/session:turn-diagnostic:three-evidence-cleanup-skipped`

Payloads should include:

- workspace/thread/turn/engine
- decision action/reason
- accepted evidence booleans
- scope match booleans
- cleanup fields affected as booleans, not raw data
- skip reason if cleanup is denied

Payloads MUST NOT include prompts, assistant output, tool output, stdout/stderr payloads, file diffs, auth files, tokens, or secrets.

## Alternatives

### Option A: patch each caller

Patch terminal settlement, interrupt handling, and watchdog handling independently.

- Benefit: minimal edit surface.
- Cost: repeats the current design flaw. One future path can still forget one lifecycle field.

Rejected because the bug is a state-machine convergence problem.

### Option B: single guarded cleanup helper

Route all Phase2b cleanup decisions through one scoped helper.

- Benefit: one contract, one set of tests, idempotent cleanup.
- Cost: requires careful wiring at the current settlement boundaries.

Chosen because it directly addresses fragmented lifecycle cleanup.

### Option C: backend terminal replay

Ask backend/runtime to replay missed terminal events.

- Benefit: may solve a broader class of missed lifecycle events.
- Cost: larger surface, new protocol, and unnecessary for the current evidence.

Deferred until there is evidence that accepted terminal evidence is absent.

## Risk Controls

- Start with tests for the two observed evidence paths.
- Keep cleanup scoped and reject mismatches.
- Avoid broad reducer resets.
- Avoid changing backend status-query semantics.
- Keep normal long-running turns protected by requiring terminal/interrupted evidence.

## Verification

- Focused tests for `cleanup-residue` application and skip cases.
- Focused tests for interrupted watchdog race cleanup.
- `openspec validate fix-foreground-turn-settlement-phase2b --strict --no-interactive`
- Relevant TypeScript/Vitest suites for touched lifecycle code.
