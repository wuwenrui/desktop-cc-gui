use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::app_paths;
use crate::project_identity::project_storage_key;
use crate::remote_backend;
use crate::state::AppState;
use crate::storage::{with_storage_lock, write_string_atomically};
use crate::types::WorkspaceEntry;

const MAX_PROJECT_CANVAS_FILE_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectCanvasFileResponse {
    content: String,
    truncated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectCanvasCompactResponse {
    deleted_documents: usize,
    deleted_temp_files: usize,
}

const LEGACY_MIGRATION_SENTINEL: &str = ".legacy-migration-complete";

async fn workspace_entry(state: &AppState, workspace_id: &str) -> Result<WorkspaceEntry, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(workspace_id)
        .cloned()
        .ok_or_else(|| format!("Workspace not found: {workspace_id}"))
}

fn is_windows_reserved_path_segment(value: &str) -> bool {
    let stem = value.split('.').next().unwrap_or(value);
    matches!(
        stem,
        "con"
            | "prn"
            | "aux"
            | "nul"
            | "com1"
            | "com2"
            | "com3"
            | "com4"
            | "com5"
            | "com6"
            | "com7"
            | "com8"
            | "com9"
            | "lpt1"
            | "lpt2"
            | "lpt3"
            | "lpt4"
            | "lpt5"
            | "lpt6"
            | "lpt7"
            | "lpt8"
            | "lpt9"
    )
}

fn is_safe_project_canvas_filename(value: &str) -> bool {
    !value.is_empty()
        && !is_windows_reserved_path_segment(&value.to_ascii_lowercase())
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
}

fn validate_project_canvas_file_path(path: &str) -> Result<PathBuf, String> {
    let normalized = path.trim().replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.contains('/') {
        return Err("Invalid Project Canvas file path.".to_string());
    }
    if normalized.contains(':') || normalized.contains("..") {
        return Err("Invalid Project Canvas file path.".to_string());
    }
    for component in Path::new(&normalized).components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err("Invalid Project Canvas file path.".to_string()),
        }
    }
    if !is_safe_project_canvas_filename(&normalized) {
        return Err("Invalid Project Canvas file path.".to_string());
    }
    if normalized == "index.json"
        || (normalized.starts_with("canvas-") && normalized.ends_with(".intent-canvas.json"))
    {
        return Ok(PathBuf::from(normalized));
    }
    Err("Invalid Project Canvas file path.".to_string())
}

fn project_canvas_root(entry: &WorkspaceEntry) -> Result<PathBuf, String> {
    Ok(app_paths::project_canvas_dir()?.join(project_storage_key(entry)))
}

fn legacy_workspace_canvas_root(entry: &WorkspaceEntry) -> PathBuf {
    PathBuf::from(&entry.path).join(".mossx").join("canvases")
}

