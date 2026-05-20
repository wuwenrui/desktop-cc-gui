use serde_json::Value;
use tauri::AppHandle;

use super::{
    attach_hook_safe_fallback_metadata, create_session_runtime_recovering_error,
    ensure_codex_session, ensure_codex_session_without_session_hooks,
    is_hook_safe_fallback_trigger, is_stopping_runtime_race_error, normalize_model_id,
};
use crate::shared::codex_core;
use crate::state::AppState;

#[cfg(test)]
pub(super) async fn run_start_thread_with_retry<FEnsure, FEnsureFuture, FStart, FStartFuture>(
    workspace_id: &str,
    ensure_runtime: FEnsure,
    start_thread: FStart,
) -> Result<Value, String>
where
    FEnsure: Fn() -> FEnsureFuture,
    FEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FStart: Fn() -> FStartFuture,
    FStartFuture: std::future::Future<Output = Result<Value, String>>,
{
    run_start_thread_with_retry_and_recovery_probe(
        workspace_id,
        ensure_runtime,
        &|| async { Ok(()) },
        start_thread,
    )
    .await
}

pub(super) async fn run_start_thread_with_retry_and_recovery_probe<
    FEnsure,
    FEnsureFuture,
    FRecoveryProbe,
    FRecoveryProbeFuture,
    FStart,
    FStartFuture,
>(
    workspace_id: &str,
    ensure_runtime: FEnsure,
    recovery_probe: &FRecoveryProbe,
    start_thread: FStart,
) -> Result<Value, String>
where
    FEnsure: Fn() -> FEnsureFuture,
    FEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FRecoveryProbe: Fn() -> FRecoveryProbeFuture,
    FRecoveryProbeFuture: std::future::Future<Output = Result<(), String>>,
    FStart: Fn() -> FStartFuture,
    FStartFuture: std::future::Future<Output = Result<Value, String>>,
{
    ensure_runtime().await?;
    let first_attempt = start_thread().await;
    match first_attempt {
        Ok(response) => Ok(response),
        Err(error) if is_stopping_runtime_race_error(&error) => {
            log::warn!(
                "[start_thread] retrying after stopping runtime race for workspace {}: {}",
                workspace_id,
                error
            );
            recovery_probe().await?;
            ensure_runtime().await?;
            match start_thread().await {
                Ok(response) => Ok(response),
                Err(retry_error) if is_stopping_runtime_race_error(&retry_error) => {
                    log::warn!(
                        "[start_thread] stopping runtime race retry exhausted for workspace {}: {}",
                        workspace_id,
                        retry_error
                    );
                    Err(create_session_runtime_recovering_error())
                }
                Err(retry_error) => Err(retry_error),
            }
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
pub(super) async fn run_start_thread_with_hook_safe_fallback<
    FEnsure,
    FEnsureFuture,
    FFallbackEnsure,
    FFallbackEnsureFuture,
    FStart,
    FStartFuture,
>(
    workspace_id: &str,
    ensure_runtime: FEnsure,
    ensure_fallback_runtime: FFallbackEnsure,
    start_thread: FStart,
) -> Result<Value, String>
where
    FEnsure: Fn() -> FEnsureFuture,
    FEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FFallbackEnsure: Fn() -> FFallbackEnsureFuture,
    FFallbackEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FStart: Fn() -> FStartFuture,
    FStartFuture: std::future::Future<Output = Result<Value, String>>,
{
    run_start_thread_with_hook_safe_fallback_and_recovery_probe(
        workspace_id,
        ensure_runtime,
        || async { Ok(()) },
        ensure_fallback_runtime,
        start_thread,
    )
    .await
}

pub(super) async fn run_start_thread_with_hook_safe_fallback_and_recovery_probe<
    FEnsure,
    FEnsureFuture,
    FRecoveryProbe,
    FRecoveryProbeFuture,
    FFallbackEnsure,
    FFallbackEnsureFuture,
    FStart,
    FStartFuture,
>(
    workspace_id: &str,
    ensure_runtime: FEnsure,
    recovery_probe: FRecoveryProbe,
    ensure_fallback_runtime: FFallbackEnsure,
    start_thread: FStart,
) -> Result<Value, String>
where
    FEnsure: Fn() -> FEnsureFuture,
    FEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FRecoveryProbe: Fn() -> FRecoveryProbeFuture,
    FRecoveryProbeFuture: std::future::Future<Output = Result<(), String>>,
    FFallbackEnsure: Fn() -> FFallbackEnsureFuture,
    FFallbackEnsureFuture: std::future::Future<Output = Result<(), String>>,
    FStart: Fn() -> FStartFuture,
    FStartFuture: std::future::Future<Output = Result<Value, String>>,
{
    let primary_result = run_start_thread_with_retry_and_recovery_probe(
        workspace_id,
        ensure_runtime,
        &recovery_probe,
        &start_thread,
    )
    .await;
    let primary_failure = match primary_result {
        Ok(response) => return Ok(response),
        Err(error) => error,
    };
    if !is_hook_safe_fallback_trigger(&primary_failure) {
        return Err(primary_failure);
    }

    log::warn!(
        "[start_thread] attempting hook-safe fallback for workspace {} after primary failure: {}",
        workspace_id,
        primary_failure
    );
    run_start_thread_with_retry_and_recovery_probe(
        workspace_id,
        ensure_fallback_runtime,
        &recovery_probe,
        &start_thread,
    )
    .await
    .map(|response| attach_hook_safe_fallback_metadata(response, &primary_failure))
    .map_err(|fallback_error| {
        format!(
            "Primary create-session failed: {primary_failure}\nHook-safe fallback thread/start failed: {fallback_error}"
        )
    })
}

pub(crate) async fn start_thread_with_runtime_retry(
    workspace_id: &str,
    model: Option<String>,
    state: &AppState,
    app: &AppHandle,
) -> Result<Value, String> {
    let normalized_model = normalize_model_id(model);
    run_start_thread_with_hook_safe_fallback_and_recovery_probe(
        workspace_id,
        || ensure_codex_session(workspace_id, state, app),
        || async {
            state
                .runtime_manager
                .lifecycle_coordinator()
                .record_quarantine_probe("codex", workspace_id, "create-session-stopping-race")
                .await
        },
        || ensure_codex_session_without_session_hooks(workspace_id, state, app),
        || {
            codex_core::start_thread_core(
                &state.sessions,
                workspace_id.to_string(),
                normalized_model.clone(),
            )
        },
    )
    .await
}
