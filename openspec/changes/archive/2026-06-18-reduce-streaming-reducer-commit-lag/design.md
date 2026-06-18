## Context

The v0.5.11 runtime trace calibration produced a fresh `realtime.turnTrace.summary` from a hot-start app conversation. The measured data shows:

- `realtimeDeltaRouteDurationAvgMs = 0`
- `appServerEventRouteDurationAvgMs = 0`
- `batchFlushEndToReducerCommitMs = 7265`
- `deltaCount = 41`
- `reducerCommitCount = 41`

This isolates the next actionable bottleneck: route work has already happened, but the reducer commit can still wait behind React transition scheduling. Current `useThreadItemEvents.ts` routes contract-batcher cadence flushes with `useTransitionForDispatch: flush.reason !== "terminal"`, so live assistant deltas can be deprioritized even though reducer fast-path tests prove non-Claude live deltas avoid `prepareThreadItems`.

After the first implementation pass, the user hot-restarted the app and ran another streaming turn. `npm run perf:renderer-diagnostics:export -- --verbose` exported `entries=1200` with `turnTraceSummaryCount=0`, so the original `batchFlushEndToReducerCommitMs` comparison could not be sampled. The raw renderer diagnostics instead showed:

- `firstVisibleTextAfterDeltaMs = 142`
- `deltaCount = 10`
- `visibleStallMs = 702`
- `latencyCategory = "visible-output-stall-after-first-delta"`
- `mitigationProfile = "codex-markdown-stream-recovery"`
- `lastIngressItemId` differed from `lastVisibleTextItemId`

This means the next verified bottleneck is not route work and is no longer proven to be reducer commit lag. It is the live row visible-text reporting/render surface chain for lightweight Codex Markdown recovery.

## Goals / Non-Goals

**Goals:**

- Make live assistant `appendAgentMessageDelta` reducer dispatch latency-critical after batch flush.
- Preserve exact terminal turn filtering at dispatch execution time.
- Keep terminal completion and heavier normalized events conservative.
- Add focused regression coverage for cadence flush scheduling.
- Ensure lightweight Markdown streaming surfaces report current assistant visible text growth when the rendered-value callback is delayed, especially after `codex-markdown-stream-recovery` activation.

**Non-Goals:**

- No Markdown worker, parent timeline derivation, backend batching, or app-server route rewrite.
- No change to terminal settlement semantics.
- No new runtime flag unless tests reveal rollback needs beyond the existing realtime batching flag.
- No forced plain-text fallback for Codex recovery; Codex streaming should remain on lightweight Markdown unless a separate evidence-backed change proves otherwise.

## Decisions

### Decision 1: Use operation-based dispatch priority

`appendAgentMessageDelta` is the only normalized operation in scope for urgent commit. It represents live assistant row growth and already has reducer support that avoids `prepareThreadItems`.

Alternative A: urgent-dispatch all normalized events. This is rejected because snapshots, tool output, reasoning, and terminal completion can carry heavier derivation or ordering risk.

Alternative B: reduce the 12ms batch cadence. This does not address the measured `batchFlushEndToReducerCommitMs` lag after flush and would increase dispatch frequency without fixing React priority.

### Decision 2: Keep terminal events synchronous/conservative

Terminal flushes already use `useTransitionForDispatch: false`. This remains unchanged. The fix must not reorder terminal completion relative to pending deltas or allow late stale work to mutate completed turns.

Alternative: split terminal and live delta into separate scheduler queues. This adds more machinery without evidence that terminal ordering is the current bottleneck.

### Decision 3: Lock with hook-level scheduling tests

The regression test should inject a `scheduleRealtimeDispatch` spy/queue and assert that cadence-flushed live assistant deltas dispatch immediately, while existing stale queued event tests still cover transition execution guards.

Alternative: only verify runtime reports. This is too slow and requires manual app interaction for each regression.

### Decision 4: Add a MessageRow-level visible-text fallback for lightweight Markdown

For streaming assistant rows using lightweight Markdown, `MessageRow` should report the current `displayText` to `onAssistantVisibleTextRender` when the row is in the lightweight live path. This is deliberately scoped to the live lightweight surface, including `codex-markdown-stream-recovery`, and does not change Markdown final rendering or completion semantics.

Alternative A: make `codex-markdown-stream-recovery` force plain text. This is rejected because the existing contract says Codex realtime assistant snapshots should prefer staged lightweight Markdown and avoid defaulting to plain text.

Alternative B: lower Markdown throttle numbers. This is rejected because the observed problem is visible-text diagnostics staying on an older item; lowering throttle would increase parse pressure without guaranteeing the latest item is registered.

## Risks / Trade-offs

- [Risk] Urgent live deltas may increase foreground React commits.
  - Mitigation: keep batching/coalescing and reducer fast path; only live assistant deltas move to urgent priority.
- [Risk] Changing scheduling could bypass stale turn protection.
  - Mitigation: `applyNormalizedRealtimeEventNow` still checks terminal state immediately before dispatching.
- [Risk] Existing tests may rely on live delta being transitioned.
  - Mitigation: update tests to reflect the new contract and preserve queued-transition coverage for non-live or explicitly transition-routed events.
- [Risk] Reporting `displayText` from the row layer could double-report when Markdown also emits `onRenderedValueChange`.
  - Mitigation: existing diagnostics already coalesce by item/text length; the fallback is only active for streaming lightweight Markdown and preserves the Markdown callback path for actual rendered values.

## Migration Plan

1. Add a small helper in `useThreadItemEvents.ts` to decide whether a normalized event should dispatch urgently.
2. Use it in first-token and batcher flush paths.
3. Add/adjust focused tests.
4. Run focused Vitest, typecheck, lint, and OpenSpec validation.
5. After the user hot-restarts and runs another streaming turn, refresh runtime evidence to verify `batchFlushEndToReducerCommitMs`.
6. If post-restart evidence cannot emit turn summary but shows `visible-output-stall-after-first-delta`, add the lightweight Markdown visible-text fallback and focused MessageRow regression.

Rollback: revert the priority helper and return cadence flushes to `flush.reason !== "terminal"` transition behavior.
Rollback for Phase 2: remove the lightweight Markdown row-level visible-text fallback and rely solely on Markdown `onRenderedValueChange`.

## Open Questions

- None for the first implementation pass. Runtime trace after implementation will decide whether the next bottleneck is message row render, parent timeline derivation, or finalization settlement.
