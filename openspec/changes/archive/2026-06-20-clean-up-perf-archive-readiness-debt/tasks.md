## 1. Residual Inventory

- [x] 1.1 P0 Capture current readiness JSON input: run `npm run --silent perf:archive-readiness -- --json`, save/inspect the 15 `budget-missing` records, proxy ratio summary, and unsupported records; output is a grouped inventory in implementation notes or task comments; validate by matching `budgetMissingCount`, `proxyRatio`, and unsupported record labels.
- [x] 1.2 P0 Classify each residual metric dependency: map long-list, input latency, realtime projection, cold-start, and long-running runtime records to an owner, source artifact candidate, and required closure path; output is an owner/source table; validate that every current residual record has exactly one disposition.

## 2. Readiness Parser Tests

- [x] 2.1 P0 Add tests proving a metric with a real `budget` block cannot remain listed in `BUDGET_RESIDUALS`; input is a fixture baseline plus script residual table; output is a failing test before implementation; validate with `node --test scripts/perf-archive-readiness.test.mjs`.
- [x] 2.2 P0 Add tests for residual entries requiring owner and next-action guidance; input is a malformed residual fixture; output is hard or explicit test failure; validate with `node --test scripts/perf-archive-readiness.test.mjs`.
- [x] 2.3 P1 Add tests preserving proxy-ratio warning metadata; input is a high-proxy evidence fixture; output asserts counts, owner, and nextAction; validate with `node --test scripts/perf-archive-readiness.test.mjs`.
- [x] 2.4 P1 Add tests for unsupported disposition metadata; input is cold-start and long-running unsupported fixture records; output asserts platform qualifier, owner, reason, release decision, and nextAction are preserved in readiness output; validate with `node --test scripts/perf-archive-readiness.test.mjs`.

## 3. Evidence Artifact Cleanup

- [x] 3.1 P0 Add owner-approved budget blocks to budgetable residual metrics in `docs/perf/baseline.json`, or explicit accepted residual disposition for metrics that are not yet budgetable; dependency: task 1.2; output includes `target` or `hardFail`, `unit`, `owner`, `source`, and `status` or `rollout` for budgeted metrics, and owner/source/reason/releaseDecision/nextAction for accepted residuals; validate with `npm run --silent perf:archive-readiness -- --json`.
- [x] 3.2 P0 Update `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` to remove only metrics that gained real budget blocks and suppress normal-mode warnings only for records with accepted residual disposition; dependency: task 3.1; output is a residual table that matches remaining unbudgeted records; validate with task 2 tests.
- [x] 3.3 P1 Upgrade selected proxy records to measured runtime evidence where source artifacts exist; dependency: task 1.2; output updates `docs/perf/runtime-evidence-gates.json` or source evidence artifacts without changing units; validate that `proxyRatio <= 0.5` or remaining proxy records have accepted disposition.
- [x] 3.4 P1 Resolve unsupported cold-start and long-running records; dependency: task 1.2; output is measured evidence or explicit unsupported disposition metadata; validate that unsupported summaries keep audit metadata and normal-mode readiness no longer has unresolved unsupported warnings.

## 4. Gate Verification

- [x] 4.1 P0 Run `openspec validate clean-up-perf-archive-readiness-debt --strict --no-interactive`; input is completed OpenSpec artifacts; output must pass before implementation proceeds.
- [x] 4.2 P0 Run `node --test scripts/perf-archive-readiness.test.mjs`; input is updated parser/tests; output must pass.
- [x] 4.3 P0 Run `npm run --silent perf:archive-readiness -- --json`; input is updated baseline/evidence artifacts; output target is `ok=true`, `status=pass`, `hardFailures=[]`, and `warnings=[]` for normal mode.
- [x] 4.4 P1 If TS evidence generators are touched, run the corresponding generator tests such as `scripts/generate-runtime-evidence-report.test.mjs`, `scripts/perf-cold-start-baseline.test.mjs`, or `scripts/perf-v0511-runtime-evidence.test.mjs`; output must pass for every touched generator.

## 5. Documentation And Archive Readiness

- [x] 5.1 P1 Document any accepted deferrals in the change notes with owner, reason, platform qualifier, release decision, and next action; dependency: tasks 3.3 and 3.4; output prevents silent warning suppression.
- [x] 5.2 P1 Update the final verification notes with before/after readiness JSON summary; dependency: task 4.3; output records budgetMissingCount, proxyRatio, unsupported count, hardFailures, and warnings.
- [x] 5.3 P1 Before archive, confirm main spec sync is required and run strict validation across the relevant change/spec scope; output is an archive-ready OpenSpec change or explicit blocker list.
