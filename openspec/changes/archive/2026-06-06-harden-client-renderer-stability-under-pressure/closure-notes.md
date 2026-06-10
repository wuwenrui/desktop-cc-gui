# Closure Notes

## Rollback switches

| Area | Rollback path |
|---|---|
| Native process hook | No native hook is enabled yet. Keep `get_renderer_platform_hook_support` as not-implemented while heartbeat fallback remains. |
| Renderer heartbeat/watchdog | Stop calling `startRendererHeartbeat()` from `installRendererLifecycleDiagnostics()` or disable `record_renderer_heartbeat` registration while keeping local renderer lifecycle diagnostics. |
| Recovery policy | Do not call `recordRendererRecoveryFailure()` from UI recovery orchestration. The helper is policy-only and does not reload by itself. |
| Streaming coalescing | Disable existing realtime batching flag or revert cadence flush to manual flush. First-token and terminal flush semantics should remain. |
| Git branch polling guard | Revert the marker preflight in `list_git_branches`; do not remove real Git error surfacing. |
| Runtime acquire sentinel | Remove only the contract classifier/tests; do not loosen existing runtime manager guard logic. |

## Unsupported gaps

- WebView2 `ProcessFailed` bridge is not wired.
- WKWebView web process termination bridge is not wired.
- WebKitGTK web process failure bridge is not wired.
- OS helper process count is not included in heartbeat payload; existing runtime pool process diagnostics remain the backend source.
- Automatic renderer reload is not enabled by default.


## Final validation closure

- OpenSpec strict validation passed.
- Focused renderer diagnostics, recovery policy, Git branch normalization, and realtime batcher Vitest coverage passed.
- Focused Rust renderer heartbeat and runtime acquire-boundary sentinel tests passed.
- No platform-native crash hook is claimed as implemented; unsupported hooks remain explicitly reported as not implemented.
