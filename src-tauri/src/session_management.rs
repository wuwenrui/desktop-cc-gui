use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde_json::json;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::engine;
use crate::local_usage;
use crate::remote_backend;
use crate::shared::codex_core;
use crate::state::AppState;
use crate::storage::{read_json_file, with_storage_lock, write_string_atomically};
use crate::types::WorkspaceEntry;

#[path = "session_management_archive_evidence.rs"]
mod session_management_archive_evidence;
#[path = "session_management_batch_assign.rs"]
mod session_management_batch_assign;
#[path = "session_management_catalog_helpers.rs"]
mod session_management_catalog_helpers;
#[path = "session_management_folder_counts.rs"]
mod session_management_folder_counts;
#[path = "session_management_related.rs"]
mod session_management_related;
#[path = "session_management_types.rs"]
mod session_management_types;

pub(crate) use session_management_archive_evidence::list_workspace_session_archive_evidence_core;
pub(crate) use session_management_batch_assign::assign_workspace_session_folders_core;
pub(crate) use session_management_related::{
    force_codex_related_query, list_project_related_sessions_core,
};
pub(crate) use session_management_types::*;

fn normalize_auto_session_metadata(
    metadata: AutoSessionMetadata,
) -> Result<AutoSessionMetadata, String> {
    let session_purpose = metadata.session_purpose.trim();
    if session_purpose.is_empty() {
        return Err("sessionPurpose is required".to_string());
    }
    if is_invalid_session_path_segment(session_purpose) {
        return Err("invalid sessionPurpose".to_string());
    }
    let owner_feature = metadata.owner_feature.trim();
    if owner_feature.is_empty() {
        return Err("ownerFeature is required".to_string());
    }
    if is_invalid_session_path_segment(owner_feature) {
        return Err("invalid ownerFeature".to_string());
    }
    Ok(AutoSessionMetadata {
        session_purpose: session_purpose.to_string(),
        visibility: metadata.visibility,
        owner_feature: owner_feature.to_string(),
        auto_archive: metadata.auto_archive,
        created_by: metadata.created_by,
    })
}

async fn forward_session_management_remote<T: DeserializeOwned>(
    state: &State<'_, AppState>,
    app: AppHandle,
    method: &str,
    params: serde_json::Value,
) -> Result<T, String> {
    let response = remote_backend::call_remote(&*state, app, method, params).await?;
    serde_json::from_value(response).map_err(|err| err.to_string())
}

async fn forward_session_management_remote_unit(
    state: &State<'_, AppState>,
    app: AppHandle,
    method: &str,
    params: serde_json::Value,
) -> Result<(), String> {
    let _: serde_json::Value =
        forward_session_management_remote(state, app, method, params).await?;
    Ok(())
}

#[cfg(test)]
use session_management_catalog_helpers::entry_matches_keyword;
use session_management_catalog_helpers::{
    build_catalog_count_summary, build_catalog_entry_stable_key, build_claude_source_fact_status,
    build_degraded_source_status, build_source_label, build_success_source_status,
    decorate_catalog_entry_for_response, entry_is_hidden_automatic_session,
    entry_matches_engine_and_keyword, entry_matches_query, entry_matches_status,
    normalize_source_statuses, source_fact_cache_dir, source_status_for_engine,
    unresolved_catalog_entry_to_diagnostic,
};
use session_management_folder_counts::{
    build_catalog_folder_count_summary, filter_catalog_entries_by_folder,
    normalize_query_folder_filter,
};

#[tauri::command]
pub(crate) async fn list_workspace_sessions(
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    list_workspace_sessions_core(
        &state.workspaces,
        &state.sessions,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        query,
        cursor,
        limit,
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_global_codex_sessions(
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    list_global_codex_sessions_core(
        &state.engine_manager,
        &state.workspaces,
        state.storage_path.as_path(),
        query,
        cursor,
        limit,
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_project_related_codex_sessions(
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    list_project_related_sessions_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        Some(force_codex_related_query(query)),
        cursor,
        limit,
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_project_related_sessions(
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    list_project_related_sessions_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        query,
        cursor,
        limit,
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_workspace_session_archive_evidence(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionArchiveEvidence, String> {
    list_workspace_session_archive_evidence_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn record_auto_session_metadata(
    workspace_id: String,
    session_id: String,
    metadata: AutoSessionMetadata,
    state: State<'_, AppState>,
) -> Result<(), String> {
    record_auto_session_metadata_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
        session_id,
        metadata,
    )
    .await
}

#[tauri::command]
pub(crate) async fn get_workspace_session_projection_summary(
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionProjectionSummary, String> {
    get_workspace_session_projection_summary_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        query,
    )
    .await
}

#[tauri::command]
pub(crate) async fn archive_workspace_sessions(
    workspace_id: String,
    session_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    archive_workspace_sessions_core(
        &state.workspaces,
        &state.sessions,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        session_ids,
    )
    .await
}

#[tauri::command]
pub(crate) async fn unarchive_workspace_sessions(
    workspace_id: String,
    session_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    unarchive_workspace_sessions_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        session_ids,
    )
    .await
}

#[tauri::command]
pub(crate) async fn delete_workspace_sessions(
    workspace_id: String,
    session_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    delete_workspace_sessions_core(
        &state.workspaces,
        &state.sessions,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        session_ids,
    )
    .await
}

#[tauri::command]
pub(crate) async fn list_workspace_session_folders(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionFolderTree, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "list_workspace_session_folders",
            json!({ "workspaceId": workspace_id }),
        )
        .await;
    }

    list_workspace_session_folders_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn create_workspace_session_folder(
    workspace_id: String,
    name: String,
    parent_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionFolderMutation, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "create_workspace_session_folder",
            json!({ "workspaceId": workspace_id, "name": name, "parentId": parent_id }),
        )
        .await;
    }

    create_workspace_session_folder_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
        name,
        parent_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn rename_workspace_session_folder(
    workspace_id: String,
    folder_id: String,
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionFolderMutation, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "rename_workspace_session_folder",
            json!({ "workspaceId": workspace_id, "folderId": folder_id, "name": name }),
        )
        .await;
    }

    rename_workspace_session_folder_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
        folder_id,
        name,
    )
    .await
}

#[tauri::command]
pub(crate) async fn move_workspace_session_folder(
    workspace_id: String,
    folder_id: String,
    parent_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionFolderMutation, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "move_workspace_session_folder",
            json!({ "workspaceId": workspace_id, "folderId": folder_id, "parentId": parent_id }),
        )
        .await;
    }

    move_workspace_session_folder_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id,
        folder_id,
        parent_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn delete_workspace_session_folder(
    workspace_id: String,
    folder_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote_unit(
            &state,
            app,
            "delete_workspace_session_folder",
            json!({ "workspaceId": workspace_id, "folderId": folder_id }),
        )
        .await;
    }

    delete_workspace_session_folder_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        folder_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn assign_workspace_session_folder(
    workspace_id: String,
    session_id: String,
    folder_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionAssignmentResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "assign_workspace_session_folder",
            json!({ "workspaceId": workspace_id, "sessionId": session_id, "folderId": folder_id }),
        )
        .await;
    }

    assign_workspace_session_folder_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        session_id,
        folder_id,
    )
    .await
}

#[tauri::command]
pub(crate) async fn assign_workspace_session_folders(
    workspace_id: String,
    session_ids: Vec<String>,
    folder_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return forward_session_management_remote(
            &state,
            app,
            "assign_workspace_session_folders",
            json!({ "workspaceId": workspace_id, "sessionIds": session_ids, "folderId": folder_id }),
        )
        .await;
    }

    assign_workspace_session_folders_core(
        &state.workspaces,
        &state.engine_manager,
        state.storage_path.as_path(),
        workspace_id,
        session_ids,
        folder_id,
    )
    .await
}

pub(crate) async fn list_workspace_sessions_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    _sessions: &Mutex<HashMap<String, std::sync::Arc<crate::codex::WorkspaceSession>>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let normalized_query = query.unwrap_or_default();
    let scan_mode = build_catalog_scan_mode(&normalized_query, cursor.as_deref(), limit);
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        scan_mode,
    )
    .await?;
    Ok(build_catalog_page(
        scope_catalog.entries,
        normalized_query,
        cursor,
        limit,
        join_partial_sources(scope_catalog.partial_sources),
        scope_catalog.source_statuses,
    ))
}

pub(crate) async fn get_workspace_session_projection_summary_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    query: Option<WorkspaceSessionCatalogQuery>,
) -> Result<WorkspaceSessionProjectionSummary, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let normalized_query = query.unwrap_or_default();
    let scan_mode = build_catalog_scan_mode(
        &normalized_query,
        None,
        Some(SESSION_CATALOG_MAX_LIMIT as u32),
    );
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        scan_mode,
    )
    .await?;
    let counts = build_catalog_count_summary(&scope_catalog.entries, &normalized_query);
    let filtered_entries = scope_catalog
        .entries
        .iter()
        .filter(|entry| entry_matches_query(entry, &normalized_query))
        .collect::<Vec<_>>();
    let folder_counts = build_catalog_folder_count_summary(&filtered_entries);
    Ok(WorkspaceSessionProjectionSummary {
        scope_kind: scope_catalog.scope_kind,
        owner_workspace_ids: scope_catalog.owner_workspace_ids,
        active_total: counts.active_total,
        archived_total: counts.archived_total,
        all_total: counts.all_total,
        filtered_total: counts.filtered_total,
        folder_counts_by_id: folder_counts.folder_counts_by_id,
        unassigned_folder_count: folder_counts.unassigned_folder_count,
        partial_sources: scope_catalog.partial_sources,
        source_statuses: scope_catalog.source_statuses,
    })
}

pub(crate) async fn list_global_codex_sessions_core(
    engine_manager: &engine::EngineManager,
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    query: Option<WorkspaceSessionCatalogQuery>,
    cursor: Option<String>,
    limit: Option<u32>,
) -> Result<WorkspaceSessionCatalogPage, String> {
    let normalized_query = query.unwrap_or_default();
    let scan_mode = build_catalog_scan_mode(&normalized_query, cursor.as_deref(), limit);
    let (entries, partial_sources) =
        build_global_engine_catalog_entries(engine_manager, workspaces, storage_path, scan_mode)
            .await?;

    Ok(build_catalog_page(
        entries,
        normalized_query,
        cursor,
        limit,
        join_partial_sources(partial_sources),
        Vec::new(),
    ))
}

