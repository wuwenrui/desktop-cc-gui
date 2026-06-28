## Implementation Audit Notes

### Readiness Trace

- Frontend create loading starts in `useWorkspaceActions.runCreateSessionFlow()` and settles only after `startThreadForWorkspace()` resolves a non-empty thread id.
- Tauri service `startThread()` calls Rust command `start_thread`.
- Rust `codex::start_thread()` normalizes the provider id, calls `start_thread_with_runtime_retry_for_provider()`, and records provider binding only after a native thread id is returned.
- `start_thread_with_runtime_retry_for_provider()` calls `codex_core::start_thread_core()`.
- For disk provider only (`provider_profile_id == "__disk__"`), it then calls `confirm_thread_ready_after_start_core()`, which performs bounded same-runtime readiness confirmation through `thread/resume`.
- Therefore healthy disk loading already waits for native thread/runtime readiness; the implementation did not add another backend readiness probe.

### Scope Guard

- Managed Codex providers are not changed: the existing Rust readiness confirmation remains gated to `__disk__`, and the new frontend disk-readiness recovery toast is gated by `targetEngine === "codex"` plus disk provider selection.
- Claude Code is not changed: no Claude command/session path was modified, and generic non-Codex runtime notices remain on the existing `threadTurnFailed` key.

### Implemented Fix

- Codex recoverable runtime/thread-binding failures now use `runtimeNotice.error.codexSessionRecoverableFailure`.
- Raw runtime text is retained as `rawMessage` in notice params for diagnostics, but the rendered summary no longer displays `manual shutdown`, `stale_reuse_cleanup`, `thread not found`, `{{reasonCode}}`, or `{{actionHint}}`.
- Disk Codex post-start stale readiness failures show the existing reconnect/retry create-session toast without automatically creating a second session.

### Verification

- `pnpm vitest run src/services/globalRuntimeNotices.test.ts src/features/notifications/components/GlobalRuntimeNoticeDock.test.tsx src/features/app/hooks/useWorkspaceActions.test.tsx src/features/threads/hooks/useThreadMessaging.test.tsx`
- `pnpm tsc --noEmit --pretty false`
