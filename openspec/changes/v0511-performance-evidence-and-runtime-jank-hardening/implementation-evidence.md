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