async fn catalog_workspace_scope(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    workspace_id: &str,
) -> Result<Vec<WorkspaceEntry>, String> {
    let workspaces = workspaces.lock().await;
    let selected = workspaces
        .get(workspace_id)
        .cloned()
        .ok_or_else(|| "workspace not found".to_string())?;
    if selected.kind.is_worktree() {
        return Ok(vec![selected]);
    }

    let mut scoped = vec![selected.clone()];
    let mut children: Vec<WorkspaceEntry> = workspaces
        .values()
        .filter(|entry| entry.parent_id.as_deref() == Some(workspace_id))
        .cloned()
        .collect();
    children.sort_by(|left, right| {
        left.path
            .cmp(&right.path)
            .then_with(|| left.name.cmp(&right.name))
            .then_with(|| left.id.cmp(&right.id))
    });
    scoped.extend(children);
    Ok(scoped)
}

pub(crate) async fn archive_workspace_sessions_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    sessions: &Mutex<HashMap<String, std::sync::Arc<crate::codex::WorkspaceSession>>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    session_ids: Vec<String>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let _workspace_path = workspace_path_for_id(workspaces, &workspace_id).await?;
    let archived_at = now_millis();
    let mut results = Vec::new();
    let mut archive_success_targets = Vec::new();
    let normalized_session_ids = normalize_session_ids(session_ids)?;
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        SessionCatalogScanMode::Exhaustive,
    )
    .await?;
    let workspaces_snapshot = workspaces.lock().await.clone();

    for session_id in normalized_session_ids {
        match parse_catalog_identity(&session_id) {
            SessionCatalogIdentity::Shared { .. } => {
                results.push(batch_error(
                    session_id,
                    "UNSUPPORTED_SHARED_SESSION",
                    "Shared sessions are not supported in phase-one archive management",
                ));
            }
            SessionCatalogIdentity::Codex { .. } => {
                let Some(target) = resolve_session_mutation_target(
                    &scope_catalog.entries,
                    &workspaces_snapshot,
                    &session_id,
                ) else {
                    results.push(batch_error(
                        session_id,
                        "OWNER_WORKSPACE_UNRESOLVED",
                        "session does not belong to target workspace",
                    ));
                    continue;
                };
                let _ = codex_core::archive_thread_best_effort_core(
                    sessions,
                    target.owner_workspace_id.clone(),
                    target.native_session_id.clone(),
                    Duration::from_millis(SESSION_CATALOG_ARCHIVE_TIMEOUT_MS),
                )
                .await;
                archive_success_targets.push(target.clone());
                results.push(batch_success_for_target(&target, Some(archived_at)));
            }
            _ => {
                let Some(target) = resolve_session_mutation_target(
                    &scope_catalog.entries,
                    &workspaces_snapshot,
                    &session_id,
                ) else {
                    results.push(batch_error(
                        session_id,
                        "OWNER_WORKSPACE_UNRESOLVED",
                        "session does not belong to target workspace",
                    ));
                    continue;
                };
                archive_success_targets.push(target.clone());
                results.push(batch_success_for_target(&target, Some(archived_at)));
            }
        }
    }

    if !archive_success_targets.is_empty() {
        let mut targets_by_owner = HashMap::<String, Vec<WorkspaceSessionMutationTarget>>::new();
        for target in archive_success_targets {
            targets_by_owner
                .entry(target.owner_workspace_id.clone())
                .or_default()
                .push(target);
        }
        for (owner_workspace_id, targets) in targets_by_owner {
            if let Err(error) =
                with_catalog_metadata_mutation(storage_path, &owner_workspace_id, |metadata| {
                    for target in &targets {
                        metadata
                            .archived_at_by_session_id
                            .insert(target.stable_session_key.clone(), archived_at);
                    }
                    Ok(())
                })
            {
                let message = format!("failed to update archive metadata: {error}");
                replace_batch_results_for_targets(
                    &mut results,
                    &targets,
                    "ARCHIVE_METADATA_WRITE_FAILED",
                    &message,
                );
            }
        }
    }
    Ok(WorkspaceSessionBatchMutationResponse { results })
}

pub(crate) async fn unarchive_workspace_sessions_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    session_ids: Vec<String>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let _workspace_path = workspace_path_for_id(workspaces, &workspace_id).await?;
    let normalized_session_ids = normalize_session_ids(session_ids)?;
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        SessionCatalogScanMode::Exhaustive,
    )
    .await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let mut targets_by_owner = HashMap::<String, Vec<WorkspaceSessionMutationTarget>>::new();
    let mut results = Vec::new();

    for session_id in normalized_session_ids {
        let Some(target) = resolve_session_mutation_target(
            &scope_catalog.entries,
            &workspaces_snapshot,
            &session_id,
        ) else {
            results.push(batch_error(
                session_id,
                "OWNER_WORKSPACE_UNRESOLVED",
                "session does not belong to target workspace",
            ));
            continue;
        };
        targets_by_owner
            .entry(target.owner_workspace_id.clone())
            .or_default()
            .push(target);
    }

    for (owner_workspace_id, targets) in targets_by_owner {
        match with_catalog_metadata_mutation(storage_path, &owner_workspace_id, |metadata| {
            let mut owner_results = Vec::new();
            for target in &targets {
                let was_archived = target
                    .metadata_lookup_keys
                    .iter()
                    .any(|key| metadata.archived_at_by_session_id.contains_key(key));
                remove_catalog_metadata_for_target(metadata, target);
                if was_archived {
                    owner_results.push(batch_success_for_target(target, None));
                } else {
                    owner_results.push(batch_error_for_target(
                        target,
                        "NOT_ARCHIVED",
                        "Session is not archived",
                    ));
                }
            }
            Ok(owner_results)
        }) {
            Ok(owner_results) => results.extend(owner_results),
            Err(error) => {
                let message = format!("failed to update unarchive metadata: {error}");
                results.extend(targets.iter().map(|target| {
                    batch_error_for_target(target, "UNARCHIVE_METADATA_WRITE_FAILED", &message)
                }));
            }
        }
    }
    Ok(WorkspaceSessionBatchMutationResponse { results })
}

