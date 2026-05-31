mod platform;
mod types;

use std::{
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{
    AppHandle, Emitter, Manager, State, WebviewUrl,
    webview::{NewWindowResponse, WebviewBuilder},
};

use crate::state::AppState;

pub(crate) use types::*;

const BROWSER_WEBVIEW_EVENT: &str = "browser-agent://webview-event";
const BROWSER_RENDERER_WEBVIEW_LABEL: &str = "browser-agent-webview-main";

static BROWSER_RENDERER_SESSION_ID: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn browser_renderer_session_binding() -> &'static Mutex<Option<String>> {
    BROWSER_RENDERER_SESSION_ID.get_or_init(|| Mutex::new(None))
}

fn bind_browser_renderer_session(browser_session_id: &str) {
    if let Ok(mut binding) = browser_renderer_session_binding().lock() {
        *binding = Some(browser_session_id.to_string());
    }
}

fn clear_browser_renderer_session(browser_session_id: &str) {
    if let Ok(mut binding) = browser_renderer_session_binding().lock() {
        if binding.as_deref() == Some(browser_session_id) {
            *binding = None;
        }
    }
}

fn current_browser_renderer_session(fallback_session_id: &str) -> String {
    browser_renderer_session_binding()
        .lock()
        .ok()
        .and_then(|binding| binding.clone())
        .unwrap_or_else(|| fallback_session_id.to_string())
}

fn settings_from_app_settings(settings: &crate::types::AppSettings) -> BrowserAgentSettings {
    BrowserAgentSettings {
        enabled: settings.browser_agent_enabled,
        prefer_for_ai_browser_operations: settings.browser_agent_prefer_built_in,
        allow_external_provider_fallback: settings.browser_agent_allow_external_provider_fallback,
        ..BrowserAgentSettings::default()
    }
}

async fn current_settings(state: &State<'_, AppState>) -> BrowserAgentSettings {
    let settings = state.app_settings.lock().await;
    settings_from_app_settings(&settings)
}

