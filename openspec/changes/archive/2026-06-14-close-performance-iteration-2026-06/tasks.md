# Tasks: Close Performance Iteration 2026-06

## 1. Preflight

- [x] 1.1 [P0][depends:none][input:`openspec list --json`][output: active-change ground truth][validation:`openspec list --json` lists only `close-performance-iteration-2026-06`] Confirm current active OpenSpec state.
- [x] 1.2 [P0][depends:none][input:`docs/perf/baseline.json`, `docs/perf/runtime-evidence-gates.json`][output: baseline fact record][validation: script/Node summary prints metric count, unit conflicts, budget-missing count, unsupported count, stale completed count, and large-file owner gaps] Record current evidence facts before patching.
- [x] 1.3 [P0][depends:none][input:`git log --oneline -1`, `git status --short`][output: repository state note][validation: proposal baseline records `1a12200d`; current HEAD may include later unrelated commits, and this change directory remains scoped] Confirm closure baseline and current repository state.

## 2. Archive-Readiness Gate

- [x] 2.1 [P0][depends:1.1,1.2][input:`docs/perf/baseline.json`, `docs/perf/runtime-evidence-gates.json`][output:`scripts/perf-archive-readiness.mjs`][validation:`node scripts/perf-archive-readiness.mjs --json` emits structured gate results] Implement readiness script.
- [x] 2.2 [P0][depends:2.1][input:`package.json`][output:`npm run perf:archive-readiness`][validation:`npm run perf:archive-readiness` exits 0, 1, or 2 with readable gate output] Add npm script entry.
- [x] 2.3 [P0][depends:2.1][input: readiness script][output: hard-fail checks][validation: current unit conflict, stale completed entries, and missing large-file owner/followUp are detected before metadata fixes] Verify the script catches current defects.
- [x] 2.4 [P1][depends:2.1][input: readiness script][output:`--json` mode][validation:`node scripts/perf-archive-readiness.mjs --json` returns parseable JSON] Add machine-readable output for future CI use.

## 3. Baseline Unit Metadata

- [x] 3.1 [P0][depends:2.3][input:`docs/perf/baseline.json`][output: `bundleSizeMain` / `bundleSizeVendor` observed unit matches `budget.unit`][validation: no `unit-conflict` for these metrics in readiness output] Fix bundle metric units to `bytes-gzip`.
- [x] 3.2 [P0][depends:3.1][input:`docs/perf/baseline.md`][output: markdown unit matches JSON][validation:`rg "bundleSize(Main|Vendor).*bytes-gzip" docs/perf/baseline.md`] Sync markdown baseline.
- [x] 3.3 [P1][depends:3.1][input:`docs/perf/baseline.json`][output: budget-missing remains distinguishable][validation: readiness output reports 21 budget-missing metrics as warn/residual, not unit-conflict] Preserve budget-missing classification.

## 4. Runtime Evidence Gate Metadata

- [x] 4.1 [P0][depends:2.3][input:`docs/perf/runtime-evidence-gates.json`][output:`archiveReadiness.completed` reconciled with current active changes][validation: readiness output has no stale completed-active entries] Remove stale archive-readiness completed entries.
- [x] 4.2 [P1][depends:4.1][input:`docs/perf/runtime-evidence-gates.json`][output: archived changes preserved as history / previous archive context if schema supports it][validation: the 8 archived change names remain discoverable outside current completed-active list] Preserve archive context without corrupting current active state.
- [x] 4.3 [P0][depends:2.3][input:`docs/perf/runtime-evidence-gates.json` largeFileSummary][output: all 10 P0/P1 candidates include `owner` and `followUp`][validation: readiness output has no large-file owner/followUp failure] Add large-file ownership metadata.
- [x] 4.4 [P0][depends:4.1,4.3][input:`docs/perf/runtime-evidence-gates.md`][output: markdown reflects reconciled archive readiness and large-file debt ownership][validation:`rg "frontend-modularization-debt|backend-modularization-debt" docs/perf/runtime-evidence-gates.md`] Sync markdown evidence report.
- [x] 4.5 [P1][depends:4.1][input: unsupported evidence records][output: unsupported records remain explicit with reason / next action][validation: readiness output reports unsupported as residual risk, not measured pass] Preserve unsupported evidence honesty.

## 5. Spec Delta

- [x] 5.1 [P0][depends:2.1,3.1,4.3][input:`openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`][output: unit consistency requirement][validation:`rg "Unit Consistency" openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`] Add unit consistency contract.
- [x] 5.2 [P0][depends:2.1][input: spec delta][output: hardFail annotation requirement][validation:`rg "HardFail" openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`] Add hardFail annotation contract.
- [x] 5.3 [P0][depends:4.1][input: spec delta][output: archiveReadiness active-state reconciliation requirement][validation:`rg "ArchiveReadiness" openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`] Add stale completed-active guard.
- [x] 5.4 [P0][depends:4.3][input: spec delta][output: large-file owner/followUp requirement][validation:`rg "owner.*followUp|followUp.*owner" openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`] Add structural debt ownership contract.
- [x] 5.5 [P0][depends:5.1-5.4][input: spec delta][output: modified archive-readiness guidance][validation:`rg "perf:archive-readiness" openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`] Require readiness gate before P0/P1 performance archive.

## 6. Final Validation

Closure validation accepts `npm run perf:archive-readiness` exit `2` only when hard failures are zero and residual warnings are explicitly recorded. Current residuals are the known `budget-missing` metrics plus unsupported cold-start timing and summary-level runtime evidence gaps; §7 remains follow-up work and is not part of this change.

- [x] 6.1 [P0][depends:2-5][input: all artifact updates][output: readiness result][validation:`npm run perf:archive-readiness` exits 0 or 2] Run archive-readiness gate.
- [x] 6.2 [P0][depends:5.5][input: OpenSpec artifacts][output: strict validation pass][validation:`openspec validate close-performance-iteration-2026-06 --strict --no-interactive`] Run OpenSpec validation.
- [x] 6.3 [P1][depends:6.1][input: repository diff][output: scoped diff confirmation][validation:`git diff --stat` matches proposal Impact] Check diff scope.
- [x] 6.4 [P1][depends:6.1][input: runtime source paths][output: no runtime source diff][validation:`git diff --stat -- 'src/**' 'src-tauri/**'` is empty] Confirm no frontend/backend runtime behavior changed.
- [x] 6.5 [P1][depends:6.1][input: TypeScript project][output: typecheck pass][validation:`npm run typecheck`] Run typecheck because package script changed.

## 7. Follow-up Work Explicitly Out of Scope

The following items are follow-up registry entries, not tasks for this change.
They remain open after closure and must not affect this change's task-completion
count.

- 7.1 [follow-up][owner:`release-grade-evidence-collection`] Collect measured Tauri webview cold-start evidence for `firstPaintMs` and `firstInteractiveMs`.
- 7.2 [follow-up][owner:`release-grade-evidence-collection`] Collect measured runtime trace evidence for realtime boundary metrics currently marked advisory.
- 7.3 [follow-up][owner:`bundle-size-optimization`] Reduce `S-CS-COLD/bundleSizeMain` below target and remove advisory rollout.
- 7.4 [follow-up][owner:`frontend-modularization-debt`] Split frontend hot-path large files without changing public hook/component contracts.
- 7.5 [follow-up][owner:`backend-modularization-debt`] Split backend bridge/runtime large files while preserving Tauri command facade and payload compatibility.
