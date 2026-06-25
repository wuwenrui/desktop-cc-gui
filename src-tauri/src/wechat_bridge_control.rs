use std::collections::HashSet;
use std::env;
use std::fs::{File, OpenOptions};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager, State};
use tokio::time::{sleep, Duration};

use crate::state::AppState;
use crate::storage::{read_json_file, write_json_file};

const BRIDGE_LISTEN: &str = "127.0.0.1:18012";
const BRIDGE_BASE_URL: &str = "http://127.0.0.1:18012";
const BRIDGE_CHAT_ENDPOINT: &str = "http://127.0.0.1:18012/v1/chat/completions";
const WECLAW_API_ADDR: &str = "127.0.0.1:18011";
const WECLAW_AGENT_NAME: &str = "lawyer-copilot";
const STARTUP_RETRY_TIMES: usize = 20;
const STARTUP_RETRY_INTERVAL_MS: u64 = 150;
const LOG_READ_LIMIT: u64 = 64 * 1024;
const MIN_REPLY_INTERVAL_MS: u64 = 1500;
const MAX_REPLIES_PER_MINUTE: u32 = 20;
const WECLAW_SYNC_FRESH_SECS: u64 = 180;
const KEEP_ONLINE_CHECK_INTERVAL_SECS: u64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WeChatBridgePhase {
    NotReady,
    Stopped,
    Starting,
    WaitingScan,
    Running,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeActivity {
    ts_secs: i64,
    wxid: String,
    workspace: String,
    decision: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WeChatBridgeMediaKind {
    Image,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WeChatBridgeMediaStatus {
    Saved,
    Failed,
    Skipped,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeMediaActivity {
    ts: String,
    wxid: String,
    kind: WeChatBridgeMediaKind,
    status: WeChatBridgeMediaStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeQuoteActivity {
    ts: String,
    wxid: String,
    status: WeChatBridgeQuoteStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WeChatBridgeQuoteStatus {
    Parsed,
    Unparsed,
    MessageShape,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeStatus {
    phase: WeChatBridgePhase,
    bridge_running: bool,
    weclaw_running: bool,
    daemon_running: bool,
    bridge_available: bool,
    weclaw_available: bool,
    daemon_host: String,
    bridge_endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    qr_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    login_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    log_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_activity: Option<WeChatBridgeActivity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_media_activity: Option<WeChatBridgeMediaActivity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_quote_activity: Option<WeChatBridgeQuoteActivity>,
    has_local_smoke_activity: bool,
    wechat_bound: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    bound_wechat_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bound_wechat_bot_id: Option<String>,
    weclaw_sync_fresh: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    weclaw_sync_age_secs: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WeChatBridgeDiagnosticState {
    Pass,
    Warn,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeDiagnosticCheck {
    key: String,
    state: WeChatBridgeDiagnosticState,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WeChatBridgeDiagnostics {
    ok: bool,
    checks: Vec<WeChatBridgeDiagnosticCheck>,
    status: WeChatBridgeStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct QrSnapshot {
    qr_text: Option<String>,
    login_url: Option<String>,
}

#[derive(Debug, Clone)]
struct ControlPaths {
    root: PathBuf,
    data_dir: PathBuf,
    bridge_pid: PathBuf,
    weclaw_pid: PathBuf,
    bridge_log: PathBuf,
    weclaw_log: PathBuf,
    audit_log: PathBuf,
}

#[derive(Debug, Clone)]
struct BinaryAvailability {
    bridge: Option<PathBuf>,
    weclaw: Option<PathBuf>,
}

#[tauri::command]
pub(crate) async fn get_wechat_bridge_status(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WeChatBridgeStatus, String> {
    get_status(&state, &app, None).await
}

#[tauri::command]
pub(crate) async fn start_wechat_bridge(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WeChatBridgeStatus, String> {
    start_wechat_bridge_inner(&state, &app, workspace_id).await
}

#[tauri::command]
pub(crate) async fn stop_wechat_bridge(app: AppHandle) -> Result<WeChatBridgeStatus, String> {
    stop_wechat_bridge_inner(&app).await
}

#[tauri::command]
pub(crate) async fn reset_wechat_bridge_login(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WeChatBridgeStatus, String> {
    reset_wechat_bridge_login_inner(&state, &app, workspace_id).await
}

#[tauri::command]
pub(crate) async fn send_wechat_bridge_verification_prompt(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WeChatBridgeStatus, String> {
    send_wechat_bridge_verification_prompt_inner(&state, &app, workspace_id).await
}

#[tauri::command]
pub(crate) async fn run_wechat_bridge_diagnostics(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WeChatBridgeDiagnostics, String> {
    let status = get_status(&state, &app, None).await?;
    let bridge_probe = if status.bridge_running {
        probe_bridge_chat().await
    } else {
        Err("message bridge is not running".to_string())
    };
    Ok(diagnostics_from_status(status, bridge_probe))
}

pub(crate) fn spawn_wechat_bridge_keep_online_task(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(3)).await;
        loop {
            let state = app.state::<AppState>();
            if state.runtime_manager.is_shutting_down() {
                break;
            }

            let status = match get_status(&state, &app, None).await {
                Ok(status) => status,
                Err(error) => {
                    log::warn!("Failed to inspect WeChat keep-online status: {error}");
                    sleep(Duration::from_secs(KEEP_ONLINE_CHECK_INTERVAL_SECS)).await;
                    continue;
                }
            };
            let settings = state.app_settings.lock().await.clone();
            if should_restore_wechat_bridge_keep_online(&settings, &status) {
                if let Err(error) = start_wechat_bridge_inner(&state, &app, None).await {
                    log::warn!("Failed to restore WeChat keep-online channel: {error}");
                }
            }

            sleep(Duration::from_secs(KEEP_ONLINE_CHECK_INTERVAL_SECS)).await;
        }
    });
}

fn should_restore_wechat_bridge_keep_online(
    settings: &crate::types::AppSettings,
    status: &WeChatBridgeStatus,
) -> bool {
    settings.wechat_bridge_keep_online
        && status.bridge_available
        && status.weclaw_available
        && (!status.bridge_running
            || !status.weclaw_running
            || matches!(
                status.phase,
                WeChatBridgePhase::Stopped | WeChatBridgePhase::Error
            ))
}

async fn start_wechat_bridge_inner(
    state: &AppState,
    app: &AppHandle,
    workspace_id: Option<String>,
) -> Result<WeChatBridgeStatus, String> {
    let entitlement_credentials =
        crate::newapi_entitlements::read_newapi_entitlement_credentials()?;
    let paths = control_paths(app)?;
    prepare_control_paths(&paths)?;
    let binaries = resolve_binaries(app, true).await;
    if binaries.bridge.is_none() || binaries.weclaw.is_none() {
        return Ok(status_from_parts(
            WeChatBridgePhase::NotReady,
            &paths,
            &binaries,
            false,
            false,
            &crate::web_service::daemon_bootstrap::get_local_daemon_status(state).await,
            None,
        )
        .await);
    }

    let daemon_status =
        crate::web_service::daemon_bootstrap::start_local_daemon_for_remote(state, app).await?;
    let token = crate::web_service::daemon_bootstrap::ensure_local_daemon_token(state).await?;
    let daemon_host = daemon_status.host.clone();
    let (selected_workspace, selected_workspace_path) =
        resolve_workspace_selection(state, workspace_id).await;

    write_weclaw_config(
        &weclaw_config_path()?,
        &paths.data_dir.join("media"),
        selected_workspace_path.as_deref(),
    )?;

    if bridge_health().await {
        terminate_pid_file(&paths.bridge_pid)?;
        sleep(Duration::from_millis(STARTUP_RETRY_INTERVAL_MS)).await;
    }
    spawn_wx_bridge(
        binaries.bridge.as_ref().expect("bridge checked"),
        &paths,
        &daemon_host,
        &token,
        &selected_workspace,
        &entitlement_credentials,
    )?;
    for _ in 0..STARTUP_RETRY_TIMES {
        sleep(Duration::from_millis(STARTUP_RETRY_INTERVAL_MS)).await;
        if bridge_health().await {
            break;
        }
    }

    if !pid_file_running(&paths.weclaw_pid) {
        spawn_weclaw(binaries.weclaw.as_ref().expect("weclaw checked"), &paths)?;
    }

    for _ in 0..10 {
        sleep(Duration::from_millis(STARTUP_RETRY_INTERVAL_MS)).await;
        let snapshot = parse_qr_snapshot(&read_tail_lossy(&paths.weclaw_log).unwrap_or_default());
        if snapshot.qr_text.is_some() || snapshot.login_url.is_some() || bridge_health().await {
            break;
        }
    }

    get_status(state, app, Some(WeChatBridgePhase::Starting)).await
}

async fn stop_wechat_bridge_inner(app: &AppHandle) -> Result<WeChatBridgeStatus, String> {
    let paths = control_paths(app)?;
    let binaries = resolve_binaries(app, false).await;
    if let Some(weclaw) = binaries.weclaw.as_ref() {
        let _ = crate::utils::async_command(weclaw)
            .arg("stop")
            .status()
            .await;
    }
    terminate_pid_file(&paths.weclaw_pid)?;
    terminate_pid_file(&paths.bridge_pid)?;
    let daemon_status = crate::web_service::daemon_bootstrap::DaemonControlStatus {
        running: false,
        host: String::new(),
        last_error: None,
    };
    Ok(status_from_parts(
        WeChatBridgePhase::Stopped,
        &paths,
        &binaries,
        false,
        false,
        &daemon_status,
        None,
    )
    .await)
}

async fn reset_wechat_bridge_login_inner(
    state: &AppState,
    app: &AppHandle,
    workspace_id: Option<String>,
) -> Result<WeChatBridgeStatus, String> {
    crate::newapi_entitlements::require_wechat_bridge_entitlement().await?;
    let paths = control_paths(app)?;
    prepare_control_paths(&paths)?;
    let binaries = resolve_binaries(app, false).await;
    if let Some(weclaw) = binaries.weclaw.as_ref() {
        let _ = crate::utils::async_command(weclaw)
            .arg("stop")
            .status()
            .await;
    }
    terminate_pid_file(&paths.weclaw_pid)?;
    let accounts_dir = weclaw_accounts_dir()
        .ok_or_else(|| "failed to resolve WeClaw accounts directory".to_string())?;
    clear_weclaw_account_state(&accounts_dir)?;
    start_wechat_bridge_inner(state, app, workspace_id).await
}

async fn send_wechat_bridge_verification_prompt_inner(
    state: &AppState,
    app: &AppHandle,
    _workspace_id: Option<String>,
) -> Result<WeChatBridgeStatus, String> {
    crate::newapi_entitlements::require_wechat_bridge_entitlement().await?;
    let accounts_dir = weclaw_accounts_dir()
        .ok_or_else(|| "failed to resolve WeClaw accounts directory".to_string())?;
    let bound_user = find_weclaw_bound_user_id(&accounts_dir)
        .ok_or_else(|| "未找到已绑定的微信账号，请重新绑定微信后再试。".to_string())?;
    let prompt = build_wechat_bridge_verification_prompt(&verification_code());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("failed to create WeChat verification client: {error}"))?;
    let response = client
        .post(format!("http://{WECLAW_API_ADDR}/api/send"))
        .json(&json!({ "to": bound_user, "text": prompt }))
        .send()
        .await
        .map_err(|error| format!("发送微信验证消息失败：{error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "发送微信验证消息失败：HTTP {status} {}",
            redact_sensitive(&body)
        ));
    }
    get_status(state, app, None).await
}

async fn get_status(
    state: &AppState,
    app: &AppHandle,
    starting_hint: Option<WeChatBridgePhase>,
) -> Result<WeChatBridgeStatus, String> {
    let paths = control_paths(app)?;
    let binaries = resolve_binaries(app, false).await;
    let daemon_status = crate::web_service::daemon_bootstrap::get_local_daemon_status(state).await;
    let bridge_running = bridge_health().await || pid_file_running(&paths.bridge_pid);
    let weclaw_running = pid_file_running(&paths.weclaw_pid);
    Ok(status_from_parts(
        starting_hint.unwrap_or(WeChatBridgePhase::Stopped),
        &paths,
        &binaries,
        bridge_running,
        weclaw_running,
        &daemon_status,
        None,
    )
    .await)
}

async fn status_from_parts(
    default_phase: WeChatBridgePhase,
    paths: &ControlPaths,
    binaries: &BinaryAvailability,
    bridge_running: bool,
    weclaw_running: bool,
    daemon_status: &crate::web_service::daemon_bootstrap::DaemonControlStatus,
    last_error: Option<String>,
) -> WeChatBridgeStatus {
    let log = read_tail_lossy(&paths.weclaw_log).unwrap_or_default();
    let qr = parse_qr_snapshot(&log);
    let activity_snapshot =
        parse_activity_snapshot(&read_tail_lossy(&paths.audit_log).unwrap_or_default());
    let bound_account = weclaw_accounts_dir()
        .as_deref()
        .and_then(find_weclaw_bound_account);
    let wechat_bound = bound_account.is_some();
    let weclaw_sync_age_secs = if weclaw_running {
        weclaw_accounts_dir()
            .as_deref()
            .and_then(latest_weclaw_sync_age_secs)
    } else {
        None
    };
    let missing_component = binaries.bridge.is_none() || binaries.weclaw.is_none();
    let phase = phase_from_status(
        missing_component,
        daemon_status.running,
        bridge_running,
        weclaw_running,
        qr.qr_text.is_some() || qr.login_url.is_some(),
        last_error.as_deref(),
        default_phase,
    );
    WeChatBridgeStatus {
        phase,
        bridge_running,
        weclaw_running,
        daemon_running: daemon_status.running,
        bridge_available: binaries.bridge.is_some(),
        weclaw_available: binaries.weclaw.is_some(),
        daemon_host: daemon_status.host.clone(),
        bridge_endpoint: BRIDGE_CHAT_ENDPOINT.to_string(),
        qr_text: qr.qr_text,
        login_url: qr.login_url,
        log_path: Some(paths.weclaw_log.to_string_lossy().to_string()),
        last_error: last_error.map(|value| redact_sensitive(&value)),
        last_activity: activity_snapshot.last_activity,
        last_media_activity: parse_latest_media_activity(&log),
        last_quote_activity: parse_latest_quote_activity(&log),
        has_local_smoke_activity: activity_snapshot.has_local_smoke_activity,
        wechat_bound,
        bound_wechat_user_id: bound_account
            .as_ref()
            .map(|account| account.user_id.clone()),
        bound_wechat_bot_id: bound_account.and_then(|account| account.bot_id),
        weclaw_sync_fresh: weclaw_sync_fresh(weclaw_sync_age_secs),
        weclaw_sync_age_secs,
    }
}

fn phase_from_status(
    missing_component: bool,
    daemon_running: bool,
    bridge_running: bool,
    weclaw_running: bool,
    has_qr: bool,
    last_error: Option<&str>,
    default_phase: WeChatBridgePhase,
) -> WeChatBridgePhase {
    if last_error.is_some() {
        return WeChatBridgePhase::Error;
    }
    if missing_component {
        return WeChatBridgePhase::NotReady;
    }
    if bridge_running && weclaw_running {
        return if has_qr {
            WeChatBridgePhase::WaitingScan
        } else {
            WeChatBridgePhase::Running
        };
    }
    if daemon_running || bridge_running || weclaw_running {
        return default_phase;
    }
    WeChatBridgePhase::Stopped
}

fn diagnostics_from_status(
    status: WeChatBridgeStatus,
    bridge_probe: Result<(), String>,
) -> WeChatBridgeDiagnostics {
    let components_ok = status.bridge_available && status.weclaw_available;
    let has_scan_signal = status.qr_text.is_some() || status.login_url.is_some();
    let bridge_state = if status.bridge_running && bridge_probe.is_ok() {
        WeChatBridgeDiagnosticState::Pass
    } else {
        WeChatBridgeDiagnosticState::Fail
    };
    let checks = vec![
        WeChatBridgeDiagnosticCheck {
            key: "component".to_string(),
            state: if components_ok {
                WeChatBridgeDiagnosticState::Pass
            } else {
                WeChatBridgeDiagnosticState::Fail
            },
            detail: missing_component_detail(&status),
        },
        WeChatBridgeDiagnosticCheck {
            key: "daemon".to_string(),
            state: if status.daemon_running {
                WeChatBridgeDiagnosticState::Pass
            } else {
                WeChatBridgeDiagnosticState::Fail
            },
            detail: Some(status.daemon_host.clone()),
        },
        WeChatBridgeDiagnosticCheck {
            key: "bridge".to_string(),
            state: bridge_state,
            detail: bridge_probe
                .err()
                .or_else(|| Some(status.bridge_endpoint.clone())),
        },
        WeChatBridgeDiagnosticCheck {
            key: "weclaw".to_string(),
            state: if status.weclaw_running {
                WeChatBridgeDiagnosticState::Pass
            } else if status.weclaw_available {
                WeChatBridgeDiagnosticState::Warn
            } else {
                WeChatBridgeDiagnosticState::Fail
            },
            detail: status.log_path.clone(),
        },
        WeChatBridgeDiagnosticCheck {
            key: "weclawSync".to_string(),
            state: weclaw_sync_diagnostic_state(&status),
            detail: weclaw_sync_detail(&status),
        },
        WeChatBridgeDiagnosticCheck {
            key: "scan".to_string(),
            state: scan_diagnostic_state(status.phase, has_scan_signal),
            detail: scan_diagnostic_detail(&status),
        },
    ];
    let ok = checks
        .iter()
        .all(|check| check.state != WeChatBridgeDiagnosticState::Fail);
    WeChatBridgeDiagnostics { ok, checks, status }
}

fn missing_component_detail(status: &WeChatBridgeStatus) -> Option<String> {
    let mut missing = Vec::new();
    if !status.bridge_available {
        missing.push("wx_bridge");
    }
    if !status.weclaw_available {
        missing.push("weclaw");
    }
    if missing.is_empty() {
        None
    } else {
        Some(format!("missing {}", missing.join(", ")))
    }
}

fn scan_diagnostic_state(
    phase: WeChatBridgePhase,
    has_scan_signal: bool,
) -> WeChatBridgeDiagnosticState {
    match phase {
        WeChatBridgePhase::Running => WeChatBridgeDiagnosticState::Pass,
        WeChatBridgePhase::WaitingScan if has_scan_signal => WeChatBridgeDiagnosticState::Warn,
        WeChatBridgePhase::Starting if has_scan_signal => WeChatBridgeDiagnosticState::Warn,
        _ => WeChatBridgeDiagnosticState::Fail,
    }
}

fn scan_diagnostic_detail(status: &WeChatBridgeStatus) -> Option<String> {
    if status.wechat_bound {
        return Some("bound account present".to_string());
    }
    status.login_url.clone()
}

fn weclaw_sync_diagnostic_state(status: &WeChatBridgeStatus) -> WeChatBridgeDiagnosticState {
    if !status.weclaw_running {
        return WeChatBridgeDiagnosticState::Warn;
    }
    if status.weclaw_sync_fresh {
        WeChatBridgeDiagnosticState::Pass
    } else {
        WeChatBridgeDiagnosticState::Warn
    }
}

fn weclaw_sync_detail(status: &WeChatBridgeStatus) -> Option<String> {
    if let Some(age) = status.weclaw_sync_age_secs {
        return Some(format!("sync age {age}s"));
    }
    if status.weclaw_running {
        Some("no sync heartbeat yet".to_string())
    } else {
        Some("WeChat component is not running".to_string())
    }
}

fn control_paths(app: &AppHandle) -> Result<ControlPaths, String> {
    let root = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
        .join("wechat-bridge");
    Ok(ControlPaths {
        data_dir: root.join("data"),
        bridge_pid: root.join("wx_bridge.pid"),
        weclaw_pid: root.join("weclaw.pid"),
        bridge_log: root.join("wx_bridge.log"),
        weclaw_log: root.join("weclaw.log"),
        audit_log: root.join("data").join("audit.log"),
        root,
    })
}

fn prepare_control_paths(paths: &ControlPaths) -> Result<(), String> {
    std::fs::create_dir_all(&paths.root)
        .map_err(|error| format!("failed to create WeChat bridge state dir: {error}"))?;
    std::fs::create_dir_all(&paths.data_dir)
        .map_err(|error| format!("failed to create WeChat bridge data dir: {error}"))?;
    Ok(())
}

async fn resolve_binaries(app: &AppHandle, build_bridge_when_missing: bool) -> BinaryAvailability {
    BinaryAvailability {
        bridge: if build_bridge_when_missing {
            resolve_or_build_wx_bridge_binary(app).await.ok()
        } else {
            resolve_wx_bridge_binary(app)
        },
        weclaw: resolve_weclaw_binary(app),
    }
}

async fn resolve_or_build_wx_bridge_binary(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(binary) = resolve_wx_bridge_binary(app) {
        return Ok(binary);
    }
    if cfg!(debug_assertions) {
        if let Some(manifest) = find_dev_manifest_path() {
            let status = crate::utils::async_command("cargo")
                .arg("build")
                .arg("--manifest-path")
                .arg(manifest)
                .arg("--bin")
                .arg("wx_bridge")
                .status()
                .await
                .map_err(|error| format!("failed to build wx_bridge: {error}"))?;
            if status.success() {
                if let Some(binary) = resolve_wx_bridge_binary(app) {
                    return Ok(binary);
                }
            }
        }
    }
    Err("wx_bridge binary not found".to_string())
}

fn resolve_wx_bridge_binary(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            append_binary_candidates(parent, "wx_bridge", &mut candidates);
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        append_binary_candidates(&resource_dir, "wx_bridge", &mut candidates);
    }
    if let Some(path) = find_in_path(binary_name("wx_bridge")) {
        candidates.push(path);
    }
    first_existing_file(candidates)
}

fn resolve_weclaw_binary(app: &AppHandle) -> Option<PathBuf> {
    let current_exe_parent = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_dir = app.path().resource_dir().ok();
    let env_bin = env::var("WECLAW_BIN").ok().map(PathBuf::from);
    let home_bin =
        dirs::home_dir().map(|home| home.join(".local").join("bin").join(binary_name("weclaw")));
    let path_bin = find_in_path(binary_name("weclaw"));
    first_existing_file(weclaw_binary_candidates(
        current_exe_parent.as_deref(),
        resource_dir.as_deref(),
        env_bin.as_deref(),
        home_bin.as_deref(),
        path_bin.as_deref(),
    ))
}

fn weclaw_binary_candidates(
    current_exe_parent: Option<&Path>,
    resource_dir: Option<&Path>,
    env_bin: Option<&Path>,
    home_bin: Option<&Path>,
    path_bin: Option<&Path>,
) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(parent) = current_exe_parent {
        append_binary_candidates(parent, "weclaw", &mut candidates);
    }
    if let Some(resource_dir) = resource_dir {
        append_binary_candidates(resource_dir, "weclaw", &mut candidates);
    }
    for candidate in [env_bin, home_bin, path_bin].into_iter().flatten() {
        candidates.push(candidate.to_path_buf());
    }
    candidates
}

fn append_binary_candidates(base: &Path, stem: &str, output: &mut Vec<PathBuf>) {
    output.push(base.join(binary_name(stem)));
}

fn binary_name(stem: &str) -> &str {
    match stem {
        "wx_bridge" if cfg!(windows) => "wx_bridge.exe",
        "weclaw" if cfg!(windows) => "weclaw.exe",
        "wx_bridge" => "wx_bridge",
        "weclaw" => "weclaw",
        _ => stem,
    }
}

fn first_existing_file(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    let mut seen = HashSet::new();
    for candidate in candidates {
        let key = candidate.to_string_lossy().to_string();
        if seen.insert(key) && candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    which::which(binary).ok()
}

fn find_dev_manifest_path() -> Option<PathBuf> {
    let mut candidates = vec![PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml")];
    if let Ok(cwd) = env::current_dir() {
        for ancestor in cwd.ancestors() {
            candidates.push(ancestor.join("Cargo.toml"));
            candidates.push(ancestor.join("src-tauri").join("Cargo.toml"));
        }
    }
    first_existing_file(candidates)
}

async fn resolve_workspace_selection(
    state: &AppState,
    requested: Option<String>,
) -> (String, Option<PathBuf>) {
    let requested = requested
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let workspaces = state.workspaces.lock().await;
    let id = if let Some(id) = requested {
        if workspaces.contains_key(&id) {
            id
        } else {
            workspaces
                .keys()
                .next()
                .cloned()
                .unwrap_or_else(|| "default".to_string())
        }
    } else {
        workspaces
            .keys()
            .next()
            .cloned()
            .unwrap_or_else(|| "default".to_string())
    };
    let path = workspaces.get(&id).and_then(|entry| {
        let trimmed = entry.path.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    });
    (id, path)
}

fn weclaw_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "failed to resolve home directory".to_string())?;
    Ok(home.join(".weclaw").join("config.json"))
}

fn weclaw_accounts_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".weclaw").join("accounts"))
}

fn latest_weclaw_sync_age_secs(accounts_dir: &Path) -> Option<u64> {
    let modified = latest_weclaw_sync_modified(accounts_dir)?;
    SystemTime::now()
        .duration_since(modified)
        .ok()
        .map(|age| age.as_secs())
}

fn latest_weclaw_sync_modified(accounts_dir: &Path) -> Option<SystemTime> {
    std::fs::read_dir(accounts_dir)
        .ok()?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let file_name = path.file_name()?.to_string_lossy();
            if !file_name.ends_with(".sync.json") {
                return None;
            }
            entry.metadata().ok()?.modified().ok()
        })
        .max()
}

fn clear_weclaw_account_state(accounts_dir: &Path) -> Result<(), String> {
    if !accounts_dir.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(accounts_dir)
        .map_err(|error| format!("failed to read WeClaw accounts dir: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("failed to read WeClaw account entry: {error}"))?;
        let path = entry.path();
        if path
            .extension()
            .is_some_and(|extension| extension == "json")
        {
            std::fs::remove_file(&path).map_err(|error| {
                format!(
                    "failed to remove WeClaw account state {}: {error}",
                    path.display()
                )
            })?;
        }
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
struct WeClawCredentialSnapshot {
    ilink_user_id: Option<String>,
    ilink_bot_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BoundWeChatAccount {
    user_id: String,
    bot_id: Option<String>,
}

fn find_weclaw_bound_account(accounts_dir: &Path) -> Option<BoundWeChatAccount> {
    let mut entries = std::fs::read_dir(accounts_dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| !name.ends_with(".sync.json"))
        })
        .collect::<Vec<_>>();
    entries.sort();
    entries.into_iter().find_map(|path| {
        read_json_file::<WeClawCredentialSnapshot>(&path)
            .ok()
            .flatten()
            .and_then(|credentials| {
                let user_id = credentials.ilink_user_id?.trim().to_string();
                if user_id.is_empty() {
                    return None;
                }
                let bot_id = credentials
                    .ilink_bot_id
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty());
                Some(BoundWeChatAccount { user_id, bot_id })
            })
    })
}

fn find_weclaw_bound_user_id(accounts_dir: &Path) -> Option<String> {
    find_weclaw_bound_account(accounts_dir).map(|account| account.user_id)
}

fn verification_code() -> String {
    uuid::Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(6)
        .collect::<String>()
        .to_ascii_uppercase()
}

fn build_wechat_bridge_verification_prompt(code: &str) -> String {
    format!(
        "LawyerCopilot 微信连接验证\n\
         请回复这条消息：连接测试 {code}\n\
         然后再发送一张图片，并引用本消息追问一句，用于完成文字、图片和引用消息验收。"
    )
}

fn weclaw_sync_fresh(age_secs: Option<u64>) -> bool {
    age_secs.is_some_and(|age| age <= WECLAW_SYNC_FRESH_SECS)
}

fn write_weclaw_config(
    path: &Path,
    save_dir: &Path,
    workspace_dir: Option<&Path>,
) -> Result<(), String> {
    let mut root = read_json_file::<Value>(path)?.unwrap_or_else(|| json!({}));
    merge_weclaw_agent_config(&mut root, save_dir, workspace_dir);
    write_json_file(path, &root)
}

fn merge_weclaw_agent_config(root: &mut Value, save_dir: &Path, workspace_dir: Option<&Path>) {
    if !root.is_object() {
        *root = json!({});
    }
    let object = root.as_object_mut().expect("root object ensured");
    object.insert(
        "default_agent".to_string(),
        Value::String(WECLAW_AGENT_NAME.to_string()),
    );
    object.insert(
        "save_dir".to_string(),
        Value::String(save_dir.to_string_lossy().to_string()),
    );
    let agents = object
        .entry("agents".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !agents.is_object() {
        *agents = Value::Object(Map::new());
    }
    let mut agent_config = json!({
        "type": "http",
        "endpoint": BRIDGE_CHAT_ENDPOINT,
        "model": "claude",
        "max_history": 20,
        "aliases": ["lc", "law"]
    });
    if let Some(workspace_dir) = workspace_dir {
        agent_config["cwd"] = Value::String(workspace_dir.to_string_lossy().to_string());
    }

    agents
        .as_object_mut()
        .expect("agents object ensured")
        .insert(WECLAW_AGENT_NAME.to_string(), agent_config);
}

fn spawn_wx_bridge(
    binary: &Path,
    paths: &ControlPaths,
    daemon_host: &str,
    token: &str,
    workspace_id: &str,
    entitlement_credentials: &(String, String),
) -> Result<(), String> {
    let stdout = append_log_file(&paths.bridge_log)?;
    let stderr = append_log_file(&paths.bridge_log)?;
    let mut command = crate::utils::std_command(binary);
    command
        .arg("--daemon-host")
        .arg(daemon_host)
        .arg("--token")
        .arg(token)
        .arg("--listen")
        .arg(BRIDGE_LISTEN)
        .arg("--default-workspace")
        .arg(workspace_id)
        .arg("--data-dir")
        .arg(&paths.data_dir)
        .arg("--min-reply-interval-ms")
        .arg(MIN_REPLY_INTERVAL_MS.to_string())
        .arg("--max-replies-per-minute")
        .arg(MAX_REPLIES_PER_MINUTE.to_string())
        .env("NEWAPI_BASE_URL", &entitlement_credentials.0)
        .env("NEWAPI_AUTH_TOKEN", &entitlement_credentials.1)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    let child = command
        .spawn()
        .map_err(|error| format!("failed to start wx_bridge: {error}"))?;
    write_pid_file(&paths.bridge_pid, child.id())
}

fn spawn_weclaw(binary: &Path, paths: &ControlPaths) -> Result<(), String> {
    let stdout = append_log_file(&paths.weclaw_log)?;
    let stderr = append_log_file(&paths.weclaw_log)?;
    let mut command = crate::utils::std_command(binary);
    command
        .arg("start")
        .arg("--foreground")
        .arg("--api-addr")
        .arg(WECLAW_API_ADDR)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    let child = command
        .spawn()
        .map_err(|error| format!("failed to start WeClaw: {error}"))?;
    write_pid_file(&paths.weclaw_pid, child.id())
}

fn append_log_file(path: &Path) -> Result<File, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open log {}: {error}", path.display()))
}

fn write_pid_file(path: &Path, pid: u32) -> Result<(), String> {
    crate::storage::write_string_atomically(path, &pid.to_string())
}

fn read_pid_file(path: &Path) -> Option<u32> {
    let raw = std::fs::read_to_string(path).ok()?;
    raw.trim().parse::<u32>().ok()
}

fn pid_file_running(path: &Path) -> bool {
    read_pid_file(path).is_some_and(is_pid_running)
}

fn terminate_pid_file(path: &Path) -> Result<(), String> {
    let Some(pid) = read_pid_file(path) else {
        return Ok(());
    };
    if is_pid_running(pid) {
        terminate_pid(pid)?;
    }
    let _ = std::fs::remove_file(path);
    Ok(())
}

#[cfg(unix)]
fn is_pid_running(pid: u32) -> bool {
    let pid_text = pid.to_string();
    if let Ok(output) = std::process::Command::new("ps")
        .args(["-o", "stat=", "-p", &pid_text])
        .output()
    {
        return output.status.success()
            && unix_process_stat_is_running(&String::from_utf8_lossy(&output.stdout));
    }
    std::process::Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(unix)]
fn unix_process_stat_is_running(stat: &str) -> bool {
    let stat = stat.trim();
    !stat.is_empty() && !stat.starts_with('Z')
}

#[cfg(windows)]
fn is_pid_running(pid: u32) -> bool {
    let output = crate::utils::std_command("tasklist")
        .arg("/FI")
        .arg(format!("PID eq {pid}"))
        .arg("/FO")
        .arg("CSV")
        .arg("/NH")
        .output();
    output
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}

#[cfg(not(any(unix, windows)))]
fn is_pid_running(_pid: u32) -> bool {
    false
}

#[cfg(unix)]
fn terminate_pid(pid: u32) -> Result<(), String> {
    let status = std::process::Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .status()
        .map_err(|error| format!("failed to terminate pid {pid}: {error}"))?;
    if !status.success() {
        let _ = std::process::Command::new("kill")
            .arg("-KILL")
            .arg(pid.to_string())
            .status();
    }
    Ok(())
}

#[cfg(windows)]
fn terminate_pid(pid: u32) -> Result<(), String> {
    let status = crate::utils::std_command("taskkill")
        .arg("/PID")
        .arg(pid.to_string())
        .arg("/T")
        .arg("/F")
        .status()
        .map_err(|error| format!("failed to terminate pid {pid}: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("taskkill failed for pid {pid}"))
    }
}

#[cfg(not(any(unix, windows)))]
fn terminate_pid(_pid: u32) -> Result<(), String> {
    Ok(())
}

async fn bridge_health() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };
    client
        .get(format!("{BRIDGE_BASE_URL}/healthz"))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

async fn probe_bridge_chat() -> Result<(), String> {
    if !bridge_health().await {
        return Err("message bridge health check failed".to_string());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|error| format!("failed to create probe client: {error}"))?;
    let response = client
        .post(BRIDGE_CHAT_ENDPOINT)
        .header("content-type", "application/json")
        .header("x-weclaw-user", "diagnostics")
        .header(
            "x-weclaw-msg-id",
            format!("diagnostic-{}", uuid::Uuid::new_v4()),
        )
        .body(
            json!({
                "model": "claude",
                "user": "diagnostics",
                "messages": [{ "role": "user", "content": "连接自检" }]
            })
            .to_string(),
        )
        .send()
        .await
        .map_err(|error| format!("message bridge probe failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "message bridge probe returned HTTP {}",
            response.status()
        ));
    }
    let text = response
        .text()
        .await
        .map_err(|error| format!("failed to read probe response: {error}"))?;
    let body: Value = serde_json::from_str(&text)
        .map_err(|error| format!("failed to parse probe response: {error}"))?;
    let content = body
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    if content.trim().is_empty() {
        return Err("message bridge probe returned empty content".to_string());
    }
    Ok(())
}

fn read_tail_lossy(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    let file = File::open(path).map_err(|error| format!("failed to read log: {error}"))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("failed to inspect log: {error}"))?;
    let offset = metadata.len().saturating_sub(LOG_READ_LIMIT);
    let mut reader = std::io::BufReader::new(file);
    use std::io::{Read, Seek, SeekFrom};
    reader
        .seek(SeekFrom::Start(offset))
        .map_err(|error| format!("failed to seek log: {error}"))?;
    let mut buf = Vec::new();
    reader
        .read_to_end(&mut buf)
        .map_err(|error| format!("failed to read log: {error}"))?;
    Ok(String::from_utf8_lossy(&buf).to_string())
}

fn parse_qr_snapshot(log: &str) -> QrSnapshot {
    if scan_prompt_expired(log) {
        return QrSnapshot {
            qr_text: None,
            login_url: None,
        };
    }
    let login_url = log
        .lines()
        .rev()
        .find_map(|line| extract_login_url(line).map(str::to_string));
    let qr_text = extract_terminal_qr(log);
    QrSnapshot { qr_text, login_url }
}

fn scan_prompt_expired(log: &str) -> bool {
    let mut latest_scan_marker = None;
    let mut latest_expired_marker = None;
    for (index, line) in log.lines().enumerate() {
        if line_has_scan_marker(line) {
            latest_scan_marker = Some(index);
        }
        if line_has_expired_marker(line) {
            latest_expired_marker = Some(index);
        }
    }
    matches!(
        (latest_scan_marker, latest_expired_marker),
        (Some(scan_index), Some(expired_index)) if expired_index > scan_index
    )
}

fn line_has_scan_marker(line: &str) -> bool {
    extract_login_url(line).is_some()
        || line.contains("Waiting for scan")
        || line.contains("Scan this QR code")
        || line.contains("二维码")
        || line.contains("请扫码")
        || line.contains('█')
        || line.contains('▀')
        || line.contains('▄')
}

fn line_has_expired_marker(line: &str) -> bool {
    line.contains("QR code expired")
        || line.contains("login failed: QR code expired")
        || line.contains("二维码已过期")
}

fn extract_login_url(line: &str) -> Option<&str> {
    let lower = line.to_ascii_lowercase();
    let has_login_marker = lower.contains("qr url")
        || lower.contains("qrcode")
        || lower.contains("qr code")
        || lower.contains("login")
        || lower.contains("scan ")
        || lower.contains("scan:")
        || lower.contains("scan this")
        || line.contains("扫码")
        || line.contains("二维码");
    if !has_login_marker {
        return None;
    }
    extract_url(line)
}

fn extract_url(line: &str) -> Option<&str> {
    line.split_whitespace().find(|part| {
        part.starts_with("http://")
            || part.starts_with("https://")
            || part.starts_with("data:image/")
    })
}

fn extract_terminal_qr(log: &str) -> Option<String> {
    let lines = log.lines().collect::<Vec<_>>();
    let qr_lines = lines
        .iter()
        .rev()
        .take(80)
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty()
                && (trimmed.contains('█')
                    || trimmed.contains('▀')
                    || trimmed.contains('▄')
                    || trimmed.contains("QR")
                    || trimmed.contains("二维码"))
        })
        .copied()
        .collect::<Vec<_>>();
    if qr_lines.is_empty() {
        return None;
    }
    let mut restored = qr_lines;
    restored.reverse();
    Some(restored.join("\n"))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WeChatBridgeActivitySnapshot {
    last_activity: Option<WeChatBridgeActivity>,
    has_local_smoke_activity: bool,
}

#[cfg(test)]
fn parse_latest_activity(log: &str) -> Option<WeChatBridgeActivity> {
    parse_activity_snapshot(log).last_activity
}

fn parse_activity_snapshot(log: &str) -> WeChatBridgeActivitySnapshot {
    let mut has_local_smoke_activity = false;
    let mut last_activity = None;
    for line in log.lines().rev() {
        match parse_activity_line(line) {
            ActivityLine::Real(activity) if last_activity.is_none() => {
                last_activity = Some(activity);
            }
            ActivityLine::Smoke => {
                has_local_smoke_activity = true;
            }
            ActivityLine::Ignored | ActivityLine::Real(_) => {}
        }
        if last_activity.is_some() && has_local_smoke_activity {
            break;
        }
    }
    WeChatBridgeActivitySnapshot {
        last_activity,
        has_local_smoke_activity,
    }
}

enum ActivityLine {
    Real(WeChatBridgeActivity),
    Smoke,
    Ignored,
}

fn parse_activity_line(line: &str) -> ActivityLine {
    let mut ts_secs = None;
    let mut wxid = None;
    let mut workspace = None;
    let mut decision = None;
    for part in line.split_whitespace() {
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };
        match key {
            "ts" => ts_secs = value.parse::<i64>().ok(),
            "wxid" => wxid = Some(value.to_string()),
            "workspace" => workspace = Some(value.to_string()),
            "decision" => decision = Some(value.to_string()),
            _ => {}
        }
    }
    let Some(wxid) = wxid else {
        return ActivityLine::Ignored;
    };
    if is_synthetic_wechat_wxid(&wxid) {
        return ActivityLine::Smoke;
    }
    let Some(ts_secs) = ts_secs else {
        return ActivityLine::Ignored;
    };
    let Some(workspace) = workspace else {
        return ActivityLine::Ignored;
    };
    let Some(decision) = decision else {
        return ActivityLine::Ignored;
    };
    ActivityLine::Real(WeChatBridgeActivity {
        ts_secs,
        wxid,
        workspace,
        decision,
    })
}

fn is_synthetic_wechat_wxid(wxid: &str) -> bool {
    wxid == "local-wechat"
        || wxid == "smoke-user"
        || wxid == "real-smoke-user"
        || wxid.starts_with("local-")
        || wxid.starts_with("wxid_probe")
        || wxid.starts_with("codex-live-dir-probe")
        || wxid.contains("_probe")
        || wxid.contains("-probe")
}

fn parse_latest_media_activity(log: &str) -> Option<WeChatBridgeMediaActivity> {
    let mut last_received_image_wxid: Option<String> = None;
    let mut latest = None;
    for line in current_weclaw_run_log(log).lines() {
        if let Some(wxid) = parse_received_image_wxid(line) {
            last_received_image_wxid = Some(wxid.clone());
            continue;
        }
        if let Some(activity) =
            parse_saved_image_activity(line, last_received_image_wxid.as_deref())
        {
            latest = Some(activity);
            continue;
        }
        if let Some(activity) = parse_failed_image_activity(line) {
            latest = Some(activity);
            continue;
        }
        if let Some(activity) = parse_unsupported_media_activity(line) {
            latest = Some(activity);
            continue;
        }
        if let Some(activity) = parse_skipped_media_activity(line) {
            latest = Some(activity);
        }
    }
    latest
}

fn parse_latest_quote_activity(log: &str) -> Option<WeChatBridgeQuoteActivity> {
    let mut latest = None;
    for line in current_weclaw_run_log(log).lines() {
        if let Some(activity) = parse_quote_activity(line) {
            latest = Some(activity);
        }
    }
    latest
}

fn current_weclaw_run_log(log: &str) -> &str {
    ["Starting message bridge", "Image save directory:"]
        .iter()
        .filter_map(|marker| log.rfind(marker))
        .max()
        .map(|index| &log[index..])
        .unwrap_or(log)
}

fn parse_received_image_wxid(line: &str) -> Option<String> {
    let wxid = between(line, "received image from ", ", saving to ")?;
    Some(wxid.to_string())
}

fn parse_saved_image_activity(
    line: &str,
    last_received_image_wxid: Option<&str>,
) -> Option<WeChatBridgeMediaActivity> {
    let path_and_size = after(line, "saved image to ")?;
    let (path, size_text) = path_and_size.rsplit_once(" (")?;
    let bytes = size_text.strip_suffix(" bytes)")?.parse::<u64>().ok();
    Some(WeChatBridgeMediaActivity {
        ts: log_ts(line),
        wxid: last_received_image_wxid
            .unwrap_or("unknown-wechat-user")
            .to_string(),
        kind: WeChatBridgeMediaKind::Image,
        status: WeChatBridgeMediaStatus::Saved,
        path: Some(path.to_string()),
        bytes,
        detail: None,
    })
}

fn parse_failed_image_activity(line: &str) -> Option<WeChatBridgeMediaActivity> {
    let rest = after(line, "failed to save image from ")
        .or_else(|| after(line, "failed to prepare inbound image from "))?;
    let (wxid, detail) = rest.split_once(": ")?;
    Some(WeChatBridgeMediaActivity {
        ts: log_ts(line),
        wxid: wxid.to_string(),
        kind: WeChatBridgeMediaKind::Image,
        status: WeChatBridgeMediaStatus::Failed,
        path: None,
        bytes: None,
        detail: Some(redact_sensitive(detail)),
    })
}

fn parse_skipped_media_activity(line: &str) -> Option<WeChatBridgeMediaActivity> {
    let wxid = between(line, "received non-text message from ", ", skipping")?;
    Some(WeChatBridgeMediaActivity {
        ts: log_ts(line),
        wxid: wxid.to_string(),
        kind: WeChatBridgeMediaKind::Image,
        status: WeChatBridgeMediaStatus::Skipped,
        path: None,
        bytes: None,
        detail: None,
    })
}

fn parse_unsupported_media_activity(line: &str) -> Option<WeChatBridgeMediaActivity> {
    let rest = after(line, "unsupported non-text message from ")?;
    let (wxid, detail) = rest.split_once(": ")?;
    Some(WeChatBridgeMediaActivity {
        ts: log_ts(line),
        wxid: wxid.to_string(),
        kind: WeChatBridgeMediaKind::Image,
        status: WeChatBridgeMediaStatus::Unsupported,
        path: None,
        bytes: None,
        detail: Some(redact_sensitive(detail)),
    })
}

fn parse_quote_activity(line: &str) -> Option<WeChatBridgeQuoteActivity> {
    if let Some(wxid) = after(line, "received quoted message from ") {
        return Some(WeChatBridgeQuoteActivity {
            ts: log_ts(line),
            wxid: wxid.to_string(),
            status: WeChatBridgeQuoteStatus::Parsed,
            detail: None,
        });
    }
    if let Some(rest) = after(line, "unparsed quote candidate from ") {
        let (wxid, detail) = rest.split_once(": ")?;
        return Some(WeChatBridgeQuoteActivity {
            ts: log_ts(line),
            wxid: wxid.to_string(),
            status: WeChatBridgeQuoteStatus::Unparsed,
            detail: Some(redact_sensitive(detail)),
        });
    }
    if let Some(rest) = after(line, "message shape from ") {
        let (wxid, detail) = rest.split_once(": ")?;
        return Some(WeChatBridgeQuoteActivity {
            ts: log_ts(line),
            wxid: wxid.to_string(),
            status: WeChatBridgeQuoteStatus::MessageShape,
            detail: Some(redact_sensitive(detail)),
        });
    }
    None
}

fn log_ts(line: &str) -> String {
    line.get(0..19).unwrap_or_default().trim().to_string()
}

fn between<'a>(value: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let rest = after(value, start)?;
    rest.split_once(end).map(|(found, _)| found)
}

