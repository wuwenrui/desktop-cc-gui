# Codex Provider-Scoped Runtime Contract

## Scenario: Codex provider-scoped runtime and thread binding

### 1. Scope / Trigger

- Trigger: 修改 `src-tauri/src/codex/**`、`src-tauri/src/shared/codex_core.rs`、`src-tauri/src/backend/app_server.rs` 的 Codex app-server launch / thread routing / fork / send path，或修改 `src-tauri/src/session_management*` 的 Codex provider binding metadata。
- 目标：Codex provider selection 是 conversation launch decision，不是全局 active provider；thread-bound operation 必须回到 persisted provider runtime。
- 当前代码事实：disk profile 保留 legacy workspace runtime key；managed profile 使用 `codex::<workspaceId>::<providerProfileId>` runtime key 与 provider-scoped `CODEX_HOME`。

### 2. Signatures

- `CODEX_DISK_PROVIDER_PROFILE_ID: "__disk__"`
- `CODEX_DISK_PROVIDER_PROFILE_NAME: "磁盘 .codex 配置"`
- `CodexProviderProfile::{Disk, Managed { id, name, config_toml, auth_json }}`
- `CodexProviderBinding { providerProfileId, providerProfileSource, providerProfileName, providerAvailability }`
- `resolve_codex_provider_profile(provider_profile_id: Option<&str>) -> Result<CodexProviderProfile, String>`
- `materialize_codex_provider_profile(profile: CodexProviderProfile) -> Result<MaterializedCodexProviderProfile, String>`
- `codex_runtime_key(workspace_id: &str, provider_profile_id: &str) -> String`
- `legacy_codex_runtime_key(workspace_id: &str) -> String`
- `ensure_codex_session_for_provider(workspace_id, provider_profile_id, state, app) -> Result<(), String>`
- Tauri commands: `start_thread(workspaceId, autoSession?, providerProfileId?)`, `fork_thread(workspaceId, threadId, messageId?, providerProfileId?, targetUserTurnIndex?, targetUserMessageText?, targetUserMessageOccurrence?, localUserMessageCount?)`, `send_user_message(...)`, `resume_thread(...)`, `thread_compact(...)`, `turn_interrupt(...)`, `start_review(...)`。
- Metadata storage: `session-management/workspaces/<workspaceId>.json.codexProviderBindingBySessionId`。

### 3. Contracts

