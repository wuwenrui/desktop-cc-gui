# runtime-performance-evidence-gates delta

## ADDED Requirements

### Requirement: Input-Latency Budget Encoding MUST Land Candidate Budgets In Baseline

The system MUST encode owner-approved input-latency candidate budgets from `openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md` into `docs/perf/baseline.json` and MUST remove the corresponding records from `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` table.

#### Scenario: inputEventLossCount metrics gain budget block

- **WHEN** `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` carry the `budgeted-next` decision with `target=0, hardFail=0, unit=count, owner=input-latency-budget` in the budget decision table
- **THEN** `docs/perf/baseline.json` MUST contain a `budget` block for both metrics
- **AND** the block MUST include `target: 0`, `hardFail: 0`, `unit: "count"`, `owner: "input-latency-budget"`, `source: "openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md"`, and `status: "approved"`
- **AND** `npm run perf:archive-readiness -- --json` MUST NOT list either metric as `budget-missing`

#### Scenario: owner rejection cannot fall back to budget-missing

- **WHEN** an owner rejects the `hardFail=0` value for inputEventLossCount
- **THEN** the implementation MAY change `target` / `hardFail` to a different approved value
- **AND** it MUST NOT remove the `budget` block and reclassify the metric as `budget-missing`

### Requirement: BUDGET_RESIDUALS Table MUST Stay In Sync With Baseline Budgets

The system MUST keep `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` table in lockstep with the set of metrics that have an actual `budget` block in `docs/perf/baseline.json`. Once a metric gains a `budget` block, the readiness gate MUST NOT list it as `budget-missing` anymore.

#### Scenario: realtime metrics already budgeted in baseline are not in BUDGET_RESIDUALS

- **WHEN** `docs/perf/baseline.json` carries a `budget` block for `S-RS-VL/visibleTextLagP95`, `S-RS-RA/reducerAmplificationMedian`, `S-RS-FD/batchFlushDurationP95`, or `S-RS-TS/terminalSettlementP95`
- **THEN** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT contain those records
- **AND** `npm run perf:archive-readiness -- --json` MUST NOT list those records under `budget-missing`

#### Scenario: input-latency budgeted metrics are removed from BUDGET_RESIDUALS after encoding

- **WHEN** `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` gain a `budget` block in `docs/perf/baseline.json`
- **THEN** `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` MUST NOT contain those records
- **AND** the normal-mode readiness report MUST drop its `budgetMissingCount` by exactly two for the input-latency pair (and by four for the realtime pair if those were not yet removed)

#### Scenario: residual 15 metrics remain visible

- **WHEN** all budgeted metrics are removed from `BUDGET_RESIDUALS`
- **THEN** the residual count MUST equal 15 (LL-200/500/1000 commit duration and first-paint = 9, CI compositionToCommit = 2, RS-PE dedupHitRatio and assemblerLatency = 2, CS-COLD firstPaintMs and firstInteractiveMs = 2)
- **AND** the readiness report MUST keep those 15 records as `budget-missing` warnings

## Implemented (No New Requirement)

The following capabilities were already implemented in commit `9db56c88` and require no contract addition in this change:

- `bundle-chunking-performance` — `ProjectMapPanel` and `IntentCanvasManager` are routed through `React.lazy(() => import(...))` inside `src/features/layout/hooks/useLayoutNodes.tsx`, and `src/app-shell-parts/appShellLazyBoundaries.test.ts` proves the static-import-free contract.
- `realtime-input-render-budget` — `S-RS-VL/RA/FD/TS` 4 metrics are now `evidenceClass: "measured"` in `docs/perf/baseline.json`, with `budget` blocks carrying `owner: "realtime-runtime-evidence"` and `source: "openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md"`. `scripts/generate-runtime-evidence-report.mjs` `buildRealtimeTraceBudgets` already prefers measured over proxy and only falls back to `realtime-extended-baseline.json` when the entry's `evidenceClass !== "measured"`.

## Out of Scope (Explicit Follow-up)

The following items are out of scope for this change and remain explicit follow-up:

- `S-CS-COLD/firstPaintMs` / `S-CS-COLD/firstInteractiveMs` measured runtime capture. The runner (`scripts/perf-cold-start-baseline.mjs --startup-markers`) and the runtime hook (`src/services/perfBaseline/startupMarkers.ts`) are both ready; running a real Tauri/WebView session and feeding the produced `.artifacts/startup-marker-snapshot.json` through the runner will upgrade both metrics to `measured`. Sandbox cannot run the desktop session; this change accepts the `release-evidence-unsupported` hard fail as an explicit release blocker and tracks the real-session follow-up under §7 of the tasks.
