# Implementation Evidence

Updated at: 2026-06-17

## Scope Completed In First Implementation Pass

- Replaced the initial `.mjs` placeholder with `scripts/perf-v0511-runtime-evidence.ts` so the producer can reuse existing TypeScript reducer/dispatcher/profile modules instead of duplicating logic.
- Added `scripts/perf-v0511-runtime-evidence.test.mjs`.
- Added `perf:v0511-runtime-evidence` npm script.
- Wired `docs/perf/v0511-runtime-evidence.json` into `scripts/generate-runtime-evidence-report.mjs`.
- Updated runtime evidence summaries so producer-backed summaries no longer keep stale "wire this producer" reason text.
- Preserved release-grade caveats for fixture-only timing/render sources instead of claiming measured desktop runtime evidence.

## Command Evidence

### Proposal Calibration

- `openspec validate v0511-performance-evidence-and-runtime-jank-hardening --strict --no-interactive`: pass.
- `openspec list --json`: active changes after scaffold are:
  - `v0511-performance-evidence-and-runtime-jank-hardening` (`0/28` at start of apply)
  - `fix-runtime-reconnect-card-state-loop` (`7/7`)
  - `fix-file-tree-virtual-scroll-height` (`0/0`)

### Current-State Readiness

- `npm run perf:archive-readiness -- --json`: exits `2`, `ok: true`, `status: "warn"`, `hardFailures: []`.
- Before this change, `activeChangeCount` was `2`.
- After creating this change, `activeChangeCount` is `3`.
- Budget warnings remain `15`; they are existing baseline budget ownership items.

### Producer And Aggregation

- `npm run perf:v0511-runtime-evidence -- --verbose`: pass.
- `node --test scripts/perf-v0511-runtime-evidence.test.mjs`: pass (`1` producer contract test).
- `npm run perf:baseline:all`: pass; generated latest v0.5.11 baseline artifacts and immutable history artifacts.
- `npm run check:runtime-evidence-gates`: pass.
- `node --test scripts/generate-runtime-evidence-report.test.mjs`: pass (`14` tests).
- `node --test scripts/perf-startup-marker-snapshot.test.mjs scripts/perf-cold-start-baseline.test.mjs`: pass (`4` tests).
- `npm run perf:baseline:aggregate && npm run perf:archive-readiness -- --json`: aggregate pass; archive readiness exits `2` with `ok: true`, `status: "warn"`, `hardFailures: []`, `budgetMissingCount: 15`.
- `npm exec vitest run src/features/threads/hooks/useThreadsReducer.append-agent-delta-fast-path.test.ts src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`: pass (`22` tests).
- `cargo test --manifest-path src-tauri/Cargo.toml external_changes_debouncer`: pass (`4` focused tests, `1257` filtered).
- `node --test scripts/generate-runtime-evidence-report.test.mjs scripts/perf-startup-marker-snapshot.test.mjs scripts/perf-cold-start-baseline.test.mjs`: pass (`18` tests).
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `openspec validate v0511-performance-evidence-and-runtime-jank-hardening --strict --no-interactive`: pass.
- Final `npm run perf:archive-readiness -- --json`: exits `2`, `ok: true`, `status: "warn"`, `hardFailures: []`, `activeChangeCount: 3`, `metricCount: 28`, `budgetMissingCount: 15`.
- After the test-first producer upgrade, `npm run check:runtime-evidence-gates`: pass; `S-IO-RR`, `S-IO-AS`, `S-IO-FS`, and `S-IO-FP` summaries consume proxy producer values.
- After the test-first producer upgrade, `npm run perf:archive-readiness -- --json`: exits `2`, `ok: true`, `status: "warn"`, `hardFailures: []`, `unsupportedRecords` no longer include `S-IO-RR`, `S-IO-AS`, `S-IO-FS`, or `S-IO-FP`.

## Budget Ownership Fix

- Added explicit budgets for `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` in `scripts/perf-aggregate.mjs`.
- This removed the two input-loss unassigned-budget warnings from archive readiness without changing observed metric values.

## Current Metric Outcome

### Now Producer-Backed

