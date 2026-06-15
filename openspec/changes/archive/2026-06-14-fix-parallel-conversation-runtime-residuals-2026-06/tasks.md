# Tasks: Fix Parallel Conversation Runtime Residuals 2026-06

## 1. Perf Flags

- [x] 1.1 Add `PERF_FLAG_DEFINITIONS` registry in `realtimePerfFlags.ts`.
- [x] 1.2 Add `getActiveRealtimePerfFlags()` with value/source/default metadata.
- [x] 1.3 Add `resetRealtimePerfFlags()` and cache clearing.
- [x] 1.4 Extend `realtimePerfFlags.test.ts` for localStorage override, active flags, and reset.

## 2. Settings Reset Entry

- [x] 2.1 Add a reset action to Settings UI.
- [x] 2.2 Show reload-required message after reset.
- [x] 2.3 Add SettingsView coverage for button behavior where feasible.

## 3. Claude Child Process Diagnostics And Drop

- [x] 3.1 Add `Drop for ClaudeSession` best-effort `start_kill()` fallback.
- [x] 3.2 Add `get_engine_active_process_diagnostics` command.
- [x] 3.3 Register command in `command_registry.rs`.
- [x] 3.4 Add frontend service wrapper in `src/services/tauri.ts`.
- [x] 3.5 Add targeted Rust/frontend tests where feasible.

## 4. Validation

- [x] 4.1 `npx vitest run src/features/threads/utils/realtimePerfFlags.test.ts`
- [x] 4.2 Relevant SettingsView test.
- [x] 4.3 Rust targeted test / `cargo test` subset where feasible.
- [x] 4.4 `npm run typecheck`
- [x] 4.5 `openspec validate fix-parallel-conversation-runtime-residuals-2026-06 --strict --no-interactive`
