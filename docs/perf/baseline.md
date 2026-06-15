# v0.5.9 Performance Baseline

Generated at: 2026-06-13T05:51:58.078Z
Schema version: 1.0
Branch: feature/v0.5.9
Commit: f731af5b2c7f930393e58ca5e40f356b19b37668

## Section A — Fixture-Replay Baseline

| Scenario | Metric | Value | Unit | Evidence | Target | Hard Fail | Notes |
|---|---:|---:|---|---|---:|---:|---|
| S-LL-200 | commitDurationP50 | 11.44 | ms | proxy |  |  |  |
| S-LL-200 | commitDurationP95 | 11.44 | ms | proxy |  |  |  |
| S-LL-200 | firstPaintAfterMount | 37.17 | ms | proxy |  |  |  |
| S-LL-500 | commitDurationP50 | 14.32 | ms | proxy |  |  |  |
| S-LL-500 | commitDurationP95 | 14.32 | ms | proxy |  |  |  |
| S-LL-500 | firstPaintAfterMount | 35.73 | ms | proxy |  |  |  |
| S-LL-1000 | commitDurationP50 | 27.01 | ms | proxy |  |  |  |
| S-LL-1000 | commitDurationP95 | 27.01 | ms | proxy |  |  |  |
| S-LL-1000 | firstPaintAfterMount | 48.29 | ms | proxy |  |  |  |
| S-LL-1000 | scrollFrameDropPct | 0 | % | proxy | 1 | 5 | jsdom proxy; browser scroll gate is follow-up |
| S-CI-50 | keystrokeToCommitP95 | 0.08 | ms | proxy | 16 | 32 |  |
| S-CI-50 | inputEventLossCount | 0 | count | proxy | 0 | 0 | approved (input-latency-budget) |
| S-CI-50 | compositionToCommit | 0 | ms | proxy |  |  |  |
| S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy | 16 | 32 |  |
| S-CI-100-IME | inputEventLossCount | 0 | count | proxy | 0 | 0 | approved (input-latency-budget) |
| S-CI-100-IME | compositionToCommit | 0.12 | ms | proxy |  |  |  |
| S-RS-FT | firstTokenLatency | 5000 | ms | proxy | 2000 | 5000 | turn start to first assistant delta |
| S-RS-FT | interTokenJitterP95 | 920 | ms | proxy | 500 | 920 |  |
| S-RS-PE | dedupHitRatio | 0.25 | ratio | proxy |  |  |  |
| S-RS-PE | assemblerLatency | 4.77 | ms | proxy |  |  | replay reducer-path proxy latency |
| S-RS-VL | visibleTextLagP95 | 35 | ms | measured | 2000 | 5000 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json |
| S-RS-RA | reducerAmplificationMedian | 3 | ratio | measured | 2 | 4 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json |
| S-RS-FD | batchFlushDurationP95 | 14 | ms | measured | 8 | 16 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json |
| S-RS-TS | terminalSettlementP95 | 70 | ms | measured | 100 | 250 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json |
| S-CS-COLD | bundleSizeMain | 1052527 | bytes-gzip | measured | 950000 | 1100000 | App-DQ2N5_ml.js |
| S-CS-COLD | bundleSizeVendor | 741554 | bytes-gzip | measured | 680000 | 760000 | subset-shared.chunk-BqJAHzmS.js |
| S-CS-COLD | firstPaintMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. |
| S-CS-COLD | firstInteractiveMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. |

## Section B — Cross-Platform Notes

- darwin: S-CS-COLD/firstPaintMs unsupported - Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded.
- darwin: S-CS-COLD/firstInteractiveMs unsupported - Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded.

## Section C — Previous Baseline Comparison

Previous baseline: v0.5.6 (docs/perf/history/v0.5.6-baseline.json)

| Scenario | Metric | Previous | Current | Delta | Unit | Evidence | Status |
|---|---|---:|---:|---:|---|---|---|
| S-LL-200 | commitDurationP50 | 17.6 | 11.44 | -6.16 | ms | proxy | comparable |
| S-LL-200 | commitDurationP95 | 17.6 | 11.44 | -6.16 | ms | proxy | comparable |
| S-LL-200 | firstPaintAfterMount | 54.54 | 37.17 | -17.37 | ms | proxy | comparable |
| S-LL-500 | commitDurationP50 | 170.66 | 14.32 | -156.34 | ms | proxy | comparable |
| S-LL-500 | commitDurationP95 | 170.66 | 14.32 | -156.34 | ms | proxy | comparable |
| S-LL-500 | firstPaintAfterMount | 195.04 | 35.73 | -159.31 | ms | proxy | comparable |
| S-LL-1000 | commitDurationP50 | 34.47 | 27.01 | -7.46 | ms | proxy | comparable |
| S-LL-1000 | commitDurationP95 | 34.47 | 27.01 | -7.46 | ms | proxy | comparable |
| S-LL-1000 | firstPaintAfterMount | 58.43 | 48.29 | -10.14 | ms | proxy | comparable |
| S-LL-1000 | scrollFrameDropPct | 0 | 0 | 0 | % | proxy | comparable |
| S-CI-50 | keystrokeToCommitP95 | 0.08 | 0.08 | 0 | ms | proxy | comparable |
| S-CI-50 | inputEventLossCount | 0 | 0 | 0 | count | proxy | comparable |
| S-CI-50 | compositionToCommit | 0 | 0 | 0 | ms | proxy | comparable |
| S-CI-100-IME | keystrokeToCommitP95 | 0.03 | 0.03 | 0 | ms | proxy | comparable |
| S-CI-100-IME | inputEventLossCount | 0 | 0 | 0 | count | proxy | comparable |
| S-CI-100-IME | compositionToCommit | 0.11 | 0.12 | 0.01 | ms | proxy | comparable |
| S-RS-FT | firstTokenLatency | 5000 | 5000 | 0 | ms | proxy | comparable |
| S-RS-FT | interTokenJitterP95 | 920 | 920 | 0 | ms | proxy | comparable |
| S-RS-PE | dedupHitRatio | 0.25 | 0.25 | 0 | ratio | proxy | comparable |
| S-RS-PE | assemblerLatency | 5.73 | 4.77 | -0.96 | ms | proxy | comparable |
| S-RS-VL | visibleTextLagP95 | unsupported | 35 |  | ms | measured | missing |
| S-RS-RA | reducerAmplificationMedian | unsupported | 3 |  | ratio | measured | missing |
| S-RS-FD | batchFlushDurationP95 | unsupported | 14 |  | ms | measured | missing |
| S-RS-TS | terminalSettlementP95 | unsupported | 70 |  | ms | measured | missing |
| S-CS-COLD | bundleSizeMain | unsupported | 1052527 |  | bytes-gzip | measured | missing |
| S-CS-COLD | bundleSizeVendor | unsupported | 741554 |  | bytes-gzip | measured | missing |
| S-CS-COLD | firstPaintMs | unsupported | unsupported |  | ms | unsupported | not comparable |
| S-CS-COLD | firstInteractiveMs | unsupported | unsupported |  | ms | unsupported | not comparable |

> Comparison status: 20/28 metrics comparable; 6 missing, 2 not comparable.

## Section D — Residual Risks

- Baseline values are fixture-based and should be used for relative comparison, not absolute UX claims.
