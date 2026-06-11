    use super::*;
    use crate::types::{WorkspaceKind, WorkspaceSettings, WorktreeInfo};
    use std::io::Write;
    use uuid::Uuid;

    fn workspace_entry(
        id: &str,
        name: &str,
        path: &str,
        kind: WorkspaceKind,
        parent_id: Option<&str>,
    ) -> WorkspaceEntry {
        WorkspaceEntry {
            id: id.to_string(),
            name: name.to_string(),
            path: path.to_string(),
            codex_bin: None,
            kind: kind.clone(),
            parent_id: parent_id.map(ToString::to_string),
            worktree: if kind.is_worktree() {
                Some(WorktreeInfo {
                    branch: "feature/test".to_string(),
                    base_ref: None,
                    base_commit: None,
                    tracking: None,
                    publish_error: None,
                    publish_retry_command: None,
                })
            } else {
                None
            },
            settings: WorkspaceSettings::default(),
        }
    }

    fn catalog_entry(
        session_id: &str,
        workspace_id: &str,
        workspace_label: Option<&str>,
        cwd: Option<&str>,
    ) -> WorkspaceSessionCatalogEntry {
        WorkspaceSessionCatalogEntry {
            session_id: session_id.to_string(),
            stable_session_key: None,
            canonical_session_id: Some(session_id.to_string()),
            parent_session_id: None,
            workspace_id: workspace_id.to_string(),
            workspace_label: workspace_label.map(ToString::to_string),
            engine: "codex".to_string(),
            title: "Example session".to_string(),
            updated_at: 1,
            archived_at: None,
            thread_kind: "native".to_string(),
            source: Some("cli".to_string()),
            source_label: Some("cli/codex".to_string()),
            provider_profile_id: None,
            provider_profile_source: None,
            provider_profile_name: None,
            provider_availability: None,
            source_completeness: None,
            source_status_reason: None,
            size_bytes: None,
            cwd: cwd.map(ToString::to_string),
            attribution_status: None,
            attribution_reason: None,
            attribution_confidence: None,
            matched_workspace_id: None,
            matched_workspace_label: None,
            folder_id: None,
            auto_session: None,
            exists_on_disk: true,
            inconsistency_code: None,
            delete_mode: Some(SESSION_DELETE_MODE_PHYSICAL.to_string()),
            physical_path: None,
            children_count: None,
        }
    }

    fn write_codex_session_fixture(
        codex_home: &Path,
        session_id: &str,
        cwd: &str,
    ) -> std::path::PathBuf {
        write_codex_session_fixture_with_message(
            codex_home,
            session_id,
            cwd,
            "2026-01-19T12:00:00.000Z",
            "2026-01-19T12:00:05.000Z",
            "Fixture session",
        )
    }

    fn write_codex_session_fixture_with_message(
        codex_home: &Path,
        session_id: &str,
        cwd: &str,
        metadata_timestamp: &str,
        message_timestamp: &str,
        message: &str,
    ) -> std::path::PathBuf {
        let day_dir = codex_home
            .join("sessions")
            .join("2026")
            .join("01")
            .join("19");
        std::fs::create_dir_all(&day_dir).expect("create codex fixture day dir");
        let path = day_dir.join(format!("{session_id}.jsonl"));
        let mut file = std::fs::File::create(&path).expect("create codex fixture");
        writeln!(
                file,
                r#"{{"timestamp":"{metadata_timestamp}","type":"session_meta","payload":{{"id":"{session_id}","cwd":"{cwd}"}}}}"#
            )
            .expect("write codex fixture metadata");
        writeln!(
                file,
                r#"{{"timestamp":"{message_timestamp}","type":"response_item","payload":{{"type":"message","role":"user","content":[{{"type":"input_text","text":"{message}"}}]}}}}"#
            )
            .expect("write codex fixture message");
        path
    }

    fn create_claude_project_dir(base_dir: &Path, workspace_path: &Path) -> std::path::PathBuf {
        let encoded = workspace_path
            .to_string_lossy()
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' {
                    c
                } else {
                    '-'
                }
            })
            .collect::<String>();
        let project_dir = base_dir.join(encoded);
        std::fs::create_dir_all(&project_dir).expect("create claude project dir");
        project_dir
    }

    fn write_claude_session_fixture(
        claude_projects_dir: &Path,
        workspace_path: &Path,
        session_id: &str,
        cwd: &Path,
        message: &str,
    ) {
        let project_dir = create_claude_project_dir(claude_projects_dir, workspace_path);
        let session_path = project_dir.join(format!("{session_id}.jsonl"));
        let mut file = std::fs::File::create(session_path).expect("create claude fixture");
        writeln!(
                file,
                r#"{{"uuid":"user-1","timestamp":"2026-01-19T12:00:00.000Z","session_id":"{session_id}","cwd":"{}","message":{{"role":"user","content":"{message}"}}}}"#,
                cwd.to_string_lossy()
            )
            .expect("write claude fixture");
    }

    fn codex_fixture_timestamp(minutes_before_latest: usize) -> String {
        let latest_total_minutes: usize = 20 * 60;
        let total_minutes = latest_total_minutes.saturating_sub(minutes_before_latest);
        format!(
            "2026-01-19T{:02}:{:02}:00.000Z",
            total_minutes / 60,
            total_minutes % 60
        )
    }

    fn workspace_with_codex_home(
        id: &str,
        name: &str,
        path: &str,
        codex_home: &Path,
    ) -> WorkspaceEntry {
        let mut workspace = workspace_entry(id, name, path, WorkspaceKind::Main, None);
        workspace.settings.codex_home = Some(codex_home.to_string_lossy().to_string());
        workspace
    }