- `S-IO-RR/prepareThreadItems_calls_per_1000_delta`: `0`, proxy.
- `S-IO-RR/realtime_reducer_dispatches_per_1000_delta`: `1000`, proxy.
- `S-IO-RR/thread_reducer_flush_ms_p95`: proxy timing from reducer-only 1000-delta fixture.
- `S-IO-RR/realtime_delta_route_ms_p95`: proxy timing from `dispatchAppServerEvent`.
- `S-IO-AS/app_server_event_raw_per_sec`: `1000`, proxy.
- `S-IO-AS/app_server_event_ipc_emit_per_sec`: `1`, proxy.
- `S-IO-AS/app_server_event_route_ms_p95`: proxy timing from `dispatchAppServerEvent`.
- `S-IO-AS/realtime_reducer_dispatches_per_1000_delta`: `1000`, proxy.
- `S-IO-AS/main_thread_long_task_count_during_stream`: `0`, proxy long-task threshold check in Node fixture.
- `S-IO-FC/fs_event_raw_per_sec`: `1000`, proxy.
- `S-IO-FC/fs_event_emitted_per_sec`: `1`, proxy.
- `S-IO-FC/fs_event_same_path_coalesce_ratio`: `0.999`, proxy.
- `S-IO-FC/fs_event_empty_batch_emit_count`: `0`, proxy.
- `S-IO-FS/*`: proxy content-safe 10MB async file I/O fixture.
- `S-IO-FP/*`: proxy render-counter fixture using `__profile.recordComponentRender`.

### Intentionally Still Unsupported

- `S-CS-COLD/firstPaintMs` and `firstInteractiveMs` unless a real startup marker snapshot is supplied

The remaining unsupported rows require real Tauri/WebView or long-running process sampling and are outside the four v0.5.11 runtime jank producer gaps.

## Explicit No-Op Decisions

- File-change debounce values pass the current targets in the proxy burst fixture; no debounce runtime fix was made in this pass.
- Cold-start timing values were not invented; the existing startup marker path remains the only way to upgrade timing to measured.
- Realtime route timing, app-server route timing, backend file I/O timing, and frontend render-count hardening are now covered by proxy producers and a producer contract test.
- These proxy producers do not claim release-grade desktop runtime proof; native Tauri/WebView capture remains the next evidence upgrade.

## Measured Diagnostics Upgrade

- Added `--diagnostics=<path>` support to `scripts/perf-v0511-runtime-evidence.ts`.
- Without an explicit path, the producer now reads `.artifacts/realtime-runtime-diagnostics.json` when present; use `--diagnostics=none` to force proxy-only regression output.
- Accepted measured rows are limited to the v0.5.11 S-IO whitelist and require numeric non-negative values.
- Explicit `perf.v0511.runtime-evidence` diagnostics can promote individual rows from `proxy` to `measured`.
- Existing `realtime.turnTrace.summary` diagnostics with `evidenceClass: "measured"` now promote:
  - `S-IO-RR/realtime_reducer_dispatches_per_1000_delta` from `counters.reducerCommitCount / counters.deltaCount * 1000`
  - `S-IO-RR/realtime_delta_route_ms_p95` from `deltas.firstDeltaToBatchFlushEndMs`
  - `S-IO-RR/thread_reducer_flush_ms_p95` from `deltas.batchFlushEndToReducerCommitMs`
  - `S-IO-AS/app_server_event_route_ms_p95` from `counters.batchFlushDurationAvgMs`
- Malformed, negative, or non-whitelisted diagnostics are ignored; prompt/body/tool text is not copied into the evidence fragment.
- The current local `.artifacts/realtime-runtime-diagnostics.json` promotes two measured S-IO rows:
  - `S-IO-RR/realtime_reducer_dispatches_per_1000_delta = 4000`
  - `S-IO-AS/app_server_event_route_ms_p95 = 14ms`
- `deltas.firstDeltaToFirstVisibleTextMs` remains a visible-lag field and is intentionally not mapped to the route/flush S-IO metrics.

Example:

```bash
npm run perf:v0511-runtime-evidence
npm run check:runtime-evidence-gates
```

## Turn Trace Delta-Count Calibration

