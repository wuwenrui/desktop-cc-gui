## Context

Issue #663 exposes a Windows WebView2/Chromium renderer failure mode: the application window remains open while the page is replaced by a browser error page containing `STATUS_ACCESS_VIOLATION`. The visible application error log in that report only contains repeated `git/branches/list error` entries for `C:/Users/Administrator/.ccgui/workspace`, which explains noisy background polling but does not explain the renderer process failure by itself.

A separate macOS field report describes long-running, high-intensity use: multiple engines streaming concurrently for hours, followed by UI stutter and eventually a full white screen. That symptom does not prove the same native crash class as Windows, but it fits a shared pressure model: renderer heartbeat gaps, long tasks, memory growth, high-frequency realtime deltas, global projection churn, and background runtime/helper process activity.

The current codebase already has related prior work:

- background Codex helper/rollout visibility and passive runtime acquisition boundaries;
- helper runtime acquire guard alignment;
- client runtime interaction jank optimization;
- WebView2 message image memory pressure mitigation;
- runtime performance evidence gates and client global error log.

This design adds the missing stability loop around those pieces rather than replacing them.

## Goals / Non-Goals

**Goals:**

- Convert renderer crash, white-screen and long-run pressure symptoms into privacy-safe, bounded evidence.
- Keep Windows WebView2 `STATUS_ACCESS_VIOLATION` analysis separate from macOS WebContent pressure analysis while sharing common diagnostics.
- Add a frontend heartbeat and backend watchdog so renderer failure can be observed even when the renderer can no longer log its own error.
- Coalesce multi-engine streaming deltas without delaying critical user controls.
- Stop repeated branch polling errors for neutral non-Git workspace paths from hiding higher-value renderer evidence.
- Re-establish runtime/helper passive-acquire guardrails as a regression sentinel for background node/codex/claude process growth.
- Keep every mitigation locally rollback-safe.

**Non-Goals:**

- Do not claim to fix WebView2 native `STATUS_ACCESS_VIOLATION` root cause without platform crash evidence.
- Do not make automatic reload the primary success criterion.
- Do not rewrite AppShell, conversation reducers, engine runtimes or provider transport.
- Do not broaden into a new full performance initiative already covered by prior runtime jank work.
- Do not capture prompt, assistant, tool body or file content in diagnostics.

## Decisions

### Decision 1: Treat renderer stability as a control loop

Chosen approach:

```text
renderer heartbeat
  -> backend watchdog
  -> bounded pressure snapshot
  -> classified evidence
  -> optional bounded recovery
  -> evidence report
```

A renderer-only logger is insufficient because a crashed or wedged renderer may be unable to write the final diagnostic. A backend watchdog gives a second observation point.

Alternative rejected: only add a frontend `window.onerror` / React ErrorBoundary. That catches JavaScript and render errors, but does not observe native WebView process failure or renderer hangs.

### Decision 2: Platform hooks are optional and feature-detected

The design should use native process failure hooks only when the current Tauri/WebView stack exposes them safely. Each platform must report one of:

- `supported` with event evidence;
- `unsupported` with reason;
- `not-implemented` while heartbeat/watchdog evidence remains active.

This avoids writing a proposal that depends on an unverified WebView2 API surface.

Alternative rejected: hard-code WebView2 `ProcessFailed` as an unconditional contract. That would overfit Windows and may not map cleanly to macOS WKWebView or Linux WebKitGTK.

### Decision 3: Recovery is bounded and subordinate to evidence

A reload/rebuild path may be useful, but it must not run before evidence is recorded and it must use backoff. Unsent Composer state must be preserved or the user must see a clear recovery state.

Alternative rejected: immediate automatic reload on every heartbeat miss. That can create a reload loop, destroy user context and erase the only repro clue.

### Decision 4: Streaming pressure control uses shared ingress coalescing

Multi-engine streaming should be coalesced before it fans out into React projections. The coalescing boundary should reduce update frequency while preserving active row live visibility and immediate controls.

Acceptable behavior:

- visible assistant text updates at a bounded cadence;
- latest buffered delta flushes at turn settlement;
- Stop and Composer source-of-truth bypass coalescing;
- toolbar handlers remain registered from canonical action state.

