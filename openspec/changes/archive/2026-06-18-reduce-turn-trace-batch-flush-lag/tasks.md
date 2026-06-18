## 1. Evidence Contract Tests

- [x] 1.1 P1 Add `turnTraceCorrelation.test.ts` coverage proving `first-visible-text-growth` keeps the first timestamp while `counters.visibleTextGrowthCount` can advance to the latest growth count. Input: simulated turn trace milestones. Output: summary with first visible delta preserved and counter > 1. Validation: focused Vitest file.
- [x] 1.2 P1 Add `streamLatencyDiagnostics.test.ts` coverage proving repeated visible text growth forwards the latest bounded count to turnTrace without notifying ordinary snapshot subscribers. Input: repeated visible text render events for one correlated turn. Output: stream snapshot and turn summary counts agree. Validation: focused Vitest file.
- [x] 1.3 P1 Add evidence report test coverage for the case where visible output latency is fast but turn summary batch/reducer windows are large. Input: synthetic renderer diagnostics fragment. Output: caution / next action instead of confirmed client lag claim. Validation: relevant script test.

## 2. Diagnostics Implementation

- [x] 2.1 P1 Update `streamLatencyDiagnostics.ts` so every visible text length growth can update turnTrace `visibleTextGrowthCount`, while preserving the first visible text milestone timestamp. Depends on 1.1 and 1.2.
- [x] 2.2 P1 Update `turnTraceCorrelation.ts` only if tests reveal counter patching cannot advance without replacing the first milestone. Output must keep bounded numeric counters only and must not persist message text.
- [x] 2.3 P2 Audit batch flush duration naming and report notes so queue/window duration, route work duration, and per-delta route duration remain distinct. Depends on existing route duration tests.

## 3. Report Consistency Guard

- [x] 3.1 P1 Update runtime evidence report scripts to keep measured values but mark summary/snapshot inconsistency as caution when visible latency is below threshold and summary batch/reducer windows are large.
- [x] 3.2 P2 Ensure report output includes enough context for `deltaCount`, `reducerCommitCount`, `reducerAmplification`, and `visibleTextGrowthCount` before recommending reducer/batch implementation work.

## 4. Validation

- [x] 4.1 P1 Run `npx openspec validate reduce-turn-trace-batch-flush-lag --strict --no-interactive`.
- [x] 4.2 P1 Run focused tests for `turnTraceCorrelation`, `streamLatencyDiagnostics`, and changed report scripts.
- [x] 4.3 P1 Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] 4.4 P2 Export renderer diagnostics after one fresh streaming conversation and confirm the report distinguishes visible latency facts from summary consistency cautions.
