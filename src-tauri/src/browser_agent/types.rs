use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserAgentFeaturePhase {
    Disabled,
    ReadOnlySnapshot,
    SafeNavigation,
    TargetedElementActions,
    FormSubmit,
    FullAgent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserCapabilityState {
    Supported,
    Degraded,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserPlatform {
    Macos,
    Windows,
    Linux,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserWebviewRuntime {
    Wkwebview,
    Webview2,
    Webkitgtk,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserPlatformCapability {
    pub(crate) platform: BrowserPlatform,
    pub(crate) webview_runtime: BrowserWebviewRuntime,
    pub(crate) browser_dock: BrowserCapabilityState,
    pub(crate) snapshot_capture: BrowserCapabilityState,
    pub(crate) screenshot_capture: BrowserCapabilityState,
    pub(crate) navigation_actions: BrowserCapabilityState,
    pub(crate) element_actions: BrowserCapabilityState,
    pub(crate) form_submit_actions: BrowserCapabilityState,
    pub(crate) diagnostics_capture: BrowserCapabilityState,
    pub(crate) unsupported_reasons: Vec<String>,
    pub(crate) degraded_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserAgentSettings {
    pub(crate) enabled: bool,
    pub(crate) prefer_for_ai_browser_operations: bool,
    pub(crate) allow_read_only_snapshots: bool,
    pub(crate) allow_navigation_actions: bool,
    pub(crate) allow_element_actions: bool,
    pub(crate) allow_form_submit_actions: bool,
    pub(crate) allow_external_provider_fallback: bool,
    pub(crate) default_snapshot_budget_chars: u32,
    pub(crate) evidence_retention_days: u32,
    pub(crate) platform_warnings_acknowledged: HashMap<String, bool>,
}

impl Default for BrowserAgentSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            prefer_for_ai_browser_operations: true,
            allow_read_only_snapshots: true,
            allow_navigation_actions: false,
            allow_element_actions: false,
            allow_form_submit_actions: false,
            allow_external_provider_fallback: true,
            default_snapshot_budget_chars: 12_000,
            evidence_retention_days: 7,
            platform_warnings_acknowledged: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserProviderRouteDecision {
    pub(crate) requested_capability: String,
    pub(crate) selected_provider: String,
    pub(crate) reason: String,
    pub(crate) user_override: bool,
    pub(crate) fallback_used: bool,
    pub(crate) fallback_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserAgentStatus {
    pub(crate) settings: BrowserAgentSettings,
    pub(crate) feature_phase: BrowserAgentFeaturePhase,
    pub(crate) platform_capability: BrowserPlatformCapability,
    pub(crate) provider_preference: BrowserProviderRouteDecision,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionRequest {
    pub(crate) browser_session_id: String,
    pub(crate) action: String,
    pub(crate) target_id: Option<String>,
    pub(crate) value: Option<String>,
    pub(crate) reason: String,
    pub(crate) requested_by: String,
    #[serde(default)]
    pub(crate) confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionAuditEntry {
    pub(crate) action_id: String,
    pub(crate) browser_session_id: String,
    pub(crate) requested_at: u64,
    pub(crate) completed_at: Option<u64>,
    pub(crate) action: String,
    pub(crate) target_description: Option<String>,
    pub(crate) outcome: String,
    pub(crate) diagnostic_message: Option<String>,
    pub(crate) before_snapshot_id: Option<String>,
    pub(crate) after_snapshot_id: Option<String>,
    pub(crate) comparison: Option<BrowserActionSnapshotComparison>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionSnapshotComparison {
    pub(crate) before_snapshot_id: Option<String>,
    pub(crate) after_snapshot_id: Option<String>,
    pub(crate) state: String,
    pub(crate) diagnostics: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionGateResolution {
    pub(crate) allowed: bool,
    pub(crate) blocked_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionPreview {
    pub(crate) action_id: String,
    pub(crate) browser_session_id: String,
    pub(crate) action: String,
    pub(crate) target_id: Option<String>,
    pub(crate) target_description: Option<String>,
    pub(crate) value_preview: Option<String>,
    pub(crate) reason: String,
    pub(crate) risk_level: String,
    pub(crate) requires_user_confirmation: bool,
    pub(crate) blocked_by_default: bool,
    pub(crate) before_snapshot_id: Option<String>,
    pub(crate) after_snapshot_id: Option<String>,
    pub(crate) expected_effect: String,
    pub(crate) privacy_notice: String,
    pub(crate) gate: BrowserActionGateResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionResult {
    pub(crate) outcome: String,
    pub(crate) audit_entry: BrowserActionAuditEntry,
    pub(crate) preview: Option<BrowserActionPreview>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserSessionStatus {
    Idle,
    Loading,
    Ready,
    Blocked,
    Failed,
    Closed,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserSession {
    pub(crate) browser_session_id: String,
    pub(crate) workspace_id: String,
    pub(crate) label: String,
    pub(crate) url: String,
    pub(crate) normalized_url: String,
    pub(crate) origin: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) favicon_ref: Option<String>,
    pub(crate) status: BrowserSessionStatus,
    pub(crate) feature_phase: BrowserAgentFeaturePhase,
    pub(crate) platform_capability: BrowserPlatformCapability,
    pub(crate) linked_thread_id: Option<String>,
    pub(crate) linked_task_run_id: Option<String>,
    pub(crate) linked_orchestration_task_id: Option<String>,
    pub(crate) last_snapshot_id: Option<String>,
    pub(crate) last_action_id: Option<String>,
    pub(crate) error_code: Option<String>,
    pub(crate) diagnostic_message: Option<String>,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
    pub(crate) last_activated_at: u64,
    pub(crate) closed_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserUrlValidationResult {
    pub(crate) raw_url: String,
    pub(crate) normalized_url: Option<String>,
    pub(crate) allowed: bool,
    pub(crate) blocked_reason: Option<String>,
    pub(crate) diagnostic: Option<BrowserDiagnostic>,
    pub(crate) workspace_local_allowed: bool,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateBrowserSessionRequest {
    pub(crate) workspace_id: String,
    pub(crate) url: String,
    pub(crate) owner_surface: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateBrowserSessionRequest {
    pub(crate) browser_session_id: String,
    pub(crate) workspace_id: Option<String>,
    pub(crate) status: Option<BrowserSessionStatus>,
    pub(crate) title: Option<String>,
    pub(crate) url: Option<String>,
    pub(crate) last_snapshot_id: Option<String>,
    pub(crate) last_action_id: Option<String>,
    pub(crate) error_code: Option<String>,
    pub(crate) diagnostic_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserSessionCleanupResult {
    pub(crate) removed_session_ids: Vec<String>,
    pub(crate) retained_session_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserWebviewBounds {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserWebviewMountRequest {
    pub(crate) browser_session_id: String,
    pub(crate) bounds: BrowserWebviewBounds,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserWebviewEvent {
    pub(crate) browser_session_id: String,
    pub(crate) label: String,
    pub(crate) url: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) status: BrowserSessionStatus,
    pub(crate) occurred_at: u64,
    pub(crate) error_code: Option<String>,
    pub(crate) diagnostic_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserSnapshotBudget {
    pub(crate) char_limit: usize,
    pub(crate) visible_text_limit: usize,
    pub(crate) element_limit: usize,
    pub(crate) form_field_limit: usize,
    pub(crate) diagnostic_limit: usize,
    pub(crate) token_estimate: Option<usize>,
    pub(crate) truncated: bool,
    pub(crate) omitted_element_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserSnapshotFreshness {
    Fresh,
    Stale,
    Expired,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserSnapshotSource {
    pub(crate) url: String,
    pub(crate) normalized_url: String,
    pub(crate) origin: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) tab_label: String,
    pub(crate) capture_reason: String,
    pub(crate) workspace_local_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserViewportState {
    pub(crate) width: Option<f64>,
    pub(crate) height: Option<f64>,
    pub(crate) scroll_x: Option<f64>,
    pub(crate) scroll_y: Option<f64>,
    pub(crate) scroll_height: Option<f64>,
    pub(crate) scroll_width: Option<f64>,
    pub(crate) device_pixel_ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserTextNode {
    pub(crate) target_id: String,
    pub(crate) role: String,
    pub(crate) level: Option<u8>,
    pub(crate) text: String,
    pub(crate) truncated: bool,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserElementBounds {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserActionTarget {
    pub(crate) target_id: String,
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) accessible_name: Option<String>,
    pub(crate) text: Option<String>,
    pub(crate) href: Option<String>,
    pub(crate) placeholder: Option<String>,
    pub(crate) value_preview: Option<String>,
    pub(crate) disabled: bool,
    pub(crate) visible: bool,
    pub(crate) sensitive: bool,
    pub(crate) bounds: Option<BrowserElementBounds>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserFormSummary {
    pub(crate) form_id: String,
    pub(crate) label: String,
    pub(crate) method: Option<String>,
    pub(crate) action_origin: Option<String>,
    #[serde(default)]
    pub(crate) fields: Vec<BrowserActionTarget>,
    #[serde(default)]
    pub(crate) submit_targets: Vec<BrowserActionTarget>,
    pub(crate) sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserLandmark {
    pub(crate) target_id: String,
    pub(crate) role: String,
    pub(crate) label: String,
    pub(crate) text_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserElementLandmark {
    pub(crate) landmark_id: String,
    pub(crate) role: String,
    pub(crate) label: String,
    pub(crate) text_preview: Option<String>,
    pub(crate) selector_hint: Option<String>,
    pub(crate) href: Option<String>,
    pub(crate) placeholder: Option<String>,
    pub(crate) enabled: bool,
    pub(crate) visible: bool,
    pub(crate) sensitive: bool,
    pub(crate) bounds: Option<BrowserElementBounds>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserContentRegion {
    pub(crate) region_id: String,
    pub(crate) role: String,
    pub(crate) label: String,
    pub(crate) text_preview: String,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BrowserPageType {
    Article,
    Issue,
    Docs,
    Form,
    Dashboard,
    Spa,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserPrimaryContent {
    pub(crate) text: String,
    pub(crate) source: String,
    pub(crate) score: i32,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserReadableBlock {
    pub(crate) block_id: String,
    pub(crate) role: String,
    pub(crate) text: String,
    pub(crate) score: i32,
    pub(crate) truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserNoiseDiagnostic {
    pub(crate) diagnostic_id: String,
    pub(crate) kind: String,
    pub(crate) severity: String,
    pub(crate) message: String,
    pub(crate) score: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserVisualEvidence {
    pub(crate) evidence_id: String,
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) alt_text: Option<String>,
    pub(crate) src_origin: Option<String>,
    pub(crate) nearby_text: Option<String>,
    pub(crate) visible: bool,
    pub(crate) sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserCodeCandidate {
    pub(crate) candidate_id: String,
    pub(crate) file_path: String,
    pub(crate) symbol_name: Option<String>,
    pub(crate) reason: String,
    pub(crate) confidence: String,
    pub(crate) matched_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserDiagnostic {
    pub(crate) diagnostic_id: String,
    pub(crate) kind: String,
    pub(crate) severity: String,
    pub(crate) message: String,
    pub(crate) source: Option<String>,
    pub(crate) redacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserNetworkSummary {
    pub(crate) request_count: usize,
    pub(crate) failed_request_count: usize,
    pub(crate) blocked_request_count: usize,
    pub(crate) main_document_status: Option<u16>,
    pub(crate) slow_request_count: Option<usize>,
    pub(crate) redacted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserPrivacyReport {
    pub(crate) redaction_applied: bool,
    #[serde(default)]
    pub(crate) redacted_kinds: Vec<String>,
    #[serde(default)]
    pub(crate) omitted_kinds: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserContextSnapshotPage {
    pub(crate) visible_text: String,
    pub(crate) page_type: BrowserPageType,
    pub(crate) primary_content: Option<BrowserPrimaryContent>,
    #[serde(default)]
    pub(crate) readable_blocks: Vec<BrowserReadableBlock>,
    #[serde(default)]
    pub(crate) noise_diagnostics: Vec<BrowserNoiseDiagnostic>,
    #[serde(default)]
    pub(crate) visual_evidence: Vec<BrowserVisualEvidence>,
    pub(crate) text_truncated: bool,
    #[serde(default)]
    pub(crate) headings: Vec<BrowserTextNode>,
    #[serde(default)]
    pub(crate) landmarks: Vec<BrowserLandmark>,
    #[serde(default)]
    pub(crate) element_landmarks: Vec<BrowserElementLandmark>,
    #[serde(default)]
    pub(crate) content_regions: Vec<BrowserContentRegion>,
    #[serde(default)]
    pub(crate) links: Vec<BrowserActionTarget>,
    #[serde(default)]
    pub(crate) buttons: Vec<BrowserActionTarget>,
    #[serde(default)]
    pub(crate) forms: Vec<BrowserFormSummary>,
    pub(crate) selected_text: Option<String>,
    pub(crate) language_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserContextSnapshotDiagnostics {
    #[serde(default)]
    pub(crate) console: Vec<BrowserDiagnostic>,
    pub(crate) network: Option<BrowserNetworkSummary>,
    #[serde(default)]
    pub(crate) capture_warnings: Vec<BrowserDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserContextSnapshotEvidence {
    pub(crate) screenshot_ref: Option<String>,
    pub(crate) html_excerpt_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserEvidenceRecord {
    pub(crate) evidence_id: String,
    pub(crate) browser_session_id: String,
    pub(crate) snapshot_id: String,
    pub(crate) workspace_id: String,
    pub(crate) url: String,
    pub(crate) title: Option<String>,
    pub(crate) captured_at: u64,
    pub(crate) expires_at: u64,
    pub(crate) state: String,
    pub(crate) summary: String,
    pub(crate) privacy: BrowserPrivacyReport,
    pub(crate) freshness: BrowserSnapshotFreshness,
    #[serde(default)]
    pub(crate) diagnostics: Vec<BrowserDiagnostic>,
    #[serde(default)]
    pub(crate) code_candidates: Vec<BrowserCodeCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserEvidenceCleanupResult {
    pub(crate) removed_evidence_ids: Vec<String>,
    pub(crate) retained_evidence_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserContextSnapshot {
    pub(crate) snapshot_id: String,
    pub(crate) browser_session_id: String,
    pub(crate) workspace_id: String,
    pub(crate) captured_at: u64,
    pub(crate) freshness: BrowserSnapshotFreshness,
    pub(crate) source: BrowserSnapshotSource,
    pub(crate) viewport: BrowserViewportState,
    pub(crate) page: BrowserContextSnapshotPage,
    #[serde(default)]
    pub(crate) code_candidates: Vec<BrowserCodeCandidate>,
    pub(crate) diagnostics: BrowserContextSnapshotDiagnostics,
    pub(crate) evidence: BrowserContextSnapshotEvidence,
    #[serde(default)]
    pub(crate) omitted_capabilities: Vec<String>,
    pub(crate) privacy: BrowserPrivacyReport,
    pub(crate) budget: BrowserSnapshotBudget,
    pub(crate) availability: String,
}