Alternative rejected: debounce the whole Messages tree or Composer. That would reduce renders by delaying user-critical interactions.

### Decision 5: Git branch polling must classify neutral non-repository state

The default `.ccgui/workspace` path may exist without being a Git repository. Branch polling against that path should not emit repeated error entries. The UI may show no branch, unavailable branch, or degraded branch state, but the error log should not be flooded.

Alternative rejected: hide all branch polling errors. Real repository corruption, permission errors and invalid worktree state remain valuable diagnostics and should still be surfaced with dedupe.

### Decision 6: Runtime helper/process guardrails stay regression sentinels

This change does not redesign runtime lifecycle. It adds audit points and focused tests so passive reads and helper reads cannot regress into unbounded runtime acquisition or background process growth.

Alternative rejected: merge this work into a broad session lifecycle refactor. That would obscure the renderer stability goal and raise regression risk.

### Decision 7: Evidence is classified before release claims

Every stability claim must classify evidence as:

- `measured`: browser/Tauri/WebView profiler, native process event, PerformanceObserver, backend watchdog timing, OS process snapshot;
- `proxy`: Vitest/jsdom render counts, pure helper batching tests, synthetic heartbeat tests;
- `manual-only`: human observation or issue screenshot without repeatable capture;
- `unsupported`: platform metric unavailable with explicit reason.

Archive or release-grade claims must not rely only on proxy/manual evidence.

## Risks / Trade-offs

- [Risk] Heartbeat adds background IPC traffic. Mitigation: use a low-frequency interval, pause or relax during hidden/minimized states when safe, and cap emitted diagnostics.
- [Risk] Heartbeat miss may be a busy main thread rather than a crashed renderer. Mitigation: classify as `heartbeat_missed` / `unresponsive` unless native crash evidence exists.
- [Risk] Platform process hooks may be unavailable in current Tauri abstraction. Mitigation: feature-detect and record `unsupported`; heartbeat/watchdog remains the portable baseline.
- [Risk] Streaming coalescing may make output feel less live. Mitigation: choose a bounded cadence, flush on turn boundaries and keep active row latest text semantics covered by tests.
- [Risk] Branch polling downgrade may hide real Git errors. Mitigation: only downgrade verified non-repository paths; permission/corrupt repository errors remain classified diagnostics with dedupe.
- [Risk] Runtime process counting is platform-sensitive. Mitigation: keep process metrics best-effort, bounded and classified as unsupported where not reliable.
- [Risk] Auto recovery can loop. Mitigation: use exponential or capped backoff, persist attempt counts where appropriate, and expose user-facing diagnostic state.

## Migration Plan

1. Add renderer heartbeat contract and backend watchdog diagnostics behind a local feature flag or conservative default.
2. Add client-global-error-log labels and caps for renderer stability, git polling degraded state and runtime helper acquire/process evidence.
3. Add git repository validation before branch polling and downgrade neutral non-repository paths.
4. Add streaming coalescing at realtime ingress with focused tests for active row and immediate controls.
5. Add passive/helper runtime acquire audit and process diagnostic sentinels.
6. Add optional platform native process failure hooks where supported by the current stack.
7. Add bounded recovery only after diagnostics are recorded and privacy/redaction tests pass.
8. Produce evidence report and run strict OpenSpec validation plus focused frontend/backend tests before archive.

Rollback strategy:

- Disable native process hooks while keeping heartbeat/watchdog evidence.
- Disable auto recovery while keeping diagnostics.
- Disable streaming coalescing and return to immediate delta flow.
- Re-enable old branch polling only for explicitly configured repository paths if the guard misclassifies.
- Keep passive/helper acquire guard tests; do not roll back historical anti-leak contracts.

## Open Questions

- Which Tauri 2 / wry integration points expose WebView2 process failure, WKWebView process termination or WebKitGTK web process events without unsafe platform-specific glue?
- What heartbeat interval and missed-heartbeat threshold best separates long tasks from actual renderer failure on slower Windows machines?
- Which existing diagnostics channel should own OS process count snapshots for node/codex/claude helpers?
- Should renderer recovery be enabled by default, or initially diagnostics-only until Windows/macOS evidence is collected?
