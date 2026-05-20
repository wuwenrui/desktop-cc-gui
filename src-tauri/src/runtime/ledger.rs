use std::fs;
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::pool_types::{RuntimePoolDiagnostics, RuntimePoolRow};
use super::process_diagnostics::terminate_pid_tree;
use super::{now_millis, RuntimeManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PersistedRuntimeLedger {
    pub(super) rows: Vec<RuntimePoolRow>,
    pub(super) diagnostics: RuntimePoolDiagnostics,
}

pub(super) fn write_json_atomically(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("runtime ledger path has no parent: {}", path.display()))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            format!(
                "runtime ledger path has invalid filename: {}",
                path.display()
            )
        })?;
    let temp_path = parent.join(format!(".{filename}.{}.tmp", uuid::Uuid::new_v4()));
    let mut temp_file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)
        .map_err(|error| error.to_string())?;
    temp_file
        .write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    temp_file.sync_all().map_err(|error| error.to_string())?;
    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(error.to_string());
    }
    Ok(())
}

impl RuntimeManager {
    pub(super) async fn persist_ledger(&self) -> Result<(), String> {
        let rows = self
            .entries
            .lock()
            .await
            .values()
            .filter(|entry| {
                entry.pid.is_some()
                    || entry.error.is_some()
                    || entry.foreground_work_state.is_some()
            })
            .cloned()
            .map(|entry| {
                let mut entry = entry;
                entry.note_foreground_work_timeout();
                let state = Self::classify_state(&entry);
                let turn_lease_count = entry.turn_leases.len() as u32;
                let stream_lease_count = entry.stream_leases.len() as u32;
                let lease_sources = entry.lease_sources();
                let active_work_protected = entry.has_active_work_protection();
                let active_work_reason = entry.active_work_reason();
                let recent_spawn_count = entry.recent_spawn_count();
                let recent_replace_count = entry.recent_replace_count();
                let recent_force_kill_count = entry.recent_force_kill_count();
                let runtime_generation = entry.runtime_generation();
                let (lifecycle_state, reason_code, recovery_source, retryable, user_action) =
                    Self::lifecycle_projection(&entry, &state);
                RuntimePoolRow {
                    workspace_id: entry.workspace_id,
                    workspace_name: entry.workspace_name,
                    workspace_path: entry.workspace_path,
                    engine: entry.engine,
                    state,
                    lifecycle_state,
                    pid: entry.pid,
                    runtime_generation,
                    wrapper_kind: entry.wrapper_kind,
                    resolved_bin: entry.resolved_bin,
                    started_at_ms: entry.started_at_ms,
                    last_used_at_ms: entry.last_used_at_ms,
                    pinned: entry.pinned,
                    turn_lease_count,
                    stream_lease_count,
                    lease_sources,
                    active_work_protected,
                    active_work_reason,
                    active_work_since_ms: entry
                        .active_work_since_ms
                        .or(entry.foreground_work_since_ms),
                    active_work_last_renewed_at_ms: entry
                        .active_work_last_renewed_at_ms
                        .or(entry.foreground_work_last_event_at_ms),
                    foreground_work_state: entry.foreground_work_state.clone(),
                    foreground_work_source: entry.foreground_work_source.clone(),
                    foreground_work_thread_id: entry.foreground_work_thread_id.clone(),
                    foreground_work_turn_id: entry.foreground_work_turn_id.clone(),
                    foreground_work_since_ms: entry.foreground_work_since_ms,
                    foreground_work_timeout_at_ms: entry.foreground_work_timeout_at_ms,
                    foreground_work_last_event_at_ms: entry.foreground_work_last_event_at_ms,
                    foreground_work_timed_out: entry.foreground_work_timed_out,
                    evict_candidate: entry.evict_candidate,
                    eviction_reason: entry.eviction_reason,
                    error: entry.error,
                    last_exit_reason_code: entry.last_exit_reason_code,
                    last_exit_message: entry.last_exit_message,
                    last_exit_at_ms: entry.last_exit_at_ms,
                    last_exit_code: entry.last_exit_code,
                    last_exit_signal: entry.last_exit_signal,
                    last_exit_pending_request_count: entry.last_exit_pending_request_count,
                    process_diagnostics: entry.process_diagnostics,
                    startup_state: entry.startup_state.clone(),
                    last_recovery_source: entry.last_recovery_source.clone(),
                    last_guard_state: entry.last_guard_state.clone(),
                    last_replace_reason: entry.last_replace_reason.clone(),
                    last_probe_failure: entry.last_probe_failure.clone(),
                    last_probe_failure_source: entry.last_probe_failure_source.clone(),
                    reason_code,
                    recovery_source,
                    retryable,
                    user_action,
                    has_stopping_predecessor: entry.has_stopping_predecessor,
                    recent_spawn_count,
                    recent_replace_count,
                    recent_force_kill_count,
                }
            })
            .collect::<Vec<_>>();
        let diagnostics = self.diagnostics.lock().await.clone();
        let payload = serde_json::to_string_pretty(&PersistedRuntimeLedger { rows, diagnostics })
            .map_err(|error| error.to_string())?;
        write_json_atomically(&self.ledger_path, &payload)
    }

    pub(crate) fn orphan_sweep_on_startup(&self, enabled: bool) {
        if !enabled {
            return;
        }
        let raw_ledger = match fs::read_to_string(&self.ledger_path) {
            Ok(raw_ledger) => raw_ledger,
            Err(_) => return,
        };
        let parsed = match serde_json::from_str::<PersistedRuntimeLedger>(&raw_ledger) {
            Ok(parsed) => parsed,
            Err(_) => return,
        };
        let mut diagnostics = parsed.diagnostics;
        diagnostics.last_orphan_sweep_at_ms = Some(now_millis());
        diagnostics.orphan_entries_found += parsed.rows.len() as u32;
        for row in parsed.rows {
            if let Some(process_diagnostics) = row.process_diagnostics {
                diagnostics.startup_orphan_residue_processes = diagnostics
                    .startup_orphan_residue_processes
                    .saturating_add(process_diagnostics.node_processes);
            }
            let Some(pid) = row.pid else {
                continue;
            };
            match terminate_pid_tree(pid) {
                Ok(force_killed) => {
                    diagnostics.orphan_entries_cleaned += 1;
                    if force_killed {
                        diagnostics.force_kill_count += 1;
                    }
                }
                Err(_) => diagnostics.orphan_entries_failed += 1,
            }
        }
        let payload = PersistedRuntimeLedger {
            rows: Vec::new(),
            diagnostics: diagnostics.clone(),
        };
        if let Ok(serialized) = serde_json::to_string_pretty(&payload) {
            let _ = write_json_atomically(&self.ledger_path, &serialized);
        }
        *self.diagnostics.blocking_lock() = diagnostics;
    }
}