pub(crate) async fn delete_workspace_sessions_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    sessions: &Mutex<HashMap<String, std::sync::Arc<crate::codex::WorkspaceSession>>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    session_ids: Vec<String>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    let normalized_session_ids = normalize_session_ids(session_ids)?;
    let ordered_session_ids = normalized_session_ids.clone();
    let mut results = Vec::new();
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        SessionCatalogScanMode::Exhaustive,
    )
    .await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let mut results_by_session_id: HashMap<String, WorkspaceSessionBatchMutationResult> =
        HashMap::new();
    let mut metadata_cleanup_targets = Vec::new();
    let mut codex_targets_by_owner = HashMap::<String, Vec<WorkspaceSessionMutationTarget>>::new();
    let mut other_targets = Vec::new();

    for session_id in normalized_session_ids {
        let identity = parse_catalog_identity(&session_id);
        if matches!(identity, SessionCatalogIdentity::Shared { .. }) {
            results_by_session_id.insert(
                session_id.clone(),
                batch_error(
                    session_id,
                    SESSION_DELETE_CODE_UNSUPPORTED,
                    "Shared sessions are not supported in phase-one delete management",
                ),
            );
            continue;
        }
        let Some(target) = resolve_session_mutation_target(
            &scope_catalog.entries,
            &workspaces_snapshot,
            &session_id,
        ) else {
            results_by_session_id.insert(
                session_id.clone(),
                batch_error(
                    session_id,
                    "OWNER_WORKSPACE_UNRESOLVED",
                    "session does not belong to target workspace",
                ),
            );
            continue;
        };
        if !target.exists_on_disk
            || target.delete_mode.as_deref() == Some(SESSION_DELETE_MODE_METADATA_CLEANUP)
        {
            metadata_cleanup_targets.push(target.clone());
            results_by_session_id.insert(
                target.requested_session_id.clone(),
                batch_already_missing_cleaned_for_target(&target),
            );
            continue;
        }
        if target.engine.eq_ignore_ascii_case("codex") {
            codex_targets_by_owner
                .entry(target.owner_workspace_id.clone())
                .or_default()
                .push(target);
        } else {
            other_targets.push(target);
        }
    }

    for (owner_workspace_id, codex_targets) in codex_targets_by_owner {
        let raw_ids: Vec<String> = codex_targets
            .iter()
            .map(|target| target.native_session_id.clone())
            .collect();
        let delete_results = local_usage::delete_codex_sessions_for_workspace(
            workspaces,
            &owner_workspace_id,
            &raw_ids,
        )
        .await?;
        let results_by_raw_id: HashMap<_, _> = delete_results
            .into_iter()
            .map(|result| (result.session_id.clone(), result))
            .collect();

        for target in codex_targets {
            match results_by_raw_id.get(&target.native_session_id) {
                Some(result) if result.deleted => {
                    metadata_cleanup_targets.push(target.clone());
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_delete_success_for_target(&target),
                    );
                }
                Some(result)
                    if result
                        .error
                        .as_deref()
                        .map(should_settle_delete_as_success)
                        .unwrap_or(false) =>
                {
                    metadata_cleanup_targets.push(target.clone());
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_already_missing_cleaned_for_target(&target),
                    );
                }
                Some(result) => {
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_error(
                            target.requested_session_id,
                            SESSION_DELETE_CODE_DELETE_FAILED,
                            result
                                .error
                                .as_deref()
                                .unwrap_or("Failed to delete Codex session"),
                        ),
                    );
                }
                None => {
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_error(
                            target.requested_session_id,
                            SESSION_DELETE_CODE_DELETE_FAILED,
                            "Missing Codex delete result",
                        ),
                    );
                }
            }
        }
    }

    let claude_config = engine_manager
        .get_engine_config(engine::EngineType::Claude)
        .await;
    let gemini_home_dir = engine_manager
        .get_engine_config(engine::EngineType::Gemini)
        .await
        .and_then(|item| item.home_dir);
    let mut async_delete_handles: Vec<(
        WorkspaceSessionMutationTarget,
        JoinHandle<Result<(), String>>,
    )> = Vec::new();

    for target in other_targets {
        match target.engine.as_str() {
            "claude" => {
                let workspace_path = target.owner_workspace_path.clone();
                let claude_config = claude_config.clone();
                let raw_id = target.native_session_id.clone();
                let handle = tokio::spawn(async move {
                    engine::claude_history::delete_claude_session_with_config(
                        &workspace_path,
                        &raw_id,
                        claude_config.as_ref(),
                    )
                    .await
                    .map(|_| ())
                });
                async_delete_handles.push((target, handle));
            }
            "gemini" => {
                let workspace_path = target.owner_workspace_path.clone();
                let gemini_home_dir = gemini_home_dir.clone();
                let raw_id = target.native_session_id.clone();
                let handle = tokio::spawn(async move {
                    engine::gemini_history::delete_gemini_session(
                        &workspace_path,
                        &raw_id,
                        gemini_home_dir.as_deref(),
                    )
                    .await
                });
                async_delete_handles.push((target, handle));
            }
            "opencode" => {
                let deletion = engine::commands::opencode_delete_session_core(
                    workspaces,
                    engine_manager,
                    &target.owner_workspace_id,
                    &target.native_session_id,
                )
                .await
                .map(|_| ());
                match deletion {
                    Ok(()) => {
                        metadata_cleanup_targets.push(target.clone());
                        results_by_session_id.insert(
                            target.requested_session_id.clone(),
                            batch_delete_success_for_target(&target),
                        );
                    }
                    Err(error) => {
                        if should_settle_delete_as_success(&error) {
                            metadata_cleanup_targets.push(target.clone());
                            results_by_session_id.insert(
                                target.requested_session_id.clone(),
                                batch_already_missing_cleaned_for_target(&target),
                            );
                        } else {
                            results_by_session_id.insert(
                                target.requested_session_id.clone(),
                                batch_error(
                                    target.requested_session_id,
                                    SESSION_DELETE_CODE_DELETE_FAILED,
                                    &error,
                                ),
                            );
                        }
                    }
                }
            }
            _ => {
                results_by_session_id.insert(
                    target.requested_session_id.clone(),
                    batch_error(
                        target.requested_session_id,
                        SESSION_DELETE_CODE_UNSUPPORTED,
                        "Session engine is not supported by delete management",
                    ),
                );
            }
        }
    }

    for (target, handle) in async_delete_handles {
        match handle.await {
            Ok(Ok(())) => {
                metadata_cleanup_targets.push(target.clone());
                results_by_session_id.insert(
                    target.requested_session_id.clone(),
                    batch_delete_success_for_target(&target),
                );
            }
            Ok(Err(error)) => {
                if should_settle_delete_as_success(&error) {
                    metadata_cleanup_targets.push(target.clone());
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_already_missing_cleaned_for_target(&target),
                    );
                } else {
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_error(
                            target.requested_session_id,
                            SESSION_DELETE_CODE_DELETE_FAILED,
                            &error,
                        ),
                    );
                }
            }
            Err(error) => {
                log::warn!(
                    "[session_management.delete_workspace_sessions] async delete task join error for workspace {}: {}",
                    workspace_id,
                    error
                );
                results_by_session_id.insert(
                    target.requested_session_id.clone(),
                    batch_error(
                        target.requested_session_id,
                        SESSION_DELETE_CODE_DELETE_FAILED,
                        "Async delete task join error",
                    ),
                );
            }
        }
    }

    if !metadata_cleanup_targets.is_empty() {
        let mut targets_by_owner = HashMap::<String, Vec<WorkspaceSessionMutationTarget>>::new();
        for target in metadata_cleanup_targets {
            targets_by_owner
                .entry(target.owner_workspace_id.clone())
                .or_default()
                .push(target);
        }
        for (owner_workspace_id, targets) in targets_by_owner {
            if let Err(error) =
                with_catalog_metadata_mutation(storage_path, &owner_workspace_id, |metadata| {
                    for target in &targets {
                        remove_catalog_metadata_for_target(metadata, target);
                    }
                    Ok(())
                })
            {
                let message = format!("failed to clean session metadata: {error}");
                for target in &targets {
                    results_by_session_id.insert(
                        target.requested_session_id.clone(),
                        batch_error_for_target(target, "DELETE_METADATA_CLEANUP_FAILED", &message),
                    );
                }
            }
        }
    }
    for session_id in ordered_session_ids {
        if let Some(result) = results_by_session_id.remove(&session_id) {
            results.push(result);
        }
    }
    let _ = sessions;
    Ok(WorkspaceSessionBatchMutationResponse { results })
}

fn batch_success_with_code(
    session_id: String,
    archived_at: Option<i64>,
    code: Option<&str>,
    deleted_from_disk: Option<bool>,
    metadata_cleaned: Option<bool>,
) -> WorkspaceSessionBatchMutationResult {
    WorkspaceSessionBatchMutationResult {
        session_id,
        stable_session_key: None,
        owner_workspace_id: None,
        ok: true,
        archived_at,
        error: None,
        code: code.map(ToString::to_string),
        deleted_from_disk,
        metadata_cleaned,
    }
}

fn batch_success_for_target(
    target: &WorkspaceSessionMutationTarget,
    archived_at: Option<i64>,
) -> WorkspaceSessionBatchMutationResult {
    WorkspaceSessionBatchMutationResult {
        session_id: target.requested_session_id.clone(),
        stable_session_key: Some(target.stable_session_key.clone()),
        owner_workspace_id: Some(target.owner_workspace_id.clone()),
        ok: true,
        archived_at,
        error: None,
        code: None,
        deleted_from_disk: None,
        metadata_cleaned: None,
    }
}

fn batch_delete_success_for_target(
    target: &WorkspaceSessionMutationTarget,
) -> WorkspaceSessionBatchMutationResult {
    let mut result = batch_delete_success(target.requested_session_id.clone());
    result.stable_session_key = Some(target.stable_session_key.clone());
    result.owner_workspace_id = Some(target.owner_workspace_id.clone());
    result
}

fn batch_already_missing_cleaned_for_target(
    target: &WorkspaceSessionMutationTarget,
) -> WorkspaceSessionBatchMutationResult {
    let mut result = batch_already_missing_cleaned(target.requested_session_id.clone());
    result.stable_session_key = Some(target.stable_session_key.clone());
    result.owner_workspace_id = Some(target.owner_workspace_id.clone());
    result
}

fn batch_delete_success(session_id: String) -> WorkspaceSessionBatchMutationResult {
    batch_success_with_code(
        session_id,
        None,
        Some(SESSION_DELETE_CODE_DELETED),
        Some(true),
        Some(true),
    )
}

fn batch_already_missing_cleaned(session_id: String) -> WorkspaceSessionBatchMutationResult {
    batch_success_with_code(
        session_id,
        None,
        Some(SESSION_DELETE_CODE_ALREADY_MISSING_CLEANED),
        Some(false),
        Some(true),
    )
}

fn batch_error(session_id: String, code: &str, error: &str) -> WorkspaceSessionBatchMutationResult {
    WorkspaceSessionBatchMutationResult {
        session_id,
        stable_session_key: None,
        owner_workspace_id: None,
        ok: false,
        archived_at: None,
        error: Some(error.to_string()),
        code: Some(code.to_string()),
        deleted_from_disk: None,
        metadata_cleaned: None,
    }
}

fn batch_error_for_target(
    target: &WorkspaceSessionMutationTarget,
    code: &str,
    error: &str,
) -> WorkspaceSessionBatchMutationResult {
    let mut result = batch_error(target.requested_session_id.clone(), code, error);
    result.stable_session_key = Some(target.stable_session_key.clone());
    result.owner_workspace_id = Some(target.owner_workspace_id.clone());
    result
}

fn replace_batch_results_for_targets(
    results: &mut [WorkspaceSessionBatchMutationResult],
    targets: &[WorkspaceSessionMutationTarget],
    code: &str,
    error: &str,
) {
    for target in targets {
        if let Some(result) = results.iter_mut().find(|result| {
            result.session_id == target.requested_session_id
                && result.stable_session_key.as_deref() == Some(target.stable_session_key.as_str())
        }) {
            *result = batch_error_for_target(target, code, error);
        }
    }
}

fn should_settle_delete_as_success(error: &str) -> bool {
    let normalized = error.trim().to_ascii_lowercase();
    if normalized.contains("invalid claude session id")
        || normalized.contains("invalid gemini session id")
        || normalized.contains("invalid opencode session id")
    {
        return false;
    }
    normalized.contains("session file not found")
        || normalized.contains("session not found")
        || normalized.contains("thread not found")
}

fn normalize_workspace_id(workspace_id: &str) -> Result<String, String> {
    let normalized = workspace_id.trim();
    if normalized.is_empty() {
        return Err("workspace_id is required".to_string());
    }
    Ok(normalized.to_string())
}

fn normalize_session_ids(session_ids: Vec<String>) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();
    for session_id in session_ids {
        let trimmed = session_id.trim();
        if trimmed.is_empty() {
            return Err("session_ids must not contain empty values".to_string());
        }
        if is_invalid_session_path_segment(trimmed) {
            return Err("invalid session_id".to_string());
        }
        if seen.insert(trimmed.to_string()) {
            normalized.push(trimmed.to_string());
        }
    }
    Ok(normalized)
}

fn normalize_folder_id(folder_id: &str) -> Result<String, String> {
    let normalized = folder_id.trim();
    if normalized.is_empty() {
        return Err("folder_id is required".to_string());
    }
    if normalized == SESSION_FOLDER_ROOT_ID
        || normalized == SESSION_FOLDER_SYSTEM_AUTO_ID
        || is_invalid_session_path_segment(normalized)
    {
        return Err("invalid folder_id".to_string());
    }
    Ok(normalized.to_string())
}

fn normalize_optional_folder_id(folder_id: Option<String>) -> Result<Option<String>, String> {
    match folder_id {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() || trimmed == SESSION_FOLDER_ROOT_ID {
                Ok(None)
            } else {
                Ok(Some(normalize_folder_id(trimmed)?))
            }
        }
        None => Ok(None),
    }
}

