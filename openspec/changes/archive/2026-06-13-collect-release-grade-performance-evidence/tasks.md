## 1. Preflight / 当前证据复核

- [x] 1.1 [P0][depends:none][input:`npm run perf:archive-readiness -- --json`][output: current residual fact record][validation: record hardFailures, budgetMissingCount, unsupportedRecords, and bundle hard breach] Capture current readiness baseline before implementation.
- [x] 1.2 [P0][depends:none][input:`docs/perf/baseline.json`, `docs/perf/runtime-evidence-gates.json`][output: release-critical metric inventory][validation: inventory lists cold-start, realtime, typing, list, and bundle metrics by evidenceClass] Build metric inventory and classify required release evidence.
- [x] 1.3 [P1][depends:1.2][input:`scripts/*perf*`, `package.json`][output: runner reuse map][validation: each target metric is mapped to an existing script or a narrow new runner task] Confirm existing script substrate before adding new tooling.

## 2. Release-Readiness Gate

- [x] 2.1 [P0][depends:1.1][input:`scripts/perf-archive-readiness.mjs`][output: release-grade readiness mode][validation:`npm run perf:archive-readiness -- --release --json` or equivalent exits non-zero on current bundle hard breach / unsupported release metrics] Add stricter release readiness mode.
- [x] 2.2 [P0][depends:2.1][input: readiness output][output: hard breach failure records include owner/source/nextAction][validation: JSON output lists `S-CS-COLD/bundleSizeMain` as release blocker while still above hardFail] Make hard budget breaches release-blocking.
- [x] 2.3 [P0][depends:2.1][input: unsupported/proxy evidence records][output: release residual classification][validation: proxy and unsupported release-critical metrics are listed separately from metadata hard failures] Separate proxy regression evidence from measured release proof.
- [x] 2.4 [P1][depends:2.1][input: readiness script tests][output: coverage for release mode][validation:`node --test` or existing script test command covers release mode pass/fail cases] Add focused readiness tests.

## 3. Tauri Cold-Start Runtime Evidence

- [x] 3.1 [P0][depends:1.3][input:`scripts/perf-cold-start-baseline.mjs`, startup runtime code][output: selected timing transport design note in implementation comments or docs][validation: runner path is explicit and does not rely on bundle generation alone] Pick Tauri/webview timing transport.
- [x] 3.2 [P0][depends:3.1][input: frontend startup lifecycle][output: content-safe first-paint and first-interactive markers][validation: focused test or static guard proves markers are emitted once and contain no content] Add bounded startup markers.
- [x] 3.3 [P0][depends:3.2][input: cold-start runner][output:`docs/perf/cold-start-baseline.json` with measured or platform-qualified timing][validation: runner records `firstPaintMs` and `firstInteractiveMs` as measured on supported local platform, or unsupported with failure reason] Collect cold-start runtime timing.
- [x] 3.4 [P1][depends:3.3][input:`scripts/perf-aggregate.mjs`, `docs/perf/cold-start-baseline.json`][output: aggregated baseline updates][validation:`docs/perf/baseline.json` and markdown reflect cold-start timing classification correctly] Wire cold-start timing into aggregate report.

## 4. Realtime Runtime Evidence

- [x] 4.1 [P0][depends:1.3][input:`scripts/realtime-perf-report.ts`, realtime trace utilities][output: runtime measurement plan for S-RS-VL/S-RS-RA/S-RS-FD/S-RS-TS][validation: metric source map lists exact runtime milestones and content-safety fields] Define realtime runtime source map.
- [x] 4.2 [P0][depends:4.1][input: renderer/reducer/batcher diagnostics][output: runtime counters/timing probes for visible lag, reducer amplification, batch flush, terminal settlement][validation: focused tests prove diagnostics are bounded and content-safe] Add runtime measurement probes.
- [x] 4.3 [P0][depends:4.2][input: deterministic streaming fixture][output: measured realtime evidence artifact][validation:`npm run perf:realtime:report` or equivalent writes measured runtime fields, not only replay proxy fields] Collect realtime runtime evidence.
- [x] 4.4 [P1][depends:4.3][input:`generate-runtime-evidence-report.mjs`][output: runtime evidence report uses measured fields where available][validation:`docs/perf/runtime-evidence-gates.json` classifies realtime runtime metrics accurately] Update normalized report generation.

## 5. Budget Ownership And Residuals

