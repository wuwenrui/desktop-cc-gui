## Overview

This change turns two log-derived error classes into explicit degradation paths:

```text
Codex sidebar list
  -> live thread/list, bounded at 1500ms in backend live call
  -> if live fails, scan local Codex session summaries
  -> return normal thread/list shape with partialSource
```

```text
Engine switch to Codex
  -> cached status says unavailable
  -> refresh detectEngines()
  -> if refreshed status is installed, switch normally
  -> otherwise run Codex doctor and emit structured evidence
```

## Backend Thread Listing

Desktop unified listing already had a local session merge path, but live list failure short-circuited before local scan. The fix keeps the live request bounded and demotes live failure to a partial-source condition.

Daemon mode previously called `codex_core::list_threads_core` directly and converted the live timeout into a fatal RPC error. The daemon now mirrors the degraded behavior by using `local_usage::list_codex_session_summaries_for_workspace` as fallback.

The daemon fallback uses a requested scan limit based on current cursor offset and requested page size:

```text
scan_limit = offset + requested_limit + 1
```

This keeps pagination possible without asking the local scanner for an unbounded full catalog on each degraded request.

## Partial Source Priority

`local-session-scan-unavailable` remains higher priority than `live-thread-list-unavailable`.

Reason: frontend continuity code already has a specific compatibility path for local scan unavailability. If both live and local fail, reporting only live failure would erase the stronger diagnostic and could break known-session continuity behavior.

## Engine Switch Diagnostics

The engine hook now treats cached unavailable status as stale until a fresh `detectEngines()` confirms it. Only after the refresh still says unavailable does Codex switch emit doctor evidence.

This matches the environment-drift diagnosis path where a GUI runtime may miss `/opt/homebrew/bin/codex` or another shell-visible binary. The switch path does not reinterpret doctor success as installation success; detector remains the gate for switching, while doctor evidence explains the failure.

## Error Handling

- Workspace-not-found remains fatal.
- Live thread-list timeout/error is degraded when fallback can answer.
- Local fallback timeout/error returns degraded empty response in daemon mode to avoid blocking the sidebar.
- Desktop unified listing can return an empty degraded result with `partialSource` when both live and local inputs are unavailable.
- Doctor failure is captured in debug payload as `doctorError`; it does not throw through the UI switch action.

## Testing

Validated with:

- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml select_unified_codex_partial_source_prefers_local_scan_failure`
- `cargo test --manifest-path src-tauri/Cargo.toml daemon_codex_`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm exec eslint src/features/engine/hooks/useEngineController.ts src/features/engine/hooks/useEngineController.test.tsx`
- `npm exec vitest run src/features/engine/hooks/useEngineController.test.tsx`
- `npm run check:runtime-contracts`
- `git diff --check` on touched files

Known unrelated validation blocker:

- `npm run typecheck` currently fails on existing `RuntimeReconnectCard.tsx` `string | null` errors outside this change scope.

## Rollback

Rollback is low risk:

- Revert the changed files in this change.
- Thread-list live behavior returns to fatal live errors.
- Engine switch returns to cached status gating.
- No storage migration or command shape change is involved.
