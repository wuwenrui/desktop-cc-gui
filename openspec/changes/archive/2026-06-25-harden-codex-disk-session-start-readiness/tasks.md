# Tasks: harden-codex-disk-session-start-readiness

## 1. Frontend disk-only recovery

- [x] 1.1 在 `useWorkspaceActions` 中识别 disk provider selection（blank / `__disk__`）。
- [x] 1.2 Codex disk 创建遇到 runtime recovering 或 ready confirmation failure 时自动 `ensureRuntimeReady` + retry 一次。
- [x] 1.3 Managed provider 创建不走 disk auto-recovery，保留现有 toast/错误路径。
- [x] 1.4 Vitest 覆盖 disk 自动恢复成功、managed provider 不额外恢复。

## 2. Backend disk ready confirmation

- [x] 2.1 在 `codex_core` 增加短超时 `thread/resume` ready confirmation helper。
- [x] 2.2 只在 `providerProfileId == "__disk__"` 的 `thread/start` 后执行 ready confirmation。
- [x] 2.3 Managed provider `thread/start` 不执行该确认，不改变 provider-scoped runtime 行为。

## 3. App-server probe cache

- [x] 3.1 为 `probe_codex_app_server` 增加成功态 TTL cache。
- [x] 3.2 Cache key 包含 resolved binary、wrapper kind、PATH env、codex args、launch options。
- [x] 3.3 失败不缓存，避免 CLI 修复后仍被旧失败挡住。

## 4. Validation

- [x] 4.1 `npx vitest run src/features/app/hooks/useWorkspaceActions.test.tsx src/features/threads/hooks/useThreadActions.start-fork.test.tsx src/services/tauri.test.ts`
- [x] 4.2 `cargo test --manifest-path src-tauri/Cargo.toml start_thread_retry -- --nocapture`
- [x] 4.3 `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli -- --nocapture`
- [x] 4.4 `npm run typecheck`
- [x] 4.5 `npm run lint`
- [x] 4.6 `npm run check:runtime-contracts`
- [x] 4.7 `cargo test --manifest-path src-tauri/Cargo.toml --no-run`

## 5. Runtime Reconnect UI Semantics

- [x] 5.1 Audit the runtime reconnect card decision path: assistant diagnostic text → `resolveThreadStabilityDiagnostic` → latest reconnect row → `RuntimeReconnectCard`.
- [x] 5.2 Keep blocking diagnostics (`broken pipe`, `workspace not connected`, `thread/session not found`) on the recovery-card path with reconnect/resend actions.
- [x] 5.3 Downgrade transient managed-runtime cleanup (`stale_reuse_cleanup`, `internal_replacement`) to a lightweight switching notice without reconnect/resend actions.
- [x] 5.4 Drop stale transient cleanup diagnostics after the user continues, so old runtime switching text does not keep occupying the conversation flow.
- [x] 5.5 Add focused regression tests for transient cleanup action suppression and stale transient cleanup dismissal.
- [x] 5.6 Validate with `npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx src/features/messages/components/runtimeReconnect.test.ts`, `npm run typecheck`, and `npm run lint`.