- Root cause found in current code: `noteTurnFirstEngineDeltaIngress` incremented `deltaCount` only for the first delta, while `noteTurnReducerCommit` incremented for every reducer commit. This made `reducerAmplification = reducerCommitCount / deltaCount` describe commits per first-token stream, not commits per runtime delta.
- Added `noteTurnDeltaIngress` and wired it into:
  - `src/features/threads/utils/streamLatencyDiagnostics.ts`
  - `src/features/threads/contracts/realtimeTurnTraceReplay.ts`
- The first-delta milestone remains stable; later delta ingress events increment `deltaCount` without overwriting `first-engine-delta-ingress`.
- Reproducible proxy replay result after the calibration:
  - `docs/perf/realtime-turn-trace.json`: `reducerAmplificationMedian` changed from `4` to `1.33`.
  - `docs/perf/realtime-extended-baseline.json`: `S-RS-RA/reducerAmplificationMedian` changed from `4` to `1.33`.
- `.artifacts/realtime-runtime-diagnostics.json` is gitignored local runtime state. If it was exported before this calibration, rerun the app trace before treating its measured `deltaCount` / `reducerCommitCount` values as post-fix evidence.

## Renderer Diagnostics Export Calibration

- Added `scripts/perf-export-renderer-diagnostics.mjs` and `npm run perf:renderer-diagnostics:export`.
- The script reads `~/.ccgui/client/app.json`, extracts `diagnostics.rendererLifecycleLog`, and writes `.artifacts/realtime-runtime-diagnostics.json`.
- Current post-restart app store fact:
  - `~/.ccgui/client/app.json` updated at `2026-06-18 00:20:27`.
  - Exported renderer diagnostic entries: `1200`.
  - Exported `realtime.turnTrace.summary` entries: `0`.
- Because the just-run app conversation did not have turn trace enabled, `docs/perf/realtime-runtime-evidence.json` now correctly reports `measuredSummaryCount=0` instead of reusing the stale fixture artifact.
- `turnTraceCorrelation.ts` and `streamLatencyDiagnostics.ts` now auto-enable bounded trace in Vite dev or `VITE_ENABLE_PERF_BASELINE=1`, while keeping test mode default-off. The next dev/hot app conversation after this code is loaded should produce fresh `realtime.turnTrace.summary` rows without requiring DevTools localStorage setup.

## Precise Route Timing Calibration

- New hot-start runtime export after user conversation produced `entries=1200` and `turnTraceSummaryCount=1`.
- The measured summary showed:
  - `S-RS-VL/firstDeltaToFirstVisibleTextMs = 156ms`
  - `S-IO-RR/reducerCommitCount / deltaCount = 32 / 32 = 1000 dispatches per 1000 deltas`
  - `deltas.firstDeltaToBatchFlushEndMs = 35600ms`
  - `counters.batchFlushDurationAvgMs = 9647.5ms`
- Code audit found `firstDeltaToBatchFlushEndMs` is a whole-turn batch wait/window value, not a per-delta route duration. `batchFlushDurationAvgMs` was also derived from event wait-window timestamps instead of actual route work.
- Added precise route timing counters to `realtime.turnTrace.summary`:
  - `counters.realtimeDeltaRouteDurationAvgMs`
  - `counters.appServerEventRouteDurationAvgMs`
- Updated `scripts/perf-v0511-runtime-evidence.ts` so:
  - `S-IO-RR/realtime_delta_route_ms_p95` is promoted to `measured` only from `realtimeDeltaRouteDurationAvgMs`
  - `S-IO-AS/app_server_event_route_ms_p95` is promoted to `measured` only from `appServerEventRouteDurationAvgMs`
  - legacy `firstDeltaToBatchFlushEndMs` and `batchFlushDurationAvgMs` no longer promote route metrics
- Updated `scripts/perf-realtime-runtime-report.mjs` so `S-RS-FD/batchFlushDurationP95` uses `appServerEventRouteDurationAvgMs`; old diagnostics without this field now remain explicit `unsupported`.
- Pre-restart regenerated evidence after this calibration:
  - `docs/perf/realtime-runtime-evidence.json`: `S-RS-FD/batchFlushDurationP95 = unsupported`, reason says precise route timing field is missing in the exported diagnostics.
  - `docs/perf/v0511-runtime-evidence.json`: `S-IO-RR/realtime_delta_route_ms_p95` and `S-IO-AS/app_server_event_route_ms_p95` fall back to proxy fixture values instead of using the stale `35600ms` / `9647.5ms` measured window values.
  - `npm run perf:archive-readiness -- --json`: exits `2`, `ok: true`, `status: "warn"`, `hardFailures: []`; unsupported records now include `S-RS-FD/batchFlushDurationP95` until the app is restarted with the new instrumentation and another conversation is exported.
