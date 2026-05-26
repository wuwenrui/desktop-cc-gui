use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::app_paths;
use crate::state::AppState;
use crate::types::WorkspaceEntry;

static PROJECT_MAP_ATOMIC_WRITE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapReadResponse {
    storage_key: String,
    storage_dir: String,
    exists: bool,
    manifest: Option<Value>,
    profile: Option<Value>,
    lenses: Option<Value>,
    lens_nodes: HashMap<String, Value>,
    view_state: Option<Value>,
    settings: Option<Value>,
    cursor: Option<Value>,
    processed: Option<Value>,
    candidates: HashMap<String, Value>,
    evidence: HashMap<String, Value>,
    runs: HashMap<String, Value>,
    diagrams: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectMapWriteFile {
    relative_path: String,
    content: String,
}

fn sanitize_project_name(value: &str) -> String {
    let mut slug = String::new();
    for character in value.trim().chars() {
        if character.is_alphanumeric() || matches!(character, '.' | '_' | '-') {
            slug.push(character);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
        if slug.len() >= 60 {
            break;
        }
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed
    }
}

fn hash_workspace_identity(value: &str) -> String {
    let mut hash: u32 = 0x811c9dc5;
    for byte in value.replace('\\', "/").to_lowercase().bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{hash:08x}")
}

fn storage_key(entry: &WorkspaceEntry) -> String {
    let slug = sanitize_project_name(&entry.name);
    let hash = hash_workspace_identity(&format!("{}#{}", entry.path, entry.id));
    format!("{slug}-{hash}")
}

async fn workspace_entry(state: &AppState, workspace_id: &str) -> Result<WorkspaceEntry, String> {
    let workspaces = state.workspaces.lock().await;
    workspaces
        .get(workspace_id)
        .cloned()
        .ok_or_else(|| format!("Workspace not found: {workspace_id}"))
}

fn project_map_root_for_mode(
    entry: &WorkspaceEntry,
    storage_mode: Option<&str>,
) -> Result<(String, PathBuf), String> {
    let key = storage_key(entry);
    let root = match storage_mode {
        Some(mode) if mode.eq_ignore_ascii_case("project") => PathBuf::from(&entry.path)
            .join(".ccgui")
            .join("project-map"),
        Some(mode) if mode.eq_ignore_ascii_case("global") => {
            app_paths::app_home_dir()?.join("project-map")
        }
        Some(mode) => {
            return Err(format!("Invalid project map storage mode: {mode}"));
        }
        None => app_paths::app_home_dir()?.join("project-map"),
    };

    Ok((key.clone(), root.join(key)))
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

fn is_safe_project_map_segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value == value.to_ascii_lowercase()
        && !is_windows_reserved_path_segment(value)
        && !value.starts_with('.')
        && !value.starts_with('_')
        && !value.starts_with('-')
        && !value.ends_with('.')
        && !value.ends_with('_')
        && !value.ends_with('-')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn is_safe_project_map_json_file(value: &str) -> bool {
    let Some(stem) = value.strip_suffix(".json") else {
        return false;
    };
    is_safe_project_map_segment(stem)
}

fn validate_relative_project_map_path(path: &str) -> Result<PathBuf, String> {
    let normalized = path.trim().replace('\\', "/");
    if normalized.is_empty() {
        return Err("Project map relative path cannot be empty.".to_string());
    }
    let candidate = Path::new(&normalized);
    let mut relative = PathBuf::new();
    let mut segments = Vec::new();
    for component in candidate.components() {
        match component {
            Component::Normal(segment) => {
                let Some(segment_text) = segment.to_str() else {
                    return Err("Invalid project map relative path.".to_string());
                };
                segments.push(segment_text.to_string());
                relative.push(segment);
            }
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_)
            | Component::CurDir => {
                return Err("Invalid project map relative path.".to_string());
            }
        }
    }

    let allowed = match segments.as_slice() {
        [file] => matches!(
            file.as_str(),
            "manifest.json" | "profile.json" | "view-state.json" | "settings.json"
        ),
        [dir, file] if dir == "lenses" => file == "manifest.json",
        [dir, file] if dir == "memory-ingestion" => {
            matches!(file.as_str(), "cursor.json" | "processed.json")
        }
        [dir, segment, file] if dir == "lenses" => {
            is_safe_project_map_segment(segment) && file == "nodes.json"
        }
        [dir, file] if matches!(dir.as_str(), "runs" | "candidates" | "evidence") => {
            is_safe_project_map_json_file(file)
        }
        [dir, file] if dir == "diagrams" => {
            file == "manifest.json"
                || (file.ends_with(".md")
                    && is_safe_project_map_segment(file.trim_end_matches(".md")))
        }
        _ => false,
    };
    if !allowed {
        return Err("Project map write path is outside the allowed contract.".to_string());
    }
    Ok(relative)
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("Failed to create directory: {err}"))?;
    }
    let nonce = PROJECT_MAP_ATOMIC_WRITE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_path = path.with_extension(format!("tmp-{}-{nonce}", std::process::id()));
    {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)
            .map_err(|err| format!("Failed to create temp project map file: {err}"))?;
        file.write_all(content.as_bytes())
            .map_err(|err| format!("Failed to write temp project map file: {err}"))?;
        file.sync_all()
            .map_err(|err| format!("Failed to sync temp project map file: {err}"))?;
    }
    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path)
            .map_err(|err| format!("Failed to replace existing project map file: {err}"))?;
    }
    if let Err(err) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to commit project map file: {err}"));
    }
    Ok(())
}

