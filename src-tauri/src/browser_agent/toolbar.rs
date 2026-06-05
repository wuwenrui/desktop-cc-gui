use std::collections::HashMap;

use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;

use super::{
    bind_browser_renderer_session, clear_browser_renderer_session, escape_js_string,
    origin_from_normalized_url, platform, spawn_browser_webview_session_patch, unix_time_ms,
    validate_browser_url_for_workspace, BrowserAgentFeaturePhase, BrowserSession,
    BrowserSessionStatus, BROWSER_RENDERER_WINDOW_LABEL,
};

const BROWSER_TOOLBAR_BRIDGE_HOST: &str = "browser-agent-toolbar.invalid";
const BROWSER_TOOLBAR_BRIDGE_PATH: &str = "/__ccgui_toolbar__";
const BROWSER_CONTEXT_ATTACHMENT_REQUEST_EVENT: &str = "browser-agent://attach-current-context";

struct BrowserToolbarLabels {
    locale: &'static str,
    brand: &'static str,
    attach: &'static str,
    status_ready: &'static str,
    open: &'static str,
    new_tab: &'static str,
    close: &'static str,
}

fn browser_toolbar_labels(locale: Option<&str>) -> BrowserToolbarLabels {
    let normalized = locale.unwrap_or("zh").trim().to_ascii_lowercase();
    if normalized.starts_with("en") {
        return BrowserToolbarLabels {
            locale: "en",
            brand: "Browser Dock",
            attach: "Attach browser context",
            status_ready: "Readable",
            open: "Open",
            new_tab: "New browser tab",
            close: "Close",
        };
    }
    BrowserToolbarLabels {
        locale: "zh",
        brand: "浏览器 Dock",
        attach: "关联浏览器上下文",
        status_ready: "可读取网页信息",
        open: "打开",
        new_tab: "新建浏览器标签页",
        close: "关闭",
    }
}