fn migrate_legacy_workspace_canvases(entry: &WorkspaceEntry, root: &Path) -> Result<(), String> {
    let migration_sentinel_path = root.join(LEGACY_MIGRATION_SENTINEL);
    if migration_sentinel_path.exists() {
        return Ok(());
    }
    let legacy_root = legacy_workspace_canvas_root(entry);
    if !legacy_root.exists() || !legacy_root.is_dir() {
        return Ok(());
    }
    std::fs::create_dir_all(root)
        .map_err(|error| format!("Failed to create Project Canvas directory: {error}"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve Project Canvas root: {error}"))?;
    let entries = std::fs::read_dir(&legacy_root)
        .map_err(|error| format!("Failed to read legacy Intent Canvas directory: {error}"))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read legacy Intent Canvas entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect legacy Intent Canvas entry: {error}"))?;
        if !file_type.is_file() {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        let relative_path = match validate_project_canvas_file_path(&file_name) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let target_path = canonical_root.join(relative_path);
        if target_path.exists() {
            continue;
        }
        let content = std::fs::read_to_string(entry.path())
            .map_err(|error| format!("Failed to read legacy Intent Canvas file: {error}"))?;
        if content.len() > MAX_PROJECT_CANVAS_FILE_BYTES as usize {
            continue;
        }
        with_storage_lock(&target_path, || {
            write_string_atomically(&target_path, &content)
        })?;
    }
    synthesize_index_from_canvas_documents(&canonical_root)?;
    std::fs::write(&migration_sentinel_path, "1")
        .map_err(|error| format!("Failed to write Project Canvas migration sentinel: {error}"))?;
    Ok(())
}

fn value_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn value_array_count(value: Option<&Value>) -> usize {
    value.and_then(Value::as_array).map(Vec::len).unwrap_or(0)
}

fn synthesize_index_from_canvas_documents(root: &Path) -> Result<(), String> {
    let index_path = root.join("index.json");
    if index_path.exists() {
        return Ok(());
    }
    let mut canvases = Vec::new();
    let entries = std::fs::read_dir(root)
        .map_err(|error| format!("Failed to read Project Canvas directory: {error}"))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read Project Canvas entry: {error}"))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if validate_project_canvas_file_path(&file_name).is_err() || file_name == "index.json" {
            continue;
        }
        let content = std::fs::read_to_string(entry.path())
            .map_err(|error| format!("Failed to read Project Canvas document: {error}"))?;
        let document: Value = match serde_json::from_str(&content) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if document.get("kind").and_then(Value::as_str) != Some("intent-canvas") {
            continue;
        }
        let Some(id) = value_string(&document, "id") else {
            continue;
        };
        if format!("{id}.intent-canvas.json") != file_name {
            continue;
        }
        let Some(title) = value_string(&document, "title") else {
            continue;
        };
        let Some(updated_at) = value_string(&document, "updatedAt") else {
            continue;
        };
        let created_at = value_string(&document, "createdAt").unwrap_or_else(|| updated_at.clone());
        let links = document.get("links");
        let scene = document.get("scene");
        let element_count = scene
            .and_then(|value| value.get("elements"))
            .and_then(Value::as_array)
            .map(|elements| {
                elements
                    .iter()
                    .filter(|element| {
                        !element
                            .get("isDeleted")
                            .and_then(Value::as_bool)
                            .unwrap_or(false)
                    })
                    .count()
            })
            .unwrap_or(0);
        canvases.push(json!({
            "id": id,
            "title": title,
            "mode": value_string(&document, "mode").unwrap_or_else(|| "architect".to_string()),
            "summary": value_string(&document, "summary").unwrap_or_default(),
            "updatedAt": updated_at,
            "createdAt": created_at,
            "path": file_name,
            "linkedFileCount": value_array_count(links.and_then(|value| value.get("filePaths"))),
            "linkedProjectMapNodeCount": value_array_count(links.and_then(|value| value.get("projectMapNodeIds"))),
            "linkedThreadCount": value_array_count(links.and_then(|value| value.get("threadIds"))),
            "elementCount": element_count,
        }));
    }
    if canvases.is_empty() {
        return Ok(());
    }
    canvases.sort_by(|left, right| {
        let left_updated = left.get("updatedAt").and_then(Value::as_str).unwrap_or("");
        let right_updated = right.get("updatedAt").and_then(Value::as_str).unwrap_or("");
        right_updated.cmp(left_updated)
    });
    let payload = json!({
        "version": 1,
        "canvases": canvases,
    });
    let content = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Failed to serialize Project Canvas index: {error}"))?;
    with_storage_lock(&index_path, || {
        write_string_atomically(&index_path, &content)
    })
}

fn is_project_canvas_document_filename(file_name: &str) -> bool {
    file_name.starts_with("canvas-")
        && file_name.ends_with(".intent-canvas.json")
        && validate_project_canvas_file_path(file_name).is_ok()
}

fn is_project_canvas_temp_filename(file_name: &str) -> bool {
    file_name.starts_with(".index.json.") && file_name.ends_with(".tmp")
}

fn load_indexed_project_canvas_filenames(
    root: &Path,
) -> Result<std::collections::HashSet<String>, String> {
    let index_path = root.join("index.json");
    if !index_path.exists() {
        return Ok(std::collections::HashSet::new());
    }
    let content = std::fs::read_to_string(&index_path)
        .map_err(|error| format!("Failed to read Project Canvas index: {error}"))?;
    let index: Value = serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse Project Canvas index: {error}"))?;
    let mut indexed_files = std::collections::HashSet::new();
    let Some(canvases) = index.get("canvases").and_then(Value::as_array) else {
        return Ok(indexed_files);
    };
    for entry in canvases {
        let Some(id) = value_string(entry, "id") else {
            continue;
        };
        let file_name = format!("{id}.intent-canvas.json");
        if is_project_canvas_document_filename(&file_name) {
            indexed_files.insert(file_name);
        }
    }
    Ok(indexed_files)
}

fn compact_project_canvas_root(root: &Path) -> Result<ProjectCanvasCompactResponse, String> {
    if !root.exists() {
        return Ok(ProjectCanvasCompactResponse {
            deleted_documents: 0,
            deleted_temp_files: 0,
        });
    }
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve Project Canvas root: {error}"))?;
    let indexed_files = load_indexed_project_canvas_filenames(&canonical_root)?;
    let mut deleted_documents = 0;
    let mut deleted_temp_files = 0;
    let entries = std::fs::read_dir(&canonical_root)
        .map_err(|error| format!("Failed to read Project Canvas directory: {error}"))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to read Project Canvas entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect Project Canvas entry: {error}"))?;
        if !file_type.is_file() {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        if is_project_canvas_temp_filename(&file_name) {
            std::fs::remove_file(entry.path())
                .map_err(|error| format!("Failed to remove Project Canvas temp file: {error}"))?;
            deleted_temp_files += 1;
            continue;
        }
        if is_project_canvas_document_filename(&file_name) && !indexed_files.contains(&file_name) {
            std::fs::remove_file(entry.path()).map_err(|error| {
                format!("Failed to remove orphan Project Canvas document: {error}")
            })?;
            deleted_documents += 1;
        }
    }
    Ok(ProjectCanvasCompactResponse {
        deleted_documents,
        deleted_temp_files,
    })
}