fn normalize_folder_name(name: &str) -> Result<String, String> {
    let normalized = name.trim();
    if normalized.is_empty() {
        return Err("folder name is required".to_string());
    }
    if normalized.len() > 120 {
        return Err("folder name is too long".to_string());
    }
    Ok(normalized.to_string())
}

fn is_invalid_session_path_segment(session_id: &str) -> bool {
    session_id == "."
        || session_id.contains('/')
        || session_id.contains('\\')
        || session_id.contains("..")
}

async fn workspace_path_for_id(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    workspace_id: &str,
) -> Result<PathBuf, String> {
    let workspaces = workspaces.lock().await;
    workspaces
        .get(workspace_id)
        .map(|entry| PathBuf::from(&entry.path))
        .ok_or_else(|| "workspace not found".to_string())
}

fn build_catalog_entry_dedupe_key(entry: &WorkspaceSessionCatalogEntry) -> String {
    format!(
        "{}::{}::{}",
        entry.engine, entry.workspace_id, entry.session_id
    )
}

fn mark_entry_as_existing_on_disk(entry: &mut WorkspaceSessionCatalogEntry) {
    entry.exists_on_disk = true;
    entry.inconsistency_code = None;
    entry.delete_mode = Some(SESSION_DELETE_MODE_PHYSICAL.to_string());
}

fn build_metadata_orphan_entry(
    workspace: &WorkspaceEntry,
    session_id: &str,
    archived_at: Option<i64>,
    folder_id: Option<String>,
    auto_session: Option<AutoSessionMetadata>,
) -> WorkspaceSessionCatalogEntry {
    let identity = parse_catalog_identity(session_id);
    let folder_id = if auto_session
        .as_ref()
        .is_some_and(|metadata| metadata.visibility == AutoSessionVisibility::SystemAuto)
    {
        Some(SESSION_FOLDER_SYSTEM_AUTO_ID.to_string())
    } else {
        folder_id
    };
    WorkspaceSessionCatalogEntry {
        session_id: session_id.to_string(),
        stable_session_key: None,
        canonical_session_id: Some(session_id.to_string()),
        parent_session_id: None,
        workspace_id: workspace.id.clone(),
        workspace_label: Some(workspace.name.clone()),
        engine: identity.engine_name().to_string(),
        title: "Missing session".to_string(),
        updated_at: archived_at.unwrap_or(0).max(0),
        archived_at,
        thread_kind: "native".to_string(),
        source: None,
        source_label: None,
        source_completeness: None,
        source_status_reason: None,
        size_bytes: None,
        cwd: None,
        attribution_status: Some(
            SessionCatalogAttributionStatus::StrictMatch
                .as_str()
                .to_string(),
        ),
        attribution_reason: Some(
            SessionCatalogAttributionReason::SourceIncomplete
                .as_str()
                .to_string(),
        ),
        attribution_confidence: Some(
            SessionCatalogAttributionConfidence::Low
                .as_str()
                .to_string(),
        ),
        matched_workspace_id: Some(workspace.id.clone()),
        matched_workspace_label: Some(workspace.name.clone()),
        folder_id,
        auto_session,
        exists_on_disk: false,
        inconsistency_code: Some(SESSION_INCONSISTENCY_MISSING_ON_DISK.to_string()),
        delete_mode: Some(SESSION_DELETE_MODE_METADATA_CLEANUP.to_string()),
        physical_path: None,
        children_count: None,
    }
}

fn finalize_existing_catalog_entry(
    mut entry: WorkspaceSessionCatalogEntry,
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
) -> WorkspaceSessionCatalogEntry {
    mark_entry_as_existing_on_disk(&mut entry);
    apply_folder_assignment(&mut entry, metadata_by_workspace_id);
    apply_auto_session_metadata(&mut entry, metadata_by_workspace_id);
    entry
}

fn append_metadata_orphan_entries(
    entries: &mut Vec<WorkspaceSessionCatalogEntry>,
    workspace: &WorkspaceEntry,
    metadata: &WorkspaceSessionCatalogMetadata,
    source_statuses: &[WorkspaceSessionCatalogSourceStatus],
) {
    let existing_session_ids = entries
        .iter()
        .filter(|entry| entry.workspace_id == workspace.id)
        .flat_map(catalog_metadata_lookup_keys_for_entry)
        .collect::<HashSet<_>>();

    let mut metadata_session_ids = metadata
        .archived_at_by_session_id
        .keys()
        .chain(metadata.folder_id_by_session_id.keys())
        .chain(metadata.auto_session_by_session_id.keys())
        .cloned()
        .collect::<Vec<_>>();
    metadata_session_ids.sort();
    metadata_session_ids.dedup();

    for session_id in metadata_session_ids {
        if existing_session_ids.contains(&session_id) {
            continue;
        }
        let engine = parse_catalog_identity(&session_id).engine_name();
        if source_status_is_incomplete_for_engine(source_statuses, engine) {
            continue;
        }
        let auto_session =
            auto_session_metadata_for_session(metadata, &workspace.id, &session_id, engine)
                .cloned();
        if auto_session
            .as_ref()
            .is_some_and(|metadata| metadata.visibility == AutoSessionVisibility::Hidden)
        {
            continue;
        }
        let folder_id =
            folder_assignment_for_session(metadata, &workspace.id, &session_id, engine).cloned();
        entries.push(build_metadata_orphan_entry(
            workspace,
            &session_id,
            archived_at_for_session(metadata, &workspace.id, &session_id),
            folder_id,
            auto_session,
        ));
    }
}

fn apply_children_counts(entries: &mut [WorkspaceSessionCatalogEntry]) {
    let mut children_by_parent = HashMap::<String, usize>::new();
    for entry in entries.iter() {
        let Some(parent_id) = entry.parent_session_id.as_deref() else {
            continue;
        };
        *children_by_parent.entry(parent_id.to_string()).or_insert(0) += 1;
    }
    for entry in entries.iter_mut() {
        if let Some(count) = children_by_parent.get(&entry.session_id).copied() {
            entry.children_count = Some(count);
        }
    }
}

fn push_orphan_entries_for_scope(
    entries: &mut Vec<WorkspaceSessionCatalogEntry>,
    workspace_scope: &[WorkspaceEntry],
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
    source_statuses: &[WorkspaceSessionCatalogSourceStatus],
) {
    for workspace in workspace_scope {
        if let Some(metadata) = metadata_by_workspace_id.get(&workspace.id) {
            append_metadata_orphan_entries(entries, workspace, metadata, source_statuses);
        }
    }
}

fn source_status_is_incomplete_for_engine(
    source_statuses: &[WorkspaceSessionCatalogSourceStatus],
    engine: &str,
) -> bool {
    source_status_for_engine(source_statuses, engine)
        .map(|status| {
            matches!(
                status.completeness,
                WorkspaceSessionSourceCompleteness::Partial
                    | WorkspaceSessionSourceCompleteness::Degraded
                    | WorkspaceSessionSourceCompleteness::UncertainEmpty
            )
        })
        .unwrap_or(false)
}

fn should_replace_global_entry(
    current: &WorkspaceSessionCatalogEntry,
    candidate: &WorkspaceSessionCatalogEntry,
) -> bool {
    let current_resolved = current.workspace_id != SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID;
    let candidate_resolved = candidate.workspace_id != SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID;
    if current_resolved != candidate_resolved {
        return candidate_resolved;
    }
    candidate.updated_at > current.updated_at
}
fn catalog_metadata_path(storage_path: &Path, workspace_id: &str) -> Result<PathBuf, String> {
    let data_dir = storage_path
        .parent()
        .ok_or_else(|| format!("storage path has no parent: {}", storage_path.display()))?;
    Ok(data_dir
        .join("session-management")
        .join("workspaces")
        .join(format!("{workspace_id}.json")))
}

fn read_catalog_metadata(
    storage_path: &Path,
    workspace_id: &str,
) -> Result<WorkspaceSessionCatalogMetadata, String> {
    let path = catalog_metadata_path(storage_path, workspace_id)?;
    Ok(read_json_file::<WorkspaceSessionCatalogMetadata>(&path)?.unwrap_or_default())
}

pub(crate) fn read_workspace_session_folder_assignments(
    storage_path: &Path,
    workspace_id: &str,
) -> Result<HashMap<String, String>, String> {
    Ok(read_catalog_metadata(storage_path, workspace_id)?.folder_id_by_session_id)
}

fn read_catalog_metadata_for_scope(
    storage_path: &Path,
    workspaces: &[WorkspaceEntry],
) -> Result<HashMap<String, WorkspaceSessionCatalogMetadata>, String> {
    let mut metadata_by_workspace_id = HashMap::new();
    for workspace in workspaces {
        metadata_by_workspace_id.insert(
            workspace.id.clone(),
            read_catalog_metadata(storage_path, &workspace.id)?,
        );
    }
    Ok(metadata_by_workspace_id)
}

fn write_catalog_metadata_unlocked(
    path: &Path,
    metadata: &WorkspaceSessionCatalogMetadata,
) -> Result<(), String> {
    let data = serde_json::to_string_pretty(metadata)
        .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
    write_string_atomically(path, &data)
}

fn read_catalog_metadata_from_path(path: &Path) -> Result<WorkspaceSessionCatalogMetadata, String> {
    Ok(read_json_file::<WorkspaceSessionCatalogMetadata>(path)?.unwrap_or_default())
}

fn with_catalog_metadata_mutation<T>(
    storage_path: &Path,
    workspace_id: &str,
    mutation: impl FnOnce(&mut WorkspaceSessionCatalogMetadata) -> Result<T, String>,
) -> Result<T, String> {
    let path = catalog_metadata_path(storage_path, workspace_id)?;
    with_storage_lock(&path, || {
        let mut metadata = read_catalog_metadata_from_path(&path)?;
        let result = mutation(&mut metadata)?;
        write_catalog_metadata_unlocked(&path, &metadata)?;
        Ok(result)
    })
}