fn read_json(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn read_json_dir(root: &Path) -> HashMap<String, Value> {
    let mut values = HashMap::new();
    let Ok(entries) = fs::read_dir(root) else {
        return values;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if let Some(value) = read_json(&path) {
            let key = path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("unknown")
                .to_string();
            values.insert(key, value);
        }
    }
    values
}

fn read_lens_nodes(root: &Path) -> HashMap<String, Value> {
    let mut values = HashMap::new();
    let lenses_root = root.join("lenses");
    let Ok(entries) = fs::read_dir(lenses_root) else {
        return values;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(lens_id) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if let Some(value) = read_json(&path.join("nodes.json")) {
            values.insert(lens_id.to_string(), value);
        }
    }
    values
}

fn create_backup(root: &Path) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    let backup_root = root.join("backups").join(format!(
        "backup-{}",
        chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
    ));
    fs::create_dir_all(&backup_root).map_err(|err| format!("Failed to create backup: {err}"))?;
    for relative in [
        "manifest.json",
        "profile.json",
        "view-state.json",
        "lenses/manifest.json",
        "settings.json",
        "memory-ingestion/cursor.json",
        "memory-ingestion/processed.json",
    ] {
        let source = root.join(relative);
        if source.is_file() {
            let target = backup_root.join(relative);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|err| format!("Failed to create backup directory: {err}"))?;
            }
            fs::copy(&source, &target)
                .map_err(|err| format!("Failed to copy backup file: {err}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn project_map_read(
    workspace_id: String,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<ProjectMapReadResponse, String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (key, root) = project_map_root_for_mode(&entry, storage_mode.as_deref())?;
    let exists = root.join("manifest.json").is_file();

    Ok(ProjectMapReadResponse {
        storage_key: key,
        storage_dir: root.to_string_lossy().to_string(),
        exists,
        manifest: read_json(&root.join("manifest.json")),
        profile: read_json(&root.join("profile.json")),
        lenses: read_json(&root.join("lenses").join("manifest.json")),
        lens_nodes: read_lens_nodes(&root),
        view_state: read_json(&root.join("view-state.json")),
        settings: read_json(&root.join("settings.json")),
        cursor: read_json(&root.join("memory-ingestion").join("cursor.json")),
        processed: read_json(&root.join("memory-ingestion").join("processed.json")),
        candidates: read_json_dir(&root.join("candidates")),
        evidence: read_json_dir(&root.join("evidence")),
        runs: read_json_dir(&root.join("runs")),
        diagrams: read_json(&root.join("diagrams").join("manifest.json")),
    })
}

#[tauri::command]
pub(crate) async fn project_map_write_snapshot(
    workspace_id: String,
    files: Vec<ProjectMapWriteFile>,
    create_backup: Option<bool>,
    storage_mode: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let entry = workspace_entry(&state, &workspace_id).await?;
    let (_key, root) = project_map_root_for_mode(&entry, storage_mode.as_deref())?;
    fs::create_dir_all(&root).map_err(|err| format!("Failed to create project map root: {err}"))?;

    if create_backup.unwrap_or(false) {
        self::create_backup(&root)?;
    }

    for file in files {
        let relative = validate_relative_project_map_path(&file.relative_path)?;
        let target = root.join(relative);
        if !target.starts_with(&root) {
            return Err("Project map write escaped the storage root.".to_string());
        }
        atomic_write(&target, &file.content)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        atomic_write, hash_workspace_identity, sanitize_project_name, storage_key,
        validate_relative_project_map_path,
    };
    use crate::types::{WorkspaceEntry, WorkspaceKind, WorkspaceSettings};
    use std::thread;
    use uuid::Uuid;

    #[test]
    fn storage_hash_normalizes_platform_separators() {
        assert_eq!(
            hash_workspace_identity(r"C:\repo\project#ws-1"),
            hash_workspace_identity("c:/repo/project#ws-1")
        );
    }

    #[test]
    fn project_name_slug_falls_back_when_empty() {
        assert_eq!(sanitize_project_name(" /// "), "project");
        assert_eq!(
            sanitize_project_name("spring boot demo"),
            "spring-boot-demo"
        );
    }

    #[test]
    fn storage_key_uses_utf8_byte_hash_for_non_ascii_paths() {
        let entry = WorkspaceEntry {
            id: "ws-中文".to_string(),
            name: "知识库".to_string(),
            path: "/Users/chenxiangning/代码/知识库".to_string(),
            codex_bin: None,
            kind: WorkspaceKind::Main,
            parent_id: None,
            worktree: None,
            settings: WorkspaceSettings::default(),
        };

        assert_eq!(storage_key(&entry), "知识库-8591e4a8");
    }

    #[test]
    fn project_map_write_paths_are_constrained() {
        assert!(validate_relative_project_map_path("manifest.json").is_ok());
        assert!(validate_relative_project_map_path("view-state.json").is_ok());
        assert!(validate_relative_project_map_path("lenses/api/nodes.json").is_ok());
        assert!(validate_relative_project_map_path("lenses/api-domain/nodes.json").is_ok());
        assert!(validate_relative_project_map_path("runs/latest.json").is_ok());
        assert!(validate_relative_project_map_path("evidence/latest.json").is_ok());
        assert!(validate_relative_project_map_path("diagrams/manifest.json").is_ok());
        assert!(validate_relative_project_map_path("diagrams/auth-service-flow.md").is_ok());
        assert!(validate_relative_project_map_path("../src/main.rs").is_err());
        assert!(validate_relative_project_map_path("lenses/api/../../manifest.json").is_err());
        assert!(validate_relative_project_map_path("lenses/api/domain/nodes.json").is_err());
        assert!(validate_relative_project_map_path("lenses/API/nodes.json").is_err());
        assert!(validate_relative_project_map_path("lenses/con/nodes.json").is_err());
        assert!(validate_relative_project_map_path("lenses/con.audit/nodes.json").is_err());
        assert!(validate_relative_project_map_path("runs/archive/latest.json").is_err());
        assert!(validate_relative_project_map_path("runs/con.json").is_err());
        assert!(validate_relative_project_map_path("diagrams/auth/service.md").is_err());
        assert!(validate_relative_project_map_path("diagrams/auth-service-flow.json").is_err());
        assert!(validate_relative_project_map_path("diagrams/CON.md").is_err());
        assert!(validate_relative_project_map_path("diagrams/nul.flow.md").is_err());
        assert!(validate_relative_project_map_path("random.json").is_err());
    }

    #[test]
    fn atomic_write_replaces_existing_file() {
        let root = std::env::temp_dir().join(format!("project-map-replace-{}", Uuid::new_v4()));
        let target = root.join("runs").join("latest.json");

        atomic_write(&target, "first").expect("initial write should commit");
        atomic_write(&target, "second").expect("replacement write should commit");

        let content = std::fs::read_to_string(&target).expect("read committed content");
        assert_eq!(content, "second");

        std::fs::remove_dir_all(root).expect("cleanup root");
    }

    #[test]
    fn atomic_write_supports_concurrent_commits_to_same_file() {
        let root = std::env::temp_dir().join(format!("project-map-atomic-{}", Uuid::new_v4()));
        let target = root.join("diagrams").join("auth-service-flow.md");

        let handles = (0..8)
            .map(|index| {
                let target = target.clone();
                thread::spawn(move || {
                    atomic_write(&target, &format!("content-{index}"))
                        .expect("write should commit");
                })
            })
            .collect::<Vec<_>>();

        for handle in handles {
            handle.join().expect("thread should finish");
        }

        let content = std::fs::read_to_string(&target).expect("read committed content");
        assert!(content.starts_with("content-"));

        std::fs::remove_dir_all(root).expect("cleanup root");
    }
}
