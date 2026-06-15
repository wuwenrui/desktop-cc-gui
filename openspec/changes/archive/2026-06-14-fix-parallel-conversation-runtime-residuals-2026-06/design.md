# Design: Fix Parallel Conversation Runtime Residuals 2026-06

OpenSpec change: `fix-parallel-conversation-runtime-residuals-2026-06`

## P0.1 Perf Flag Self-Check And Reset

Current code:

- `src/features/threads/utils/realtimePerfFlags.ts` uses `FLAG_PREFIX = "ccgui.perf."`.
- `readRealtimePerfFlag(key, defaultValue, testDefaultValue)` reads localStorage and caches non-test values.
- `useThreadsReducer.ts` and `threadReducerCoreHelpers.ts` currently read some flags at module load.

Implementation:

- Define a local `PERF_FLAG_DEFINITIONS` array with 8 stable ids, production default, test default, and metric/rationale.
- Keep existing `isXxxEnabled()` exports by delegating to the same reader.
- Add:
  - `getActiveRealtimePerfFlags(): Record<string, { value: boolean; source: "localStorage" | "default"; storageKey: string; defaultValue: boolean; testDefaultValue: boolean; metric: string }>`
  - `resetRealtimePerfFlags(): string[]`
- `resetRealtimePerfFlags()` removes all known keys, clears `cachedFlags`, and returns removed storage keys.

Settings UI:

- Add a small reset action in Settings' existing miscellaneous/diagnostics area.
- The action calls `resetRealtimePerfFlags()`, then shows a reload-required message. It MUST NOT reload automatically.

## P0.2 Claude Active Process Diagnostics

Current code:

- `ClaudeSession.active_process_ids()` exists.
- `ClaudeSessionManager.list_sessions()` exists.
- No webview-callable workspace-level command currently aggregates active child processes.

Implementation:

- Add serializable structs in `src-tauri/src/engine/commands.rs`:
  - `EngineActiveProcessDiagnostics`
  - `EngineWorkspaceActiveProcessDiagnostics`
- Add `#[tauri::command] get_engine_active_process_diagnostics(...) -> Result<EngineActiveProcessDiagnostics, String>`.
- Local mode returns Claude workspace ids and active process ids.
- Remote mode returns empty measured=false diagnostics rather than failing; this keeps Settings/DevTools stable when connected to a remote backend.
- Register command in `command_registry.rs`.
- Add frontend wrapper in `src/services/tauri.ts`.

## P0.3 ClaudeSession Drop Fallback

Current code:

- Explicit async cleanup exists in normal completion, disposed startup, interrupt, and remove paths.
- `Drop` cannot await `terminate_child_process`.

Implementation:

- Implement `Drop for ClaudeSession`.
- In Drop, use `active_processes.try_lock()`.
- Drain any remaining child handles.
- Call `child.start_kill()` as best-effort non-blocking fallback.
- Log failures; do not panic, block, or await.

Limit:

- This is a final safety net, not a replacement for existing async termination paths.
- If the async mutex is locked during Drop, Drop records a warning and returns; follow-up reconciler work remains out of scope.

## Validation

- `npx vitest run src/features/threads/utils/realtimePerfFlags.test.ts`
- Relevant SettingsView test for reset button behavior.
- Rust targeted test where feasible for diagnostics shape.
- `npm run typecheck`
- `openspec validate fix-parallel-conversation-runtime-residuals-2026-06 --strict --no-interactive`
