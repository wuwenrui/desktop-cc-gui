use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

use crate::state::AppState;

const DEFAULT_HEARTBEAT_THRESHOLD_MS: i64 = 45_000;
const WATCHDOG_INTERVAL_MS: u64 = 15_000;
const MAX_HEARTBEAT_SCOPES: usize = 16;
const MAX_WATCHDOG_DIAGNOSTICS: usize = 64;
const MAX_SCOPE_CHARS: usize = 80;
const MAX_ID_CHARS: usize = 160;
const MAX_PLATFORM_CHARS: usize = 80;
const MAX_APP_VERSION_CHARS: usize = 80;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum RendererSupportState {
    Supported,
    Unsupported,
    NotImplemented,
}

impl Default for RendererSupportState {
    fn default() -> Self {
        Self::Unsupported
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererHeartbeatSupportFlags {
    pub(crate) native_process_failure_hook: RendererSupportState,
    pub(crate) memory: RendererSupportState,
    pub(crate) long_task: RendererSupportState,
    pub(crate) process_count: RendererSupportState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererHeartbeatPressureSnapshot {
    pub(crate) active_engine_count: Option<u16>,
    pub(crate) active_streaming_turn_count: Option<u16>,
    pub(crate) helper_process_count: Option<u16>,
    pub(crate) memory_support_state: RendererSupportState,
    pub(crate) used_js_heap_size: Option<u64>,
    pub(crate) total_js_heap_size: Option<u64>,
    pub(crate) js_heap_size_limit: Option<u64>,
    pub(crate) long_task_support_state: RendererSupportState,
    pub(crate) recovery_attempt_count: u16,
}

impl Default for RendererHeartbeatPressureSnapshot {
    fn default() -> Self {
        Self {
            active_engine_count: None,
            active_streaming_turn_count: None,
            helper_process_count: None,
            memory_support_state: RendererSupportState::Unsupported,
            used_js_heap_size: None,
            total_js_heap_size: None,
            js_heap_size_limit: None,
            long_task_support_state: RendererSupportState::Unsupported,
            recovery_attempt_count: 0,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererHeartbeatInput {
    pub(crate) app_scope: String,
    pub(crate) renderer_id: String,
    pub(crate) sequence: u64,
    pub(crate) sent_at: i64,
    pub(crate) platform: String,
    pub(crate) app_version: String,
    #[serde(default)]
    pub(crate) workspace_id: Option<String>,
    #[serde(default)]
    pub(crate) thread_id: Option<String>,
    pub(crate) visibility_state: String,
    pub(crate) document_ready_state: String,
    #[serde(default)]
    pub(crate) support: RendererHeartbeatSupportFlags,
    #[serde(default)]
    pub(crate) pressure: RendererHeartbeatPressureSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererHeartbeatRecord {
    pub(crate) app_scope: String,
    pub(crate) renderer_id: String,
    pub(crate) sequence: u64,
    pub(crate) sent_at: i64,
    pub(crate) received_at: i64,
    pub(crate) platform: String,
    pub(crate) app_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) thread_id: Option<String>,
    pub(crate) visibility_state: String,
    pub(crate) document_ready_state: String,
    pub(crate) support: RendererHeartbeatSupportFlags,
    pub(crate) pressure: RendererHeartbeatPressureSnapshot,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererPlatformHookSupport {
    pub(crate) platform: &'static str,
    pub(crate) webview_runtime: &'static str,
    pub(crate) state: RendererSupportState,
    pub(crate) reason: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererHeartbeatStatus {
    pub(crate) app_scope: String,
    pub(crate) classification: &'static str,
    pub(crate) threshold_ms: i64,
    pub(crate) missed_by_ms: Option<i64>,
    pub(crate) latest: Option<RendererHeartbeatRecord>,
    pub(crate) native_hook_support: Vec<RendererPlatformHookSupport>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererWatchdogDiagnostic {
    pub(crate) timestamp: i64,
    pub(crate) app_scope: String,
    pub(crate) label: &'static str,
    pub(crate) missed_by_ms: i64,
    pub(crate) threshold_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RendererStabilitySnapshot {
    pub(crate) statuses: Vec<RendererHeartbeatStatus>,
    pub(crate) watchdog_diagnostics: Vec<RendererWatchdogDiagnostic>,
    pub(crate) native_hook_support: Vec<RendererPlatformHookSupport>,
}

#[derive(Debug, Default)]
pub(crate) struct RendererHeartbeatStore {
    latest_by_scope: HashMap<String, RendererHeartbeatRecord>,
    watchdog_diagnostics: VecDeque<RendererWatchdogDiagnostic>,
    last_watchdog_emit_by_scope: HashMap<String, i64>,
}

impl RendererHeartbeatStore {
    fn record(&mut self, record: RendererHeartbeatRecord) {
        if self.latest_by_scope.len() >= MAX_HEARTBEAT_SCOPES
            && !self.latest_by_scope.contains_key(&record.app_scope)
        {
            if let Some(oldest_scope) = self
                .latest_by_scope
                .iter()
                .min_by_key(|(_, entry)| entry.received_at)
                .map(|(scope, _)| scope.clone())
            {
                self.latest_by_scope.remove(&oldest_scope);
                self.last_watchdog_emit_by_scope.remove(&oldest_scope);
            }
        }
        self.latest_by_scope
            .insert(record.app_scope.clone(), record);
    }

    fn status_for_scope(
        &self,
        app_scope: &str,
        now_ms: i64,
        threshold_ms: i64,
    ) -> RendererHeartbeatStatus {
        let latest = self.latest_by_scope.get(app_scope).cloned();
        let missed_by_ms = latest
            .as_ref()
            .map(|record| now_ms.saturating_sub(record.received_at) - threshold_ms)
            .filter(|value| *value > 0);
        let classification = if latest.is_none() {
            "unknown"
        } else if missed_by_ms.is_some() {
            "heartbeat_missed"
        } else {
            "healthy"
        };
        RendererHeartbeatStatus {
            app_scope: app_scope.to_string(),
            classification,
            threshold_ms,
            missed_by_ms,
            latest,
            native_hook_support: platform_hook_support_matrix(),
        }
    }

    fn snapshot(&self, now_ms: i64, threshold_ms: i64) -> RendererStabilitySnapshot {
        let statuses = self
            .latest_by_scope
            .keys()
            .map(|scope| self.status_for_scope(scope, now_ms, threshold_ms))
            .collect();
        RendererStabilitySnapshot {
            statuses,
            watchdog_diagnostics: self.watchdog_diagnostics.iter().cloned().collect(),
            native_hook_support: platform_hook_support_matrix(),
        }
    }

    fn collect_watchdog_diagnostics(
        &mut self,
        now_ms: i64,
        threshold_ms: i64,
    ) -> Vec<RendererWatchdogDiagnostic> {
        let mut emitted = Vec::new();
        for (scope, record) in &self.latest_by_scope {
            let missed_by_ms = now_ms.saturating_sub(record.received_at) - threshold_ms;
            if missed_by_ms <= 0 {
                continue;
            }
            let last_emit = self
                .last_watchdog_emit_by_scope
                .get(scope)
                .copied()
                .unwrap_or(0);
            if now_ms.saturating_sub(last_emit) < threshold_ms {
                continue;
            }
            let diagnostic = RendererWatchdogDiagnostic {
                timestamp: now_ms,
                app_scope: scope.clone(),
                label: "renderer.heartbeat_missed",
                missed_by_ms,
                threshold_ms,
            };
            self.last_watchdog_emit_by_scope
                .insert(scope.clone(), now_ms);
            self.watchdog_diagnostics.push_back(diagnostic.clone());
            while self.watchdog_diagnostics.len() > MAX_WATCHDOG_DIAGNOSTICS {
                self.watchdog_diagnostics.pop_front();
            }
            emitted.push(diagnostic);
        }
        emitted
    }
}

#[tauri::command]
pub(crate) async fn record_renderer_heartbeat(
    input: RendererHeartbeatInput,
    state: tauri::State<'_, AppState>,
) -> Result<RendererHeartbeatStatus, String> {
    let now_ms = now_ms();
    let record = RendererHeartbeatRecord::from_input(input, now_ms);
    let scope = record.app_scope.clone();
    let mut store = state.renderer_heartbeats.lock().await;
    store.record(record);
    Ok(store.status_for_scope(&scope, now_ms, DEFAULT_HEARTBEAT_THRESHOLD_MS))
}

#[tauri::command]
pub(crate) async fn get_renderer_stability_snapshot(
    state: tauri::State<'_, AppState>,
) -> Result<RendererStabilitySnapshot, String> {
    let store = state.renderer_heartbeats.lock().await;
    Ok(store.snapshot(now_ms(), DEFAULT_HEARTBEAT_THRESHOLD_MS))
}

#[tauri::command]
pub(crate) fn get_renderer_platform_hook_support() -> Vec<RendererPlatformHookSupport> {
    platform_hook_support_matrix()
}

pub(crate) fn spawn_renderer_heartbeat_watchdog(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(WATCHDOG_INTERVAL_MS)).await;
            let state = app.state::<AppState>();
            if state.runtime_manager.is_shutting_down() {
                break;
            }
            let diagnostics = {
                let mut store = state.renderer_heartbeats.lock().await;
                store.collect_watchdog_diagnostics(now_ms(), DEFAULT_HEARTBEAT_THRESHOLD_MS)
            };
            for diagnostic in diagnostics {
                log::warn!(
                    "[renderer-stability] heartbeat missed: scope={} missedByMs={} thresholdMs={}",
                    diagnostic.app_scope,
                    diagnostic.missed_by_ms,
                    diagnostic.threshold_ms
                );
            }
        }
    });
}

impl RendererHeartbeatRecord {
    fn from_input(input: RendererHeartbeatInput, received_at: i64) -> Self {
        Self {
            app_scope: bound_string(&input.app_scope, MAX_SCOPE_CHARS, "main"),
            renderer_id: bound_string(&input.renderer_id, MAX_ID_CHARS, "main"),
            sequence: input.sequence,
            sent_at: input.sent_at.max(0),
            received_at,
            platform: bound_string(&input.platform, MAX_PLATFORM_CHARS, "unknown"),
            app_version: bound_string(&input.app_version, MAX_APP_VERSION_CHARS, "unknown"),
            workspace_id: bound_optional_string(input.workspace_id, MAX_ID_CHARS),
            thread_id: bound_optional_string(input.thread_id, MAX_ID_CHARS),
            visibility_state: bound_string(&input.visibility_state, 32, "unknown"),
            document_ready_state: bound_string(&input.document_ready_state, 32, "unknown"),
            support: input.support,
            pressure: input.pressure,
        }
    }
}

fn platform_hook_support_matrix() -> Vec<RendererPlatformHookSupport> {
    vec![
        RendererPlatformHookSupport {
            platform: "windows",
            webview_runtime: "webview2",
            state: RendererSupportState::NotImplemented,
            reason: "Tauri/wry WebView2 ProcessFailed bridge is not wired; heartbeat/watchdog fallback remains active.",
        },
        RendererPlatformHookSupport {
            platform: "macos",
            webview_runtime: "wkwebview",
            state: RendererSupportState::NotImplemented,
            reason: "WKWebView web process termination bridge is not wired in the current Tauri integration.",
        },
        RendererPlatformHookSupport {
            platform: "linux",
            webview_runtime: "webkitgtk",
            state: RendererSupportState::NotImplemented,
            reason: "WebKitGTK web process failure bridge is not wired in the current Tauri integration.",
        },
    ]
}

fn bound_string(value: &str, max_chars: usize, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }
    trimmed.chars().take(max_chars).collect()
}

fn bound_optional_string(value: Option<String>, max_chars: usize) -> Option<String> {
    value
        .map(|entry| bound_string(&entry, max_chars, ""))
        .filter(|entry| !entry.is_empty())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn heartbeat(scope: &str, received_at: i64) -> RendererHeartbeatRecord {
        RendererHeartbeatRecord {
            app_scope: scope.to_string(),
            renderer_id: "main".to_string(),
            sequence: 1,
            sent_at: received_at,
            received_at,
            platform: "macOS".to_string(),
            app_version: "0.5.4".to_string(),
            workspace_id: None,
            thread_id: None,
            visibility_state: "visible".to_string(),
            document_ready_state: "complete".to_string(),
            support: RendererHeartbeatSupportFlags::default(),
            pressure: RendererHeartbeatPressureSnapshot::default(),
        }
    }

    #[test]
    fn classifies_missed_heartbeat_without_claiming_native_crash() {
        let mut store = RendererHeartbeatStore::default();
        store.record(heartbeat("main", 1_000));

        let status = store.status_for_scope("main", 50_000, 45_000);

        assert_eq!(status.classification, "heartbeat_missed");
        assert_eq!(status.missed_by_ms, Some(4_000));
        assert!(status
            .native_hook_support
            .iter()
            .all(|hook| hook.state == RendererSupportState::NotImplemented));
    }

    #[test]
    fn bounds_heartbeat_scopes() {
        let mut store = RendererHeartbeatStore::default();
        for index in 0..(MAX_HEARTBEAT_SCOPES + 4) {
            store.record(heartbeat(&format!("scope-{index}"), index as i64));
        }

        assert_eq!(store.latest_by_scope.len(), MAX_HEARTBEAT_SCOPES);
    }
}
