# Runtime Evidence Gates

Generated at: 2026-05-24T11:31:59.707Z

## Performance Evidence

| Source | Scenario | Metric | Value | Unit | Class | Reason | Next Action |
|---|---|---|---:|---|---|---|---|
| docs/perf/baseline.json | S-LL-200 | commitDurationP50 | 14.15 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | commitDurationP95 | 14.15 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | firstPaintAfterMount | 40.01 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP50 | 20.08 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP95 | 20.08 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | firstPaintAfterMount | 41.12 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP50 | 18.71 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP95 | 18.71 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | firstPaintAfterMount | 39.5 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | scrollFrameDropPct | 0 | % | proxy | jsdom proxy; browser scroll gate is follow-up | Add browser-level scroll gate for the 1000-row scenario. |
| docs/perf/baseline.json | S-CI-50 | keystrokeToCommitP95 | 0.09 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | inputEventLossCount | 0 | count | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | compositionToCommit | 0 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | inputEventLossCount | 0 | count | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | compositionToCommit | 0.11 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-RS-FT | firstTokenLatency | 5000 | ms | proxy | turn start to first assistant delta | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-FT | interTokenJitterP95 | 920 | ms | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | dedupHitRatio | 0.25 | ratio | proxy | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | assemblerLatency | 4.05 | ms | proxy | replay reducer-path proxy latency | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeMain | 1128218 | bytes | measured | App-GaIGSlNJ.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeVendor | 672902 | bytes | measured | vendor-mermaid-DpHPKkXo.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | firstPaintMs | unsupported | ms | unsupported | Tauri webview headless cold-start timing is not available in this script; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/baseline.json | S-CS-COLD | firstInteractiveMs | unsupported | ms | unsupported | Tauri webview headless cold-start timing is not available in this script; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/long-list-browser-scroll.json | S-LL-1000 | browserScrollFrameDropPct | 0 | % | measured | browser=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome | Track for regression. |

## Realtime Correlation

- First token latency: 5000 ms
- Inter-token jitter P95: 920 ms
- Visible lag risk: high
- Terminal pressure: not-directly-measured
- Next action: Add runtime trace that correlates ingress cadence, batch flush, render-visible cadence, and terminal settlement.

## Cold Start

- First paint evidence: unsupported
- First interactive evidence: unsupported
- Reason: Tauri webview headless cold-start timing is not available in this script; bundle baseline is recorded.
- Next action: Collect Tauri webview timing on supported macOS/Windows/Linux runners.