- Missing or blank provider profile id normalizes to `__disk__` only at explicit launch/default boundaries and historical metadata migration boundaries.
- Disk profile MUST use `legacy_codex_runtime_key(workspace_id)` so existing `.codex` / `CODEX_HOME` behavior remains compatible.
- Managed profile MUST be resolved from app config `codex.providers[providerProfileId]`; missing provider or empty `configToml` returns an error and MUST NOT fall back to disk.
- Managed provider home MUST be app-local under `codex-provider-homes/<providerId>/`; provider id path segment rejects empty, `.`, `..`, `/`, and `\`.
- Managed materialization MUST write `config.toml`; if `authJson` exists, it MUST JSON-validate and write `auth.json`. On Unix, written files MUST use owner-only `0600` permissions.
- Managed materialization MUST extract top-level `model`, `model_provider`, `approval_policy`, and `sandbox_mode` from `configToml` into `codex_args_override` as `-c key=value` pairs so project `.codex/config.toml` cannot silently override launch-critical settings.
- `start_thread` MUST normalize selected provider id, ensure that provider runtime, call `thread/start`, and record `CodexProviderBinding` only after a thread id is returned.
- Thread-bound commands MUST call `resolve_thread_provider_profile_id` from metadata before ensuring/sending to a runtime. Missing metadata MAY default to disk for legacy threads; unavailable managed provider MUST surface a provider error from provider resolution.
- Provider-selected fork defaults to parent provider when `providerProfileId` is blank. Cross-provider fork MUST validate/ensure selected provider first, then native-fork in the parent provider runtime, copy the native child history into the selected provider home when homes differ, then record child binding.
- Stale `turn/start` recovery stays inside the same `WorkspaceSession`: classify `thread not found` / `thread_not_found`, clear foreground work, send bounded `thread/resume`, retry the original `turn/start` once, and clear foreground work if recovery fails.
- Daemon adapter currently supports only disk Codex runtime. It MUST parse `providerProfileId`; `None`, blank, and `__disk__` are allowed; managed provider ids return an explicit unsupported provider-scoped runtime error.
- Codex app-server launch MUST set `initialize.clientInfo.name/title` to `codex-tui`, resolve `clientInfo.version` from `codex --version`, fallback to `0.137.0`, and set terminal env hints `TERM_PROGRAM` / `TERM_PROGRAM_VERSION` while preserving existing env values when present.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 新建会话无 `providerProfileId` | 创建 disk profile thread 并记录 disk binding | 猜测最近使用的 managed provider |
| 新建 managed provider 会话 | materialize provider home，启动 provider-scoped runtime，记录 managed binding | 写入全局 `~/.codex` 或复用 disk runtime |
| provider 缺失/删除后继续发送 | 返回 provider not found / unavailable 类错误 | 静默按 `__disk__` 发送 |
| thread metadata 缺失的旧会话 | 作为 legacy disk thread 处理 | 标记为 managed provider |
| cross-provider fork | parent runtime native fork -> copy child history -> record selected provider binding | transcript seed turn 或隐藏/改写 parent thread |
| `turn/start` stale thread | same runtime `thread/resume` + one bounded retry | 重新路由到 disk 或无限 retry |
| daemon 收到 managed provider id | 显式 unsupported error | 丢弃 `providerProfileId` 后创建 disk thread |
| Codex launch identity | `codex-tui` client info + terminal fallback env | 影响 Claude/Gemini/OpenCode launch |

### 5. Good / Base / Bad Cases

- Good: `send_user_message` 先 `resolve_thread_provider_profile_id`，再 `ensure_codex_session_for_provider`，最后把 `Some(provider_profile_id)` 传入 `send_user_message_core`。
- Good: `fork_thread` 对 cross-provider fork 只在 parent provider runtime 调 `thread/fork`，`copy_native_fork_history_to_selected_provider` 成功后才 `record_codex_provider_binding`。
- Base: 旧历史 thread 没有 metadata，默认 `__disk__`，使用 workspace-only legacy runtime key。
- Bad: managed provider 找不到时 `unwrap_or(__disk__)`。
- Bad: daemon/web adapter 解析到 `providerProfileId` 后不使用也不报错。
- Bad: `thread not found` 后重新 `start_thread` 或新建 disk thread 替代原 thread。

### 6. Tests Required

- Rust tests for `codex_runtime_key`, disk legacy key behavior, provider id sanitization, managed materialization, auth JSON validation, owner-only permissions where platform supports it, and launch-critical override extraction.
- Rust tests for thread binding metadata read/write and catalog projection fields `providerProfileId/source/name/availability`.
- Rust tests for fork response enrichment and cross-provider history copy failure diagnostics.
- Rust tests for stale thread classifier and same-runtime retry behavior; at minimum classifier tests must cover both response error shapes and unrelated errors.
- Rust tests for `codex-tui` version parsing and GUI control-plane classification for `codex-tui + experimentalApi`.
- Contract validation: `npm run check:runtime-contracts`, `cargo test --manifest-path src-tauri/Cargo.toml --no-run`, and `openspec validate add-codex-provider-scoped-session-launch --strict --no-interactive` after cross-layer routing changes.

### 7. Wrong vs Correct

#### Wrong

```rust
let provider_profile_id = requested_provider.unwrap_or("__disk__".to_string());
let session_key = workspace_id.clone();
// managed provider errors now silently use disk runtime
```

#### Correct

```rust
let provider_profile_id = resolve_thread_provider_profile_id(&state, &workspace_id, &thread_id).await;
ensure_codex_session_for_provider(&workspace_id, &provider_profile_id, &state, &app).await?;
codex_core::send_user_message_core(
    &state.sessions,
    workspace_id,
    Some(provider_profile_id),
    thread_id,
    text,
    model,
    effort,
    access_mode,
    images,
    collaboration_mode,
    preferred_language,
    custom_spec_root,
    mode_enforcement_enabled,
).await
```

#### Wrong

```rust
if is_thread_not_found(error) {
    start_thread_core(&sessions, workspace_id, None, None).await?;
}
```

#### Correct

```rust
if is_thread_not_found_error_message(&error) {
    retry_turn_start_after_thread_resume(
        &session,
        &workspace_id,
        &thread_id,
        &params,
        timeout_duration,
        &error,
    ).await?;
}
```
