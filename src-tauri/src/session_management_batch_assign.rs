use std::collections::HashMap;
use std::path::Path;

use tokio::sync::Mutex;

use super::{
    batch_error, batch_success_for_target, build_workspace_scope_catalog_data,
    ensure_workspace_exists, folder_exists, normalize_optional_folder_id, normalize_session_ids,
    normalize_workspace_id, read_catalog_metadata, remove_folder_assignment_for_session,
    replace_batch_results_for_targets, resolve_session_mutation_target,
    with_catalog_metadata_mutation, SessionCatalogScanMode, WorkspaceSessionBatchMutationResponse,
    WorkspaceSessionMutationTarget,
};
use crate::engine;
use crate::types::WorkspaceEntry;

pub(crate) async fn assign_workspace_session_folders_core(
    workspaces: &Mutex<HashMap<String, WorkspaceEntry>>,
    engine_manager: &engine::EngineManager,
    storage_path: &Path,
    workspace_id: String,
    session_ids: Vec<String>,
    folder_id: Option<String>,
) -> Result<WorkspaceSessionBatchMutationResponse, String> {
    let workspace_id = normalize_workspace_id(&workspace_id)?;
    ensure_workspace_exists(workspaces, &workspace_id).await?;
    let normalized_session_ids = normalize_session_ids(session_ids)?;
    let folder_id = normalize_optional_folder_id(folder_id)?;

    if normalized_session_ids.is_empty() {
        return Ok(WorkspaceSessionBatchMutationResponse { results: vec![] });
    }

    let scope_catalog = build_workspace_scope_catalog_data(
        workspaces,
        engine_manager,
        storage_path,
        &workspace_id,
        SessionCatalogScanMode::Exhaustive,
    )
    .await?;
    let workspaces_snapshot = workspaces.lock().await.clone();
    let mut assignable_targets_by_owner =
        HashMap::<String, Vec<WorkspaceSessionMutationTarget>>::new();
    let mut results = Vec::new();

    for session_id in normalized_session_ids {
        let Some(target) = resolve_session_mutation_target(
            &scope_catalog.entries,
            &workspaces_snapshot,
            &session_id,
        )
        .filter(|target| target.exists_on_disk) else {
            results.push(batch_error(
                session_id,
                "SESSION_NOT_IN_WORKSPACE_SCOPE",
                "session does not belong to target workspace",
            ));
            continue;
        };
        let mut result = batch_success_for_target(&target, None);
        result.code = Some(super::SESSION_ASSIGN_CODE_FOLDER_ASSIGNED.to_string());
        result.metadata_cleaned = Some(true);
        results.push(result);
        assignable_targets_by_owner
            .entry(target.owner_workspace_id.clone())
            .or_default()
            .push(target);
    }

    let mut owner_validation_errors = HashMap::<String, String>::new();
    if let Some(folder_id) = folder_id.as_deref() {
        for owner_workspace_id in assignable_targets_by_owner.keys() {
            match read_catalog_metadata(storage_path, owner_workspace_id) {
                Ok(metadata) if folder_exists(&metadata, folder_id) => {}
                Ok(_) => {
                    owner_validation_errors.insert(
                        owner_workspace_id.clone(),
                        "target folder not found".to_string(),
                    );
                }
                Err(error) => {
                    owner_validation_errors.insert(
                        owner_workspace_id.clone(),
                        format!("failed to read folder metadata: {error}"),
                    );
                }
            }
        }
    }

    for (owner_workspace_id, targets) in assignable_targets_by_owner {
        if let Some(error) = owner_validation_errors.get(&owner_workspace_id) {
            replace_batch_results_for_targets(
                &mut results,
                &targets,
                "FOLDER_METADATA_UNAVAILABLE",
                error,
            );
            continue;
        }
        if let Err(error) =
            with_catalog_metadata_mutation(storage_path, &owner_workspace_id, |metadata| {
                if let Some(folder_id) = folder_id.as_deref() {
                    if !folder_exists(metadata, folder_id) {
                        return Err("target folder not found".to_string());
                    }
                }

                for target in &targets {
                    remove_folder_assignment_for_session(
                        metadata,
                        &owner_workspace_id,
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
                }
                Ok(())
            })
        {
            let message = format!("failed to update folder metadata: {error}");
            replace_batch_results_for_targets(
                &mut results,
                &targets,
                "FOLDER_METADATA_WRITE_FAILED",
                &message,
            );
        }
    }

    Ok(WorkspaceSessionBatchMutationResponse { results })
}