async fn ensure_workspace_exists(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    workspace_id: &str,
) -> Result<(), String> {
    let workspaces = workspaces.lock().await;
    if workspaces.contains_key(workspace_id) {
        Ok(())
    } else {
        Err("workspace not found".to_string())
    }
}

fn sort_workspace_session_folders(folders: &mut [WorkspaceSessionFolder]) {
    folders.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
}

fn folder_exists(metadata: &WorkspaceSessionCatalogMetadata, folder_id: &str) -> bool {
    metadata.folders.iter().any(|folder| folder.id == folder_id)
}

fn folder_subtree_ids(
    metadata: &WorkspaceSessionCatalogMetadata,
    folder_id: &str,
) -> HashSet<String> {
    let mut subtree_ids = HashSet::from([folder_id.to_string()]);
    loop {
        let previous_len = subtree_ids.len();
        for folder in &metadata.folders {
            let parent_in_subtree = folder
                .parent_id
                .as_deref()
                .map(|parent_id| subtree_ids.contains(parent_id))
                .unwrap_or(false);
            if parent_in_subtree {
                subtree_ids.insert(folder.id.clone());
            }
        }
        if subtree_ids.len() == previous_len {
            return subtree_ids;
        }
    }
}

fn would_create_folder_cycle(
    metadata: &WorkspaceSessionCatalogMetadata,
    folder_id: &str,
    parent_id: Option<&str>,
) -> bool {
    let Some(mut current_parent_id) = parent_id else {
        return false;
    };
    if current_parent_id == folder_id {
        return true;
    }

    let parent_by_id: HashMap<&str, Option<&str>> = metadata
        .folders
        .iter()
        .map(|folder| (folder.id.as_str(), folder.parent_id.as_deref()))
        .collect();

    let mut seen = HashSet::new();
    loop {
        if !seen.insert(current_parent_id) {
            return true;
        }
        if current_parent_id == folder_id {
            return true;
        }
        match parent_by_id.get(current_parent_id).copied().flatten() {
            Some(next_parent_id) => current_parent_id = next_parent_id,
            None => return false,
        }
    }
}

fn apply_folder_assignment(
    entry: &mut WorkspaceSessionCatalogEntry,
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
) {
    entry.folder_id = metadata_by_workspace_id
        .get(&entry.workspace_id)
        .and_then(|metadata| folder_assignment_for_entry(metadata, entry))
        .cloned();
}

fn auto_session_metadata_for_entry<'a>(
    metadata: &'a WorkspaceSessionCatalogMetadata,
    entry: &WorkspaceSessionCatalogEntry,
) -> Option<&'a AutoSessionMetadata> {
    catalog_metadata_lookup_keys_for_entry(entry)
        .into_iter()
        .find_map(|key| metadata.auto_session_by_session_id.get(&key))
}

fn apply_auto_session_metadata(
    entry: &mut WorkspaceSessionCatalogEntry,
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
) {
    let Some(metadata) = metadata_by_workspace_id.get(&entry.workspace_id) else {
        return;
    };
    let Some(auto_session) = auto_session_metadata_for_entry(metadata, entry).cloned() else {
        return;
    };
    if auto_session.visibility == AutoSessionVisibility::SystemAuto {
        entry.folder_id = Some(SESSION_FOLDER_SYSTEM_AUTO_ID.to_string());
    }
    entry.auto_session = Some(auto_session);
}

fn auto_session_metadata_for_session<'a>(
    metadata: &'a WorkspaceSessionCatalogMetadata,
    workspace_id: &str,
    session_id: &str,
    engine: &str,
) -> Option<&'a AutoSessionMetadata> {
    catalog_metadata_lookup_keys_for_session(workspace_id, session_id, engine)
        .into_iter()
        .find_map(|key| metadata.auto_session_by_session_id.get(&key))
}

fn apply_strict_attribution_owner(
    mut entry: WorkspaceSessionCatalogEntry,
    workspaces_snapshot: &HashMap<String, WorkspaceEntry>,
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
) -> WorkspaceSessionCatalogEntry {
    let attribution = resolve_catalog_entry_attribution(workspaces_snapshot, &entry);
    if attribution.status == SessionCatalogAttributionStatus::StrictMatch {
        if let Some(matched_workspace_id) = attribution.matched_workspace_id.clone() {
            if let Some(matched_workspace) = workspaces_snapshot.get(&matched_workspace_id) {
                entry.workspace_id = matched_workspace.id.clone();
                entry.workspace_label = Some(matched_workspace.name.clone());
                entry.archived_at = metadata_by_workspace_id
                    .get(&matched_workspace.id)
                    .and_then(|metadata| archived_at_for_entry(metadata, &entry));
            }
        }
    }
    apply_attribution_to_entry(entry, attribution)
}

fn is_stable_catalog_metadata_key(session_id: &str) -> bool {
    let mut parts = session_id.splitn(3, ':');
    let engine = parts.next().unwrap_or_default();
    let workspace_id = parts.next().unwrap_or_default();
    let canonical_session_id = parts.next().unwrap_or_default();
    matches!(
        engine,
        "codex" | "claude" | "gemini" | "opencode" | "shared"
    ) && !workspace_id.trim().is_empty()
        && !canonical_session_id.trim().is_empty()
}

fn metadata_stable_key_for_session_id(workspace_id: &str, session_id: &str) -> String {
    if is_stable_catalog_metadata_key(session_id) {
        return session_id.trim().to_string();
    }
    let identity = parse_catalog_identity(session_id);
    format!(
        "{}:{}:{}",
        identity.engine_name(),
        workspace_id,
        identity.raw_session_id()
    )
}

fn folder_assignment_keys_for_session(session_id: &str, engine: &str) -> Vec<String> {
    let trimmed_session_id = session_id.trim();
    let normalized_engine = engine.trim().to_ascii_lowercase();
    let mut keys = Vec::new();
    if trimmed_session_id.is_empty() {
        return keys;
    }

    keys.push(trimmed_session_id.to_string());
    if normalized_engine == "codex" {
        if let Some(raw_session_id) = trimmed_session_id.strip_prefix("codex:") {
            if !raw_session_id.is_empty() {
                keys.push(raw_session_id.to_string());
            }
        } else {
            keys.push(format!("codex:{trimmed_session_id}"));
        }
    }
    keys.sort();
    keys.dedup();
    keys
}

fn catalog_metadata_lookup_keys_for_entry(entry: &WorkspaceSessionCatalogEntry) -> Vec<String> {
    let mut keys = Vec::new();
    if let Some(stable_key) = entry
        .stable_session_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        keys.push(stable_key.to_string());
    } else {
        keys.push(build_catalog_entry_stable_key(entry));
    }
    keys.extend(folder_assignment_keys_for_session(
        &entry.session_id,
        &entry.engine,
    ));
    keys.sort();
    keys.dedup();
    keys
}

fn catalog_metadata_lookup_keys_for_session(
    workspace_id: &str,
    session_id: &str,
    engine: &str,
) -> Vec<String> {
    let mut keys = vec![metadata_stable_key_for_session_id(workspace_id, session_id)];
    keys.extend(folder_assignment_keys_for_session(session_id, engine));
    keys.sort();
    keys.dedup();
    keys
}

fn archived_at_for_entry(
    metadata: &WorkspaceSessionCatalogMetadata,
    entry: &WorkspaceSessionCatalogEntry,
) -> Option<i64> {
    catalog_metadata_lookup_keys_for_entry(entry)
        .into_iter()
        .find_map(|key| metadata.archived_at_by_session_id.get(&key).copied())
}

fn archived_at_for_session(
    metadata: &WorkspaceSessionCatalogMetadata,
    workspace_id: &str,
    session_id: &str,
) -> Option<i64> {
    let engine = parse_catalog_identity(session_id).engine_name();
    catalog_metadata_lookup_keys_for_session(workspace_id, session_id, engine)
        .into_iter()
        .find_map(|key| metadata.archived_at_by_session_id.get(&key).copied())
}

fn folder_assignment_for_session<'a>(
    metadata: &'a WorkspaceSessionCatalogMetadata,
    workspace_id: &str,
    session_id: &str,
    engine: &str,
) -> Option<&'a String> {
    catalog_metadata_lookup_keys_for_session(workspace_id, session_id, engine)
        .into_iter()
        .find_map(|key| metadata.folder_id_by_session_id.get(&key))
}

fn folder_assignment_for_entry<'a>(
    metadata: &'a WorkspaceSessionCatalogMetadata,
    entry: &WorkspaceSessionCatalogEntry,
) -> Option<&'a String> {
    catalog_metadata_lookup_keys_for_entry(entry)
        .into_iter()
        .find_map(|key| metadata.folder_id_by_session_id.get(&key))
}

fn remove_folder_assignment_for_session(
    metadata: &mut WorkspaceSessionCatalogMetadata,
    workspace_id: &str,
    session_id: &str,
    engine: &str,
) {
    for key in catalog_metadata_lookup_keys_for_session(workspace_id, session_id, engine) {
        metadata.folder_id_by_session_id.remove(&key);
    }
}

#[cfg(test)]
fn remove_catalog_metadata_for_session(
    metadata: &mut WorkspaceSessionCatalogMetadata,
    workspace_id: &str,
    session_id: &str,
) {
    let engine = parse_catalog_identity(session_id).engine_name();
    for key in catalog_metadata_lookup_keys_for_session(workspace_id, session_id, engine) {
        metadata.archived_at_by_session_id.remove(&key);
        metadata.folder_id_by_session_id.remove(&key);
        metadata.auto_session_by_session_id.remove(&key);
    }
}

fn remove_catalog_metadata_for_target(
    metadata: &mut WorkspaceSessionCatalogMetadata,
    target: &WorkspaceSessionMutationTarget,
) {
    for key in &target.metadata_lookup_keys {
        metadata.archived_at_by_session_id.remove(key);
        metadata.folder_id_by_session_id.remove(key);
        metadata.auto_session_by_session_id.remove(key);
    }
}

