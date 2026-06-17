# Runtime Evidence Gates

Generated at: 2026-06-17T15:45:18.383Z

## Performance Evidence

| Source | Scenario | Metric | Value | Unit | Class | Target | Hard Fail | Reason | Next Action |
|---|---|---|---:|---|---|---:|---:|---|---|
| docs/perf/baseline.json | S-LL-200 | commitDurationP50 | 10.06 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | commitDurationP95 | 10.06 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-200 | firstPaintAfterMount | 36.9 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP50 | 12.96 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | commitDurationP95 | 12.96 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-500 | firstPaintAfterMount | 32.03 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP50 | 21.28 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | commitDurationP95 | 21.28 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | firstPaintAfterMount | 41.55 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-LL-1000 | scrollFrameDropPct | 0 | % | proxy | 1 | 5 | jsdom proxy; browser scroll gate is follow-up | Add browser-level scroll gate for the 1000-row scenario. |
| docs/perf/baseline.json | S-CI-50 | keystrokeToCommitP95 | 0.08 | ms | proxy | 16 | 32 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | inputEventLossCount | 0 | count | proxy | 0 | 0 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-50 | compositionToCommit | 0 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy | 16 | 32 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | inputEventLossCount | 0 | count | proxy | 0 | 0 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-CI-100-IME | compositionToCommit | 0.1 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/baseline.json | S-RS-FT | firstTokenLatency | 5000 | ms | proxy | 2000 | 5000 | turn start to first assistant delta | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-FT | interTokenJitterP95 | 920 | ms | proxy | 500 | 920 | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | dedupHitRatio | 0.25 | ratio | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-PE | assemblerLatency | 4.59 | ms | proxy |  |  | replay reducer-path proxy latency | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-VL | visibleTextLagP95 | 35 | ms | measured | 2000 | 5000 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-RA | reducerAmplificationMedian | 3 | ratio | measured | 2 | 4 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-FD | batchFlushDurationP95 | 14 | ms | measured | 8 | 16 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-RS-TS | terminalSettlementP95 | 70 | ms | measured | 100 | 250 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeMain | 1068094 | bytes-gzip | measured | 950000 | 1100000 | App-pCMuvY3q.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | bundleSizeVendor | 741553 | bytes-gzip | measured | 680000 | 760000 | subset-shared.chunk-BcpPBYlL.js | Track for regression. |
| docs/perf/baseline.json | S-CS-COLD | firstPaintMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/baseline.json | S-CS-COLD | firstInteractiveMs | unsupported | ms | unsupported |  |  | Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded. | Collect real Tauri webview cold-start timing on a supported runner. |
| docs/perf/composer-baseline.json | S-CI-50 | keystrokeToCommitP95 | 0.08 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-50 | inputEventLossCount | 0 | count | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-50 | compositionToCommit | 0 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | keystrokeToCommitP95 | 0.03 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | inputEventLossCount | 0 | count | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/composer-baseline.json | S-CI-100-IME | compositionToCommit | 0.1 | ms | proxy |  |  | Fixture or replay evidence; useful for regression comparison, not release-grade runtime proof. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/long-list-browser-scroll.json | S-LL-1000 | browserScrollFrameDropPct | 0 | % | measured |  |  | browser=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome | Track for regression. |
| docs/perf/realtime-runtime-evidence.json | S-RS-VL | visibleTextLagP95 | 35 | ms | measured | 2000 | 5000 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-RA | reducerAmplificationMedian | 3 | ratio | measured | 2 | 4 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-FD | batchFlushDurationP95 | 14 | ms | measured | 8 | 16 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/realtime-runtime-evidence.json | S-RS-TS | terminalSettlementP95 | 70 | ms | measured | 100 | 250 | measured runtime turn trace from .artifacts/realtime-runtime-diagnostics.json | Correlate replay metrics with runtime visible-lag and terminal-pressure traces. |
| docs/perf/v0511-runtime-evidence.json | S-IO-RR | prepareThreadItems_calls_per_1000_delta | 0 | count | proxy |  |  | Proxy fixture anchored to useThreadsReducer.append-agent-delta-fast-path 1000-delta Codex burst. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-RR | realtime_reducer_dispatches_per_1000_delta | 1000 | count | proxy |  |  | Proxy fixture anchored to useThreadsReducer.__profile reducerDispatchCount for the same burst. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-RR | thread_reducer_flush_ms_p95 | 0.025 | ms | proxy |  |  | Proxy timing from the same reducer-only 1000-delta fixture; not a browser frame/render measurement. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-RR | realtime_delta_route_ms_p95 | 0.003 | ms | proxy |  |  | Proxy timing from dispatchAppServerEvent over the synthetic 1000-delta app-server route. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-AS | app_server_event_raw_per_sec | 1000 | events/sec | proxy |  |  | Proxy burst fixture: 1000 app-server delta events submitted in a one-second synthetic window. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-AS | app_server_event_ipc_emit_per_sec | 1 | events/sec | proxy |  |  | Proxy burst fixture expects one per-workspace batch IPC payload for the synthetic window. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-AS | app_server_event_route_ms_p95 | 0.001 | ms | proxy |  |  | Proxy timing from dispatchAppServerEvent over 1000 synthetic app-server delta payloads. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-AS | realtime_reducer_dispatches_per_1000_delta | 1000 | count | proxy |  |  | Proxy fixture counts routed append-only deltas through dispatchAppServerEventBatch. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-AS | main_thread_long_task_count_during_stream | 0 | count | proxy |  |  | Node fixture proxy: one synchronous batch route is compared to the 50ms long-task threshold; browser PerformanceObserver remains release follow-up. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FC | fs_event_raw_per_sec | 1000 | events/sec | proxy |  |  | Proxy same-path burst fixture mirrors DebouncedState same-key replacement semantics. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FC | fs_event_emitted_per_sec | 1 | events/sec | proxy |  |  | Proxy same-path burst fixture emits one debounced batch for one flush window. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FC | fs_event_same_path_coalesce_ratio | 0.999 | ratio | proxy |  |  | Proxy same-path burst fixture: (rawCount - emittedCount) / rawCount. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FC | fs_event_empty_batch_emit_count | 0 | count | proxy |  |  | Proxy fixture matches external_changes_debouncer_no_empty_batch_emit regression contract. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FS | file_io_command_wall_ms_p95 | 12.892 | ms | proxy |  |  | Proxy Node async fs fixture: 10MB write+read wall-time P95; Tauri command timing remains release follow-up. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FS | file_io_async_worker_stall_ms_p95 | 0.248 | ms | proxy |  |  | Proxy event-loop stall probe sampled with setImmediate during async 10MB write+read fixture. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FS | file_io_blocking_pool_call_count | 10 | count | proxy |  |  | Proxy count of async fs operations in the fixture; native Tauri blocking-pool attribution remains release follow-up. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FS | tauri_command_during_stream_ms_p95 | 12.892 | ms | proxy |  |  | Proxy wall-time reused for the content-safe file I/O fixture; not a live Tauri command measurement. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FP | composer_render_count_per_streaming_minute | 2 | count | proxy |  |  | Proxy render-counter fixture using the same __profile.recordComponentRender hook wired by useLayoutNodes Profiler. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FP | sidebar_render_count_per_streaming_minute | 1 | count | proxy |  |  | Proxy render-counter fixture using the same __profile.recordComponentRender hook wired by useLayoutNodes Profiler. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FP | thread_row_rerender_count_per_1000_delta | 1 | count | proxy |  |  | Proxy render-counter fixture; production row-level Profiler capture remains release follow-up. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
| docs/perf/v0511-runtime-evidence.json | S-IO-FP | layout_nodes_recompute_count_per_1000_delta | 1 | count | proxy |  |  | Proxy render-counter fixture; production layout recompute capture remains release follow-up. | Keep as regression baseline and add runtime/browser evidence before release-grade closure. |
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
- Long-list commit P95: 21.28 ms
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
- prepareThreadItems calls / 1000 delta: 0 (target 5)
- Reducer flush P95: 0.025 ms (target 8)
- Delta route P95: 0.003 ms (target 4)
- Evidence class: proxy
- Reason: Producer artifact captures reducer fast-path and realtime route timing proxy evidence.
- Next action: Promote proxy reducer and route timing to measured Tauri/WebView evidence before release-grade closure.

