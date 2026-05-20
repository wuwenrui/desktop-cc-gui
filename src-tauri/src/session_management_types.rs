use std::collections::HashMap;

use serde::{Deserialize, Serialize};

pub(crate) const SESSION_CATALOG_DEFAULT_LIMIT: usize = 50;
pub(crate) const SESSION_CATALOG_MAX_LIMIT: usize = 200;
pub(crate) const SESSION_CATALOG_SCAN_LOOKAHEAD: usize = 1;
pub(crate) const SESSION_CATALOG_ARCHIVE_TIMEOUT_MS: u64 = 1_500;
pub(crate) const SESSION_CATALOG_CURSOR_PREFIX: &str = "offset:";
pub(crate) const SESSION_CATALOG_PARTIAL_CODEX: &str = "codex-history-unavailable";
pub(crate) const SESSION_CATALOG_PARTIAL_CLAUDE: &str = "claude-history-unavailable";
pub(crate) const SESSION_CATALOG_PARTIAL_GEMINI: &str = "gemini-history-unavailable";
pub(crate) const SESSION_CATALOG_PARTIAL_OPENCODE: &str = "opencode-history-unavailable";
pub(crate) const SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID: &str = "__global_unassigned__";
pub(crate) const SESSION_FOLDER_ROOT_ID: &str = "__root__";
pub(crate) const SESSION_INCONSISTENCY_MISSING_ON_DISK: &str = "missing-on-disk";
pub(crate) const SESSION_DELETE_MODE_PHYSICAL: &str = "physical";
pub(crate) const SESSION_DELETE_MODE_METADATA_CLEANUP: &str = "metadata-cleanup";
pub(crate) const SESSION_DELETE_MODE_UNSUPPORTED: &str = "unsupported";
pub(crate) const SESSION_DELETE_CODE_DELETED: &str = "DELETED";
pub(crate) const SESSION_DELETE_CODE_ALREADY_MISSING_CLEANED: &str = "ALREADY_MISSING_CLEANED";
pub(crate) const SESSION_DELETE_CODE_DELETE_FAILED: &str = "DELETE_FAILED";
pub(crate) const SESSION_DELETE_CODE_UNSUPPORTED: &str = "UNSUPPORTED";
pub(crate) const SESSION_ASSIGN_CODE_FOLDER_ASSIGNED: &str = "FOLDER_ASSIGNED";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionCatalogEntry {
    pub(crate) session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) canonical_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) parent_session_id: Option<String>,
    pub(crate) workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) workspace_label: Option<String>,
    pub(crate) engine: String,
    pub(crate) title: String,
    pub(crate) updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) archived_at: Option<i64>,
    pub(crate) thread_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) attribution_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) attribution_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) attribution_confidence: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) matched_workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) matched_workspace_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) folder_id: Option<String>,
    #[serde(default)]
    pub(crate) exists_on_disk: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) inconsistency_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) delete_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) physical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) children_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionCatalogQuery {
    #[serde(default)]
    pub(crate) keyword: Option<String>,
    #[serde(default)]
    pub(crate) engine: Option<String>,
    #[serde(default)]
    pub(crate) status: Option<String>,
    #[serde(default)]
    pub(crate) folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionCatalogPage {
    pub(crate) data: Vec<WorkspaceSessionCatalogEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) partial_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionFolder {
    pub(crate) id: String,
    pub(crate) workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) parent_id: Option<String>,
    pub(crate) name: String,
    pub(crate) created_at: i64,
    pub(crate) updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionFolderTree {
    pub(crate) workspace_id: String,
    pub(crate) folders: Vec<WorkspaceSessionFolder>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionFolderMutation {
    pub(crate) folder: WorkspaceSessionFolder,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionAssignmentResponse {
    pub(crate) session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) folder_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum WorkspaceSessionProjectionScopeKind {
    Project,
    Worktree,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionProjectionSummary {
    pub(crate) scope_kind: WorkspaceSessionProjectionScopeKind,
    pub(crate) owner_workspace_ids: Vec<String>,
    pub(crate) active_total: usize,
    pub(crate) archived_total: usize,
    pub(crate) all_total: usize,
    pub(crate) filtered_total: usize,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub(crate) folder_counts_by_id: HashMap<String, usize>,
    #[serde(default)]
    pub(crate) unassigned_folder_count: usize,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) partial_sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionBatchMutationResult {
    pub(crate) session_id: String,
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) archived_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) deleted_from_disk: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) metadata_cleaned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionBatchMutationResponse {
    pub(crate) results: Vec<WorkspaceSessionBatchMutationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSessionCatalogMetadata {
    #[serde(default)]
    pub(crate) archived_at_by_session_id: HashMap<String, i64>,
    #[serde(default)]
    pub(crate) folders: Vec<WorkspaceSessionFolder>,
    #[serde(default)]
    pub(crate) folder_id_by_session_id: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub(crate) struct WorkspaceScopeCatalogData {
    pub(crate) scope_kind: WorkspaceSessionProjectionScopeKind,
    pub(crate) owner_workspace_ids: Vec<String>,
    pub(crate) entries: Vec<WorkspaceSessionCatalogEntry>,
    pub(crate) partial_sources: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum SessionCatalogScanMode {
    Bounded(usize),
    Exhaustive,
}

impl SessionCatalogScanMode {
    pub(crate) fn limit(self) -> usize {
        match self {
            SessionCatalogScanMode::Bounded(limit) => limit,
            SessionCatalogScanMode::Exhaustive => usize::MAX,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct SessionCatalogCountSummary {
    pub(crate) active_total: usize,
    pub(crate) archived_total: usize,
    pub(crate) all_total: usize,
    pub(crate) filtered_total: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionCatalogStatusFilter {
    Active,
    Archived,
    All,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionCatalogAttributionStatus {
    StrictMatch,
    InferredRelated,
    Unassigned,
}

impl SessionCatalogAttributionStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            SessionCatalogAttributionStatus::StrictMatch => "strict-match",
            SessionCatalogAttributionStatus::InferredRelated => "inferred-related",
            SessionCatalogAttributionStatus::Unassigned => "unassigned",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionCatalogAttributionReason {
    DirectWorkspacePath,
    DirectGitRoot,
    SharedWorktreeFamily,
    SharedGitRoot,
    ParentScope,
    UnassignedAmbiguous,
    UnassignedMissingEvidence,
}

impl SessionCatalogAttributionReason {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            SessionCatalogAttributionReason::DirectWorkspacePath => "direct-workspace-path",
            SessionCatalogAttributionReason::DirectGitRoot => "direct-git-root",
            SessionCatalogAttributionReason::SharedWorktreeFamily => "shared-worktree-family",
            SessionCatalogAttributionReason::SharedGitRoot => "shared-git-root",
            SessionCatalogAttributionReason::ParentScope => "parent-scope",
            SessionCatalogAttributionReason::UnassignedAmbiguous => "unassigned-ambiguous",
            SessionCatalogAttributionReason::UnassignedMissingEvidence => {
                "unassigned-missing-evidence"
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionCatalogAttributionConfidence {
    High,
    Medium,
    Low,
}

impl SessionCatalogAttributionConfidence {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            SessionCatalogAttributionConfidence::High => "high",
            SessionCatalogAttributionConfidence::Medium => "medium",
            SessionCatalogAttributionConfidence::Low => "low",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SessionCatalogAttribution {
    pub(crate) status: SessionCatalogAttributionStatus,
    pub(crate) reason: Option<SessionCatalogAttributionReason>,
    pub(crate) confidence: Option<SessionCatalogAttributionConfidence>,
    pub(crate) matched_workspace_id: Option<String>,
    pub(crate) matched_workspace_label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SessionCatalogIdentity {
    Codex { session_id: String },
    Claude { session_id: String },
    Gemini { session_id: String },
    OpenCode { session_id: String },
    Shared { session_id: String },
}

impl SessionCatalogIdentity {
    pub(crate) fn engine_name(&self) -> &'static str {
        match self {
            Self::Codex { .. } => "codex",
            Self::Claude { .. } => "claude",
            Self::Gemini { .. } => "gemini",
            Self::OpenCode { .. } => "opencode",
            Self::Shared { .. } => "shared",
        }
    }
}

pub(crate) fn parse_catalog_identity(session_id: &str) -> SessionCatalogIdentity {
    if let Some(raw_id) = session_id.strip_prefix("claude:") {
        return SessionCatalogIdentity::Claude {
            session_id: raw_id.to_string(),
        };
    }
    if let Some(raw_id) = session_id.strip_prefix("gemini:") {
        return SessionCatalogIdentity::Gemini {
            session_id: raw_id.to_string(),
        };
    }
    if let Some(raw_id) = session_id.strip_prefix("opencode:") {
        return SessionCatalogIdentity::OpenCode {
            session_id: raw_id.to_string(),
        };
    }
    if let Some(raw_id) = session_id.strip_prefix("shared:") {
        return SessionCatalogIdentity::Shared {
            session_id: raw_id.to_string(),
        };
    }
    SessionCatalogIdentity::Codex {
        session_id: session_id.to_string(),
    }
}

pub(crate) fn parse_status_filter(value: Option<&str>) -> SessionCatalogStatusFilter {
    match value
        .map(str::trim)
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "archived" => SessionCatalogStatusFilter::Archived,
        "all" => SessionCatalogStatusFilter::All,
        _ => SessionCatalogStatusFilter::Active,
    }
}

pub(crate) fn parse_catalog_cursor(cursor: Option<&str>) -> usize {
    let Some(raw_cursor) = cursor.map(str::trim).filter(|value| !value.is_empty()) else {
        return 0;
    };
    if let Some(raw_offset) = raw_cursor.strip_prefix(SESSION_CATALOG_CURSOR_PREFIX) {
        return raw_offset.parse::<usize>().unwrap_or(0);
    }
    raw_cursor.parse::<usize>().unwrap_or(0)
}

pub(crate) fn build_catalog_cursor(offset: usize) -> String {
    format!("{SESSION_CATALOG_CURSOR_PREFIX}{offset}")
}

pub(crate) fn normalize_catalog_page_limit(limit: Option<u32>) -> usize {
    limit
        .unwrap_or(SESSION_CATALOG_DEFAULT_LIMIT as u32)
        .clamp(1, SESSION_CATALOG_MAX_LIMIT as u32) as usize
}

pub(crate) fn build_catalog_scan_limit(cursor: Option<&str>, limit: Option<u32>) -> usize {
    parse_catalog_cursor(cursor)
        .saturating_add(normalize_catalog_page_limit(limit))
        .saturating_add(SESSION_CATALOG_SCAN_LOOKAHEAD)
}

pub(crate) fn query_requires_exhaustive_scan(query: &WorkspaceSessionCatalogQuery) -> bool {
    let has_keyword = query
        .keyword
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();
    if has_keyword {
        return true;
    }
    let has_folder_filter = query
        .folder_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter(|value| *value != "__all__")
        .is_some();
    if has_folder_filter {
        return true;
    }
    matches!(
        parse_status_filter(query.status.as_deref()),
        SessionCatalogStatusFilter::Archived
    )
}

pub(crate) fn build_catalog_scan_mode(
    query: &WorkspaceSessionCatalogQuery,
    cursor: Option<&str>,
    limit: Option<u32>,
) -> SessionCatalogScanMode {
    if query_requires_exhaustive_scan(query) {
        SessionCatalogScanMode::Exhaustive
    } else {
        SessionCatalogScanMode::Bounded(build_catalog_scan_limit(cursor, limit))
    }
}
