# Renderer Stability Evidence Report

## Evidence classification

| Area | Evidence | Classification | Source / reason |
|---|---|---|---|
| Renderer heartbeat sender | Privacy-safe heartbeat payload excludes prompt, assistant text, tool output, file content and environment values | Proxy | `src/services/rendererDiagnostics.ts` and focused fixture in `rendererDiagnostics.test.ts`. |
| Backend heartbeat receiver | Latest heartbeat is stored by app scope with bounded scope count | Proxy | `src-tauri/src/renderer_stability.rs` unit fixture. |
| Backend watchdog | Missed heartbeat is classified as `heartbeat_missed` without claiming native process crash | Proxy | `RendererHeartbeatStore` classification fixture. |
| Native process hooks | Windows WebView2, macOS WKWebView and Linux WebKitGTK native hooks | Unsupported / not-implemented | `get_renderer_platform_hook_support` emits deterministic not-implemented reasons. |
| Renderer pressure snapshot | Memory and long-task support states, process count support state and recovery attempt count | Proxy | Heartbeat payload is bounded metadata only; OS process count remains unsupported in the first slice. |
| Streaming coalescing | First assistant token immediate, cadence flush and terminal settlement flush | Proxy | `realtimeEventBatcher` fixture covers coalescing, cadence and terminal flush. |
| Streaming pressure diagnostics | `renderer/streaming-pressure` emits bounded metadata without delta text | Proxy | `noteRealtimeCoalescedFlush` records reason, count and identifiers only. |
| Git branch polling | Non-repository workspace returns neutral branch state before branch listing | Proxy | `list_git_branches` marker preflight and `normalizeGitBranchListResponse` fixture. |
| Runtime acquire guardrails | Passive/helper/runtime-required path classification | Proxy | `runtime/acquire_boundary.rs` sentinel tests. |
| Windows `STATUS_ACCESS_VIOLATION` issue screenshot | Native renderer crash symptom | Manual-only | Requires platform/native hook or external crash dump to become measured evidence. |
| macOS long-run white screen report | Renderer pressure / unresponsive symptom | Manual-only | Requires heartbeat gap, memory/long-task, profiler or OS process snapshot to become measured evidence. |

## Platform signal table

| Signal | Windows | macOS | Linux |
|---|---|---|---|
| Heartbeat/watchdog | Proxy now; measured when observed in real app logs | Proxy now; measured when observed in real app logs | Proxy now; measured when observed in real app logs |
| Native renderer process failure hook | Not implemented | Not implemented | Not implemented |
| Memory pressure | Browser support-dependent; currently reported as support state | Browser support-dependent; currently reported as support state | Browser support-dependent; currently reported as support state |
| Long task | PerformanceObserver support-dependent | PerformanceObserver support-dependent | PerformanceObserver support-dependent |
| Helper process count | Unsupported in heartbeat first slice; runtime pool has existing process diagnostics | Unsupported in heartbeat first slice; runtime pool has existing process diagnostics | Unsupported in heartbeat first slice; runtime pool has existing process diagnostics |

## Release claim boundary

This implementation may claim improved observability and bounded pressure controls. It must not claim that WebView2 `STATUS_ACCESS_VIOLATION` or macOS white-screen native root cause is fixed until measured platform evidence exists.


## Final validation evidence

- OpenSpec strict: `openspec validate harden-client-renderer-stability-under-pressure --strict --no-interactive` passed.
- Frontend focused tests: `pnpm vitest run src/services/rendererDiagnostics.test.ts src/services/rendererRecoveryPolicy.test.ts src/features/git/utils/gitBranchList.test.ts src/features/threads/contracts/realtimeEventBatcher.test.ts` passed: 4 files, 21 tests.
- Rust focused tests: `cargo test --manifest-path src-tauri/Cargo.toml renderer_stability` passed: 2 tests.
- Rust focused tests: `cargo test --manifest-path src-tauri/Cargo.toml acquire_boundary` passed: 6 tests across lib/bin targets.
- Environment note: default Cargo USTC sparse mirror failed with SSL connection errors; validation used a command-line-only mirror override, `source.ustc.registry="sparse+https://rsproxy.cn/index/"`, without changing project or user Cargo config.
