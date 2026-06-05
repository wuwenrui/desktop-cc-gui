## Evidence Summary

### Proxy Evidence

- Full heavy-test-noise gate:
  - Command: `npm run check:heavy-test-noise`
  - Result: passed, `608` test files completed.
  - Noise summary: `act warnings: 0`, `stdout payload lines: 0`, `stderr payload lines: 0`.
  - Report: `.artifacts/heavy-test-noise.json` records `status: pass` and `breachCount: 0` after report-mode recheck.
- Composer adapter advisory stability:
  - Command: `pnpm vitest run src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`
  - Result: passed, 50 tests.
  - Coverage: structurally equal context/rate/advisory list payloads do not rerender the input subtree; changed advisory content still rerenders.
- Session catalog bounded/stale behavior:
  - Command: `pnpm vitest run src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx`
  - Result: passed, 14 tests.
  - Coverage: bounded `SESSION_CATALOG_PAGE_SIZE`, backend `nextCursor` preservation, equivalent in-flight request dedupe, attribution/filter-sensitive dedupe keys, filter stale-response guard, workspace ownership mutation behavior.
- Status projection scoped helper/cache:
  - Command: `pnpm vitest run src/features/status-panel/hooks/useStatusPanelData.test.ts src/features/status-panel/components/StatusPanel.test.tsx`
  - Result: `useStatusPanelData.test.ts` passed with 5 tests in the latest focused run; previous combined status panel run passed with broader component coverage.
  - Coverage: fallback parent cache by `itemsByThread` identity, active root subtree collection, deferred summary freeze/convergence, task output and receiver-thread navigation target correctness.
- Messages streaming render and controls:
  - Command: `pnpm vitest run src/features/messages/components/Messages.streaming-presentation.test.tsx src/features/messages/components/Messages.test.tsx`
  - Result: passed, 60 tests.
  - Coverage: stable timeline snapshot with latest live assistant override, copy/fork/rewind action reachability.
- Foreground-first thread switching:
  - Command: `pnpm vitest run src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx`
  - Result: passed, 8 tests.
  - Coverage: active thread selection precedes right-panel collapse/layout transition work; rapid A->B switching drops late A scoped work before it can apply over B.
- Session Radar aggregate stability:
  - Command: `pnpm vitest run src/features/session-activity/hooks/useSessionRadarFeed.test.ts src/features/session-activity/hooks/useSessionRadarFeed.incremental.test.tsx src/features/session-activity/hooks/useSessionRadarFeed.parity.test.tsx`
  - Result: passed, 11 tests.
  - Coverage: running row dedupe, deterministic freshness/id tie-break ordering, workspace-keyed running counts, incremental entry reuse, persisted recent parity.
- Radar/prewarm staging:
  - Command: `pnpm vitest run src/app-shell-parts/useWorkspaceThreadListHydration.test.tsx`
  - Result: passed, 8 tests.
  - Coverage: active workspace hydration stays immediate; non-active prewarm is idle-scheduled.
- Sidebar projection surface:
  - Command: `pnpm vitest run src/features/app/utils/workspaceSessionFolders.test.ts src/features/app/components/Sidebar.session-folders.test.tsx src/features/app/components/ThreadList.test.tsx`
  - Result: passed, 36 tests.
  - Coverage: workspace-scoped folder projection helper/cache, session folder render behavior, load-older behavior in folder trees, memoized thread row behavior, and row interaction behavior remain stable after projection cache changes.
- Runtime control immediate path:
  - Command: `pnpm vitest run src/features/composer/components/ChatInputBox/ButtonArea.test.tsx`
  - Result: passed, 14 tests.
  - Coverage: Stop remains enabled from canonical runtime state while stream phase advisory changes; deferred visual phase changes do not drop Stop clicks.
- Content-safe diagnostics:
  - Command: `pnpm vitest run src/services/rendererDiagnostics.test.ts`
  - Result: passed, 11 tests.
  - Coverage: `perf.client-interaction` payload excludes prompt, assistant, and tool body text.
