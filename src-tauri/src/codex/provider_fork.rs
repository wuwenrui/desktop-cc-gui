use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::sleep;

use super::provider_profile::{
    materialize_codex_provider_profile, resolve_codex_provider_profile, CodexProviderProfile,
};
use super::{resolve_default_codex_home, resolve_workspace_codex_home};
use crate::shared::workspace_snapshot::resolve_workspace_and_parent;
use crate::state::AppState;

pub(super) fn enrich_native_provider_fork_response(
    mut response: Value,
    child_thread_id: &str,
    parent_thread_id: &str,
    parent_provider_profile_id: &str,
    selected_provider_profile_id: &str,
) -> Value {
    let fork_mode = if selected_provider_profile_id == parent_provider_profile_id {
        "native"
    } else {
        "native-provider-rebind"
    };
    let mut thread = response
        .get("thread")
        .and_then(Value::as_object)
        .cloned()
        .or_else(|| {
            response
                .get("result")
                .and_then(|result| result.get("thread"))
                .and_then(Value::as_object)
                .cloned()
        })
        .unwrap_or_default();
    thread.insert("id".to_string(), json!(child_thread_id));
    thread.insert("parentThreadId".to_string(), json!(parent_thread_id));
    thread.insert("forkMode".to_string(), json!(fork_mode));
    thread.insert(
        "parentProviderProfileId".to_string(),
        json!(parent_provider_profile_id),
    );
    thread.insert(
        "providerProfileId".to_string(),
        json!(selected_provider_profile_id),
    );

    if let Some(root) = response.as_object_mut() {
        root.insert("thread".to_string(), Value::Object(thread));
        root.insert("threadId".to_string(), json!(child_thread_id));
        root.insert("parentThreadId".to_string(), json!(parent_thread_id));
        root.insert("forkMode".to_string(), json!(fork_mode));
        root.insert(
            "parentProviderProfileId".to_string(),
            json!(parent_provider_profile_id),
        );
        root.insert(
            "providerProfileId".to_string(),
            json!(selected_provider_profile_id),
        );
        if let Some(result) = root.get_mut("result").and_then(Value::as_object_mut) {
            let result_thread = result
                .entry("thread".to_string())
                .or_insert_with(|| json!({}));
            if let Some(result_thread) = result_thread.as_object_mut() {
                result_thread.insert("id".to_string(), json!(child_thread_id));
                result_thread.insert("parentThreadId".to_string(), json!(parent_thread_id));
                result_thread.insert("forkMode".to_string(), json!(fork_mode));
                result_thread.insert(
                    "parentProviderProfileId".to_string(),
                    json!(parent_provider_profile_id),
                );
                result_thread.insert(
                    "providerProfileId".to_string(),
                    json!(selected_provider_profile_id),
                );
            }
        }
        return response;
    }

    json!({
        "thread": thread,
        "threadId": child_thread_id,
        "parentThreadId": parent_thread_id,
        "forkMode": fork_mode,
        "parentProviderProfileId": parent_provider_profile_id,
        "providerProfileId": selected_provider_profile_id
    })
}

fn codex_session_roots_for_home(codex_home: &Path) -> [PathBuf; 2] {
    [
        codex_home.join("sessions"),
        codex_home.join("archived_sessions"),
    ]
}

fn collect_codex_jsonl_files(root: &Path, output: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    let mut paths = entries
        .flatten()
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    paths.sort_by(|left, right| left.to_string_lossy().cmp(&right.to_string_lossy()));
    for path in paths {
        if path.is_dir() {
            collect_codex_jsonl_files(&path, output);
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            output.push(path);
        }
    }
}

fn codex_history_file_matches_thread(path: &Path, thread_id: &str) -> bool {
    if path.file_stem().and_then(|value| value.to_str()) == Some(thread_id) {
        return true;
    }

    let Ok(file) = fs::File::open(path) else {
        return false;
    };
    let reader = BufReader::new(file);
    for line in reader.lines().take(64).flatten() {
        if line.len() > 512_000 {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let payload = value.get("payload").unwrap_or(&value);
        let Some(id) = payload
            .get("id")
            .or_else(|| payload.get("threadId"))
            .or_else(|| payload.get("thread_id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        if id == thread_id {
            return true;
        }
    }
    false
}

fn find_codex_history_file(codex_home: &Path, thread_id: &str) -> Option<PathBuf> {
    let mut files = Vec::new();
    for root in codex_session_roots_for_home(codex_home) {
        collect_codex_jsonl_files(&root, &mut files);
    }
    files
        .into_iter()
        .find(|path| codex_history_file_matches_thread(path, thread_id))
}

async fn resolve_codex_home_for_provider(
    state: &AppState,
    workspace_id: &str,
    provider_profile_id: &str,
) -> Result<PathBuf, String> {
    let profile = resolve_codex_provider_profile(Some(provider_profile_id))?;
    match profile {
        CodexProviderProfile::Disk => {
            let (entry, parent_entry) =
                resolve_workspace_and_parent(&state.workspaces, workspace_id).await?;
            resolve_workspace_codex_home(&entry, parent_entry.as_ref())
                .or_else(resolve_default_codex_home)
                .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
        }
        managed_profile => materialize_codex_provider_profile(managed_profile)?
            .codex_home
            .ok_or_else(|| "managed Codex provider did not resolve CODEX_HOME".to_string()),
    }
}

pub(super) async fn copy_native_fork_history_to_selected_provider(
    state: &AppState,
    workspace_id: &str,
    child_thread_id: &str,
    parent_provider_profile_id: &str,
    selected_provider_profile_id: &str,
) -> Result<(), String> {
    if selected_provider_profile_id == parent_provider_profile_id {
        return Ok(());
    }

    let source_home =
        resolve_codex_home_for_provider(state, workspace_id, parent_provider_profile_id).await?;
    let target_home =
        resolve_codex_home_for_provider(state, workspace_id, selected_provider_profile_id).await?;
    if source_home == target_home {
        return Ok(());
    }

    let mut source_file = None;
    for _ in 0..10 {
        source_file = find_codex_history_file(&source_home, child_thread_id);
        if source_file.is_some() {
            break;
        }
        sleep(Duration::from_millis(100)).await;
    }
    let source_file = source_file.ok_or_else(|| {
        format!(
            "[CODEX_FORK_HISTORY_NOT_FOUND] workspaceId={workspace_id}; childThreadId={child_thread_id}; parentProviderProfileId={parent_provider_profile_id}; selectedProviderProfileId={selected_provider_profile_id}; sourceCodexHome={}",
            source_home.display()
        )
    })?;

    let source_roots = codex_session_roots_for_home(&source_home);
    let mut target_file = None;
    for source_root in &source_roots {
        let Ok(relative_path) = source_file.strip_prefix(source_root) else {
            continue;
        };
        let target_root_name = source_root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("sessions");
        target_file = Some(target_home.join(target_root_name).join(relative_path));
        break;
    }
    let target_file = target_file.ok_or_else(|| {
        format!(
            "[CODEX_FORK_HISTORY_PATH_INVALID] workspaceId={workspace_id}; childThreadId={child_thread_id}; sourcePath={}",
            source_file.display()
        )
    })?;
    if let Some(parent) = target_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(&source_file, &target_file).map_err(|error| {
        format!(
            "[CODEX_FORK_HISTORY_COPY_FAILED] workspaceId={workspace_id}; childThreadId={child_thread_id}; sourcePath={}; targetPath={}; reason={error}",
            source_file.display(),
            target_file.display()
        )
    })?;
    Ok(())
}