fn build_claude_attribution_scopes(
    workspace: &WorkspaceEntry,
) -> Vec<engine::claude_history::ClaudeSessionAttributionScope> {
    let mut scopes = Vec::new();
    let mut seen = HashSet::new();

    let workspace_path = PathBuf::from(&workspace.path);
    if seen.insert(workspace_path.to_string_lossy().to_string()) {
        scopes.push(
            engine::claude_history::ClaudeSessionAttributionScope::workspace_path(workspace_path),
        );
    }

    if let Some(git_root) = workspace
        .settings
        .git_root
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let git_root_path = PathBuf::from(git_root);
        if seen.insert(git_root_path.to_string_lossy().to_string()) {
            scopes.push(
                engine::claude_history::ClaudeSessionAttributionScope::git_root(git_root_path),
            );
        }
    }

    scopes
}

pub(crate) async fn list_workspace_session_folders_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
) -> Result<WorkspaceSessionFolderTree, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let mut metadata = read_catalog_metadata(storage_path, &workspace_id)?;
    if metadata
        .auto_session_by_session_id
        .values()
        .any(|metadata| metadata.visibility == AutoSessionVisibility::SystemAuto)
    {
        metadata
            .folders
            .push(system_auto_session_folder(&workspace_id));
    }
    sort_workspace_session_folders(&mut metadata.folders);
    Ok(WorkspaceSessionFolderTree {
        workspace_id,
        folders: metadata.folders,
    })
}

fn system_auto_session_folder(workspace_id: &str) -> WorkspaceSessionFolder {
    WorkspaceSessionFolder {
        id: SESSION_FOLDER_SYSTEM_AUTO_ID.to_string(),
        workspace_id: workspace_id.to_string(),
        parent_id: None,
        name: "system-auto".to_string(),
        created_at: 0,
        updated_at: 0,
    }
}

pub(crate) async fn record_auto_session_metadata_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
    session_id: String,
    metadata: AutoSessionMetadata,
) -> Result<(), String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let session_id = normalize_session_ids(vec![session_id])?
        .into_iter()
        .next()
        .ok_or_else(|| "session_id is required".to_string())?;
    let metadata = normalize_auto_session_metadata(metadata)?;
    let engine = parse_catalog_identity(&session_id)
        .engine_name()
        .to_string();
    let stable_key = metadata_stable_key_for_session_id(&workspace_id, &session_id);
    with_catalog_metadata_mutation(storage_path, &workspace_id, |stored| {
        stored
            .auto_session_by_session_id
            .insert(stable_key, metadata.clone());
        for key in folder_assignment_keys_for_session(&session_id, &engine) {
            stored
                .auto_session_by_session_id
                .insert(key, metadata.clone());
        }
        Ok(())
    })
}

pub(crate) async fn create_workspace_session_folder_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
    name: String,
    parent_id: Option<String>,
) -> Result<WorkspaceSessionFolderMutation, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let name = normalize_folder_name(&name)?;
    let parent_id = normalize_optional_folder_id(parent_id)?;

    with_catalog_metadata_mutation(storage_path, &workspace_id, |metadata| {
        if let Some(parent_id) = parent_id.as_deref() {
            if !folder_exists(metadata, parent_id) {
                return Err("target folder not found".to_string());
            }
        }

        let now = now_millis();
        let folder = WorkspaceSessionFolder {
            id: uuid::Uuid::new_v4().to_string(),
            workspace_id: workspace_id.clone(),
            parent_id,
            name,
            created_at: now,
            updated_at: now,
        };
        metadata.folders.push(folder.clone());
        sort_workspace_session_folders(&mut metadata.folders);
        Ok(WorkspaceSessionFolderMutation { folder })
    })
}

pub(crate) async fn rename_workspace_session_folder_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
    folder_id: String,
    name: String,
) -> Result<WorkspaceSessionFolderMutation, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let folder_id = normalize_folder_id(&folder_id)?;
    let name = normalize_folder_name(&name)?;

    with_catalog_metadata_mutation(storage_path, &workspace_id, |metadata| {
        let folder = metadata
            .folders
            .iter_mut()
            .find(|folder| folder.id == folder_id)
            .ok_or_else(|| "folder not found".to_string())?;
        folder.name = name;
        folder.updated_at = now_millis();
        let updated = folder.clone();
        sort_workspace_session_folders(&mut metadata.folders);
        Ok(WorkspaceSessionFolderMutation { folder: updated })
    })
}

pub(crate) async fn move_workspace_session_folder_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    workspace_id: String,
    folder_id: String,
    parent_id: Option<String>,
) -> Result<WorkspaceSessionFolderMutation, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let folder_id = normalize_folder_id(&folder_id)?;
    let parent_id = normalize_optional_folder_id(parent_id)?;

    with_catalog_metadata_mutation(storage_path, &workspace_id, |metadata| {
        if !folder_exists(metadata, &folder_id) {
            return Err("folder not found".to_string());
        }
        if let Some(parent_id) = parent_id.as_deref() {
            if !folder_exists(metadata, parent_id) {
                return Err("target folder not found".to_string());
            }
        }
        if would_create_folder_cycle(metadata, &folder_id, parent_id.as_deref()) {
            return Err("folder tree cannot contain cycles".to_string());
        }

        let folder = metadata
            .folders
            .iter_mut()
            .find(|folder| folder.id == folder_id)
            .ok_or_else(|| "folder not found".to_string())?;
        folder.parent_id = parent_id;
        folder.updated_at = now_millis();
        let updated = folder.clone();
        sort_workspace_session_folders(&mut metadata.folders);
        Ok(WorkspaceSessionFolderMutation { folder: updated })
    })
}

pub(crate) async fn delete_workspace_session_folder_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    _engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    folder_id: String,
) -> Result<(), String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let folder_id = normalize_folder_id(&folder_id)?;

    with_catalog_metadata_mutation(storage_path, &workspace_id, |metadata| {
        let promoted_parent_id = metadata
            .folders
            .iter()
            .find(|folder| folder.id == folder_id)
            .map(|folder| folder.parent_id.clone())
            .ok_or_else(|| "folder not found".to_string())?
            .filter(|parent_id| folder_exists(metadata, parent_id));
        let subtree_ids = folder_subtree_ids(metadata, &folder_id);
        match promoted_parent_id {
            Some(parent_id) if !subtree_ids.contains(&parent_id) => {
                for assigned_folder_id in metadata.folder_id_by_session_id.values_mut() {
                    if subtree_ids.contains(assigned_folder_id) {
                        *assigned_folder_id = parent_id.clone();
                    }
                }
            }
            _ => {
                metadata
                    .folder_id_by_session_id
                    .retain(|_, assigned_folder_id| !subtree_ids.contains(assigned_folder_id));
            }
        }
        metadata
            .folders
            .retain(|folder| !subtree_ids.contains(&folder.id));
        Ok(())
    })
}

pub(crate) async fn assign_workspace_session_folder_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    session_id: String,
    folder_id: Option<String>,
) -> Result<WorkspaceSessionAssignmentResponse, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let session_id = normalize_session_ids(vec![session_id])?
        .into_iter()
        .next()
        .ok_or_else(|| "session_id is required".to_string())?;
    let folder_id = normalize_optional_folder_id(folder_id)?;
    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        SessionCatalogScanMode::Exhaustive,
    )
    .await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let target =
        resolve_session_mutation_target(&scope_catalog.entries, &workspaces_snapshot, &session_id)
            .filter(|target| target.exists_on_disk)
            .ok_or_else(|| "session does not belong to target workspace".to_string())?;

    with_catalog_metadata_mutation(storage_path, &target.owner_workspace_id, |metadata| {
        if let Some(folder_id) = folder_id.as_deref() {
            if !folder_exists(metadata, folder_id) {
                return Err("target folder not found".to_string());
            }
        }

        remove_folder_assignment_for_session(
            metadata,
            &target.owner_workspace_id,
            &target.stable_session_key,
            &target.engine,
        );
        for key in &target.metadata_lookup_keys {
            metadata.folder_id_by_session_id.remove(key);
        }
        if let Some(folder_id) = folder_id.clone() {
            metadata
                .folder_id_by_session_id
                .insert(target.stable_session_key.clone(), folder_id);
        }
        Ok(WorkspaceSessionAssignmentResponse {
            session_id,
            folder_id,
        })
    })
}

#[derive(Debug, Clone)]
struct WorkspaceSessionMutationTarget {
    requested_session_id: String,
    stable_session_key: String,
    metadata_lookup_keys: Vec<String>,
    owner_workspace_id: String,
    owner_workspace_path: PathBuf,
    native_session_id: String,
    engine: String,
    exists_on_disk: bool,
    delete_mode: Option<String>,
}

fn find_session_entry_in_workspace_scope<'a>(
    entries: &'a [WorkspaceSessionCatalogEntry],
    session_id: &str,
    session_engine: &str,
) -> Option<&'a WorkspaceSessionCatalogEntry> {
    entries.iter().find(|entry| {
        entry.engine.eq_ignore_ascii_case(session_engine)
            && entry.workspace_id != SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID
            && catalog_metadata_lookup_keys_for_entry(entry)
                .iter()
                .any(|key| key == session_id)
    })
}

fn resolve_session_mutation_target(
    entries: &[WorkspaceSessionCatalogEntry],
    workspaces: &HashMap<String, WorkspaceEntry>,
    session_id: &str,
) -> Option<WorkspaceSessionMutationTarget> {
    let identity = parse_catalog_identity(session_id);
    let session_engine = identity.engine_name();
    let entry = find_session_entry_in_workspace_scope(entries, session_id, session_engine)?;
    let owner_workspace = workspaces.get(&entry.workspace_id)?;
    let stable_session_key = entry
        .stable_session_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| build_catalog_entry_stable_key(entry));
    let metadata_lookup_keys = catalog_metadata_lookup_keys_for_entry(entry);
    let native_session_id = entry
        .canonical_session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| {
            parse_catalog_identity(&entry.session_id)
                .raw_session_id()
                .to_string()
        });

    Some(WorkspaceSessionMutationTarget {
        requested_session_id: session_id.to_string(),
        stable_session_key,
        metadata_lookup_keys,
        owner_workspace_id: entry.workspace_id.clone(),
        owner_workspace_path: PathBuf::from(&owner_workspace.path),
        native_session_id,
        engine: entry.engine.clone(),
        exists_on_disk: entry.exists_on_disk,
        delete_mode: entry.delete_mode.clone(),
    })
}
fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_millis(0))
        .as_millis() as i64
}

