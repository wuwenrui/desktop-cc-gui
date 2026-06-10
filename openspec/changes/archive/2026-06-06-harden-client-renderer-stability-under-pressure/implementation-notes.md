# Implementation Notes

## 1.1 Evidence model

| Signal | Classification | Current interpretation |
|---|---|---|
| Windows `STATUS_ACCESS_VIOLATION` WebView2 error page | Native renderer crash evidence | Treat as renderer process failure evidence. Do not collapse it into JavaScript error or Git polling failure. |
| macOS long-run white screen after hours of multi-engine use | Pressure / unresponsive candidate model | Treat as heartbeat gap, memory growth, long task, event storm, streaming fan-out or helper process pressure until measured evidence proves a native crash. |
| Multi-engine realtime jank | Renderer pressure amplifier | High-frequency deltas can force repeated React projection work. Active row must stay live while parent projections coalesce. |
| Repeated `git/branches/list error` for `.ccgui/workspace` | Diagnostic noise / pressure amplifier | Non-repository default workspace must be neutral/degraded, not a repeated global error. |
| Runtime/helper process regression | Background pressure risk | Passive reads and helper reads must not start unbounded node/codex/claude helpers. Process evidence is best-effort and platform-gated. |

## 1.2 Diagnostic channel reference map

| Channel | Owner | Existing path | This change |
|---|---|---|---|
| Renderer lifecycle log | Frontend renderer diagnostics service | `src/services/rendererDiagnostics.ts` -> `diagnostics.rendererLifecycleLog` client store | Adds privacy-safe heartbeat sender and heartbeat send failure label. |
| Backend heartbeat state | Tauri backend | New `src-tauri/src/renderer_stability.rs` | Records latest heartbeat by app scope and classifies missed heartbeats without claiming native crash. |
| Global client error log | Tauri backend bounded JSONL | `src-tauri/src/client_error_log.rs` | Existing cap remains; branch polling repeated failures are downgraded/deduped before they become noise. |
| Diagnostics bundle renderer section | Tauri diagnostics bundle | `src-tauri/src/diagnostics_bundle.rs` | Existing sanitizer already redacts renderer lifecycle entries by shape/fingerprint. Backend heartbeat snapshot is exposed through `get_renderer_stability_snapshot`. |
| Runtime performance evidence | Frontend perf diagnostics | `appendClientInteractionPerfDiagnostic` in `src/services/rendererDiagnostics.ts` | Kept separate from heartbeat; heartbeat payload records support states and bounded pressure metadata only. |

## 1.3 Platform hook support matrix

| Platform | WebView runtime | State | Reason |
|---|---|---|---|
| Windows | WebView2 | `not-implemented` | Current Tauri/wry integration does not wire a safe `ProcessFailed` bridge. Heartbeat/watchdog fallback is active. |
| macOS | WKWebView | `not-implemented` | Current integration does not wire web process termination callbacks. Heartbeat/watchdog fallback is active. |
| Linux | WebKitGTK | `not-implemented` | Current integration does not wire web process failure callbacks. Heartbeat/watchdog fallback is active. |

The matrix is also emitted deterministically by `get_renderer_platform_hook_support`.

## 1.4 Runtime/helper process visibility map

| Path | Classification | Current visibility | Gap |
|---|---|---|---|
| Passive session/history selection | Passive | Local durable state and session catalog paths exist. | Must remain covered by passive acquire regression tests before closure. |
| Model list / account / rate-limit / thread list helper reads | Helper-live | Existing engine/runtime manager owns guarded acquire paths. | Needs focused tests to prove helper reads use shared guard rather than storming. |
| node/codex/claude process starts | Runtime-required / helper-live | Runtime manager has pool/process diagnostics in backend evidence surfaces. | OS process count is platform-sensitive; unsupported states must be explicit. |
| Renderer helper process count in heartbeat | Unsupported in first implementation slice | Heartbeat pressure payload includes `processCount: unsupported` and `helperProcessCount: null`. | Later slice can attach measured OS process snapshot when reliable. |

