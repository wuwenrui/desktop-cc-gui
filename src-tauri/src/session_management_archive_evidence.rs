use std::collections::HashMap;
use std::path::Path;

use tokio::sync::Mutex;

use super::{
    build_degraded_source_status, catalog_workspace_scope, is_stable_catalog_metadata_key,
    join_partial_sources, normalize_source_statuses, normalize_workspace_id, read_catalog_metadata,
    WorkspaceSessionArchiveEvidence, WorkspaceSessionCatalogSourceStatus,
    WorkspaceSessionSourceCompleteness, SESSION_CATALOG_PARTIAL_ARCHIVE_METADATA,
};
use crate::types::WorkspaceEntry;

pub(crate) async fn list_workspace_session_archive_evidence_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
) -> Result<WorkspaceSessionArchiveEvidence, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let workspace_scope = catalog_workspace_scope(workspaces, &workspace_id).await?;
    let mut archived_at_by_session_id = HashMap::<String, i64>::new();
    let mut source_statuses = Vec::new();
    let mut partial_sources = Vec::new();
    let mut scanned_metadata_entries = 0usize;

    for workspace in workspace_scope {
        match read_catalog_metadata(storage_path, &workspace.id) {
            Ok(metadata) => {
                scanned_metadata_entries = scanned_metadata_entries
                    .saturating_add(metadata.archived_at_by_session_id.len());
                for (metadata_key, archived_at) in metadata.archived_at_by_session_id {
                    if archived_at <= 0 {
                        continue;
                    }
                    for archive_key in archive_evidence_keys_for_metadata_key(&metadata_key) {
                        archived_at_by_session_id.insert(archive_key, archived_at);
                    }
                }
            }
            Err(error) => {
                log::warn!(
                    "[session_management.archive_evidence] archive metadata unavailable for workspace {}: {}",
                    workspace.id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_ARCHIVE_METADATA.to_string());
                source_statuses.push(build_degraded_source_status(
                    "archive-metadata",
                    SESSION_CATALOG_PARTIAL_ARCHIVE_METADATA,
                ));
            }
        }
    }

    if source_statuses.is_empty() {
        source_statuses.push(WorkspaceSessionCatalogSourceStatus {
            engine: "archive-metadata".to_string(),
            completeness: WorkspaceSessionSourceCompleteness::Complete,
            reason: None,
            scanned_candidates: Some(scanned_metadata_entries),
            skipped_candidates: None,
            scan_cap_reached: Some(false),
            diagnostics: Vec::new(),
            cache: None,
        });
    }

    Ok(WorkspaceSessionArchiveEvidence {
        archived_at_by_session_id,
        partial_source: join_partial_sources(partial_sources),
        source_statuses: normalize_source_statuses(source_statuses),
    })
}

fn archive_evidence_keys_for_metadata_key(metadata_key: &str) -> Vec<String> {
    let trimmed = metadata_key.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let mut keys = vec![trimmed.to_string()];
    let parts = trimmed.splitn(3, ':').collect::<Vec<_>>();
    if parts.len() == 3 && is_stable_catalog_metadata_key(trimmed) {
        let engine = parts[0].trim().to_ascii_lowercase();
        let canonical_session_id = parts[2].trim();
        if !canonical_session_id.is_empty() {
            keys.push(canonical_session_id.to_string());
            match engine.as_str() {
                "codex" => {
                    if let Some(raw_session_id) = canonical_session_id.strip_prefix("codex:") {
                        if !raw_session_id.is_empty() {
                            keys.push(raw_session_id.to_string());
                        }
                    } else {
                        keys.push(format!("codex:{canonical_session_id}"));
                    }
                }
                "claude" | "gemini" | "opencode" | "shared" => {
                    keys.push(format!("{engine}:{canonical_session_id}"));
                }
                _ => {}
            }
        }
    }
    keys.sort();
    keys.dedup();
    keys
}
