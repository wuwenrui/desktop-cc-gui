# Design: harden-codex-disk-session-start-readiness

## Scope

本变更只加固默认 disk Codex provider（blank / `__disk__`）的新会话创建路径。Managed provider 创建路径已经稳定，必须保持 provider-scoped runtime key、provider-scoped `CODEX_HOME`、materialize config、provider binding record 的既有行为。

## Data Flow

```text
UI create Codex session
  -> useWorkspaceActions.handleAddAgent
  -> runCreateSessionFlow
  -> startThreadForWorkspace
  -> Tauri start_thread
  -> start_thread_with_runtime_retry_for_provider
  -> start_thread_core
  -> disk only: thread/resume readiness confirmation
  -> frontend ensureThread loaded state
```

## Frontend Recovery

`useWorkspaceActions` 通过 `providerProfileId` / `providerProfile.id` 判定 disk selection。只有 `targetEngine === "codex"` 且 provider 为 disk 时，首次创建遇到 runtime recovering 或 backend ready confirmation failure，才自动：

1. `ensureRuntimeReady(workspace.id)`
2. 重新执行同一个 `runCreateSessionFlow`

Managed provider 不进入该分支，仍使用原手动恢复 toast / error path。

## Backend Readiness Confirmation

`start_thread_with_runtime_retry_for_provider` 在 `providerProfileId == "__disk__"` 且 `thread/start` 返回 thread id 后，调用 `confirm_thread_ready_after_start_core`。该 helper 对同一个 session key 发送短超时 `thread/resume`，确认新 thread 在 runtime 内可用。失败时返回 create-session error，避免 frontend 先把 thread 标为 loaded 后形成虚连。

Managed provider 不执行该确认，避免改变其创建延迟和 runtime 行为。

## Probe Cache

`probe_codex_app_server` 增加内存 TTL cache，只缓存成功结果。Key 包含：

- resolved binary
- wrapper kind
- PATH env
- codex args
- launch options

失败结果不缓存，用户修复 CLI、PATH 或 wrapper 后下一次仍会真实探测。

## Validation

- Frontend tests cover disk inline recovery and managed provider non-recovery.
- Existing provider start/fork tests verify provider in-flight key and payload mapping remain stable.
- Rust focused tests cover start retry and app-server CLI launch helpers.
- Runtime contract / typecheck / lint / Rust no-run compile gate must pass before archive.