## 4.1 Branch polling call-path map

```text
AppShell
  -> useGitBranches(activeWorkspace)
  -> listGitBranches(workspaceId)
  -> Tauri command list_git_branches
  -> resolve_git_root(workspace.settings.git_root || workspace.path)
  -> repo marker preflight
  -> git2 branch listing only for valid repositories
```

`.ccgui/workspace` enters this path as the configured workspace path. If it exists without a `.git` marker, the backend now returns `repositoryState: "not_git_repository"` and the hook records neutral server debug instead of `git/branches/list error`.

## 5.1 Runtime acquire boundary audit matrix

| Surface | Boundary |
|---|---|
| Selecting persisted history/session metadata | Passive |
| Session visibility and catalog projection | Passive |
| Model list and provider catalog refresh | Helper-live through guarded runtime path |
| Account/rate limit/thread list requiring live CLI state | Helper-live through guarded runtime path |
| Sending, stopping, continuing or runtime mutation | Runtime-required |

## Historical regression checklist

- Preserve passive selection: local history/session reads must not acquire a runtime.
- Preserve helper guard alignment: helper-live reads must surface contention/quarantine from shared runtime guard.
- Preserve branch polling signal quality: non-repo workspace is neutral; permission/corrupt Git errors still surface.
- Preserve renderer evidence quality: heartbeat miss is unresponsive evidence, not confirmed native crash.
- Contract sentinel: `src-tauri/src/runtime/acquire_boundary.rs` classifies passive, helper-live and runtime-required paths so future changes cannot silently blur the boundary.

## 3.1 Streaming delta ingress map

| Engine/source | Normalization boundary | Fan-out before this change | Pressure control |
|---|---|---|---|
| Claude | `sharedRealtimeAdapter` / thread item events | normalized item events into reducer and render projections | Existing realtime batcher first-token immediate + cadence flush. |
| Codex | `sharedRealtimeAdapter` / thread item events | text delta, reasoning, tool output and completion events into reducer | Existing realtime batcher + Codex live-row / shadow transcript path. |
| Gemini | `sharedRealtimeAdapter` / thread item events | `text:delta` alias and reasoning deltas into reducer | Same coalescing boundary by normalized event operation. |
| OpenCode | `sharedRealtimeAdapter` / thread item events | `text:delta` into assistant delta; heartbeat ignored | Same coalescing boundary by normalized event operation. |
| Custom provider | normalized realtime event contract | adapter-specific raw events mapped to `NormalizedThreadEvent` | Coalescing applies only after normalization and before reducer fan-out. |

## 3.2 - 3.5 Streaming pressure implementation

- Shared coalescer: `src/features/threads/contracts/realtimeEventBatcher.ts`.
- Cadence boundary: timer flushes are now labeled `cadence`, while first visible assistant token and terminal settlement remain immediate.
- Active row contract: first assistant token bypasses coalescing; `MessagesTimeline` live item override remains the visible row path.
- Critical controls: Composer draft, IME, selection, Stop, toolbar, copy/fork/rewind and scroll are outside thread item coalescing and remain immediate action paths.
- Diagnostics: `renderer/streaming-pressure` records bounded metadata only: reason, event count, engine, workspace/thread/turn identifiers and item kind. It never records delta text, prompt text, tool output or file content.

## 2.6 Recovery policy

`src/services/rendererRecoveryPolicy.ts` implements a bounded decision helper only. It records attempt count, applies capped backoff, blocks after budget exhaustion and blocks immediately if an unsent Composer draft exists without preservation. It deliberately does not call `window.location.reload()`; UI orchestration must record evidence first and then opt into any recovery action.

## 5.4 Process diagnostics

The first implementation slice reports helper process count as unsupported in the renderer heartbeat pressure snapshot. Existing runtime pool diagnostics remain the backend source for process evidence, while heartbeat stays privacy-safe and platform-neutral. This prevents unsupported platforms from silently omitting the signal.