fn resolve_existing_project_canvas_file(root: &Path, path: &str) -> Result<PathBuf, String> {
    let relative_path = validate_project_canvas_file_path(path)?;
    if !root.exists() {
        return Err(format!("Project Canvas file not found: {path}"));
    }
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve Project Canvas root: {error}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|error| format!("Failed to open Project Canvas file: {error}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid Project Canvas file path.".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|error| format!("Failed to read Project Canvas file metadata: {error}"))?;
    if !metadata.is_file() {
        return Err("Project Canvas path is not a file.".to_string());
    }
    Ok(canonical_path)
}

fn resolve_writable_project_canvas_file(root: &Path, path: &str) -> Result<PathBuf, String> {
    let relative_path = validate_project_canvas_file_path(path)?;
    std::fs::create_dir_all(root)
        .map_err(|error| format!("Failed to create Project Canvas directory: {error}"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Failed to resolve Project Canvas root: {error}"))?;
    let candidate = canonical_root.join(relative_path);
    if let Some(parent) = candidate.parent() {
        let canonical_parent = parent.canonicalize().map_err(|error| {
            format!("Failed to resolve Project Canvas parent directory: {error}")
        })?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Invalid Project Canvas file path.".to_string());
        }
    }
    Ok(candidate)
}

#[tauri::command]
pub(crate) async fn project_canvas_read_file(
    workspace_id: String,
    path: String,
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<ProjectCanvasFileResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return Err(
            "Project Canvas global storage is not supported in remote mode yet.".to_string(),
        );
    }

    let entry = workspace_entry(&state, &workspace_id).await?;
    let root = project_canvas_root(&entry)?;
    migrate_legacy_workspace_canvases(&entry, &root)?;
    let path = resolve_existing_project_canvas_file(&root, &path)?;
    let file = File::open(&path)
        .map_err(|error| format!("Failed to open Project Canvas file: {error}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_PROJECT_CANVAS_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|error| format!("Failed to read Project Canvas file: {error}"))?;
    let truncated = buffer.len() > MAX_PROJECT_CANVAS_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_PROJECT_CANVAS_FILE_BYTES as usize);
    }
    let content = String::from_utf8(buffer)
        .map_err(|error| format!("Failed to decode Project Canvas file as UTF-8: {error}"))?;
    Ok(ProjectCanvasFileResponse { content, truncated })
}

#[tauri::command]
pub(crate) async fn project_canvas_write_file(
    workspace_id: String,
    path: String,
    content: String,
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        return Err(
            "Project Canvas global storage is not supported in remote mode yet.".to_string(),
        );
    }
    if content.len() > MAX_PROJECT_CANVAS_FILE_BYTES as usize {
        return Err("Project Canvas file content exceeds maximum allowed size.".to_string());
    }

    let entry = workspace_entry(&state, &workspace_id).await?;
    let root = project_canvas_root(&entry)?;
    let path = resolve_writable_project_canvas_file(&root, &path)?;
    with_storage_lock(&path, || write_string_atomically(&path, &content))
}

#[tauri::command]
pub(crate) async fn project_canvas_trash_file(
    workspace_id: String,
    path: String,
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        return Err(
            "Project Canvas global storage is not supported in remote mode yet.".to_string(),
        );
    }

    let entry = workspace_entry(&state, &workspace_id).await?;
    let root = project_canvas_root(&entry)?;
    let path = resolve_existing_project_canvas_file(&root, &path)?;
    trash::delete(&path)
        .map_err(|error| format!("Failed to move Project Canvas file to trash: {error}"))
}

#[tauri::command]
pub(crate) async fn project_canvas_compact_files(
    workspace_id: String,
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<ProjectCanvasCompactResponse, String> {
    if remote_backend::is_remote_mode(&*state).await {
        return Err(
            "Project Canvas global storage is not supported in remote mode yet.".to_string(),
        );
    }

    let entry = workspace_entry(&state, &workspace_id).await?;
    let root = project_canvas_root(&entry)?;
    with_storage_lock(&root.join("index.json"), || {
        compact_project_canvas_root(&root)
    })
}