## Backend File IO Isolation

- Diagnostics label: perf.backend.file-io-isolation
- File I/O command wall P95: 12.892 ms (no artificial 5ms budget)
- Async worker stall P95: 0.248 ms (target 1)
- Blocking pool call count: 10
- Tauri command during stream P95: 12.892 ms
- Evidence class: proxy
- Reason: Proxy Node async fs fixture: 10MB write+read wall-time P95; Tauri command timing remains release follow-up.
- Next action: Run blocking pool call counter and async-worker stall probe in a 10MB read/write fixture during streaming.

## File Change Debounce

- Diagnostics label: perf.file-change.debounce
- Raw fs events / sec: 1000
- Emitted fs events / sec: 1 (target 10)
- Same-path coalesce ratio: 0.999 (target 0.8)
- Empty batch emit count: 0 (target 0)
- Evidence class: proxy
- Reason: Producer artifact captures same-path burst debounce evidence.
- Next action: Promote proxy burst evidence to Rust/runtime measured evidence when a native producer is available.

## App Server Event Batching

- Diagnostics label: perf.app-server-event.batching
- Raw app server events / sec: 1000
- IPC app server events / sec: 1 (target ipcEmit/raw ratio 0.1)
- Route P95: 0.001 ms (target 4)
- Reducer dispatches / 1000 delta: 1000 (target 1000)
- Main thread long tasks during stream: 0 (target 0)
- Evidence class: proxy
- Reason: Producer artifact captures raw-vs-IPC batching, route timing, reducer dispatch, and long-task proxy evidence.
- Next action: Promote proxy route timing and long-task count to measured browser/Tauri evidence before release-grade closure.

## Frontend Prop Chain Stability

- Diagnostics label: perf.frontend.prop-chain-stability
- Composer renders / streaming minute: 2 (target 1800)
- Sidebar renders / streaming minute: 1 (target 600)
- Thread row rerenders / 1000 delta: 1 (target 100)
- Layout nodes recomputes / 1000 delta: 1 (target 100)
- Evidence class: proxy
- Reason: Proxy render-counter fixture using the same __profile.recordComponentRender hook wired by useLayoutNodes Profiler.
- Next action: Add Profiler-based render counters or React Profiler API capture during the streaming fixture.

## Cold Start

- First paint evidence: unsupported
- First interactive evidence: unsupported
- Reason: Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded.
- Next action: Collect Tauri webview timing on supported macOS/Windows/Linux runners.
