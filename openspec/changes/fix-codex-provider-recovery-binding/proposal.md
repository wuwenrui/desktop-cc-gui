## Why

Codex `codex-tui/default-config` recovery could split client state from the real disk session: backend provider binding lookup did not prioritize the catalog canonical key, and frontend stale recovery could create fresh/fork continuations without preserving the current thread provider binding. This made `thread not found` recovery unstable even when Codex CLI itself had already written a usable session.

## 目标与边界

- Stabilize client-side Codex provider/session identity during stale recovery.
- Keep disk/default profile compatibility: blank provider id still means the disk `.codex` profile.
- Keep durable stale thread semantics conservative: no silent replacement of durable history.
- Keep the change scoped to Codex provider binding, stale recovery, and test noise cleanup.

## 非目标

- 不改变 Codex CLI 或 `~/.codex` 文件格式。
- 不新增 provider management UI。
- 不重写 session catalog attribution 或 history scanner。
- 不扩大 heavy-test-noise gate 的 policy，只修复本次暴露的 repo-owned warning。

## What Changes

- Backend Codex thread-bound operations resolve provider binding with canonical `codex:<workspaceId>:<threadId>` metadata key first, while preserving legacy lookup keys for old rows.
- Frontend Codex stale recovery inherits the source thread `providerProfileId` when creating fresh continuation or fork continuation.
- Shared frontend start helper trims blank `providerProfileId` before passing it through the launch path.
- Recovery tests cover provider-bound fresh/fork continuation and blank provider fallback.
- Heavy test noise cleanup waits for rich Markdown outline async state before leaving the test.

## 技术方案取舍

| Option | 方案 | 取舍 |
|---|---|---|
| A | Only add retry around `thread not found` | 只能缓解冷启动 race，不能修复 provider/session identity 漂移。 |
| B | Canonicalize provider binding lookup and preserve provider id through recovery | 命中根因，改动范围小，兼容旧 metadata。 |
| C | Rewrite session catalog / alias model | 可能更彻底，但风险和变更面过大，不适合本次 P0 hotfix。 |

Decision: choose Option B.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-provider-scoped-session-launch`: thread-bound provider metadata lookup must prefer the canonical catalog key and support legacy keys without falling back to disk prematurely.
- `codex-stale-thread-binding-recovery`: fresh/fork continuation must remain inside the source thread provider binding when metadata exists.
- `codex-message-recovery-hook`: recovery hook must accept optional provider binding and pass it to fresh/fork helpers.
- `heavy-test-noise-cleanliness`: Markdown preview tests must not leak async outline compile `act(...)` warnings.

## Impact

- Backend: `src-tauri/src/codex/mod.rs`, `src-tauri/src/codex/codex_tests.rs`.
- Frontend: `useCodexMessageRecovery`, `useThreadMessaging`, `useThreadMessagingThreadResolution`, `useThreads`.
- Tests: focused Vitest recovery tests, Rust lookup tests, Markdown preview fast test.
- CI gates: large-file governance unchanged; heavy-test-noise warning path cleaned for the affected test.

## 验收标准

- A stale Codex recovery from a provider-bound thread sends fresh/fork continuation with the same `providerProfileId`.
- Blank/whitespace provider id is normalized away and remains disk default.
- Backend lookup supports canonical, legacy double-colon, bare, and `codex:<threadId>` keys.
- Focused recovery tests and Rust lookup tests pass.
- Focused heavy-test-noise scan for `FileMarkdownPreviewFast.test.tsx` reports zero act/stdout/stderr violations.