fn browser_agent_toolbar_script(
    browser_session_id: &str,
    workspace_id: &str,
    current_url: &str,
    title: Option<&str>,
    tabs_json: &str,
    locale: Option<&str>,
) -> String {
    let labels = browser_toolbar_labels(locale);
    let mut script = String::from(
        r#"(function () {
  const sessionId = "#,
    );
    script.push_str(&escape_js_string(browser_session_id));
    script.push_str(
        r#";
  const workspaceId = "#,
    );
    script.push_str(&escape_js_string(workspace_id));
    script.push_str(
        r#";
  const currentUrl = "#,
    );
    script.push_str(&escape_js_string(current_url));
    script.push_str(
        r#";
  const pageTitle = "#,
    );
    script.push_str(&escape_js_string(title.unwrap_or("")));
    script.push_str(
        r#";
  const locale = "#,
    );
    script.push_str(&escape_js_string(labels.locale));
    script.push_str(
        r#";
  const labels = {
    brand: "#,
    );
    script.push_str(&escape_js_string(labels.brand));
    script.push_str(
        r#",
    attach: "#,
    );
    script.push_str(&escape_js_string(labels.attach));
    script.push_str(
        r#",
    statusReady: "#,
    );
    script.push_str(&escape_js_string(labels.status_ready));
    script.push_str(
        r#",
    open: "#,
    );
    script.push_str(&escape_js_string(labels.open));
    script.push_str(
        r#",
    newTab: "#,
    );
    script.push_str(&escape_js_string(labels.new_tab));
    script.push_str(
        r#",
    close: "#,
    );
    script.push_str(&escape_js_string(labels.close));
    script.push_str(
        r#",
  };
  const tabs = "#,
    );
    script.push_str(tabs_json);
    script.push_str(
        r#";
  const toolbarHeight = 126;
  const hostId = "ccgui-browser-agent-toolbar";
  const bridgeBase = "https://browser-agent-toolbar.invalid/__ccgui_toolbar__";
  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  const normalizeDraftUrl = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };
  let nextOpenCreatesTab = false;
  const sendBridgeAction = (action, extraParams = {}) => {
    const params = new URLSearchParams({
      action,
      sessionId,
      workspaceId,
      locale,
      ...extraParams,
    });
    window.location.href = `${bridgeBase}?${params.toString()}`;
  };
  const host = document.getElementById(hostId) || document.createElement("div");
  host.id = hostId;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.right = "0";
  host.style.height = `${toolbarHeight}px`;
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "auto";
  if (!host.parentNode) {
    (document.documentElement || document.body).appendChild(host);
  }
  const body = document.body;
  if (body) {
    if (body.dataset.mossxBrowserToolbarPaddingTop === undefined) {
      body.dataset.mossxBrowserToolbarPaddingTop = body.style.paddingTop || "";
    }
    const originalPaddingTop = body.dataset.mossxBrowserToolbarPaddingTop || "";
    body.style.paddingTop = originalPaddingTop.trim()
      ? `calc(${originalPaddingTop} + ${toolbarHeight}px)`
      : `${toolbarHeight}px`;
  }
  const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
  const displayUrl = currentUrl || window.location.href || "";
  const tabLabel = pageTitle || document.title || displayUrl || labels.brand;
  const normalizedTabs = Array.isArray(tabs) && tabs.length > 0
    ? tabs
    : [{ browserSessionId: sessionId, title: tabLabel, url: displayUrl, status: "ready" }];
  const tabMarkup = normalizedTabs.map((tab) => {
    const tabId = String(tab.browserSessionId || "");
    const label = String(tab.title || tab.url || labels.brand);
    const activeClass = tabId === sessionId ? " is-active" : "";
    return `<button class="tab${activeClass}" type="button" data-tab-id="${escapeHtml(tabId)}" title="${escapeHtml(label)}"><span>◉ ${escapeHtml(label)}</span></button>`;
  }).join("");
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .dock {
        height: ${toolbarHeight}px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 16px 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(248, 250, 252, 0.96);
        color: #111827;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(16px);
      }
      .topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
      }
      .brand {
        display: flex;
        flex-direction: column;
        min-width: 0;
        font-weight: 800;
        letter-spacing: 0.01em;
      }
      .workspace {
        margin-top: 2px;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }
      .attach {
        border: 1px solid #93b4ff;
        border-radius: 12px;
        background: #f8fbff;
        color: #2563eb;
        cursor: pointer;
        font-size: 14px;
        font-weight: 800;
        padding: 8px 14px;
      }
      .tabrow {
        display: flex;
        align-items: stretch;
        gap: 8px;
        min-width: 0;
      }
      .tablist {
        display: flex;
        align-items: stretch;
        flex: 0 1 auto;
        max-width: min(48vw, 680px);
        min-width: 0;
        overflow-x: auto;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        max-width: 320px;
        min-width: 160px;
        height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-bottom: 2px solid #60a5fa;
        background: rgba(255, 255, 255, 0.78);
        color: #1f2937;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }
      .tab.is-active {
        background: rgba(255, 255, 255, 0.96);
        border-bottom-color: #2563eb;
      }
      .tab span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .plus {
        width: 34px;
        border: 0;
        background: transparent;
        color: #111827;
        cursor: pointer;
        font-size: 28px;
        line-height: 1;
      }
      .status {
        display: inline-flex;
        align-items: center;
        height: 30px;
        padding: 0 10px;
        border-radius: 8px;
        background: #6d8fc7;
        color: white;
        font-size: 12px;
        font-weight: 800;
      }
      form {
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        gap: 10px;
      }
      input {
        flex: 1 1 auto;
        min-width: 0;
        height: 36px;
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 11px;
        background: white;
        color: #111827;
        font: 500 14px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        outline: none;
        padding: 0 12px;
      }
      input:focus {
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.24);
      }
      .open, .close {
        height: 36px;
        border: 0;
        border-radius: 11px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 900;
        padding: 0 18px;
      }
      .open {
        background: white;
        color: #111827;
      }
      .close {
        width: 44px;
        padding: 0;
        background: rgba(255, 255, 255, 0.7);
        color: #111827;
        font-size: 24px;
        line-height: 1;
      }
    </style>
    <div class="dock">
      <div class="topline">
        <div class="brand">
          <span>${escapeHtml(labels.brand)}</span>
          <span class="workspace">${escapeHtml(workspaceId || "workspace")}</span>
        </div>
        <button class="attach" type="button" data-action="attach">${escapeHtml(labels.attach)}</button>
      </div>
      <div class="tabrow">
        <div class="tablist">${tabMarkup}</div>
        <button class="plus" type="button" data-action="new" aria-label="${escapeHtml(labels.newTab)}">+</button>
        <span class="status">${escapeHtml(labels.statusReady)}</span>
        <form data-open-form>
          <input data-url-input value="${escapeHtml(displayUrl)}" spellcheck="false" autocomplete="off" />
          <button class="open" type="submit">${escapeHtml(labels.open)}</button>
          <button class="close" type="button" data-action="close" aria-label="${escapeHtml(labels.close)}">×</button>
        </form>
      </div>
    </div>
  `;
  const form = shadow.querySelector("[data-open-form]");
  const input = shadow.querySelector("[data-url-input]");
  const newButton = shadow.querySelector('[data-action="new"]');
  const attachButton = shadow.querySelector('[data-action="attach"]');
  const closeButton = shadow.querySelector('[data-action="close"]');
  shadow.querySelectorAll("[data-tab-id]").forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      const targetSessionId = tabButton.getAttribute("data-tab-id") || "";
      if (targetSessionId) {
        sendBridgeAction("activate", { targetSessionId });
      }
    });
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const normalized = normalizeDraftUrl(input?.value);
    if (normalized) {
      sendBridgeAction("open", {
        url: normalized,
        newTab: nextOpenCreatesTab ? "1" : "0",
      });
      nextOpenCreatesTab = false;
    }
  });
  newButton?.addEventListener("click", () => {
    nextOpenCreatesTab = true;
    if (input) {
      input.value = "";
      input.focus();
    }
  });
  attachButton?.addEventListener("click", () => sendBridgeAction("attach"));
  closeButton?.addEventListener("click", () => sendBridgeAction("close"));
})();"#,
    );
    script
}

async fn inject_browser_agent_toolbar_from_state(
    app: AppHandle,
    window: tauri::WebviewWindow<tauri::Wry>,
    active_browser_session_id: String,
    current_url: Option<String>,
    title: Option<String>,
    locale: Option<String>,
) {
    let (workspace_id, active_url, active_title, tabs_json) = {
        let state = app.state::<AppState>();
        let sessions = state.browser_sessions.lock().await;
        let Some(active_session) = sessions.get(active_browser_session_id.as_str()) else {
            return;
        };
        let workspace_id = active_session.workspace_id.clone();
        let active_url = current_url.unwrap_or_else(|| active_session.normalized_url.clone());
        let active_title = title.or_else(|| active_session.title.clone());
        let mut tabs = sessions
            .values()
            .filter(|session| {
                session.workspace_id == workspace_id
                    && session.status != BrowserSessionStatus::Closed
            })
            .cloned()
            .collect::<Vec<_>>();
        tabs.sort_by(|left, right| left.created_at.cmp(&right.created_at));
        let tabs_json = serde_json::to_string(
            &tabs
                .iter()
                .map(|session| {
                    serde_json::json!({
                        "browserSessionId": session.browser_session_id,
                        "title": session.title.as_deref().unwrap_or(""),
                        "url": session.normalized_url,
                        "status": session.status,
                    })
                })
                .collect::<Vec<_>>(),
        )
        .unwrap_or_else(|_| "[]".to_string());
        (workspace_id, active_url, active_title, tabs_json)
    };

    let script = browser_agent_toolbar_script(
        active_browser_session_id.as_str(),
        workspace_id.as_str(),
        active_url.as_str(),
        active_title.as_deref(),
        tabs_json.as_str(),
        locale.as_deref(),
    );
    let _ = window.eval(script);
}

pub(super) fn spawn_browser_toolbar_injection(
    app: AppHandle,
    window: tauri::WebviewWindow<tauri::Wry>,
    active_browser_session_id: String,
    current_url: Option<String>,
    title: Option<String>,
    locale: Option<String>,
) {
    tauri::async_runtime::spawn(async move {
        inject_browser_agent_toolbar_from_state(
            app,
            window,
            active_browser_session_id,
            current_url,
            title,
            locale,
        )
        .await;
    });
}

async fn open_browser_toolbar_url(
    app: AppHandle,
    current_browser_session_id: String,
    workspace_id: String,
    raw_url: String,
    new_tab: bool,
    locale: Option<String>,
) {
    let validation =
        validate_browser_url_for_workspace(raw_url.as_str(), Some(workspace_id.as_str()));
    let normalized_url = match validation.normalized_url.clone() {
        Some(normalized_url) => normalized_url,
        None => {
            spawn_browser_webview_session_patch(
                app,
                current_browser_session_id,
                Some(BrowserSessionStatus::Blocked),
                Some(raw_url),
                None,
                validation.blocked_reason,
                validation.diagnostic.map(|diagnostic| diagnostic.message),
            );
            return;
        }
    };

    let now = unix_time_ms();
    let active_session = {
        let state = app.state::<AppState>();
        let mut sessions = state.browser_sessions.lock().await;
        if new_tab {
            let browser_session_id = format!("browser-session-{}", uuid::Uuid::new_v4());
            let session = BrowserSession {
                browser_session_id: browser_session_id.clone(),
                workspace_id: workspace_id.clone(),
                label: "Browser Agent · browser-agent-window".to_string(),
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
            sessions.insert(browser_session_id, session.clone());
            session
        } else {
            let session = if sessions.contains_key(current_browser_session_id.as_str()) {
                sessions.get_mut(current_browser_session_id.as_str())
            } else {
                sessions.values_mut().find(|session| {
                    session.workspace_id == workspace_id
                        && session.status != BrowserSessionStatus::Closed
                })
            };
            let Some(session) = session else {
                return;
            };
            session.url = normalized_url.clone();
            session.normalized_url = normalized_url.clone();
            session.origin = origin_from_normalized_url(normalized_url.as_str());
            session.status = BrowserSessionStatus::Loading;
            session.error_code = None;
            session.diagnostic_message = None;
            session.updated_at = now;
            session.last_activated_at = now;
            session.clone()
        }
    };

    bind_browser_renderer_session(active_session.browser_session_id.as_str());
    if let Some(window) = app.get_webview_window(BROWSER_RENDERER_WINDOW_LABEL) {
        spawn_browser_toolbar_injection(
            app.clone(),
            window.clone(),
            active_session.browser_session_id.clone(),
            Some(active_session.normalized_url.clone()),
            active_session.title.clone(),
            locale,
        );
        if let Ok(parsed_url) = active_session.normalized_url.parse::<tauri::Url>() {
            let _ = window.navigate(parsed_url);
        }
    }
}

async fn activate_browser_toolbar_session(
    app: AppHandle,
    target_browser_session_id: String,
    expected_workspace_id: Option<String>,
    locale: Option<String>,
) {
    let session = {
        let state = app.state::<AppState>();
        let sessions = state.browser_sessions.lock().await;
        sessions.get(target_browser_session_id.as_str()).cloned()
    };
    let Some(session) = session else {
        return;
    };
    if session.status == BrowserSessionStatus::Closed {
        return;
    }
    if let Some(expected_workspace_id) = expected_workspace_id.as_deref() {
        if session.workspace_id != expected_workspace_id {
            return;
        }
    }
    bind_browser_renderer_session(session.browser_session_id.as_str());
    if let Some(window) = app.get_webview_window(BROWSER_RENDERER_WINDOW_LABEL) {
        spawn_browser_toolbar_injection(
            app.clone(),
            window.clone(),
            session.browser_session_id.clone(),
            Some(session.normalized_url.clone()),
            session.title.clone(),
            locale,
        );
        let _ = window.show();
        let _ = window.set_focus();
        if let Ok(parsed_url) = session.normalized_url.parse::<tauri::Url>() {
            let _ = window.navigate(parsed_url);
        }
    }
}

async fn close_browser_toolbar_session(
    app: AppHandle,
    browser_session_id: String,
    expected_workspace_id: Option<String>,
    locale: Option<String>,
) {
    let next_session = {
        let state = app.state::<AppState>();
        let mut sessions = state.browser_sessions.lock().await;
        let Some(session_workspace_id) = sessions
            .get(browser_session_id.as_str())
            .map(|session| session.workspace_id.clone())
        else {
            return;
        };
        if let Some(expected_workspace_id) = expected_workspace_id.as_deref() {
            if session_workspace_id != expected_workspace_id {
                return;
            }
        }
        let now = unix_time_ms();
        if let Some(session) = sessions.get_mut(browser_session_id.as_str()) {
            session.status = BrowserSessionStatus::Closed;
            session.updated_at = now;
            session.closed_at = Some(now);
        }
        {
            let workspace_id = session_workspace_id;
            let mut candidates = sessions
                .values()
                .filter(|session| {
                    session.workspace_id == workspace_id
                        && session.status != BrowserSessionStatus::Closed
                })
                .cloned()
                .collect::<Vec<_>>();
            candidates.sort_by(|left, right| right.last_activated_at.cmp(&left.last_activated_at));
            candidates.into_iter().next()
        }
    };

    clear_browser_renderer_session(browser_session_id.as_str());
    match next_session {
        Some(session) => {
            activate_browser_toolbar_session(
                app,
                session.browser_session_id,
                Some(session.workspace_id),
                locale,
            )
            .await;
        }
        None => {
            if let Some(window) = app.get_webview_window(BROWSER_RENDERER_WINDOW_LABEL) {
                let _ = window.close();
            }
        }
    }
}

pub(super) fn handle_browser_toolbar_navigation(
    app: &AppHandle,
    raw_url: &str,
    browser_session_id: &str,
    workspace_id: &str,
) -> bool {
    let Ok(url) = raw_url.parse::<tauri::Url>() else {
        return false;
    };
    if url.host_str() != Some(BROWSER_TOOLBAR_BRIDGE_HOST)
        || url.path() != BROWSER_TOOLBAR_BRIDGE_PATH
    {
        return false;
    }
    let action = url
        .query_pairs()
        .find_map(|(key, value)| (key == "action").then(|| value.into_owned()))
        .unwrap_or_default();
    let query_pairs = url
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect::<HashMap<_, _>>();
    let toolbar_browser_session_id =
        normalize_toolbar_query_value(query_pairs.get("sessionId"), browser_session_id);
    let toolbar_workspace_id =
        normalize_toolbar_query_value(query_pairs.get("workspaceId"), workspace_id);
    let toolbar_locale = query_pairs
        .get("locale")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string());
    match action.as_str() {
        "activate" => {
            let target_browser_session_id = query_pairs
                .get("targetSessionId")
                .map(|value| {
                    normalize_toolbar_query_value(Some(value), toolbar_browser_session_id.as_str())
                })
                .unwrap_or_else(|| toolbar_browser_session_id.clone());
            let app_for_action = app.clone();
            let locale = toolbar_locale.clone();
            tauri::async_runtime::spawn(async move {
                activate_browser_toolbar_session(
                    app_for_action,
                    target_browser_session_id,
                    Some(toolbar_workspace_id),
                    locale,
                )
                .await;
            });
        }
        "open" => {
            if let Some(url) = query_pairs.get("url").cloned() {
                let app_for_action = app.clone();
                let current_browser_session_id = toolbar_browser_session_id.clone();
                let workspace_id = toolbar_workspace_id.clone();
                let locale = toolbar_locale.clone();
                let new_tab = parse_toolbar_boolean(query_pairs.get("newTab"));
                tauri::async_runtime::spawn(async move {
                    open_browser_toolbar_url(
                        app_for_action,
                        current_browser_session_id,
                        workspace_id,
                        url,
                        new_tab,
                        locale,
                    )
                    .await;
                });
            }
        }
        "attach" => {
            let _ = app.emit_to(
                "main",
                BROWSER_CONTEXT_ATTACHMENT_REQUEST_EVENT,
                serde_json::json!({
                    "workspaceId": toolbar_workspace_id.as_str(),
                    "browserSessionId": toolbar_browser_session_id.as_str(),
                }),
            );
        }
        "close" => {
            let app_for_action = app.clone();
            let browser_session_id = toolbar_browser_session_id.clone();
            let locale = toolbar_locale.clone();
            tauri::async_runtime::spawn(async move {
                close_browser_toolbar_session(
                    app_for_action,
                    browser_session_id,
                    Some(toolbar_workspace_id),
                    locale,
                )
                .await;
            });
        }
        _ => {}
    }
    true
}

fn normalize_toolbar_query_value(value: Option<&String>, fallback: &str) -> String {
    value
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn parse_toolbar_boolean(value: Option<&String>) -> bool {
    value
        .map(|value| {
            let normalized = value.trim();
            normalized == "1" || normalized.eq_ignore_ascii_case("true")
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{normalize_toolbar_query_value, parse_toolbar_boolean};

    #[test]
    fn normalize_toolbar_query_value_trims_or_falls_back_for_empty_input() {
        assert_eq!(
            normalize_toolbar_query_value(Some(&" session-1 ".to_string()), "fallback"),
            "session-1",
        );
        assert_eq!(
            normalize_toolbar_query_value(Some(&"   ".to_string()), "fallback"),
            "fallback",
        );
        assert_eq!(normalize_toolbar_query_value(None, "fallback"), "fallback");
    }

    #[test]
    fn parse_toolbar_boolean_accepts_only_explicit_truthy_values() {
        assert!(parse_toolbar_boolean(Some(&"1".to_string())));
        assert!(parse_toolbar_boolean(Some(&" TRUE ".to_string())));
        assert!(!parse_toolbar_boolean(Some(&"0".to_string())));
        assert!(!parse_toolbar_boolean(Some(&"yes".to_string())));
        assert!(!parse_toolbar_boolean(None));
    }
}