fn default_route_decision(
    requested_capability: &str,
    settings: &BrowserAgentSettings,
    user_override: bool,
    platform_capability: &BrowserPlatformCapability,
) -> BrowserProviderRouteDecision {
    if !settings.enabled {
        return BrowserProviderRouteDecision {
            requested_capability: requested_capability.to_string(),
            selected_provider: "browser_skill".to_string(),
            reason: "Browser Agent is disabled in settings.".to_string(),
            user_override,
            fallback_used: settings.allow_external_provider_fallback,
            fallback_reason: Some("browser_agent_disabled".to_string()),
        };
    }

    if user_override {
        return BrowserProviderRouteDecision {
            requested_capability: requested_capability.to_string(),
            selected_provider: "browser_skill".to_string(),
            reason: "User explicitly opted out of the built-in Browser Agent.".to_string(),
            user_override,
            fallback_used: true,
            fallback_reason: Some("user_override".to_string()),
        };
    }

    if !settings.prefer_for_ai_browser_operations {
        return BrowserProviderRouteDecision {
            requested_capability: requested_capability.to_string(),
            selected_provider: "browser_skill".to_string(),
            reason: "Browser Agent is enabled but not preferred for AI browser operations."
                .to_string(),
            user_override,
            fallback_used: settings.allow_external_provider_fallback,
            fallback_reason: Some("browser_agent_not_preferred".to_string()),
        };
    }

    let capability_state = match requested_capability {
        "read_snapshot" => &platform_capability.snapshot_capture,
        "navigate" | "reload" | "scroll" => &platform_capability.navigation_actions,
        "click" | "type" => &platform_capability.element_actions,
        "submit" | "full_agent_task" => &platform_capability.form_submit_actions,
        _ => &BrowserCapabilityState::Unsupported,
    };
    if *capability_state == BrowserCapabilityState::Unsupported {
        return BrowserProviderRouteDecision {
            requested_capability: requested_capability.to_string(),
            selected_provider: "browser_skill".to_string(),
            reason: "Browser Agent platform capability is unsupported for this operation."
                .to_string(),
            user_override,
            fallback_used: settings.allow_external_provider_fallback,
            fallback_reason: Some("platform_unsupported".to_string()),
        };
    }

    let phase_blocked = match requested_capability {
        "read_snapshot" => !settings.allow_read_only_snapshots,
        "navigate" | "reload" | "scroll" => !settings.allow_navigation_actions,
        "click" | "type" => !settings.allow_element_actions,
        "submit" | "full_agent_task" => !settings.allow_form_submit_actions,
        _ => true,
    };
    if phase_blocked {
        return BrowserProviderRouteDecision {
            requested_capability: requested_capability.to_string(),
            selected_provider: "browser_skill".to_string(),
            reason: "Browser Agent feature phase blocks this operation.".to_string(),
            user_override,
            fallback_used: settings.allow_external_provider_fallback,
            fallback_reason: Some("phase_blocked".to_string()),
        };
    }

    BrowserProviderRouteDecision {
        requested_capability: requested_capability.to_string(),
        selected_provider: "built_in_browser_agent".to_string(),
        reason: "Browser Agent is enabled and preferred for AI browser operations.".to_string(),
        user_override,
        fallback_used: false,
        fallback_reason: None,
    }
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn browser_diagnostic(
    diagnostic_id: &str,
    kind: &str,
    severity: &str,
    message: &str,
) -> BrowserDiagnostic {
    BrowserDiagnostic {
        diagnostic_id: diagnostic_id.to_string(),
        kind: kind.to_string(),
        severity: severity.to_string(),
        message: message.to_string(),
        source: Some("browser_agent".to_string()),
        redacted: true,
    }
}

fn blocked_url(raw_url: &str, blocked_reason: &str, message: &str) -> BrowserUrlValidationResult {
    BrowserUrlValidationResult {
        raw_url: raw_url.to_string(),
        normalized_url: None,
        allowed: false,
        blocked_reason: Some(blocked_reason.to_string()),
        diagnostic: Some(browser_diagnostic(
            "browser-url-blocked",
            "security_warning",
            "warning",
            message,
        )),
    }
}

fn origin_from_normalized_url(normalized_url: &str) -> Option<String> {
    let (scheme, rest) = normalized_url.split_once("://")?;
    let authority = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .trim();
    if authority.is_empty() {
        return None;
    }
    Some(format!("{scheme}://{authority}"))
}

fn host_from_normalized_url(normalized_url: &str) -> Option<String> {
    let (_, rest) = normalized_url.split_once("://")?;
    let authority = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .trim();
    let host_port = authority.rsplit('@').next().unwrap_or(authority);
    let host = if host_port.starts_with('[') {
        host_port
            .trim_start_matches('[')
            .split(']')
            .next()
            .unwrap_or_default()
    } else {
        host_port.split(':').next().unwrap_or_default()
    };
    let normalized = host.trim().trim_end_matches('.').to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    Some(normalized)
}

fn is_blocked_local_host(host: &str) -> bool {
    host == "localhost"
        || host == "::1"
        || host.starts_with("127.")
        || host == "0.0.0.0"
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("172.16.")
        || host.starts_with("172.17.")
        || host.starts_with("172.18.")
        || host.starts_with("172.19.")
        || host.starts_with("172.20.")
        || host.starts_with("172.21.")
        || host.starts_with("172.22.")
        || host.starts_with("172.23.")
        || host.starts_with("172.24.")
        || host.starts_with("172.25.")
        || host.starts_with("172.26.")
        || host.starts_with("172.27.")
        || host.starts_with("172.28.")
        || host.starts_with("172.29.")
        || host.starts_with("172.30.")
        || host.starts_with("172.31.")
}

fn is_cleanup_candidate(session: &BrowserSession, now: u64, max_closed_age_ms: u64) -> bool {
    let terminal = matches!(
        session.status,
        BrowserSessionStatus::Closed
            | BrowserSessionStatus::Failed
            | BrowserSessionStatus::Unsupported
    );
    terminal && now.saturating_sub(session.updated_at) > max_closed_age_ms
}

fn browser_evidence_id(snapshot_id: &str) -> String {
    format!("browser-evidence-{snapshot_id}")
}

fn snapshot_summary(snapshot: &BrowserContextSnapshot) -> String {
    let title = snapshot
        .source
        .title
        .as_deref()
        .unwrap_or(snapshot.source.normalized_url.as_str());
    let text = snapshot.page.visible_text.replace('\n', " ");
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.is_empty() {
        return title.to_string();
    }
    let excerpt = compact.chars().take(360).collect::<String>();
    format!("{title}\n{excerpt}")
}

async fn persist_snapshot_evidence(
    state: &State<'_, AppState>,
    snapshot: &BrowserContextSnapshot,
) -> BrowserContextSnapshotEvidence {
    let settings = current_settings(state).await;
    let retention_ms =
        u64::from(settings.evidence_retention_days).saturating_mul(24 * 60 * 60 * 1000);
    let evidence_id = browser_evidence_id(snapshot.snapshot_id.as_str());
    let record = BrowserEvidenceRecord {
        evidence_id: evidence_id.clone(),
        browser_session_id: snapshot.browser_session_id.clone(),
        snapshot_id: snapshot.snapshot_id.clone(),
        workspace_id: snapshot.workspace_id.clone(),
        url: snapshot.source.normalized_url.clone(),
        title: snapshot.source.title.clone(),
        captured_at: snapshot.captured_at,
        expires_at: snapshot.captured_at.saturating_add(retention_ms),
        state: "available".to_string(),
        summary: snapshot_summary(snapshot),
        privacy: snapshot.privacy.clone(),
    };
    state.browser_evidence.lock().await.insert(evidence_id.clone(), record);
    BrowserContextSnapshotEvidence {
        screenshot_ref: None,
        html_excerpt_ref: Some(evidence_id),
    }
}

fn browser_webview_label(browser_session_id: &str) -> String {
    let _ = browser_session_id;
    BROWSER_RENDERER_WEBVIEW_LABEL.to_string()
}

fn valid_webview_bounds(bounds: &BrowserWebviewBounds) -> bool {
    bounds.x.is_finite()
        && bounds.y.is_finite()
        && bounds.width.is_finite()
        && bounds.height.is_finite()
        && bounds.width >= 40.0
        && bounds.height >= 40.0
}

fn emit_browser_webview_event(app: &AppHandle, event: BrowserWebviewEvent) {
    let _ = app.emit(BROWSER_WEBVIEW_EVENT, event);
}

fn resolve_browser_parent_window(
    app: &AppHandle,
) -> Result<tauri::WebviewWindow<tauri::Wry>, String> {
    let windows = app.webview_windows();
    let labels = windows
        .keys()
        .map(|label| label.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    if let Some(window) = windows
        .values()
        .find(|window| {
            window.label() != "about"
                && !window.label().starts_with("browser-agent-webview-")
                && window.is_focused().unwrap_or(false)
        })
        .cloned()
    {
        return Ok(window);
    }
    if let Some(window) = app.get_webview_window("main") {
        return Ok(window);
    }
    if let Some(window) = windows.into_values().find(|window| {
        window.label() != "about" && !window.label().starts_with("browser-agent-webview-")
    }) {
        return Ok(window);
    }
    if labels.is_empty() {
        return Err(
            "Main window not found for Browser Agent WebView. No webview windows are registered."
                .to_string(),
        );
    }
    Err(format!(
        "Main window not found for Browser Agent WebView. Registered windows: {labels}"
    ))
}

fn spawn_browser_webview_session_patch(
    app: AppHandle,
    browser_session_id: String,
    status: Option<BrowserSessionStatus>,
    url: Option<String>,
    title: Option<String>,
    error_code: Option<String>,
    diagnostic_message: Option<String>,
) {
    tauri::async_runtime::spawn(async move {
        let now = unix_time_ms();
        let label = browser_webview_label(browser_session_id.as_str());
        let event = {
            let state = app.state::<AppState>();
            let mut sessions = state.browser_sessions.lock().await;
            let Some(session) = sessions.get_mut(browser_session_id.as_str()) else {
                return;
            };

            if let Some(next_url) = url.as_ref() {
                session.url = next_url.clone();
                session.normalized_url = next_url.clone();
                session.origin = origin_from_normalized_url(next_url.as_str());
            }
            if let Some(next_title) = title.as_ref() {
                session.title = if next_title.trim().is_empty() {
                    None
                } else {
                    Some(next_title.clone())
                };
            }
            if let Some(next_status) = status.as_ref() {
                session.status = next_status.clone();
            }
            if error_code.is_some() {
                session.error_code = error_code.clone();
            }
            if diagnostic_message.is_some() {
                session.diagnostic_message = diagnostic_message.clone();
            }
            session.updated_at = now;
            session.last_activated_at = now;

            BrowserWebviewEvent {
                browser_session_id: browser_session_id.clone(),
                label,
                url,
                title,
                status: session.status.clone(),
                occurred_at: now,
                error_code,
                diagnostic_message,
            }
        };
        emit_browser_webview_event(&app, event);
    });
}

fn create_browser_child_webview(
    app: &AppHandle,
    session: &BrowserSession,
    bounds: &BrowserWebviewBounds,
) -> Result<(), String> {
    if !valid_webview_bounds(bounds) {
        return Err("Browser Agent WebView bounds are too small.".to_string());
    }

    let label = browser_webview_label(session.browser_session_id.as_str());
    let url = session
        .normalized_url
        .parse()
        .map_err(|error| format!("Invalid Browser Agent URL: {error}"))?;
    bind_browser_renderer_session(session.browser_session_id.as_str());

    if let Some(webview) = app.get_webview(label.as_str()) {
        webview
            .set_position(tauri::LogicalPosition::new(bounds.x, bounds.y))
            .map_err(|error| error.to_string())?;
        webview
            .set_size(tauri::LogicalSize::new(bounds.width, bounds.height))
            .map_err(|error| error.to_string())?;
        webview.navigate(url).map_err(|error| error.to_string())?;
        webview.show().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let window = resolve_browser_parent_window(app)?;
    let session_id_for_navigation = session.browser_session_id.clone();
    let session_id_for_load = session.browser_session_id.clone();
    let session_id_for_title = session.browser_session_id.clone();
    let app_for_navigation = app.clone();
    let app_for_load = app.clone();
    let app_for_title = app.clone();

    let webview_builder = WebviewBuilder::new(label, WebviewUrl::External(url))
        .on_navigation(move |target_url| {
            let validation = validate_browser_url(target_url.as_str());
            if validation.allowed {
                return true;
            }
            spawn_browser_webview_session_patch(
                app_for_navigation.clone(),
                current_browser_renderer_session(session_id_for_navigation.as_str()),
                Some(BrowserSessionStatus::Blocked),
                Some(target_url.to_string()),
                None,
                validation.blocked_reason,
                validation.diagnostic.map(|diagnostic| diagnostic.message),
            );
            false
        })
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_page_load(move |_, payload| {
            let status = match payload.event() {
                tauri::webview::PageLoadEvent::Started => BrowserSessionStatus::Loading,
                tauri::webview::PageLoadEvent::Finished => BrowserSessionStatus::Ready,
            };
            spawn_browser_webview_session_patch(
                app_for_load.clone(),
                current_browser_renderer_session(session_id_for_load.as_str()),
                Some(status),
                Some(payload.url().to_string()),
                None,
                None,
                None,
            );
        })
        .on_document_title_changed(move |_, title| {
            spawn_browser_webview_session_patch(
                app_for_title.clone(),
                current_browser_renderer_session(session_id_for_title.as_str()),
                None,
                None,
                Some(title),
                None,
                None,
            );
        });

    let parent_window = window.as_ref().window();
    let webview = parent_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(bounds.x, bounds.y),
            tauri::LogicalSize::new(bounds.width, bounds.height),
        )
        .map_err(|error| error.to_string())?;
    let _ = webview.set_auto_resize(false);
    Ok(())
}

fn validate_browser_url(raw_url: &str) -> BrowserUrlValidationResult {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return blocked_url(raw_url, "empty_url", "Browser Agent URL cannot be empty.");
    }

    let lower = trimmed.to_ascii_lowercase();
    let scheme = match lower.split_once("://") {
        Some((scheme, _)) => scheme,
        None => {
            return blocked_url(
                raw_url,
                "missing_scheme",
                "Browser Agent URL must include an http:// or https:// scheme.",
            )
        }
    };

    if scheme != "http" && scheme != "https" {
        return blocked_url(
            raw_url,
            "blocked_scheme",
            "Browser Agent MVP only allows http:// and https:// pages.",
        );
    }

    let Some(host) = host_from_normalized_url(trimmed) else {
        return blocked_url(raw_url, "missing_host", "Browser Agent URL must include a host.");
    };
    if is_blocked_local_host(&host) {
        return blocked_url(
            raw_url,
            "blocked_local_host",
            "Browser Agent MVP blocks localhost and private network targets.",
        );
    }

    BrowserUrlValidationResult {
        raw_url: raw_url.to_string(),
        normalized_url: Some(trimmed.to_string()),
        allowed: true,
        blocked_reason: None,
        diagnostic: None,
    }
}

#[tauri::command]
pub(crate) async fn get_browser_agent_settings(
    state: State<'_, AppState>,
) -> Result<BrowserAgentSettings, String> {
    Ok(current_settings(&state).await)
}

#[tauri::command]
pub(crate) async fn get_browser_agent_platform_capability(
) -> Result<BrowserPlatformCapability, String> {
    Ok(platform::current_platform_capability())
}

#[tauri::command]
pub(crate) async fn validate_browser_agent_url(
    url: String,
) -> Result<BrowserUrlValidationResult, String> {
    Ok(validate_browser_url(url.as_str()))
}

#[tauri::command]
pub(crate) async fn create_browser_agent_session(
    request: CreateBrowserSessionRequest,
    state: State<'_, AppState>,
) -> Result<BrowserSession, String> {
    let settings = current_settings(&state).await;
    if !settings.enabled {
        return Err("Browser Agent is disabled in settings.".to_string());
    }

    let validation = validate_browser_url(request.url.as_str());
    let Some(normalized_url) = validation.normalized_url else {
        return Err(validation
            .diagnostic
            .map(|diagnostic| diagnostic.message)
            .unwrap_or_else(|| "Browser Agent URL is blocked.".to_string()));
    };

    let now = unix_time_ms();
    let browser_session_id = format!("browser-session-{}", uuid::Uuid::new_v4());
    let owner_surface = request.owner_surface.trim();
    let label = if owner_surface.is_empty() {
        "Browser Agent".to_string()
    } else {
        format!("Browser Agent · {owner_surface}")
    };
    let session = BrowserSession {
        browser_session_id: browser_session_id.clone(),
        workspace_id: request.workspace_id,
        label,
        url: normalized_url.clone(),
        normalized_url: normalized_url.clone(),
        origin: origin_from_normalized_url(normalized_url.as_str()),
        title: None,
        favicon_ref: None,
        status: BrowserSessionStatus::Loading,
        feature_phase: BrowserAgentFeaturePhase::ReadOnlySnapshot,
        platform_capability: platform::current_platform_capability(),
        linked_thread_id: None,
        linked_task_run_id: None,
        linked_orchestration_task_id: None,
        last_snapshot_id: None,
        last_action_id: None,
        error_code: None,
        diagnostic_message: None,
        created_at: now,
        updated_at: now,
        last_activated_at: now,
        closed_at: None,
    };

    state
        .browser_sessions
        .lock()
        .await
        .insert(browser_session_id, session.clone());
    Ok(session)
}

#[tauri::command]
pub(crate) async fn list_browser_agent_sessions(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<BrowserSession>, String> {
    let sessions = state.browser_sessions.lock().await;
    let mut list = sessions
        .values()
        .filter(|session| {
            workspace_id
                .as_deref()
                .map(|id| session.workspace_id == id)
                .unwrap_or(true)
        })
        .cloned()
        .collect::<Vec<_>>();
    list.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(list)
}

#[tauri::command]
pub(crate) async fn update_browser_agent_session(
    request: UpdateBrowserSessionRequest,
    state: State<'_, AppState>,
) -> Result<BrowserSession, String> {
    let now = unix_time_ms();
    let mut sessions = state.browser_sessions.lock().await;
    let session = sessions
        .get_mut(request.browser_session_id.as_str())
        .ok_or_else(|| format!("Browser session not found: {}", request.browser_session_id))?;

    if let Some(next_url) = request.url {
        let validation = validate_browser_url(next_url.as_str());
        let Some(normalized_url) = validation.normalized_url else {
            return Err(validation
                .diagnostic
                .map(|diagnostic| diagnostic.message)
                .unwrap_or_else(|| "Browser Agent URL is blocked.".to_string()));
        };
        session.url = normalized_url.clone();
        session.normalized_url = normalized_url.clone();
        session.origin = origin_from_normalized_url(normalized_url.as_str());
    }
    if let Some(status) = request.status {
        session.status = status;
    }
    if request.title.is_some() {
        session.title = request.title;
    }
    if request.last_snapshot_id.is_some() {
        session.last_snapshot_id = request.last_snapshot_id;
    }
    if request.last_action_id.is_some() {
        session.last_action_id = request.last_action_id;
    }
    if request.error_code.is_some() {
        session.error_code = request.error_code;
    }
    if request.diagnostic_message.is_some() {
        session.diagnostic_message = request.diagnostic_message;
    }
    session.updated_at = now;
    session.last_activated_at = now;
    Ok(session.clone())
}

#[tauri::command]
pub(crate) async fn close_browser_agent_session(
    browser_session_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BrowserSession, String> {
    let now = unix_time_ms();
    let mut sessions = state.browser_sessions.lock().await;
    let session = sessions
        .get_mut(browser_session_id.as_str())
        .ok_or_else(|| format!("Browser session not found: {browser_session_id}"))?;
    session.status = BrowserSessionStatus::Closed;
    session.updated_at = now;
    session.closed_at = Some(now);
    clear_browser_renderer_session(browser_session_id.as_str());
    Ok(session.clone())
}

#[tauri::command]
pub(crate) async fn cleanup_browser_agent_sessions(
    max_closed_age_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<BrowserSessionCleanupResult, String> {
    let now = unix_time_ms();
    let max_closed_age_ms = max_closed_age_ms.unwrap_or(30 * 60 * 1000);
    let mut sessions = state.browser_sessions.lock().await;
    let removed_session_ids = sessions
        .values()
        .filter(|session| is_cleanup_candidate(session, now, max_closed_age_ms))
        .map(|session| session.browser_session_id.clone())
        .collect::<Vec<_>>();

    for session_id in &removed_session_ids {
        sessions.remove(session_id);
    }

    Ok(BrowserSessionCleanupResult {
        removed_session_ids,
        retained_session_count: sessions.len(),
    })
}

#[tauri::command]
pub(crate) async fn list_browser_agent_evidence(
    workspace_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<BrowserEvidenceRecord>, String> {
    let now = unix_time_ms();
    let evidence = state.browser_evidence.lock().await;
    let mut records = evidence
        .values()
        .filter(|record| {
            workspace_id
                .as_deref()
                .map(|id| record.workspace_id == id)
                .unwrap_or(true)
        })
        .cloned()
        .map(|mut record| {
            if record.expires_at <= now && record.state == "available" {
                record.state = "expired".to_string();
            }
            record
        })
        .collect::<Vec<_>>();
    records.sort_by(|left, right| right.captured_at.cmp(&left.captured_at));
    Ok(records)
}

#[tauri::command]
pub(crate) async fn cleanup_browser_agent_evidence(
    now: Option<u64>,
    state: State<'_, AppState>,
) -> Result<BrowserEvidenceCleanupResult, String> {
    let now = now.unwrap_or_else(unix_time_ms);
    let mut evidence = state.browser_evidence.lock().await;
    let removed_evidence_ids = evidence
        .values()
        .filter(|record| record.expires_at <= now)
        .map(|record| record.evidence_id.clone())
        .collect::<Vec<_>>();
    for evidence_id in &removed_evidence_ids {
        evidence.remove(evidence_id);
    }
    Ok(BrowserEvidenceCleanupResult {
        removed_evidence_ids,
        retained_evidence_count: evidence.len(),
    })
}

#[tauri::command]
pub(crate) async fn mount_browser_agent_webview(
    request: BrowserWebviewMountRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BrowserSession, String> {
    let settings = current_settings(&state).await;
    if !settings.enabled {
        return Err("Browser Agent is disabled in settings.".to_string());
    }

    let capability = platform::current_platform_capability();
    if capability.browser_dock == BrowserCapabilityState::Unsupported {
        return Err(
            capability
                .unsupported_reasons
                .first()
                .cloned()
                .unwrap_or_else(|| "Browser Agent WebView is unsupported on this platform.".to_string()),
        );
    }

    let session = {
        let sessions = state.browser_sessions.lock().await;
        sessions
            .get(request.browser_session_id.as_str())
            .cloned()
            .ok_or_else(|| format!("Browser session not found: {}", request.browser_session_id))?
    };
    if session.status == BrowserSessionStatus::Closed {
        return Err(format!("Browser session is closed: {}", session.browser_session_id));
    }

    create_browser_child_webview(&app, &session, &request.bounds)?;
    spawn_browser_webview_session_patch(
        app,
        session.browser_session_id.clone(),
        Some(BrowserSessionStatus::Loading),
        Some(session.normalized_url.clone()),
        None,
        None,
        None,
    );

    let sessions = state.browser_sessions.lock().await;
    sessions
        .get(session.browser_session_id.as_str())
        .cloned()
        .ok_or_else(|| format!("Browser session not found: {}", session.browser_session_id))
}

#[tauri::command]
pub(crate) async fn sync_browser_agent_webview_bounds(
    browser_session_id: String,
    bounds: BrowserWebviewBounds,
    app: AppHandle,
) -> Result<(), String> {
    let label = browser_webview_label(browser_session_id.as_str());
    let webview = app
        .get_webview(label.as_str())
        .ok_or_else(|| format!("Browser Agent WebView not found: {browser_session_id}"))?;
    if !valid_webview_bounds(&bounds) {
        webview.hide().map_err(|error| error.to_string())?;
        return Ok(());
    }
    webview
        .set_position(tauri::LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|error| error.to_string())?;
    webview
        .set_size(tauri::LogicalSize::new(bounds.width, bounds.height))
        .map_err(|error| error.to_string())?;
    webview.show().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn hide_browser_agent_webview(
    browser_session_id: String,
    app: AppHandle,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(browser_webview_label(browser_session_id.as_str()).as_str()) {
        webview.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn capture_browser_agent_snapshot(
    browser_session_id: String,
    state: State<'_, AppState>,
) -> Result<BrowserContextSnapshot, String> {
    let now = unix_time_ms();
    let session = {
        let sessions = state.browser_sessions.lock().await;
        sessions
            .get(browser_session_id.as_str())
            .cloned()
            .ok_or_else(|| format!("Browser session not found: {browser_session_id}"))?
    };
    if session.status == BrowserSessionStatus::Closed {
        return Err(format!("Browser session is closed: {browser_session_id}"));
    }

    let visible_text = session
        .title
        .as_ref()
        .map(|title| format!("{title}\n{}", session.normalized_url))
        .unwrap_or_else(|| session.normalized_url.clone());

    let mut snapshot = BrowserContextSnapshot {
        snapshot_id: format!("browser-snapshot-{now}"),
        browser_session_id: session.browser_session_id.clone(),
        workspace_id: session.workspace_id.clone(),
        captured_at: now,
        source: BrowserContextSnapshotSource {
            url: session.url.clone(),
            normalized_url: session.normalized_url.clone(),
            title: session.title.clone(),
            origin: session.origin.clone(),
        },
        page: BrowserContextSnapshotPage {
            visible_text,
            text_truncated: false,
            headings: Vec::new(),
            landmarks: Vec::new(),
            links: Vec::new(),
            buttons: Vec::new(),
            forms: Vec::new(),
            selected_text: None,
        },
        diagnostics: BrowserContextSnapshotDiagnostics {
            console: Vec::new(),
            network: None,
            capture_warnings: vec![browser_diagnostic(
                "browser-capture-degraded",
                "capture_warning",
                "warning",
                "Live WebView DOM capture is not wired in this MVP slice; snapshot contains session metadata only.",
            )],
        },
        evidence: BrowserContextSnapshotEvidence {
            screenshot_ref: None,
            html_excerpt_ref: None,
        },
        privacy: BrowserPrivacyReport {
            redaction_applied: false,
            redacted_kinds: Vec::new(),
            omitted_kinds: vec![
                "raw_dom".to_string(),
                "cookies".to_string(),
                "headers".to_string(),
                "scripts".to_string(),
                "styles".to_string(),
                "hidden_nodes".to_string(),
            ],
        },
        budget: BrowserSnapshotBudget {
            char_limit: current_settings(&state).await.default_snapshot_budget_chars as usize,
            visible_text_limit: 8_000,
            element_limit: 120,
            form_field_limit: 80,
            diagnostic_limit: 50,
            token_estimate: None,
        },
        availability: "partial".to_string(),
    };
    snapshot.evidence = persist_snapshot_evidence(&state, &snapshot).await;
    {
        let mut sessions = state.browser_sessions.lock().await;
        if let Some(session) = sessions.get_mut(browser_session_id.as_str()) {
            session.last_snapshot_id = Some(snapshot.snapshot_id.clone());
            session.updated_at = now;
        }
    }
    Ok(snapshot)
}

#[tauri::command]
pub(crate) async fn route_browser_agent_provider(
    requested_capability: String,
    user_override: bool,
    state: State<'_, AppState>,
) -> Result<BrowserProviderRouteDecision, String> {
    let settings = current_settings(&state).await;
    Ok(default_route_decision(
        requested_capability.as_str(),
        &settings,
        user_override,
        &platform::current_platform_capability(),
    ))
}

#[tauri::command]
pub(crate) async fn get_browser_agent_status(
    state: State<'_, AppState>,
) -> Result<BrowserAgentStatus, String> {
    let settings = current_settings(&state).await;
    Ok(BrowserAgentStatus {
        feature_phase: if settings.enabled {
            BrowserAgentFeaturePhase::ReadOnlySnapshot
        } else {
            BrowserAgentFeaturePhase::Disabled
        },
        platform_capability: platform::current_platform_capability(),
        provider_preference: default_route_decision(
            "read_snapshot",
            &settings,
            false,
            &platform::current_platform_capability(),
        ),
        settings,
    })
}

#[tauri::command]
pub(crate) async fn run_browser_agent_action(
    request: BrowserActionRequest,
    state: State<'_, AppState>,
) -> Result<BrowserActionResult, String> {
    let now = unix_time_ms();
    let settings = current_settings(&state).await;
    let action = request.action.clone();
    let is_safe_navigation = matches!(action.as_str(), "navigate" | "reload" | "scroll");
    let is_element_action = matches!(action.as_str(), "click" | "type" | "select" | "submit");
    let feature_allowed = if is_safe_navigation {
        settings.allow_navigation_actions
    } else if action == "submit" {
        settings.allow_form_submit_actions
    } else if is_element_action {
        settings.allow_element_actions
    } else {
        false
    };
    let preview = BrowserActionPreview {
        action: action.clone(),
        target_id: request.target_id.clone(),
        target_description: request.target_id.clone(),
        value_preview: request.value.as_ref().map(|value| {
            if action == "type" || action == "submit" {
                "[redacted-preview]".to_string()
            } else {
                value.chars().take(80).collect::<String>()
            }
        }),
        reason: request.reason.clone(),
        requires_user_confirmation: true,
        blocked_by_default: !feature_allowed,
    };
    let message = if !settings.enabled {
        "Browser Agent is disabled in settings."
    } else if is_safe_navigation {
        "Browser Agent safe navigation actions are preview-only until user confirmation UI is enabled."
    } else if is_element_action {
        "Browser Agent element actions have a disabled preview skeleton and remain blocked by default."
    } else {
        "Browser Agent does not support this action."
    };

    let audit_entry = BrowserActionAuditEntry {
        action_id: format!("browser-action-{now}"),
        browser_session_id: request.browser_session_id,
        requested_at: now,
        completed_at: Some(now),
        action,
        target_description: request.target_id,
        outcome: "blocked".to_string(),
        diagnostic_message: Some(message.to_string()),
        before_snapshot_id: None,
        after_snapshot_id: None,
    };

    Ok(BrowserActionResult {
        outcome: "blocked".to_string(),
        audit_entry,
        preview: Some(preview),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_settings_do_not_select_builtin_provider() {
        let settings = BrowserAgentSettings {
            enabled: false,
            ..BrowserAgentSettings::default()
        };
        let decision = default_route_decision(
            "read_snapshot",
            &settings,
            false,
            &platform::current_platform_capability(),
        );
        assert_eq!(decision.selected_provider, "browser_skill");
        assert!(decision.fallback_used);
        assert_eq!(
            decision.fallback_reason.as_deref(),
            Some("browser_agent_disabled")
        );
    }

    #[test]
    fn enabled_settings_select_builtin_provider() {
        let settings = BrowserAgentSettings {
            enabled: true,
            ..BrowserAgentSettings::default()
        };
        let decision = default_route_decision(
            "read_snapshot",
            &settings,
            false,
            &platform::current_platform_capability(),
        );
        assert_eq!(decision.selected_provider, "built_in_browser_agent");
        assert!(!decision.fallback_used);
    }

    #[test]
    fn user_override_blocks_builtin_provider() {
        let settings = BrowserAgentSettings {
            enabled: true,
            ..BrowserAgentSettings::default()
        };
        let decision = default_route_decision(
            "read_snapshot",
            &settings,
            true,
            &platform::current_platform_capability(),
        );
        assert_eq!(decision.selected_provider, "browser_skill");
        assert!(decision.fallback_used);
        assert_eq!(decision.fallback_reason.as_deref(), Some("user_override"));
    }

    #[test]
    fn snapshot_summary_uses_bounded_visible_text() {
        let snapshot = BrowserContextSnapshot {
            snapshot_id: "snapshot-1".to_string(),
            browser_session_id: "session-1".to_string(),
            workspace_id: "workspace-1".to_string(),
            captured_at: 100,
            source: BrowserContextSnapshotSource {
                url: "https://example.com".to_string(),
                normalized_url: "https://example.com".to_string(),
                title: Some("Example".to_string()),
                origin: Some("https://example.com".to_string()),
            },
            page: BrowserContextSnapshotPage {
                visible_text: "first line\nsecond line".to_string(),
                text_truncated: false,
                headings: Vec::new(),
                landmarks: Vec::new(),
                links: Vec::new(),
                buttons: Vec::new(),
                forms: Vec::new(),
                selected_text: None,
            },
            diagnostics: BrowserContextSnapshotDiagnostics {
                console: Vec::new(),
                network: None,
                capture_warnings: Vec::new(),
            },
            evidence: BrowserContextSnapshotEvidence {
                screenshot_ref: None,
                html_excerpt_ref: None,
            },
            privacy: BrowserPrivacyReport {
                redaction_applied: false,
                redacted_kinds: Vec::new(),
                omitted_kinds: Vec::new(),
            },
            budget: BrowserSnapshotBudget {
                char_limit: 12_000,
                visible_text_limit: 8_000,
                element_limit: 120,
                form_field_limit: 80,
                diagnostic_limit: 50,
                token_estimate: None,
            },
            availability: "available".to_string(),
        };

        assert_eq!(snapshot_summary(&snapshot), "Example\nfirst line second line");
    }
}