fn join_partial_sources(partial_sources: Vec<String>) -> Option<String> {
    let deduped = normalize_partial_sources(partial_sources);
    if deduped.is_empty() {
        None
    } else {
        Some(deduped.join(","))
    }
}

fn normalize_partial_sources(partial_sources: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::new();
    let mut seen = HashSet::new();
    for partial_source in partial_sources {
        let normalized = partial_source.trim();
        if normalized.is_empty() {
            continue;
        }
        if seen.insert(normalized.to_string()) {
            deduped.push(normalized.to_string());
        }
    }
    deduped
}

async fn build_global_codex_catalog_entries(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    scan_mode: SessionCatalogScanMode,
) -> Result<Vec<WorkspaceSessionCatalogEntry>, String> {
    let global_summaries =
        local_usage::list_global_codex_session_summaries(workspaces, scan_mode.limit()).await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let metadata_by_workspace_id = read_catalog_metadata_for_scope(
        storage_path,
        &workspaces_snapshot.values().cloned().collect::<Vec<_>>(),
    )?;

    let mut deduped = HashMap::<String, WorkspaceSessionCatalogEntry>::new();
    for summary in global_summaries {
        let entry = build_global_codex_catalog_entry(
            &summary,
            &workspaces_snapshot,
            &metadata_by_workspace_id,
        );
        let dedupe_key = format!("{}::{}", entry.engine, entry.session_id);
        match deduped.get(&dedupe_key) {
            Some(existing) if !should_replace_global_entry(existing, &entry) => {}
            _ => {
                deduped.insert(dedupe_key, entry);
            }
        }
    }
    let mut entries = deduped.into_values().collect::<Vec<_>>();
    apply_children_counts(&mut entries);

    Ok(entries)
}

async fn build_global_engine_catalog_entries(
    engine_manager: &engine::EngineManager,
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    storage_path: &Path,
    scan_mode: SessionCatalogScanMode,
) -> Result<(Vec<WorkspaceSessionCatalogEntry>, Vec<String>), String> {
    let workspaces_snapshot = workspaces.lock().await.clone();
    let workspace_entries = workspaces_snapshot.values().cloned().collect::<Vec<_>>();
    let metadata_by_workspace_id =
        read_catalog_metadata_for_scope(storage_path, &workspace_entries)?;
    let mut entries =
        build_global_codex_catalog_entries(workspaces, storage_path, scan_mode).await?;
    let mut partial_sources = Vec::new();
    let gemini_config = engine_manager
        .get_engine_config(engine::EngineType::Gemini)
        .await;
    let claude_config = engine_manager
        .get_engine_config(engine::EngineType::Claude)
        .await;

    for workspace in workspace_entries {
        let workspace_path = PathBuf::from(&workspace.path);
        match engine::claude_history::list_claude_sessions_for_attribution_scopes_with_config(
            &workspace_path,
            build_claude_attribution_scopes(&workspace),
            Some(scan_mode.limit()),
            claude_config.as_ref(),
        )
        .await
        {
            Ok(sessions) => {
                for session in sessions {
                    let session_id = format!("claude:{}", session.session_id);
                    let archived_at =
                        metadata_by_workspace_id
                            .get(&workspace.id)
                            .and_then(|metadata| {
                                archived_at_for_session(metadata, &workspace.id, &session_id)
                            });
                    let mut entry = WorkspaceSessionCatalogEntry {
                        session_id,
                        stable_session_key: None,
                        canonical_session_id: Some(session.session_id),
                        parent_session_id: session
                            .parent_session_id
                            .as_ref()
                            .map(|parent_session_id| format!("claude:{}", parent_session_id)),
                        workspace_id: workspace.id.clone(),
                        workspace_label: Some(workspace.name.clone()),
                        engine: "claude".to_string(),
                        title: session.first_message,
                        updated_at: session.updated_at.max(0),
                        archived_at,
                        thread_kind: "native".to_string(),
                        source: None,
                        source_label: None,
                        source_completeness: None,
                        source_status_reason: None,
                        size_bytes: session.file_size_bytes,
                        cwd: session.cwd,
                        attribution_status: session.attribution_status.or_else(|| {
                            Some(
                                SessionCatalogAttributionStatus::StrictMatch
                                    .as_str()
                                    .to_string(),
                            )
                        }),
                        attribution_reason: session.attribution_reason,
                        attribution_confidence: None,
                        matched_workspace_id: Some(workspace.id.clone()),
                        matched_workspace_label: Some(workspace.name.clone()),
                        folder_id: None,
                        auto_session: None,
                        exists_on_disk: false,
                        inconsistency_code: None,
                        delete_mode: None,
                        physical_path: None,
                        children_count: None,
                    };
                    entry = apply_strict_attribution_owner(
                        entry,
                        &workspaces_snapshot,
                        &metadata_by_workspace_id,
                    );
                    entries.push(finalize_existing_catalog_entry(
                        entry,
                        &metadata_by_workspace_id,
                    ));
                }
            }
            Err(error) => {
                log::warn!(
                    "[session_management.list_global_codex_sessions] claude history unavailable for workspace {}: {}",
                    workspace.id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_CLAUDE.to_string());
            }
        }

        match engine::gemini_history::list_gemini_sessions(
            &workspace_path,
            Some(scan_mode.limit()),
            gemini_config
                .as_ref()
                .and_then(|item| item.home_dir.as_deref()),
        )
        .await
        {
            Ok(sessions) => {
                for session in sessions {
                    let session_id = format!("gemini:{}", session.session_id);
                    let archived_at =
                        metadata_by_workspace_id
                            .get(&workspace.id)
                            .and_then(|metadata| {
                                archived_at_for_session(metadata, &workspace.id, &session_id)
                            });
                    let entry = WorkspaceSessionCatalogEntry {
                        session_id,
                        stable_session_key: None,
                        canonical_session_id: session.canonical_session_id,
                        parent_session_id: None,
                        workspace_id: workspace.id.clone(),
                        workspace_label: Some(workspace.name.clone()),
                        engine: session.engine.unwrap_or_else(|| "gemini".to_string()),
                        title: session.first_message,
                        updated_at: session.updated_at.max(0),
                        archived_at,
                        thread_kind: "native".to_string(),
                        source: None,
                        source_label: None,
                        source_completeness: None,
                        source_status_reason: None,
                        size_bytes: session.file_size_bytes,
                        cwd: None,
                        attribution_status: session.attribution_status.or_else(|| {
                            Some(
                                SessionCatalogAttributionStatus::StrictMatch
                                    .as_str()
                                    .to_string(),
                            )
                        }),
                        attribution_reason: None,
                        attribution_confidence: None,
                        matched_workspace_id: Some(workspace.id.clone()),
                        matched_workspace_label: Some(workspace.name.clone()),
                        folder_id: None,
                        auto_session: None,
                        exists_on_disk: false,
                        inconsistency_code: None,
                        delete_mode: None,
                        physical_path: None,
                        children_count: None,
                    };
                    entries.push(finalize_existing_catalog_entry(
                        entry,
                        &metadata_by_workspace_id,
                    ));
                }
            }
            Err(error) => {
                log::warn!(
                    "[session_management.list_global_codex_sessions] gemini history unavailable for workspace {}: {}",
                    workspace.id,
                    error
                );
                partial_sources.push(SESSION_CATALOG_PARTIAL_GEMINI.to_string());
            }
        }
    }

    let mut deduped = HashMap::<String, WorkspaceSessionCatalogEntry>::new();
    for entry in entries {
        let dedupe_key = format!("{}::{}", entry.engine, entry.session_id);
        match deduped.get(&dedupe_key) {
            Some(existing) if !should_replace_global_entry(existing, &entry) => {}
            _ => {
                deduped.insert(dedupe_key, entry);
            }
        }
    }

    Ok((
        deduped.into_values().collect(),
        normalize_partial_sources(partial_sources),
    ))
}

fn build_global_codex_catalog_entry(
    summary: &crate::types::LocalUsageSessionSummary,
    workspaces_snapshot: &HashMap<String, WorkspaceEntry>,
    metadata_by_workspace_id: &HashMap<String, WorkspaceSessionCatalogMetadata>,
) -> WorkspaceSessionCatalogEntry {
    let source_label = build_source_label(summary.source.as_deref(), summary.provider.as_deref());
    let unresolved_entry = WorkspaceSessionCatalogEntry {
        session_id: summary.session_id.clone(),
        stable_session_key: None,
        canonical_session_id: Some(summary.session_id.clone()),
        parent_session_id: None,
        workspace_id: SESSION_CATALOG_UNASSIGNED_WORKSPACE_ID.to_string(),
        workspace_label: None,
        engine: "codex".to_string(),
        title: summary
            .summary
            .clone()
            .unwrap_or_else(|| "Codex Session".to_string()),
        updated_at: summary.timestamp.max(0),
        archived_at: None,
        thread_kind: "native".to_string(),
        source: summary.source.clone(),
        source_label,
        source_completeness: None,
        source_status_reason: None,
        size_bytes: summary.file_size_bytes,
        cwd: summary.cwd.clone(),
        attribution_status: None,
        attribution_reason: None,
        attribution_confidence: None,
        matched_workspace_id: None,
        matched_workspace_label: None,
        folder_id: None,
        auto_session: None,
        exists_on_disk: false,
        inconsistency_code: None,
        delete_mode: Some(SESSION_DELETE_MODE_UNSUPPORTED.to_string()),
        physical_path: None,
        children_count: None,
    };
    let attribution = resolve_catalog_entry_attribution(workspaces_snapshot, &unresolved_entry);
    let mut entry = apply_attribution_to_entry(unresolved_entry, attribution);
    if let Some(owner_workspace_id) = entry.matched_workspace_id.clone() {
        if let Some(owner_workspace) = workspaces_snapshot.get(&owner_workspace_id) {
            entry.workspace_id = owner_workspace.id.clone();
            entry.workspace_label = Some(owner_workspace.name.clone());
            entry.archived_at = metadata_by_workspace_id
                .get(&owner_workspace.id)
                .and_then(|metadata| archived_at_for_entry(metadata, &entry));
        }
    }
    mark_entry_as_existing_on_disk(&mut entry);
    entry
}