- [x] 5.1 [P0][depends:1.2][input: 21 `budget-missing` metrics][output: owner-approved budget decision table][validation: each metric is marked `budgeted` with source/owner or `residual` with owner/followUp] Classify missing budgets without inventing thresholds.
- [x] 5.2 [P1][depends:5.1][input:`docs/perf/baseline.json`][output: budget metadata for approved metrics][validation: readiness output no longer reports approved metrics as `budget-missing`] Encode approved budgets.
- [x] 5.3 [P1][depends:5.1][input:`docs/perf/runtime-evidence-gates.json`][output: residual budget list with owner/followUp][validation: residual budget-missing warnings include owner and next action] Keep unapproved budgets explicit.

## 6. Bundle Hard Breach Remediation

- [x] 6.1 [P0][depends:1.3][input:`npm run build`, bundle budget/chunking outputs][output: main bundle culprit list][validation: report identifies first-viewport vs non-startup candidates from actual build output] Analyze `bundleSizeMain` breach using current build artifacts.
- [x] 6.2 [P0][depends:6.1][input: culprit list][output: narrow lazy-boundary remediation plan][validation: plan names files/imports and proves they are outside startup hot path] Select minimal bundle remediation target.
- [x] 6.3 [P0][depends:6.2][input: selected startup-lazy candidate][output: narrow code change lowering main bundle][validation:`bundleSizeMain <= 1100000 bytes-gzip` after build/aggregate] Implement bundle hard breach fix.
- [x] 6.4 [P1][depends:6.3][input: touched feature/runtime surface][output: focused Vitest or contract test proves lazy-loaded behavior still works] Add or update focused tests.

## 7. Report Regeneration And Validation

- [x] 7.1 [P0][depends:3.4,4.4,5.2,5.3,6.3][input: all perf source artifacts][output:`docs/perf/baseline.{json,md}` and `docs/perf/runtime-evidence-gates.{json,md}` regenerated][validation: generated reports contain no unit conflicts and classify measured/proxy/manual/unsupported correctly] Regenerate performance reports.
- [x] 7.2 [P0][depends:7.1][input: release readiness gate][output: release readiness result][validation:`npm run perf:archive-readiness -- --release` passes or fails only with explicit release blocker] Run release readiness gate.
- [x] 7.3 [P0][depends:7.1][input: OpenSpec artifacts][output: strict validation pass][validation:`openspec validate collect-release-grade-performance-evidence --strict --no-interactive`] Validate OpenSpec change.
- [x] 7.4 [P0][depends:6.3,7.1][input: TypeScript project][output: typecheck pass][validation:`npm run typecheck`] Run typecheck.
- [x] 7.5 [P1][depends:4.2][input: touched tests][output: focused test pass][validation: focused Vitest/script tests for readiness, startup markers, and realtime evidence scripts pass] Run focused tests.
- [x] 7.6 [P1][depends:7.1][input: repository diff][output: scoped diff confirmation][validation:`git diff --stat` shows evidence scripts/docs and narrow bundle remediation only] Confirm scope did not drift into broad refactor.

## 8. Profiling Regression Follow-up

- [x] 8.1 [P0][depends:none][input:`git blame src/features/layout/hooks/useLayoutNodes.tsx`, `git show 25d101a0`][output: regression root-cause record][validation: identify that `Profiler` wrapper changed `sidebarNode` from direct `Sidebar` element to wrapper element] Confirm sidebar titlebar toggle disappearance root cause.
- [x] 8.2 [P0][depends:8.1][input:`src/app-shell-parts/renderAppShell.tsx`][output: wrapper-aware `topbarNode` injection][validation: `Profiler` remains in `useLayoutNodes`, while `topbarNode` reaches the actual `Sidebar` child] Restore sidebar titlebar collapse affordance without removing profiling.
- [x] 8.3 [P0][depends:8.2][input:`src/app-shell-parts/renderAppShell.sidebarTopbar.test.tsx`][output: focused regression test][validation:`npx vitest run src/app-shell-parts/renderAppShell.sidebarTopbar.test.tsx src/features/layout/utils/sidebarTogglePlacement.test.ts src/styles/sidebar-titlebar-drag-region.test.ts`] Lock the `Profiler -> Sidebar` injection path.
- [x] 8.4 [P1][depends:8.2][input: desktop sidebar placement rules][output: expanded desktop sidebar shows left titlebar toggle; collapsed sidebar shows restore toggle in main topbar][validation: user-confirmed Tauri screenshot shows the button restored] Confirm user-visible restoration.
