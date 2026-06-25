# Implementation Notes

## Readiness Inventory

Captured with `npm run --silent perf:archive-readiness -- --json` before implementation.

| Field | Before |
|---|---:|
| status | warn |
| exitCode | 2 |
| hardFailures | 0 |
| warnings | 16 |
| budgetMissingCount | 15 |
| proxyRatio | 0.6842 |
| measured | 48 |
| proxy | 104 |
| unsupported | 10 |
| unresolved unsupported labels | 8 |

## Residual Budget Disposition

The previous budget decision table explicitly kept these records as residual because they lacked owner-approved thresholds. This implementation does not invent thresholds; normal-mode readiness accepts them as audited residuals while release-mode evidence remains stricter.

| Group | Records | Owner | Disposition |
|---|---|---|---|
| Long-list commit and first paint | `S-LL-200/*`, `S-LL-500/*`, `S-LL-1000/*` except `scrollFrameDropPct` | `release-grade-evidence-collection` | accepted normal-mode residual until row-count budgets and browser/runtime first-paint budgets are owner-approved |
| Input latency composition | `S-CI-50/compositionToCommit`, `S-CI-100-IME/compositionToCommit` | `input-latency-budget` | accepted normal-mode residual until IME/runtime composition budget source is approved |
| Realtime projection diagnostics | `S-RS-PE/dedupHitRatio`, `S-RS-PE/assemblerLatency` | `realtime-runtime-evidence` | accepted normal-mode residual until release hard-budget source exists |
| Cold start timing | `S-CS-COLD/firstPaintMs`, `S-CS-COLD/firstInteractiveMs` | `release-grade-evidence-collection` | accepted normal-mode residual until measured Tauri/WebView startup marker evidence exists |

## Proxy Evidence Disposition

Current proxy ratio remains above the advisory threshold because the evidence set intentionally keeps fixture/jsdom records as regression baselines. Normal-mode readiness accepts this with explicit owner and next action; release-mode readiness must still surface release-required proxy/unsupported evidence.

## Unsupported Evidence Disposition

| Record | Owner | Platform qualifier | Next action |
|---|---|---|---|
| `S-CS-COLD/firstPaintMs` | `release-grade-evidence-collection` | supported Tauri/WebView startup marker runner unavailable in current CI/local evidence set | collect real Tauri webview first-paint timing |
| `S-CS-COLD/firstInteractiveMs` | `release-grade-evidence-collection` | supported Tauri/WebView startup marker runner unavailable in current CI/local evidence set | collect real Tauri webview first-interactive timing |
| `S-LR-101/sampledOsChildLivenessAfterClose` | `long-running-runtime-evidence` | cross-platform OS child process sampler unavailable | add or waive a platform-safe sampler before release-grade closure |
| `S-LR-200/moduleSwitchP95Ms` | `long-running-runtime-evidence` | Tauri/WebView module-switch trace unavailable in jsdom evidence | collect module switch P95 from a supported Tauri/WebView trace |

## Verification Summary

| Field | Before | After |
|---|---:|---:|
| status | warn | pass |
| exitCode | 2 | 0 |
| hardFailures | 0 | 0 |
| warnings | 16 | 0 |
| budgetMissingCount | 15 | 0 |
| proxyRatio | 0.6842 | 0.6842 |
| unresolved unsupported labels | 8 | 0 |
| accepted budget residuals | 0 | 15 |
| accepted unsupported records | 0 | 8 |

Validation commands:

- `openspec validate clean-up-perf-archive-readiness-debt --strict --no-interactive`
- `node --test scripts/perf-archive-readiness.test.mjs`
- `node --test scripts/generate-runtime-evidence-report.test.mjs`
- `npm run --silent perf:archive-readiness -- --json`
