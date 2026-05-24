## Verification

Generated on 2026-05-24 for `stabilize-runtime-performance-evidence-gates`.

### Commands

| Command | Result | Notes |
|---|---|---|
| `npm run check:runtime-evidence-gates` | Pass | Generated `docs/perf/runtime-evidence-gates.{json,md}` and `openspec/docs/runtime-evidence-gates-2026-05-24.md`. |
| `npm run perf:long-list:browser-scroll -- --verbose` | Pass | Generated browser/CDP measured `docs/perf/long-list-browser-scroll.json`; local Chrome result: `S-LL-1000/browserScrollFrameDropPct=0%`, 1000 rows, 218 frames, 0 dropped frames. |
| `node --test scripts/generate-runtime-evidence-report.test.mjs scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs scripts/check-large-files.test.mjs` | Pass | Covered runtime evidence report edge cases plus workflow parser contracts for heavy-test-noise and large-file sentries. |
| `npm exec vitest run src/features/messages/components/messagesTimelineVirtualization.test.ts src/features/messages/components/Messages.live-behavior.test.tsx` | Pass | Focused virtualizer cleanup and Messages live behavior validation passed. |
| `npm run check:heavy-test-noise` | Pass | Completed 532 test files; no virtualizer teardown error after clearing the pending scroll-end fallback timeout on unmount. |
| `npm run check:large-files:near-threshold` | Pass with warnings | Refreshed `.artifacts/large-files-near-threshold.json`; 15 watch findings, 0 blocking findings. |
| `openspec validate stabilize-runtime-performance-evidence-gates --strict --no-interactive` | Pass | Change artifact validation passed. |
| `openspec validate --all --strict --no-interactive` | Pass | 303 passed, 0 failed. |
| `npm run typecheck` | Pass | TypeScript validation passed. |
| `npm run check:large-files:gate` | Pass | Hard large-file gate found 0 findings. |
| `npm run check:bundle-chunking` | Pass | `[bundle-chunking] ok`. |
| `npm run check:realtime-event-batching` | Pass | `[realtime-event-batching] ok`. |

### Evidence Summary

- Performance evidence is now classified as `measured`, `proxy`, `unsupported`, or `manual-only`.
- Missing or malformed runtime evidence sources now emit explicit `unsupported` rows instead of disappearing from the aggregate report.
- Long-list `S-LL-*`, composer fixture, and realtime replay metrics are classified as `proxy`, not release-grade runtime proof.
- `S-LL-1000/browserScrollFrameDropPct` now has local Chrome/CDP browser evidence classified as `measured`.
- The browser scroll script treats unsupported browser/CDP environments as explicit unsupported evidence rather than hard script failure.
- Messages timeline virtualization now uses a cleanup-safe offset observer so pending scroll-end fallback timers cannot fire after jsdom teardown.
- Cold-start bundle sizes are classified as `measured`; Tauri webview `firstPaintMs` and `firstInteractiveMs` remain `unsupported`.
- Realtime summary records `firstTokenLatency=5000ms`, `interTokenJitterP95=920ms`, visible-lag risk `high`, and terminal pressure `not-directly-measured`.
- Large-file next-step guidance ranks P0/P1 hot-path files by priority and remaining fail-threshold headroom.

### Cleanup / Compatibility Boundary

- `listClaudeSessions` and `listProjectRelatedCodexSessions` have active service/hook/test references and remain compatibility/diagnostic paths.
- Legacy bare-session metadata lookup and legacy cursor parsing remain compatibility paths backed by OpenSpec notes and tests.
- No runtime compatibility code was removed in this change; deletion requires a dedicated compatibility-removal change.

### Platform Qualifiers

- Windows runtime/manual evidence was not collected in this environment.
- Browser-level long-list scroll evidence was collected locally on macOS via Google Chrome headless/CDP; Windows and Linux browser scroll evidence is not covered here.
- Tauri webview cold-start timing was not collected in this pass; timing metrics remain `unsupported`.

### Workspace Note

The current working-tree diff for this pass is scoped to runtime evidence gates, browser scroll evidence, and Messages timeline virtualizer teardown stabilization.
