# Runtime Evidence Gates

Generated at: 2026-06-17T09:50:58.775Z

## Performance Evidence

| Source | Scenario | Metric | Value | Unit | Class | Target | Hard Fail | Reason | Next Action |
|---|---|---|---:|---|---|---:|---:|---|---|
| docs/perf/baseline.json | S-LL-200 | commitDurationP50 | 11.44 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | commitDurationP95 | 11.44 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | firstPaintAfterMount | 37.17 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP50 | 14.32 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP95 | 14.32 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | firstPaintAfterMount | 35.73 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP50 | 27.01 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP95 | 27.01 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | firstPaintAfterMount | 48.29 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | scrollFrameDropPct | 0 | % | proxy | 1 | 5 | jsdom proxy; browser scroll gate is follow-up | Add browser-level scroll gate for the 1000-row scenario. |
| docs/perf/baseline.json | S-CI-50 | keystrokeToCommitP95 | 0.08 | ms | proxy | 16 | 32 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | inputEventLossCount | 0 | count | proxy | 0 | 0 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | compositionToCommit | 0 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy | 16 | 32 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | inputEventLossCount | 0 | count | proxy | 0 | 0 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | compositionToCommit | 0.12 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-RS-FT | firstTokenLatency | 5000 | ms | proxy | 2000 | 5000 | turn start to first assistant delta | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-FT | interTokenJitterP95 | 920 | ms | proxy | 500 | 920 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | dedupHitRatio | 0.25 | ratio | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | assemblerLatency | 4.77 | ms | proxy |  |  | replay reducer-path proxy latency | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-VL | visibleTextLagP95 | 35 | ms | measured | 2000 | 5000 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-RA | reducerAmplificationMedian | 3 | ratio | measured | 2 | 4 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-FD | batchFlushDurationP95 | 14 | ms | measured | 8 | 16 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-TS | terminalSettlementP95 | 70 | ms | measured | 100 | 250 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeMain | 1052527 | bytes-gzip | measured | 950000 | 1100000 | App-DQ2N5_ml.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeVendor | 741554 | bytes-gzip | measured | 680000 | 760000 | subset-shared.chunk-BqJAHzmS.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | firstPaintMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/baseline.json | S-CS-COLD | firstInteractiveMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/baseline.json | S-CHAT-100 | longConversationFrameP95 | 24 | ms | proxy | 16.8 | 33.6 | 500-row + 2-thread parallel streaming 5min trace; baseline derived from S-RS-VL2 (proxy) | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CHAT-101 | reducerFastPathHitRate | 0 | ratio | proxy | 0.85 | 0.6 | fraction of streaming deltas that returned prior state reference; chat-stream-render-isolation-2026-06 task 1.x | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CHAT-102 | virtualizerActiveDuringStreaming | true | bool | proxy | true | false | shouldVirtualizeTimelineRows must be true when rowCount>=200 even if isThinking===true; chat-stream-render-isolation-2026-06 task 2.x | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CHAT-103 | workspaceScopedRefEvictions | 0 | count | proxy | 0 | 0 | orphan workspace-scope ref entries after LRU eviction; chat-stream-render-isolation-2026-06 task 8.x | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CHAT-104 | transientTimerCleanups | 1 | ratio | proxy | 1 | 1 | fraction of active-thread switches that cleared all 7 RAF/timeout refs in Messages; chat-stream-render-isolation-2026-06 task 7.1 | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-50 | keystrokeToCommitP95 | 0.08 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-50 | inputEventLossCount | 0 | count | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-50 | compositionToCommit | 0 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | inputEventLossCount | 0 | count | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | compositionToCommit | 0.12 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/long-list-browser-scroll.json | S-LL-1000 | browserScrollFrameDropPct | 0 | % | measured |  |  | browser=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome | Track for regression. |
| docs/perf/realtime-runtime-evidence.json | S-RS-VL | visibleTextLagP95 | 35 | ms | measured | 2000 | 5000 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-RA | reducerAmplificationMedian | 3 | ratio | measured | 2 | 4 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-FD | batchFlushDurationP95 | 14 | ms | measured | 8 | 16 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-TS | terminalSettlementP95 | 70 | ms | measured | 100 | 250 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/long-running-runtime-evidence.json | S-LR-100 | activeEngineProcessCountAfterClose | 0 | count | measured |  |  | registered runtime handle count; OS child liveness recorded separately under S-LR-101 | Track for regression. |
| docs/perf/long-running-runtime-evidence.json | S-LR-101 | sampledOsChildLivenessAfterClose | unsupported | count | unsupported |  |  | Runtime does not ship a cross-platform OS child process sampler; sampler added in release-grade-evidence follow-up (task 6.4) | Provide supported environment evidence or preserve explicit qualifier. |
| docs/perf/long-running-runtime-evidence.json | S-LR-110 | staleEngineChildCandidateCount | 0 | count | measured |  |  | diagnostics-only; no auto-kill; candidates require registeredAgeMs >= 5min; OpenCode/Gemini report progress_evidence=unsupported | Track for regression. |
| docs/perf/long-running-runtime-evidence.json | S-LR-200 | moduleSwitchP95Ms | unsupported | ms | unsupported |  |  | jsdom cannot produce real module switch latency; requires Tauri/WebView trace | Provide supported environment evidence or preserve explicit qualifier. |
| docs/perf/long-running-runtime-evidence.json | S-LR-210 | visibleListRowCount | 36 | rows | proxy |  |  | 200-workspace / 200-thread fixture; DOM mounted row count is bounded by virtualizer overscan, not by list size; CSS defines bounded scroll viewport plus relative/absolute virtual rows | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/long-running-runtime-evidence.json | S-LR-300 | markdownWorkerPendingRequests | 0 | count | proxy |  |  | pending count returns to 0 after worker dispose; worker request carries content-safe requestMeta; unit-tested in workerAdapterDiagnostics.test.ts | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/long-running-runtime-evidence.json | S-LR-310 | streamingVisibleLagP95Ms | 24 | ms | proxy |  |  | reuses S-RS-VL2 proxy from chat-stream-render-isolation-2026-06; no fresh runtime trace in this change | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |

