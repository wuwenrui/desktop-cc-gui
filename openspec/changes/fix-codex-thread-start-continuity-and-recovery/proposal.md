## Why

Codex first-turn recovery currently has two identities that look similar but must not be treated the same:

- a disposable local first-send draft that never reached native `thread/start`;
- a native Codex thread returned by `thread/start`, now pending readiness or first `turn/start`.

The second case is already a provider/runtime-owned thread identity. Silently replacing it with another fresh thread when `turn/start` sees `thread not found` can hide a cold-start readiness race, create duplicate first-turn threads, and make runtime pool cleanup think there is no foreground work attached to the newly created thread.

This change tightens that boundary: backend readiness confirmation gets a bounded `thread/resume` retry window, runtime pool records the just-started Codex thread as protected foreground continuity, and frontend recovery refuses silent fresh/fork replacement for native `thread-start` empty drafts or unknown native missing-thread failures.

## What Changes

- Backend Codex `thread/start` validation now trims and rejects blank thread ids before treating a response as usable.
- After a valid `thread/start`, the runtime manager records foreground continuity with source `thread-started` so reconcile/eviction does not discard a just-created runtime while first-send readiness is still pending.
- `thread/start` ready confirmation and stale `turn/start` retry both use bounded same-runtime `thread/resume` readiness retries before surfacing `thread not ready`.
- Frontend accepted-turn facts mark native Codex `thread/started` empty drafts with source `thread-start`.
- Codex message recovery only allows silent fresh replacement for authoritative disposable local first-send drafts with current optimistic user intent. Native `thread-start` drafts, unknown native missing-thread failures, and durable activity must use verified rebind, explicit fork/fresh continuation, or visible failure.
- Message auto-follow now gates static history item changes behind active work/finalization instead of scrolling on non-live history updates.

## Capabilities

### Modified Capabilities

- `codex-stale-thread-binding-recovery`
- `conversation-runtime-stability`
- `long-list-virtualization-performance`

### New Capabilities

- None.

## Impact

- Rust backend:
  - `src-tauri/src/shared/codex_core.rs`
  - `src-tauri/src/backend/app_server.rs`
  - `src-tauri/src/runtime/mod.rs`
  - focused Rust tests in `src-tauri/src/runtime/tests.rs`
- Frontend:
  - `src/features/threads/hooks/useCodexMessageRecovery.ts`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/threads/hooks/useThreadTurnEvents.ts`
  - `src/features/threads/hooks/sessionLifecycleController.ts`
  - `src/features/threads/utils/codexConversationLiveness.ts`
  - `src/features/messages/components/Messages.tsx`
  - focused Vitest coverage for recovery and live behavior
- Implementation rules:
  - `.trellis/spec/frontend/hook-guidelines.md` is updated so future work does not reintroduce silent fresh replacement for native `thread-start` drafts.

## Acceptance

- A Codex native thread returned by `thread/start` is not silently replaced by a second fresh thread if first `turn/start` reports `thread not found`.
- Backend readiness checks retry bounded same-runtime `thread/resume` and never route the request to another provider/runtime.
- Runtime pool reconciliation keeps a just-started Codex thread protected while startup/first-turn readiness is pending.
- Unknown native `thread not found` failures do not fresh-replace or fork without accepted/durable evidence.
- Static history updates do not trigger live auto-follow scroll work when no turn is running or finalizing.
- OpenSpec validation passes for this change.

## Risk

- [Risk] A truly disposable local first-send draft might surface an error instead of silently replaying if facts are incomplete.
  - [Mitigation] Fresh replacement remains allowed for explicit `local-first-send-draft` with optimistic user intent; unknown or native identities fail conservatively.
- [Risk] Bounded resume retries can add several seconds before surfacing a cold-start failure.
  - [Mitigation] Retry windows are finite and same-runtime only; failures return a clear `thread not ready after bounded resume retry` message.

## Migration

No data migration. Existing thread metadata remains compatible. Rollback is a normal `git revert` of the code/spec commit.