fn apply_attribution_to_entry(
    mut entry: WorkspaceSessionCatalogEntry,
    attribution: SessionCatalogAttribution,
) -> WorkspaceSessionCatalogEntry {
    entry.attribution_status = Some(attribution.status.as_str().to_string());
    entry.attribution_reason = attribution.reason.map(|reason| reason.as_str().to_string());
    entry.attribution_confidence = attribution
        .confidence
        .map(|confidence| confidence.as_str().to_string());
    entry.matched_workspace_id = attribution.matched_workspace_id;
    entry.matched_workspace_label = attribution.matched_workspace_label;
    entry
}

fn resolve_catalog_entry_attribution(
    workspaces: &HashMap<String, WorkspaceEntry>,
    entry: &WorkspaceSessionCatalogEntry,
) -> SessionCatalogAttribution {
    if let Some(cwd) = entry.cwd.as_deref() {
        let exact_workspace_matches = workspaces
            .values()
            .filter(|workspace| paths_are_equivalent_for_owner(cwd, &workspace.path))
            .collect::<Vec<_>>();
        if let Some(workspace) = choose_longest_unique_workspace_match(exact_workspace_matches) {
            if claude_project_dir_owner_conflicts(entry, workspace, workspaces) {
                return unresolved_catalog_owner(
                    SessionCatalogAttributionReason::CwdProjectConflict,
                );
            }
            return SessionCatalogAttribution {
                status: SessionCatalogAttributionStatus::StrictMatch,
                reason: Some(SessionCatalogAttributionReason::CwdExact),
                confidence: Some(SessionCatalogAttributionConfidence::High),
                matched_workspace_id: Some(workspace.id.clone()),
                matched_workspace_label: Some(workspace.name.clone()),
            };
        }

        let matching_workspaces = workspaces
            .values()
            .filter(|workspace| {
                local_usage::path_matches_workspace(cwd, Path::new(&workspace.path))
            })
            .collect::<Vec<_>>();
        if let Some(workspace) = choose_longest_unique_workspace_match(matching_workspaces) {
            if claude_project_dir_owner_conflicts(entry, workspace, workspaces) {
                return unresolved_catalog_owner(
                    SessionCatalogAttributionReason::CwdProjectConflict,
                );
            }
            return SessionCatalogAttribution {
                status: SessionCatalogAttributionStatus::StrictMatch,
                reason: Some(SessionCatalogAttributionReason::CwdLongest),
                confidence: Some(SessionCatalogAttributionConfidence::High),
                matched_workspace_id: Some(workspace.id.clone()),
                matched_workspace_label: Some(workspace.name.clone()),
            };
        }

        let matching_git_root_workspaces = workspaces
            .values()
            .filter(|workspace| {
                workspace
                    .settings
                    .git_root
                    .as_deref()
                    .map(|git_root| local_usage::path_matches_workspace(cwd, Path::new(git_root)))
                    .unwrap_or(false)
            })
            .collect::<Vec<_>>();
        if let Some(workspace) = choose_longest_unique_workspace_match(matching_git_root_workspaces)
        {
            if claude_project_dir_owner_conflicts(entry, workspace, workspaces) {
                return unresolved_catalog_owner(
                    SessionCatalogAttributionReason::CwdProjectConflict,
                );
            }
            return SessionCatalogAttribution {
                status: SessionCatalogAttributionStatus::StrictMatch,
                reason: Some(SessionCatalogAttributionReason::GitRootInferred),
                confidence: Some(SessionCatalogAttributionConfidence::High),
                matched_workspace_id: Some(workspace.id.clone()),
                matched_workspace_label: Some(workspace.name.clone()),
            };
        }

        return unresolved_catalog_owner(SessionCatalogAttributionReason::AmbiguousSibling);
    }

    if entry.engine.eq_ignore_ascii_case("claude")
        && entry.attribution_reason.as_deref()
            == Some(engine::claude_history::CLAUDE_ATTRIBUTION_REASON_PROJECT_DIRECTORY)
    {
        if let Some(workspace) = workspaces.get(&entry.workspace_id) {
            return SessionCatalogAttribution {
                status: SessionCatalogAttributionStatus::StrictMatch,
                reason: Some(SessionCatalogAttributionReason::ProjectDirDirect),
                confidence: Some(SessionCatalogAttributionConfidence::Medium),
                matched_workspace_id: Some(workspace.id.clone()),
                matched_workspace_label: Some(workspace.name.clone()),
            };
        }
    }

    unresolved_catalog_owner(SessionCatalogAttributionReason::SourceIncomplete)
}

fn unresolved_catalog_owner(reason: SessionCatalogAttributionReason) -> SessionCatalogAttribution {
    SessionCatalogAttribution {
        status: SessionCatalogAttributionStatus::Unassigned,
        reason: Some(reason),
        confidence: Some(SessionCatalogAttributionConfidence::Low),
        matched_workspace_id: None,
        matched_workspace_label: None,
    }
}

fn claude_project_dir_owner_conflicts(
    entry: &WorkspaceSessionCatalogEntry,
    matched_workspace: &WorkspaceEntry,
    workspaces: &HashMap<String, WorkspaceEntry>,
) -> bool {
    if !entry.engine.eq_ignore_ascii_case("claude")
        || entry.attribution_reason.as_deref()
            != Some(engine::claude_history::CLAUDE_ATTRIBUTION_REASON_PROJECT_DIRECTORY)
        || entry.workspace_id == matched_workspace.id
    {
        return false;
    }

    workspaces
        .get(&entry.workspace_id)
        .map(|project_dir_workspace| {
            !is_same_workspace_family(project_dir_workspace, matched_workspace)
        })
        .unwrap_or(false)
}

fn normalize_owner_path_for_exact_match(path: &str) -> String {
    path.trim()
        .trim_end_matches(|value| value == '/' || value == '\\')
        .to_string()
}

fn paths_are_equivalent_for_owner(left: &str, right: &str) -> bool {
    let left = normalize_owner_path_for_exact_match(left);
    let right = normalize_owner_path_for_exact_match(right);
    !left.is_empty() && left == right
}

fn choose_longest_unique_workspace_match(matches: Vec<&WorkspaceEntry>) -> Option<&WorkspaceEntry> {
    let max_len = matches.iter().map(|workspace| workspace.path.len()).max()?;
    let mut longest = matches
        .into_iter()
        .filter(|workspace| workspace.path.len() == max_len)
        .collect::<Vec<_>>();
    if longest.len() == 1 {
        longest.pop()
    } else {
        None
    }
}

fn infer_related_attribution_for_workspace(
    workspaces: &HashMap<String, WorkspaceEntry>,
    selected_workspace: &WorkspaceEntry,
    entry: &WorkspaceSessionCatalogEntry,
) -> Option<SessionCatalogAttribution> {
    let entry_cwd = entry.cwd.as_deref();
    let owner_workspace = workspaces.get(&entry.workspace_id);
    if let Some(owner_workspace) = owner_workspace {
        if is_same_workspace_family(selected_workspace, owner_workspace) {
            return Some(SessionCatalogAttribution {
                status: SessionCatalogAttributionStatus::InferredRelated,
                reason: Some(SessionCatalogAttributionReason::SharedWorktreeFamily),
                confidence: Some(SessionCatalogAttributionConfidence::High),
                matched_workspace_id: Some(selected_workspace.id.clone()),
                matched_workspace_label: Some(selected_workspace.name.clone()),
            });
        }
    }

    let cwd = entry_cwd?;
    if selected_workspace.kind.is_worktree() {
        if let Some(parent_workspace) = selected_workspace
            .parent_id
            .as_ref()
            .and_then(|parent_id| workspaces.get(parent_id))
        {
            if local_usage::path_matches_workspace(cwd, Path::new(&parent_workspace.path)) {
                let family_candidates = workspaces
                    .values()
                    .filter(|candidate| {
                        candidate.parent_id.as_deref() == Some(parent_workspace.id.as_str())
                    })
                    .count();
                if family_candidates <= 1 {
                    return Some(SessionCatalogAttribution {
                        status: SessionCatalogAttributionStatus::InferredRelated,
                        reason: Some(SessionCatalogAttributionReason::ParentScope),
                        confidence: Some(SessionCatalogAttributionConfidence::Medium),
                        matched_workspace_id: Some(selected_workspace.id.clone()),
                        matched_workspace_label: Some(selected_workspace.name.clone()),
                    });
                }
            }
        }
    }

    let selected_git_root = selected_workspace.settings.git_root.as_deref()?;
    if !local_usage::path_matches_workspace(cwd, Path::new(selected_git_root)) {
        return None;
    }
    let matching_git_root_families = workspaces
        .values()
        .filter(|candidate| {
            candidate
                .settings
                .git_root
                .as_deref()
                .map(|git_root| local_usage::path_matches_workspace(cwd, Path::new(git_root)))
                .unwrap_or(false)
        })
        .map(|candidate| workspace_family_key(candidate))
        .collect::<HashSet<_>>();
    if matching_git_root_families.len() != 1
        || !matching_git_root_families.contains(&workspace_family_key(selected_workspace))
    {
        return None;
    }

    Some(SessionCatalogAttribution {
        status: SessionCatalogAttributionStatus::InferredRelated,
        reason: Some(SessionCatalogAttributionReason::SharedGitRoot),
        confidence: Some(SessionCatalogAttributionConfidence::Medium),
        matched_workspace_id: Some(selected_workspace.id.clone()),
        matched_workspace_label: Some(selected_workspace.name.clone()),
    })
}

fn workspace_family_key(workspace: &WorkspaceEntry) -> String {
    if workspace.kind.is_worktree() {
        workspace
            .parent_id
            .clone()
            .unwrap_or_else(|| workspace.id.clone())
    } else {
        workspace.id.clone()
    }
}

fn is_same_workspace_family(left: &WorkspaceEntry, right: &WorkspaceEntry) -> bool {
    workspace_family_key(left) == workspace_family_key(right)
}

include!("session_management_catalog_projection.rs");

#[cfg(test)]
mod tests {
    include!("session_management_tests.rs");
    include!("session_management_attribution_tests.rs");
}
