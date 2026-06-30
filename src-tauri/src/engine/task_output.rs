use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, State};

use crate::remote_backend;
use crate::state::AppState;
use crate::text_encoding::decode_text_bytes;

const MAX_TASK_OUTPUT_TAIL_BYTES: u64 = 16_000;
const TASK_OUTPUT_TEMP_DIR_PREFIX: &str = "ccgui-task-output-";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineTaskOutputArtifactTailResponse {
    pub exists: bool,
    pub content: String,
    pub truncated: bool,
    pub byte_length: u64,
}

fn empty_artifact_response() -> EngineTaskOutputArtifactTailResponse {
    EngineTaskOutputArtifactTailResponse {
        exists: false,
        content: String::new(),
        truncated: false,
        byte_length: 0,
    }
}

fn canonical_allowed_roots(workspace_path: &str) -> Vec<PathBuf> {
    vec![PathBuf::from(workspace_path)]
        .into_iter()
        .filter_map(|root| root.canonicalize().ok())
        .fold(Vec::<PathBuf>::new(), |mut acc, root| {
            if !acc.iter().any(|existing| existing == &root) {
                acc.push(root);
            }
            acc
        })
}

fn path_is_allowed_task_output_temp_file(canonical_path: &Path) -> bool {
    canonical_path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(TASK_OUTPUT_TEMP_DIR_PREFIX))
}

fn resolve_allowed_task_output_artifact_path(
    workspace_path: &str,
    artifact_path: &str,
) -> Result<Option<PathBuf>, String> {
    let trimmed = artifact_path.trim();
    if trimmed.is_empty() {
        return Err("Task output artifact path is required.".to_string());
    }
    let raw_path = PathBuf::from(trimmed);
    if !raw_path.is_absolute() {
        return Err("Task output artifact path must be absolute.".to_string());
    }
    if !raw_path.exists() {
        return Ok(None);
    }

    let canonical_path = raw_path
        .canonicalize()
        .map_err(|err| format!("Failed to resolve task output artifact: {err}"))?;
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read task output artifact metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Task output artifact is not a file.".to_string());
    }

    let allowed_roots = canonical_allowed_roots(workspace_path);
    if !allowed_roots
        .iter()
        .any(|allowed_root| canonical_path.starts_with(allowed_root))
        && !path_is_allowed_task_output_temp_file(&canonical_path)
    {
        return Err("Task output artifact is outside allowed directories.".to_string());
    }

    Ok(Some(canonical_path))
}

pub(crate) fn read_task_output_artifact_tail_inner(
    workspace_path: &str,
    artifact_path: &str,
) -> Result<EngineTaskOutputArtifactTailResponse, String> {
    let Some(canonical_path) =
        resolve_allowed_task_output_artifact_path(workspace_path, artifact_path)?
    else {
        return Ok(empty_artifact_response());
    };

    let mut file = File::open(&canonical_path)
        .map_err(|err| format!("Failed to open task output artifact: {err}"))?;
    let byte_length = file
        .metadata()
        .map_err(|err| format!("Failed to read task output artifact metadata: {err}"))?
        .len();
    let truncated = byte_length > MAX_TASK_OUTPUT_TAIL_BYTES;
    let read_start = byte_length.saturating_sub(MAX_TASK_OUTPUT_TAIL_BYTES);
    if read_start > 0 {
        file.seek(SeekFrom::Start(read_start))
            .map_err(|err| format!("Failed to seek task output artifact: {err}"))?;
    }

    let mut buffer = Vec::new();
    file.take(MAX_TASK_OUTPUT_TAIL_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read task output artifact: {err}"))?;
    if buffer.len() > MAX_TASK_OUTPUT_TAIL_BYTES as usize {
        buffer.truncate(MAX_TASK_OUTPUT_TAIL_BYTES as usize);
    }
    let content = decode_text_bytes(&buffer, "Task output artifact")?;

    Ok(EngineTaskOutputArtifactTailResponse {
        exists: true,
        content,
        truncated,
        byte_length,
    })
}

#[tauri::command]
pub async fn engine_task_output_read_artifact(
    workspace_id: String,
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<EngineTaskOutputArtifactTailResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let response = remote_backend::call_remote(
            &*state,
            app,
            "engine_task_output_read_artifact",
            json!({ "workspaceId": workspace_id, "path": path }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    let workspace_path = {
        let workspaces = state.workspaces.lock().await;
        workspaces
            .get(&workspace_id)
            .map(|entry| entry.path.clone())
            .ok_or_else(|| format!("Workspace not found: {workspace_id}"))?
    };

    read_task_output_artifact_tail_inner(&workspace_path, &path)
}

#[cfg(test)]
mod tests {
    use super::{read_task_output_artifact_tail_inner, MAX_TASK_OUTPUT_TAIL_BYTES};
    use std::fs;

    fn unique_temp_dir(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("ccgui-task-output-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn reads_task_output_tail_from_temp_file() {
        let workspace = unique_temp_dir("workspace");
        let tasks = unique_temp_dir("tasks");
        let artifact = tasks.join("task.output");
        fs::write(&artifact, "first\nsecond").expect("write artifact");

        let response = read_task_output_artifact_tail_inner(
            workspace.to_str().expect("workspace path"),
            artifact.to_str().expect("artifact path"),
        )
        .expect("read artifact");

        assert!(response.exists);
        assert_eq!(response.content, "first\nsecond");
        assert!(!response.truncated);
        assert_eq!(response.byte_length, 12);
    }

    #[test]
    fn returns_missing_response_for_absent_file() {
        let workspace = unique_temp_dir("missing-workspace");
        let artifact = workspace.join("missing.output");

        let response = read_task_output_artifact_tail_inner(
            workspace.to_str().expect("workspace path"),
            artifact.to_str().expect("artifact path"),
        )
        .expect("missing artifact should not fail");

        assert!(!response.exists);
        assert!(response.content.is_empty());
    }

    #[test]
    fn rejects_existing_file_outside_allowed_roots() {
        let workspace = unique_temp_dir("disallowed-workspace");
        let disallowed_root = std::env::current_dir()
            .expect("current dir")
            .join("target")
            .join("task-output-disallowed");
        fs::create_dir_all(&disallowed_root).expect("create disallowed dir");
        let artifact = disallowed_root.join("task.output");
        fs::write(&artifact, "secret").expect("write disallowed artifact");

        let error = read_task_output_artifact_tail_inner(
            workspace.to_str().expect("workspace path"),
            artifact.to_str().expect("artifact path"),
        )
        .expect_err("disallowed path should fail");

        assert!(error.contains("outside allowed directories"));
    }

    #[test]
    fn truncates_long_artifact_to_tail() {
        let workspace = unique_temp_dir("long-workspace");
        let artifact = workspace.join("task.output");
        let content = format!(
            "{}TAIL",
            "a".repeat(MAX_TASK_OUTPUT_TAIL_BYTES as usize + 32)
        );
        fs::write(&artifact, content).expect("write long artifact");

        let response = read_task_output_artifact_tail_inner(
            workspace.to_str().expect("workspace path"),
            artifact.to_str().expect("artifact path"),
        )
        .expect("read long artifact");

        assert!(response.truncated);
        assert!(response.content.ends_with("TAIL"));
        assert!(response.content.len() <= MAX_TASK_OUTPUT_TAIL_BYTES as usize);
    }
}
