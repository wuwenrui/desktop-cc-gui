## Why

`2026-05-31` error-log showed three user-visible stability problems around Codex sidebar history and engine switching:

- `thread/list live timeout`: frontend live query reached the 30s UI budget.
- `thread/list error`: daemon returned `live thread/list timed out after 1500ms` as a fatal list error.
- `engine/switch error`: UI reported `Engine codex is not installed` even when shell verification showed `/opt/homebrew/bin/codex` and `codex-cli 0.135.0`.

The core issue was not three unrelated UI bugs. The history list path still treated live `thread/list` as too authoritative in daemon/runtime contention cases, and engine switching trusted stale detection state before rechecking or attaching doctor evidence.

## Goal And Boundaries

- Goal: make Codex sidebar history degrade to local session evidence when live `thread/list` fails.
- Goal: keep live `thread/list` bounded; do not hide contention by raising the live timeout.
- Goal: make Codex engine switching refresh stale status before failing, and include doctor evidence when failure remains.
- Boundary: do not change Tauri command names, frontend service payload mapping, Codex app-server protocol, or the runtime acquire state machine.
- Boundary: `account/rateLimits/read error` is explicitly out of scope for this change.

## Non-Goals

- Do not redesign the runtime lifecycle coordinator.
- Do not add a new history storage backend.
- Do not make doctor output a hard dependency for successful engine switching.
- Do not solve unrelated typecheck failures in `RuntimeReconnectCard.tsx`.

## What Changes

- Desktop unified Codex thread listing now treats live `thread/list` failure as degraded input and continues with local session scan results.
- The degraded response includes `partialSource = "live-thread-list-unavailable"` when live listing fails but local history is available.
- If local scan also fails, the existing `local-session-scan-unavailable` marker takes priority so frontend known-session continuity logic remains compatible.
- Daemon `list_threads` now falls back to local Codex session summaries on live timeout/error instead of surfacing `live thread/list timed out after 1500ms` as a fatal error.
- Daemon fallback has a 5s local-scan budget and returns a degraded empty response if local fallback is unavailable, preserving UI responsiveness.
- Codex engine switching now refreshes `detectEngines()` when cached status says unavailable.
- If Codex still appears unavailable, switching records `runCodexDoctor(null, null)` evidence including environment diagnosis and resolved binary path.

## Technical Options

| Option | Trade-off | Decision |
|---|---|---|
| Increase live `thread/list` timeout | Reduces some symptoms but hides runtime contention and can still block UI | Rejected |
| Frontend-only ignore timeout errors | Fast but still leaves daemon fatal response and no source diagnostics | Rejected |
| Backend degraded fallback with `partialSource` | Preserves bounded live read and uses existing local history catalog | Chosen |
| Always run Codex doctor before engine switch | More evidence but adds unnecessary work to healthy switch path | Rejected |
| Refresh stale status first, doctor only on remaining failure | Small, targeted, preserves healthy path and improves diagnostics | Chosen |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-cross-source-history-unification`: live `thread/list` failure must not collapse the Codex history response when local history can answer, and local-scan failure markers remain compatible with known-session continuity.
- `engine-environment-doctor`: engine switch failure for Codex must be backed by refreshed detection and structured doctor evidence instead of a stale cached "not installed" message.

## Impact

- Backend:
  - `src-tauri/src/codex/thread_listing.rs`
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`
  - `src-tauri/src/codex/codex_tests.rs`
- Frontend:
  - `src/features/engine/hooks/useEngineController.ts`
  - `src/features/engine/hooks/useEngineController.test.tsx`
- User-visible behavior:
  - Sidebar history should show local/degraded Codex history instead of failing on live timeout.
  - Engine switch should recover from stale unavailable status after a fresh detect, or produce actionable doctor evidence.

## Acceptance Criteria

- Live `thread/list` failure with local session data returns a successful response with `partialSource = "live-thread-list-unavailable"`.
- Local scan failure keeps `partialSource = "local-session-scan-unavailable"` priority for known-session continuity.
- Daemon `list_threads` no longer returns `live thread/list timed out after 1500ms` as fatal when local fallback can produce a degraded response.
- Daemon local fallback is bounded and can return degraded empty response rather than blocking the sidebar.
- Switching to Codex after a stale unavailable status performs fresh `detectEngines()` and proceeds if the refreshed status is installed.
- If Codex remains unavailable, debug evidence includes doctor fields such as `doctorOk`, `environmentDiagnosis`, `resolvedBinaryPath`, and `pathEnvUsed`.
- Focused Rust and Vitest regression tests pass.
