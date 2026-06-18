## 1. Evidence Baseline Inventory

- [x] 1.1 [P0][input: current `feature/v0.5.11` checkout][output: recorded command summary] Run read-only current-state gates: `npm run perf:archive-readiness -- --json`, `git status --short`, and active OpenSpec listing; verify hard failures and active change count are recorded in implementation notes.
- [x] 1.2 [P0][input: `package.json`, git HEAD][output: v0.5.11 baseline anchor] Confirm baseline generation uses `package.json.version=0.5.11` and current git commit; verify generated baseline does not claim v0.5.9 or stale OpenSpec injected context.
- [x] 1.3 [P1][input: existing `docs/perf/runtime-evidence-gates.json`][output: unsupported/budget-missing inventory] Extract unsupported records and missing-budget warnings into an implementation checklist; verify every record has owner or next action before fixes start.

## 2. Producer Artifacts

- [x] 2.1 [P0][depends:1.1][input: `useThreadsReducer.__profile`, reducer burst test][output: `S-IO-RR` producer artifact] Add or extend a perf producer for `prepareThreadItems_calls_per_1000_delta`, reducer dispatch count, and route/flush timing support; verify focused reducer/profile tests pass.
- [x] 2.2 [P1][depends:1.1][input: `useAppServerEvents` batch fixture][output: `S-IO-AS` producer artifact] Add app-server batching evidence for raw event count, IPC emit count, route P95, reducer dispatch count, and long-task count when available; verify app-server batch consumer tests pass.
- [x] 2.3 [P1][depends:1.1][input: `src-tauri/src/workspaces/external_changes.rs` debounce tests][output: `S-IO-FC` producer artifact] Add same-path burst evidence for raw/emitted rate, coalesce ratio, and empty batch emit count; verify Rust debounce tests pass.
- [x] 2.4 [P1][depends:1.1][input: backend file I/O substrate][output: `S-IO-FS` producer artifact] Add backend file I/O fixture evidence for command wall P95, async-worker stall P95 when measurable, blocking-pool call count, and Tauri command latency during stream when measurable; verify content-safety assertions pass.
- [x] 2.5 [P1][depends:1.1][input: existing React Profiler / `__profile` counters][output: `S-IO-FP` producer artifact] Add frontend prop-chain producer rows for composer/sidebar render counts and row/layout counts when available; verify unavailable counters produce explicit unsupported rows.
- [x] 2.6 [P1][depends:1.2][input: real startup marker snapshot if available][output: cold-start marker artifact] Wire `perf:cold-start:startup-markers` output into `perf:cold-start:baseline`; verify missing snapshots keep `firstPaintMs` and `firstInteractiveMs` unsupported with exact reason.

## 3. Aggregation And Gates

- [x] 3.1 [P0][depends:2.1][input: `S-IO-RR` artifact][output: populated realtime input render budget summary] Update `scripts/generate-runtime-evidence-report.mjs` to consume `S-IO-RR`; verify summary no longer reports unsupported when artifact exists.
- [x] 3.2 [P1][depends:2.2][input: `S-IO-AS` artifact][output: populated app-server event batching summary] Update aggregation for raw-vs-IPC and reducer dispatch metrics; verify generated markdown includes values and evidence class.
- [x] 3.3 [P1][depends:2.3][input: `S-IO-FC` artifact][output: populated file-change debounce summary] Update aggregation for file-change burst metrics; verify empty batch count is visible.
- [x] 3.4 [P1][depends:2.4][input: `S-IO-FS` artifact][output: populated backend file I/O isolation summary] Update aggregation for backend file I/O metrics; verify content-sensitive fields are not written.
- [x] 3.5 [P1][depends:2.5][input: `S-IO-FP` artifact][output: populated frontend prop-chain stability summary] Update aggregation for render-count metrics; verify unavailable fields remain explicitly unsupported.
- [x] 3.6 [P1][depends:2.6][input: cold-start baseline fragment][output: measured or unsupported cold-start summary] Ensure startup marker rows flow through `perf:baseline:aggregate` and runtime evidence gates; verify no fake timing is emitted.
- [x] 3.7 [P1][depends:3.1-3.6][input: archive-readiness output][output: residual warning report] Update archive-readiness ownership only where needed; verify hard failures stay distinct from residual warnings.

## 4. Evidence-Gated Runtime Jank Hardening

- [x] 4.1 [P1][depends:3.1][input: realtime input render summary][output: scoped fix or explicit no-op] If `S-IO-RR` exceeds target or remains unsupported due to missing instrumentation, implement the smallest reducer/route instrumentation or fix; verify focused tests and evidence report.
- [x] 4.2 [P1][depends:3.2][input: app-server batching summary][output: scoped fix or explicit no-op] If IPC/raw ratio or route P95 fails, adjust batch route/coalescing without changing control event order; verify batch consumer tests.
- [x] 4.3 [P1][depends:3.3][input: file-change debounce summary][output: scoped fix or explicit no-op] If same-path coalesce or empty batch count fails, adjust debounce emitter only; verify Rust debounce tests.
- [x] 4.4 [P1][depends:3.4][input: backend file I/O summary][output: scoped fix or explicit no-op] If blocking/stall evidence fails, adjust backend file I/O isolation using existing blocking/cache substrate; verify cargo focused tests.
- [x] 4.5 [P1][depends:3.5][input: frontend prop-chain summary][output: scoped fix or explicit no-op] If render-count evidence fails, narrow only the measured propagation chain; verify profiler fixture and focused component tests.

## 5. Validation And Closure

- [x] 5.1 [P0][depends:3.1-3.7][input: updated perf artifacts][output: v0.5.11 performance baseline] Run `npm run perf:baseline:all`; verify latest and history artifacts are generated for v0.5.11.
- [x] 5.2 [P0][depends:5.1][input: updated evidence artifacts][output: runtime evidence gate report] Run `npm run check:runtime-evidence-gates`; verify summaries reflect producer artifacts or explicit unsupported reasons.
- [x] 5.3 [P0][depends:5.2][input: generated gates][output: archive readiness decision] Run `npm run perf:archive-readiness -- --json`; verify `hardFailures` is empty or document blockers.
- [x] 5.4 [P0][depends: implementation files touched][input: TypeScript source][output: type safety result] Run `npm run typecheck`; verify pass.
- [x] 5.5 [P0][depends: implementation files touched][input: lintable source][output: lint result] Run `npm run lint`; verify pass.
- [x] 5.6 [P0][depends: Rust producer or backend files touched][input: Rust source][output: Rust test result] Run `cargo test --manifest-path src-tauri/Cargo.toml` or focused Rust tests; verify pass or document why skipped.
- [x] 5.7 [P0][depends: artifacts complete][input: OpenSpec change][output: strict validation result] Run `openspec validate v0511-performance-evidence-and-runtime-jank-hardening --strict --no-interactive`; verify pass.