- Automated performance baseline:
  - Command: `npm run perf:baseline:all`
  - Result: passed.
  - Outputs: `docs/perf/baseline.json`, `docs/perf/baseline.md`, `docs/perf/long-list-baseline.json`, `docs/perf/composer-baseline.json`, `docs/perf/realtime-extended-baseline.json`, `docs/perf/cold-start-baseline.json`, and `docs/perf/history/v0.5.6-baseline.*`.
  - Key proxy metrics from the generated baseline:
    - `S-CI-50 keystrokeToCommitP95`: `0.08ms`, `inputEventLossCount`: `0`.
    - `S-CI-100-IME keystrokeToCommitP95`: `0.03ms`, `inputEventLossCount`: `0`, `compositionToCommit`: `0.11ms`.
    - `S-RS-PE assemblerLatency`: `5.73ms`.
  - Boundary: fixture/replay metrics are regression evidence, not release-grade runtime UX proof.

### Runtime Evidence Gate

- Command: `npm run check:runtime-evidence-gates`
- Result: passed.
- Outputs:
  - `docs/perf/runtime-evidence-gates.json`
  - `docs/perf/runtime-evidence-gates.md`
  - `openspec/docs/runtime-evidence-gates-2026-05-24.md`
- Gate classification:
  - `fix-client-runtime-interaction-jank` is listed as `archive-candidate-after-qualifier-review`.
  - Generated runtime evidence includes measured bundle-size evidence and `docs/perf/long-list-browser-scroll.json` with `S-LL-1000 browserScrollFrameDropPct = 0`.
  - Composer, realtime, and long-list fixture replay metrics remain classified as `proxy`.
  - Tauri/WebView cold-start first-paint and first-interactive timing remain `unsupported` in the headless script.

### Measured Evidence

- Status: partially collected through existing automated runtime evidence gates.
- Collected:
  - `docs/perf/long-list-browser-scroll.json` records measured browser scroll evidence for `S-LL-1000` with `browserScrollFrameDropPct = 0`.
  - Bundle-size cold-start evidence is recorded as measured in `docs/perf/baseline.json`.
- Still required before claiming release-grade end-user interaction improvement:
  - Browser/Tauri/WebView profiler while long streaming output is active and the user types 50 normal characters.
  - Browser/Tauri/WebView profiler while IME composition performs 100 composition updates during streaming.
  - React Profiler commit duration for Composer, Messages, Sidebar, and Session Management.
  - PerformanceObserver long-task trace during rapid thread switching and catalog hydration.

### Manual-Only Evidence

- Status: not collected.

### Unsupported Evidence

- None recorded. Tooling path is documented in `implementation-notes.md`; measured capture remains pending outside this terminal-only run.

## Validation

- `openspec validate fix-client-runtime-interaction-jank --strict --no-interactive`: passed.
- `openspec status --change fix-client-runtime-interaction-jank --json`: complete, `4/4` artifacts done.
- `npm run check:heavy-test-noise`: passed, `608` test files completed; report-mode recheck recorded zero breaches.
- `npm run perf:baseline:all`: passed and regenerated the v0.5.6 performance baseline.
- `npm run check:runtime-evidence-gates`: passed and classified this change as `archive-candidate-after-qualifier-review`.
- `npm run typecheck`: passed.
- Focused Vitest suite covering touched frontend paths: latest incremental runs passed for catalog/status/thread-switch and Radar feed; earlier combined run passed, 254 tests.
- `pnpm typecheck`: passed after latest incremental catalog/thread-switch/Radar/sidebar changes.
- Rust focused tests:
  - `cargo test --manifest-path src-tauri/Cargo.toml catalog_`: passed, covering backend catalog dedupe keys, scan limits, next cursor, folder-before-pagination, stable cursor behavior, and archive metadata evidence.
  - `cargo test --manifest-path src-tauri/Cargo.toml claude_source_status_treats_capped`: passed, covering capped Claude source status as partial evidence.