## Realtime Correlation

- First token latency: 5000 ms
- Inter-token jitter P95: 920 ms
- Visible text lag P95: 35 ms (turn-trace correlation gate)
- Reducer amplification median: 3 ratio
- Batch flush duration P95: 14 ms
- Terminal settlement P95: 70 ms
- Visible lag risk: high
- Terminal pressure: not-directly-measured
- Turn trace evidence class: proxy (source: docs/perf/realtime-turn-trace.json)
- Next action: Add runtime trace that correlates ingress cadence, batch flush, render-visible cadence, and terminal settlement.

## Renderer Resource Pressure

- Backpressure flush cap: 200 events / 131072 bytes
- Backpressure evidence: measured
- Listener owner pilot surfaces: events.terminal-output, events.runtime-log-line, events.runtime-log-status, focus-refresh-wave
- Media owner pilot surfaces: message-image-grid, message-deferred-image
- Residual listener risk: Full-app listener inventory remains manual; pilot surfaces are tracked first.

## Backend IO / Bridge Payload

- Scan cache substrate: ScanCache<K,V>.get_or_compute/invalidate/invalidate_matching
- JSONL states: append-only, full-rescan, corrupt-fallback
- Bridge pilot command: get_git_log
- Bridge payload target: 1048576 bytes / 2000 items
- Bridge residual risk: session catalog, local usage, Claude history, workspace files, project map relations

## Workspace File Listing

- Diagnostics label: workspaces.file.listing-budget
- Initial listing target: 1048576 bytes / 2000 entries
- Subtree target entries: 500
- Shared index fields: pathTokens, directoryTokens, sourceVersion, freshness, invalidatedPaths
- Long-list commit P95: 27.01 ms
- Browser scroll drop: 0%
- Content safety: Diagnostics store hashes, counts, sourceVersion, and payload sizes; file contents and raw paths are excluded.

## Markdown Precompute

- Diagnostics label: perf.messages.markdown.precompute
- Threshold: 10000 chars or fenced-code, math, table, raw-html
- Modes: worker-precompute, main, cache-hit, fallback
- Unsafe HTML boundary: Worker output is not trusted DOM; rich React render and sanitization remain on the main renderer path.
- Content safety: Diagnostics store source length/hash and structural counts; raw Markdown, prompt text, assistant body, tool output, and file content are excluded.

## Realtime Input Render Budget

- Diagnostics label: perf.realtime.input-render-budget
- prepareThreadItems calls / 1000 delta: unsupported (target 5)
- Reducer flush P95: unsupported ms (target 8)
- Delta route P95: unsupported ms (target 4)
- Evidence class: unsupported
- Reason: Streaming fixture needed to populate reducer fast-path evidence; baseline scenarios are added by this change.
- Next action: Wire prepareThreadItems call counter and reducer flush timing into the realtime replay fixture.

## Backend File IO Isolation

- Diagnostics label: perf.backend.file-io-isolation
- File I/O command wall P95: unsupported ms (no artificial 5ms budget)
- Async worker stall P95: unsupported ms (target 1)
- Blocking pool call count: unsupported
- Tauri command during stream P95: unsupported ms
- Evidence class: unsupported
- Reason: Blocking pool call counter and async-worker stall probe will be added by the file I/O isolation step.
- Next action: Run blocking pool call counter and async-worker stall probe in a 10MB read/write fixture during streaming.

## File Change Debounce

- Diagnostics label: perf.file-change.debounce
- Raw fs events / sec: unsupported
- Emitted fs events / sec: unsupported (target 10)
- Same-path coalesce ratio: unsupported (target 0.8)
- Empty batch emit count: unsupported (target 0)
- Evidence class: unsupported
- Reason: Debounce emitter is added by the file watcher debounce step; current fixture does not yet produce same-path burst events.
- Next action: Generate a 1000-event same-path burst fixture and capture raw vs emitted counts.

## App Server Event Batching

- Diagnostics label: perf.app-server-event.batching
- Raw app server events / sec: unsupported
- IPC app server events / sec: unsupported (target ipcEmit/raw ratio 0.1)
- Route P95: unsupported ms (target 4)
- Reducer dispatches / 1000 delta: unsupported (target 1000)
- Main thread long tasks during stream: unsupported (target 0)
- Evidence class: unsupported
- Reason: App server event batching emitter and batch-aware route are added by the batching step.
- Next action: Capture raw vs IPC emit divergence and reducer dispatch count in a multi-workspace codex streaming fixture.

## Frontend Prop Chain Stability

- Diagnostics label: perf.frontend.prop-chain-stability
- Composer renders / streaming minute: unsupported (target 1800)
- Sidebar renders / streaming minute: unsupported (target 600)
- Thread row rerenders / 1000 delta: unsupported (target 100)
- Layout nodes recomputes / 1000 delta: unsupported (target 100)
- Evidence class: unsupported
- Reason: Domain context split and scoped status lookup are added by the prop chain stability step; render counters need source.
- Next action: Add Profiler-based render counters or React Profiler API capture during the streaming fixture.

## Cold Start

- First paint evidence: unsupported
- First interactive evidence: unsupported
- Reason: Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded.
- Next action: Collect Tauri webview timing on supported macOS/Windows/Linux runners.