fn after<'a>(value: &'a str, marker: &str) -> Option<&'a str> {
    let index = value.find(marker)?;
    Some(&value[index + marker.len()..])
}

fn redact_sensitive(value: &str) -> String {
    let mut output = value.to_string();
    for marker in [
        "Bearer ",
        "token=",
        "token:",
        "api_key=",
        "apiKey=",
        "OPENAI_API_KEY=",
    ] {
        output = redact_marker(&output, marker);
    }
    output
}

fn redact_marker(value: &str, marker: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut cursor = 0;
    while let Some(relative_index) = value[cursor..].find(marker) {
        let marker_start = cursor + relative_index;
        let secret_start = marker_start + marker.len();
        let secret_end = value[secret_start..]
            .find(|c: char| c.is_whitespace() || c == ',' || c == '"' || c == '\'')
            .map(|offset| secret_start + offset)
            .unwrap_or(value.len());
        output.push_str(&value[cursor..secret_start]);
        output.push_str("[REDACTED]");
        cursor = secret_end;
    }
    output.push_str(&value[cursor..]);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_weclaw_agent_config_preserves_unrelated_agents() {
        let mut value = json!({
            "default_agent": "old",
            "agents": {
                "other": { "type": "noop", "endpoint": "http://example.test" }
            },
            "extra": true
        });

        merge_weclaw_agent_config(&mut value, Path::new("/tmp/wechat-bridge-media"), None);

        assert_eq!(value["default_agent"], WECLAW_AGENT_NAME);
        assert_eq!(value["extra"], true);
        assert_eq!(value["save_dir"], "/tmp/wechat-bridge-media");
        assert_eq!(value["agents"]["other"]["endpoint"], "http://example.test");
        assert_eq!(
            value["agents"][WECLAW_AGENT_NAME]["endpoint"],
            BRIDGE_CHAT_ENDPOINT
        );
        assert_eq!(value["agents"][WECLAW_AGENT_NAME]["type"], "http");
        let agent_config = value["agents"][WECLAW_AGENT_NAME].as_object().unwrap();
        assert!(
            !agent_config.contains_key("headers"),
            "patched WeClaw sets x-weclaw-user dynamically per WeChat conversation"
        );
    }

    #[test]
    fn merge_weclaw_agent_config_recovers_from_non_object_root() {
        let mut value = json!("bad");
        merge_weclaw_agent_config(&mut value, Path::new("/tmp/wechat-bridge-media"), None);

        assert_eq!(
            value["agents"][WECLAW_AGENT_NAME]["endpoint"],
            BRIDGE_CHAT_ENDPOINT
        );
        assert_eq!(value["save_dir"], "/tmp/wechat-bridge-media");
    }

    #[test]
    fn merge_weclaw_agent_config_sets_workspace_cwd() {
        let mut value = json!({});
        merge_weclaw_agent_config(
            &mut value,
            Path::new("/tmp/wechat-bridge-media"),
            Some(Path::new("/tmp/lawyer-copilot-workspace")),
        );

        assert_eq!(
            value["agents"][WECLAW_AGENT_NAME]["cwd"],
            "/tmp/lawyer-copilot-workspace"
        );
    }

    #[test]
    fn parse_qr_snapshot_extracts_latest_login_url() {
        let snapshot = parse_qr_snapshot(
            "noise\nlogin: https://example.test/old\nscan https://example.test/new\n",
        );

        assert_eq!(
            snapshot.login_url.as_deref(),
            Some("https://example.test/new")
        );
    }

    #[test]
    fn parse_qr_snapshot_ignores_non_login_attachment_urls() {
        let snapshot = parse_qr_snapshot(
            "2026/06/24 16:31:00 已发送附件：\n\
             http://127.0.0.1:58024/wechat-file-smoke-2.txt\n\
             2026/06/24 16:31:01 message bridge running\n",
        );

        assert_eq!(snapshot.login_url, None);
        assert_eq!(snapshot.qr_text, None);
    }

    #[test]
    fn parse_qr_snapshot_extracts_terminal_qr_block() {
        let snapshot = parse_qr_snapshot("请扫码\n████\n█  █\n████\n");

        assert!(snapshot.qr_text.expect("qr text").contains("████"));
    }

    #[test]
    fn parse_qr_snapshot_ignores_expired_scan_prompt() {
        let snapshot = parse_qr_snapshot(
            "QR URL: https://example.test/login\nWaiting for scan...\nQR code expired.\nlogin failed: QR code expired\n",
        );

        assert_eq!(snapshot.login_url, None);
        assert_eq!(snapshot.qr_text, None);
    }

    #[cfg(unix)]
    #[test]
    fn unix_process_stat_treats_zombie_as_stopped() {
        assert!(!unix_process_stat_is_running("Z"));
        assert!(!unix_process_stat_is_running("Z+"));
        assert!(unix_process_stat_is_running("S"));
    }

    #[test]
    fn phase_from_status_reports_not_ready_when_component_missing() {
        assert_eq!(
            phase_from_status(
                true,
                false,
                false,
                false,
                false,
                None,
                WeChatBridgePhase::Stopped
            ),
            WeChatBridgePhase::NotReady
        );
    }

    #[test]
    fn phase_from_status_reports_waiting_scan_when_qr_is_present() {
        assert_eq!(
            phase_from_status(
                false,
                true,
                true,
                true,
                true,
                None,
                WeChatBridgePhase::Starting
            ),
            WeChatBridgePhase::WaitingScan
        );
    }

    #[test]
    fn phase_from_status_reports_running_without_qr() {
        assert_eq!(
            phase_from_status(
                false,
                true,
                true,
                true,
                false,
                None,
                WeChatBridgePhase::Starting
            ),
            WeChatBridgePhase::Running
        );
    }

    #[test]
    fn terminate_missing_pid_file_is_idempotent() {
        let path = std::env::temp_dir().join(format!("missing-{}.pid", uuid::Uuid::new_v4()));

        terminate_pid_file(&path).expect("missing pid file is ok");
    }

    #[test]
    fn weclaw_candidates_prefer_bundled_sidecar() {
        let bundled_dir = PathBuf::from("/app/Contents/MacOS");
        let path_dir = PathBuf::from("/usr/local/bin");
        let path_bin = path_dir.join(binary_name("weclaw"));

        let candidates =
            weclaw_binary_candidates(Some(&bundled_dir), None, None, None, Some(&path_bin));

        assert_eq!(candidates[0], bundled_dir.join(binary_name("weclaw")));
    }

    #[test]
    fn redact_sensitive_hides_tokens() {
        let redacted = redact_sensitive("token=sk-secret Bearer abc.def api_key=xyz");

        assert!(!redacted.contains("sk-secret"));
        assert!(!redacted.contains("abc.def"));
        assert!(!redacted.contains("xyz"));
        assert!(redacted.contains("[REDACTED]"));
    }

    #[test]
    fn parse_latest_activity_uses_last_audit_line_without_body() {
        let activity = parse_latest_activity(
            "ts=1718000000 wxid=wx-a method=engine_send_message_sync workspace=ws-1 decision=allow body=abc\n\
             ts=1718000001 wxid=wx-b method=engine_send_message_sync workspace=ws-2 decision=error body=secret-body-hash\n",
        )
        .expect("activity");

        assert_eq!(activity.ts_secs, 1718000001);
        assert_eq!(activity.decision, "error");
        assert_eq!(activity.workspace, "ws-2");
        assert_eq!(activity.wxid, "wx-b");
    }

    #[test]
    fn parse_latest_activity_skips_local_smoke_entries() {
        let activity = parse_latest_activity(
            "ts=1718000000 wxid=local-wechat method=engine_send_message_sync workspace=ws-1 decision=allow body=abc\n\
             ts=1718000001 wxid=local-boundary-smoke method=engine_send_message_sync workspace=ws-1 decision=allow body=def\n\
             ts=1718000002 wxid=local-rate-smoke method=engine_send_message_sync workspace=ws-1 decision=deny body=ghi\n\
             ts=1718000003 wxid=wx-real@im.wechat method=engine_send_message_sync workspace=ws-1 decision=allow body=jkl\n",
        )
        .expect("activity");

        assert_eq!(activity.ts_secs, 1718000003);
        assert_eq!(activity.wxid, "wx-real@im.wechat");
        assert_eq!(activity.decision, "allow");
    }

    #[test]
    fn parse_activity_snapshot_treats_local_fallback_and_probes_as_synthetic() {
        let snapshot = parse_activity_snapshot(
            "ts=1718000000 wxid=local-wechat method=engine_send_message_sync workspace=ws-1 decision=allow body=abc\n\
             ts=1718000001 wxid=local-rich-final method=engine_send_message_sync workspace=ws-1 decision=allow body=def\n\
             ts=1718000002 wxid=wxid_probe_final method=engine_send_message_sync workspace=ws-1 decision=allow body=ghi\n\
             ts=1718000003 wxid=codex-live-dir-probe-1782252234632 method=engine_send_message_sync workspace=ws-1 decision=allow body=jkl\n\
             ts=1718000004 wxid=real-smoke-user method=engine_send_message_sync workspace=ws-1 decision=allow body=mno\n\
             ts=1718000005 wxid=smoke-user method=engine_send_message_sync workspace=ws-1 decision=allow body=pqr\n\
             ts=1718000006 wxid=wxid_final_real_image_probe method=engine_send_message_sync workspace=ws-1 decision=allow body=stu\n",
        );

        assert_eq!(snapshot.last_activity, None);
        assert!(snapshot.has_local_smoke_activity);
    }

    #[test]
    fn parse_activity_snapshot_reports_smoke_only_logs() {
        let snapshot = parse_activity_snapshot(
            "ts=1718000001 wxid=local-boundary-smoke method=engine_send_message_sync workspace=ws-1 decision=allow body=def\n\
             ts=1718000002 wxid=local-rate-smoke method=engine_send_message_sync workspace=ws-1 decision=deny body=ghi\n",
        );

        assert_eq!(snapshot.last_activity, None);
        assert!(snapshot.has_local_smoke_activity);
    }

    #[test]
    fn parse_media_activity_reports_saved_failed_and_legacy_skipped_images() {
        let saved = parse_latest_media_activity(
            "2026/06/24 01:15:01 [handler] received image from wxid-a@im.wechat, saving to /tmp/media\n\
             2026/06/24 01:15:02 [handler] saved image to /tmp/media/a.jpg (2048 bytes)\n",
        )
        .expect("saved media activity");

        assert_eq!(saved.kind, WeChatBridgeMediaKind::Image);
        assert_eq!(saved.status, WeChatBridgeMediaStatus::Saved);
        assert_eq!(saved.wxid, "wxid-a@im.wechat");
        assert_eq!(saved.path.as_deref(), Some("/tmp/media/a.jpg"));
        assert_eq!(saved.bytes, Some(2048));

        let failed = parse_latest_media_activity(
            "2026/06/24 01:16:02 [handler] failed to save image from wxid-b@im.wechat: image has no URL or CDN media info\n",
        )
        .expect("failed media activity");
        assert_eq!(failed.status, WeChatBridgeMediaStatus::Failed);
        assert_eq!(failed.wxid, "wxid-b@im.wechat");

        let failed_prepare = parse_latest_media_activity(
            "2026/06/24 01:16:02 [handler] failed to prepare inbound image from wxid-b@im.wechat: image has no URL or CDN media info\n",
        )
        .expect("failed prepare media activity");
        assert_eq!(failed_prepare.status, WeChatBridgeMediaStatus::Failed);
        assert_eq!(failed_prepare.wxid, "wxid-b@im.wechat");

        let skipped = parse_latest_media_activity(
            "2026/06/24 01:17:03 [handler] received non-text message from wxid-c@im.wechat, skipping\n",
        )
        .expect("legacy skipped media activity");
        assert_eq!(skipped.status, WeChatBridgeMediaStatus::Skipped);
        assert_eq!(skipped.wxid, "wxid-c@im.wechat");

        let unsupported = parse_latest_media_activity(
            "2026/06/24 01:18:03 [handler] unsupported non-text message from wxid-d@im.wechat: items=[type=2 keys=mysteryImagePayload,type]\n",
        )
        .expect("unsupported media activity");
        assert_eq!(unsupported.status, WeChatBridgeMediaStatus::Unsupported);
        assert_eq!(unsupported.wxid, "wxid-d@im.wechat");
        assert_eq!(
            unsupported.detail.as_deref(),
            Some("items=[type=2 keys=mysteryImagePayload,type]")
        );
    }

    #[test]
    fn parse_media_activity_ignores_previous_weclaw_runs() {
        let activity = parse_latest_media_activity(
            "2026/06/24 00:10:00 [handler] received non-text message from wxid-old@im.wechat, skipping\n\
             2026/06/24 01:14:00 Image save directory: /tmp/media\n\
             2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n",
        );

        assert_eq!(activity, None);
    }

    #[test]
    fn parse_quote_activity_reports_latest_real_quote_without_body() {
        let activity = parse_latest_quote_activity(
            "2026/06/24 01:14:00 Image save directory: /tmp/media\n\
             2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n\
             2026/06/24 01:15:02 [handler] received quoted message from wxid-a@im.wechat\n",
        )
        .expect("quote activity");

        assert_eq!(activity.ts, "2026/06/24 01:15:02");
        assert_eq!(activity.wxid, "wxid-a@im.wechat");
        assert_eq!(activity.status, WeChatBridgeQuoteStatus::Parsed);
        assert_eq!(activity.detail, None);
    }

    #[test]
    fn parse_quote_activity_reports_unparsed_and_shape_diagnostics_without_body() {
        let unparsed = parse_latest_quote_activity(
            "2026/06/24 01:14:00 Image save directory: /tmp/media\n\
             2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n\
             2026/06/24 01:15:02 [handler] unparsed quote candidate from wxid-a@im.wechat: item[0].quotePayload keys=unknownText\n",
        )
        .expect("unparsed quote activity");

        assert_eq!(unparsed.status, WeChatBridgeQuoteStatus::Unparsed);
        assert_eq!(
            unparsed.detail.as_deref(),
            Some("item[0].quotePayload keys=unknownText")
        );

        let shape = parse_latest_quote_activity(
            "2026/06/24 01:14:00 Image save directory: /tmp/media\n\
             2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n\
             2026/06/24 01:15:03 [handler] message shape from wxid-a@im.wechat: item[0] keys=mysteryContext,textItem,type\n",
        )
        .expect("message shape quote activity");

        assert_eq!(shape.status, WeChatBridgeQuoteStatus::MessageShape);
        assert_eq!(
            shape.detail.as_deref(),
            Some("item[0] keys=mysteryContext,textItem,type")
        );
    }

    #[test]
    fn parse_quote_activity_ignores_previous_weclaw_runs() {
        let activity = parse_latest_quote_activity(
            "2026/06/24 00:10:00 [handler] received quoted message from wxid-old@im.wechat\n\
             2026/06/24 01:14:00 Image save directory: /tmp/media\n\
             2026/06/24 01:14:01 Starting message bridge for 1 account(s)...\n",
        );

        assert_eq!(activity, None);
    }

    #[test]
    fn latest_weclaw_sync_age_uses_newest_sync_file_mtime_only() {
        let root = std::env::temp_dir().join(format!("weclaw-sync-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("create sync dir");
        std::fs::write(root.join("old.sync.json"), "{}").expect("write old sync");
        std::fs::write(root.join("fresh.sync.json"), "{}").expect("write fresh sync");
        std::fs::write(root.join("account.json"), "{}").expect("write credential file");

        let age = latest_weclaw_sync_age_secs(&root).expect("sync age");

        assert!(age <= 5);
        assert!(weclaw_sync_fresh(Some(age)));

        let credentials_only =
            std::env::temp_dir().join(format!("weclaw-credentials-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&credentials_only).expect("create credential dir");
        std::fs::write(
            credentials_only.join("account.json"),
            "{\"token\":\"secret\"}",
        )
        .expect("write credential file");
        assert_eq!(latest_weclaw_sync_age_secs(&credentials_only), None);
        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&credentials_only);
    }

    #[test]
    fn clear_weclaw_account_state_removes_credentials_and_sync_without_touching_config() {
        let root = std::env::temp_dir().join(format!("weclaw-rebind-{}", uuid::Uuid::new_v4()));
        let accounts = root.join("accounts");
        std::fs::create_dir_all(&accounts).expect("create accounts dir");
        std::fs::write(
            root.join("config.json"),
            "{\"default_agent\":\"lawyer-copilot\"}",
        )
        .expect("write config");
        std::fs::write(accounts.join("bot.json"), "{\"bot_token\":\"secret\"}")
            .expect("write credential");
        std::fs::write(
            accounts.join("bot.sync.json"),
            "{\"get_updates_buf\":\"opaque\"}",
        )
        .expect("write sync");
        std::fs::write(accounts.join("notes.txt"), "keep").expect("write unrelated file");

        clear_weclaw_account_state(&accounts).expect("clear account state");

        assert!(root.join("config.json").exists());
        assert!(!accounts.join("bot.json").exists());
        assert!(!accounts.join("bot.sync.json").exists());
        assert!(accounts.join("notes.txt").exists());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn find_weclaw_bound_user_id_prefers_credentials_without_sync_files() {
        let root = std::env::temp_dir().join(format!("weclaw-bound-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("create accounts dir");
        std::fs::write(
            root.join("bot.sync.json"),
            "{\"get_updates_buf\":\"opaque\"}",
        )
        .expect("write sync");
        std::fs::write(
            root.join("bot.json"),
            "{\"bot_token\":\"secret\",\"ilink_user_id\":\"wx-user@im.wechat\"}",
        )
        .expect("write credential");

        let user_id = find_weclaw_bound_user_id(&root).expect("bound user id");

        assert_eq!(user_id, "wx-user@im.wechat");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn build_wechat_bridge_verification_prompt_has_code_without_local_paths() {
        let body = build_wechat_bridge_verification_prompt("AB12CD");

        assert!(body.contains("AB12CD"));
        assert!(body.contains("回复这条消息"));
        assert!(!body.contains("/Users/"));
        assert!(!body.contains("127.0.0.1"));
    }

    #[test]
    fn diagnostics_fail_when_running_bridge_chat_probe_fails() {
        let status = WeChatBridgeStatus {
            phase: WeChatBridgePhase::Running,
            bridge_running: true,
            weclaw_running: true,
            daemon_running: true,
            bridge_available: true,
            weclaw_available: true,
            daemon_host: "127.0.0.1:47329".to_string(),
            bridge_endpoint: BRIDGE_CHAT_ENDPOINT.to_string(),
            qr_text: None,
            login_url: None,
            log_path: None,
            last_error: None,
            last_activity: None,
            last_media_activity: None,
            last_quote_activity: None,
            has_local_smoke_activity: false,
            wechat_bound: false,
            bound_wechat_user_id: None,
            bound_wechat_bot_id: None,
            weclaw_sync_fresh: true,
            weclaw_sync_age_secs: Some(12),
        };

        let diagnostics = diagnostics_from_status(status, Err("probe failed".to_string()));

        assert!(!diagnostics.ok);
        assert_eq!(
            diagnostics
                .checks
                .iter()
                .find(|check| check.key == "bridge")
                .expect("bridge check")
                .state,
            WeChatBridgeDiagnosticState::Fail
        );
    }

    #[test]
    fn diagnostics_reports_fresh_weclaw_sync_without_reading_message_content() {
        let status = WeChatBridgeStatus {
            phase: WeChatBridgePhase::Running,
            bridge_running: true,
            weclaw_running: true,
            daemon_running: true,
            bridge_available: true,
            weclaw_available: true,
            daemon_host: "127.0.0.1:47329".to_string(),
            bridge_endpoint: BRIDGE_CHAT_ENDPOINT.to_string(),
            qr_text: None,
            login_url: None,
            log_path: None,
            last_error: None,
            last_activity: None,
            last_media_activity: None,
            last_quote_activity: None,
            has_local_smoke_activity: false,
            wechat_bound: false,
            bound_wechat_user_id: None,
            bound_wechat_bot_id: None,
            weclaw_sync_fresh: true,
            weclaw_sync_age_secs: Some(12),
        };

        let diagnostics = diagnostics_from_status(status, Ok(()));

        let check = diagnostics
            .checks
            .iter()
            .find(|check| check.key == "weclawSync")
            .expect("weclaw sync check");
        assert_eq!(check.state, WeChatBridgeDiagnosticState::Pass);
        assert_eq!(check.detail.as_deref(), Some("sync age 12s"));
    }

    #[test]
    fn diagnostics_reports_bound_wechat_without_exposing_identifier() {
        let status = WeChatBridgeStatus {
            phase: WeChatBridgePhase::Running,
            bridge_running: true,
            weclaw_running: true,
            daemon_running: true,
            bridge_available: true,
            weclaw_available: true,
            daemon_host: "127.0.0.1:47329".to_string(),
            bridge_endpoint: BRIDGE_CHAT_ENDPOINT.to_string(),
            qr_text: None,
            login_url: None,
            log_path: None,
            last_error: None,
            last_activity: None,
            last_media_activity: None,
            last_quote_activity: None,
            has_local_smoke_activity: false,
            wechat_bound: true,
            bound_wechat_user_id: Some("wx-user@im.wechat".to_string()),
            bound_wechat_bot_id: Some("bot@im.bot".to_string()),
            weclaw_sync_fresh: true,
            weclaw_sync_age_secs: Some(12),
        };

        let diagnostics = diagnostics_from_status(status, Ok(()));

        let check = diagnostics
            .checks
            .iter()
            .find(|check| check.key == "scan")
            .expect("scan check");
        assert_eq!(check.state, WeChatBridgeDiagnosticState::Pass);
        assert_eq!(check.detail.as_deref(), Some("bound account present"));
        assert!(!serde_json::to_string(&diagnostics)
            .expect("diagnostics json")
            .contains("wxid"));
    }

    #[test]
    fn keep_online_restore_is_disabled_by_default() {
        let settings = crate::types::AppSettings::default();
        let status = keep_online_status(WeChatBridgePhase::Stopped, false, false);

        assert!(!should_restore_wechat_bridge_keep_online(
            &settings, &status
        ));
    }

    #[test]
    fn keep_online_restore_starts_when_enabled_and_stopped() {
        let mut settings = crate::types::AppSettings::default();
        settings.wechat_bridge_keep_online = true;
        let status = keep_online_status(WeChatBridgePhase::Stopped, false, false);

        assert!(should_restore_wechat_bridge_keep_online(&settings, &status));
    }

    #[test]
    fn keep_online_restore_skips_when_already_running() {
        let mut settings = crate::types::AppSettings::default();
        settings.wechat_bridge_keep_online = true;
        let status = keep_online_status(WeChatBridgePhase::Running, true, true);

        assert!(!should_restore_wechat_bridge_keep_online(
            &settings, &status
        ));
    }

    fn keep_online_status(
        phase: WeChatBridgePhase,
        bridge_running: bool,
        weclaw_running: bool,
    ) -> WeChatBridgeStatus {
        WeChatBridgeStatus {
            phase,
            bridge_running,
            weclaw_running,
            daemon_running: bridge_running,
            bridge_available: true,
            weclaw_available: true,
            daemon_host: "127.0.0.1:47329".to_string(),
            bridge_endpoint: BRIDGE_CHAT_ENDPOINT.to_string(),
            qr_text: None,
            login_url: None,
            log_path: None,
            last_error: None,
            last_activity: None,
            last_media_activity: None,
            last_quote_activity: None,
            has_local_smoke_activity: false,
            wechat_bound: bridge_running && weclaw_running,
            bound_wechat_user_id: None,
            bound_wechat_bot_id: None,
            weclaw_sync_fresh: bridge_running && weclaw_running,
            weclaw_sync_age_secs: None,
        }
    }
}
