# Evidence Baseline: collect-release-grade-performance-evidence

Collected during implementation preflight on 2026-06-13.

## Readiness Snapshot

Command:

```bash
npm run perf:archive-readiness -- --json
```

Current result:

- `status`: `warn`
- `exitCode`: `2`
- `activeChangeCount`: `2`
- `metricCount`: `28`
- `budgetMissingCount`: `21`
- `hardFailures`: `0`
- `unsupportedRecords`: `9`

Interpretation:

- Normal archive-readiness has no metadata hard failure.
- Release-grade readiness is not satisfied because hard budget breach, unsupported runtime evidence, and missing budget ownership remain.

## Hard Budget Breach

| Record | Value | Hard Fail | Unit | Current Evidence |
|---|---:|---:|---|---|
| `S-CS-COLD/bundleSizeMain` | 1121481 | 1100000 | bytes-gzip | measured |

## Unsupported Evidence Records

| Path | Scenario / Metric | Reason |
|---|---|---|
| `performanceEvidence.26` | `S-CS-COLD/firstPaintMs` | Tauri webview timing unavailable in current script |
| `performanceEvidence.27` | `S-CS-COLD/firstInteractiveMs` | Tauri webview timing unavailable in current script |
| `realtimeInputRenderBudgetSummary` | summary | streaming fixture/probe still missing |
| `backendFileIoIsolationSummary` | summary | blocking-pool / async-worker probe still missing |
| `fileChangeEventDebounceSummary` | summary | same-path burst fixture still missing |
| `appServerEventBatchingSummary` | summary | raw-vs-IPC / reducer-dispatch capture still missing |
| `frontendPropChainStabilitySummary` | summary | Profiler/render counters still missing |
| `realtimeTraceBudgets.26` | `S-CS-COLD/firstPaintMs` | Tauri webview timing unavailable in current script |
| `realtimeTraceBudgets.27` | `S-CS-COLD/firstInteractiveMs` | Tauri webview timing unavailable in current script |

## Release-Critical Metric Inventory

| Record | Value | Unit | Evidence | Budget |
|---|---:|---|---|---|
| `S-LL-1000/commitDurationP50` | 18.03 | ms | proxy | missing |
| `S-LL-1000/commitDurationP95` | 18.03 | ms | proxy | missing |
| `S-LL-1000/firstPaintAfterMount` | 36.91 | ms | proxy | missing |
| `S-LL-1000/scrollFrameDropPct` | 0 | % | proxy | target 1 / hardFail 5 |
| `S-CI-50/keystrokeToCommitP95` | 0.09 | ms | proxy | target 16 / hardFail 32 |
| `S-CI-50/inputEventLossCount` | 0 | count | proxy | missing |
| `S-CI-50/compositionToCommit` | 0 | ms | proxy | missing |
| `S-CI-100-IME/keystrokeToCommitP95` | 0.03 | ms | proxy | target 16 / hardFail 32 |
| `S-CI-100-IME/inputEventLossCount` | 0 | count | proxy | missing |
| `S-CI-100-IME/compositionToCommit` | 0.13 | ms | proxy | missing |
| `S-RS-VL/visibleTextLagP95` | 24 | ms | proxy | missing |
| `S-RS-RA/reducerAmplificationMedian` | 4 | ratio | proxy | missing |
| `S-RS-FD/batchFlushDurationP95` | 13.33 | ms | proxy | missing |
| `S-RS-TS/terminalSettlementP95` | 60 | ms | proxy | missing |
| `S-CS-COLD/bundleSizeMain` | 1121481 | bytes-gzip | measured | target 950000 / hardFail 1100000 |
| `S-CS-COLD/bundleSizeVendor` | 741552 | bytes-gzip | measured | target 680000 / hardFail 760000 |
| `S-CS-COLD/firstPaintMs` | unsupported | ms | unsupported | missing |
| `S-CS-COLD/firstInteractiveMs` | unsupported | ms | unsupported | missing |

## Runner Reuse Map

| Target | Existing Script / Surface | Reuse Decision |
|---|---|---|
| Bundle gzip size | `scripts/perf-cold-start-baseline.mjs`, `scripts/check-bundle-chunking.mjs` | extend current cold-start/bundle path |
| Tauri cold-start timing | `scripts/perf-cold-start-baseline.mjs` | extend; current script records unsupported timing |
| Long-list baseline | `scripts/perf-long-list-baseline.ts` | keep as proxy regression |
| Browser scroll evidence | `scripts/perf-long-list-browser-scroll.mjs` | reuse as measured browser evidence |
| Composer baseline | `scripts/perf-composer-baseline.ts` | keep as proxy until runtime input fixture exists |
| Realtime replay / extended baseline | `scripts/realtime-perf-report.ts` | extend to runtime-measured fields; existing output remains proxy |
| Runtime evidence report | `scripts/generate-runtime-evidence-report.mjs` | reuse as normalized report writer |
| Readiness gate | `scripts/perf-archive-readiness.mjs` | extend with release mode |