- Validation:
  - `npm exec vitest run src/features/threads/utils/turnTraceCorrelation.test.ts src/features/threads/utils/streamLatencyDiagnostics.test.ts`: pass (`47` tests)
  - `node --test scripts/perf-v0511-runtime-evidence.test.mjs scripts/perf-realtime-runtime-report.test.mjs`: pass (`9` tests)
  - `npm exec vitest run src/features/threads/hooks/useThreadItemEvents.test.ts src/features/threads/hooks/useThreadEventHandlers.test.ts src/features/threads/hooks/useThreadsReducer.append-agent-delta-fast-path.test.ts src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`: pass (`115` tests)
  - `npm run typecheck`: pass
  - `npm run lint`: pass
  - `npm run perf:baseline:aggregate`: pass
  - `npm run check:runtime-evidence-gates`: pass
  - `openspec validate v0511-performance-evidence-and-runtime-jank-hardening --strict --no-interactive`: pass

## Hot Restart Runtime Evidence Closure

- User restarted the hot dev app and ran a streaming conversation against the latest instrumentation.
- Process fact:
  - `npm run tauri:dev:hot` was active from this repository.
  - No `/Applications/ccgui.app/Contents/MacOS/cc-gui` stale app process was observed in the active process list.
- `npm run perf:renderer-diagnostics:export -- --verbose`: pass; exported `entries=1200`, `turnTraceSummaryCount=1`.
- The exported `realtime.turnTrace.summary` includes the new precise route timing counters:
  - `counters.realtimeDeltaRouteDurationAvgMs = 0`
  - `counters.realtimeDeltaRouteDurationCount = 2`
  - `counters.appServerEventRouteDurationAvgMs = 0`
  - `counters.appServerEventRouteDurationCount = 2`
- The same measured turn summary records:
  - `deltas.sendToFirstDeltaMs = 3549`
  - `deltas.firstDeltaToFirstVisibleTextMs = 116`
  - `deltas.batchFlushEndToReducerCommitMs = 7265`
  - `counters.reducerCommitCount / counters.deltaCount = 41 / 41 = 1000 dispatches per 1000 deltas`
  - `counters.visibleTextGrowthCount = 1`
- Refreshed evidence after export:
  - `docs/perf/realtime-runtime-evidence.json`: `S-RS-FD/batchFlushDurationP95 = 0ms`, `measured`, sourced from `appServerEventRouteDurationAvgMs`.
  - `docs/perf/v0511-runtime-evidence.json`: `S-IO-RR/realtime_delta_route_ms_p95 = 0ms`, `measured`, sourced from `realtimeDeltaRouteDurationAvgMs`.
  - `docs/perf/v0511-runtime-evidence.json`: `S-IO-AS/app_server_event_route_ms_p95 = 0ms`, `measured`, sourced from `appServerEventRouteDurationAvgMs`.
  - `docs/perf/v0511-runtime-evidence.json`: `S-IO-RR/thread_reducer_flush_ms_p95 = 7265ms`, `measured`, sourced from `batchFlushEndToReducerCommitMs`.
- `npm run perf:realtime:runtime-report -- --verbose`: pass; `realtime runtime measured summaries: 1`.
- `npm run perf:v0511-runtime-evidence -- --verbose`: pass.
- `npm run perf:baseline:aggregate`: pass.
- `npm run check:runtime-evidence-gates`: pass.
- `npm run perf:archive-readiness -- --json`: exits `2` with `ok: true`, `status: "warn"`, `hardFailures: []`, `activeChangeCount: 3`, `metricCount: 28`, `budgetMissingCount: 15`.
- Remaining unsupported rows are cold-start and long-running-process sampling rows, not the precise route timing gap fixed in this pass.
