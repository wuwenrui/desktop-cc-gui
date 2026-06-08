use super::{
    encode_project_path, list_claude_sessions_from_base_dir, load_claude_session_from_base_dir,
    ClaudeSessionAttributionScope,
};
use crate::engine::claude_history_entries::{
    is_claude_control_plane_entry, CLAUDE_CONTROL_EVENT_TOOL_TYPE,
};
use serde_json::json;
use uuid::Uuid;

fn create_project_dir(
    base_dir: &std::path::Path,
    workspace_path: &std::path::Path,
) -> std::path::PathBuf {
    let project_dir = base_dir.join(encode_project_path(&workspace_path.to_string_lossy()));
    std::fs::create_dir_all(&project_dir).expect("create project dir");
    project_dir
}

fn write_jsonl_lines(path: &std::path::Path, lines: &[serde_json::Value], line_ending: &str) {
    let payload = lines
        .iter()
        .map(|line| line.to_string())
        .collect::<Vec<String>>()
        .join(line_ending);
    std::fs::write(path, format!("{}{}", payload, line_ending)).expect("write session");
}

fn synthetic_continuation_summary_text() -> String {
    [
        "This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.",
        "",
        "Summary:",
        "Primary Request and Intent:",
        "The user asked to analyze the current project.",
        "",
        "Current Work:",
        "Continue the conversation from where it left off without asking the user any further questions.",
    ]
    .join("\n")
}

#[test]
fn codex_tui_client_info_with_experimental_api_is_control_plane() {
    let entry = json!({
        "params": {
            "clientInfo": { "name": "codex-tui", "title": "codex-tui" },
            "capabilities": { "experimentalApi": true }
        }
    });

    assert!(is_claude_control_plane_entry(&entry));
}

#[tokio::test]
async fn control_plane_only_transcript_does_not_create_visible_session() {
    let unique = Uuid::new_v4().to_string();
    let temp_root = std::env::temp_dir().join(format!("ccgui-claude-control-only-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");

    let project_dir = create_project_dir(&base_dir, &workspace_path);

    let session_id = format!("control-only-{}", unique);
    let session_path = project_dir.join(format!("{}.jsonl", session_id));
    let lines = vec![
        json!({
            "timestamp": "2026-05-09T00:00:00.000Z",
            "method": "initialize",
            "params": {
                "clientInfo": { "name": "ccgui", "title": "ccgui" },
                "capabilities": { "experimentalApi": true }
            }
        }),
        json!({
            "timestamp": "2026-05-09T00:00:01.000Z",
            "message": {
                "role": "user",
                "content": "developer_instructions=\"follow workspace policy\""
            }
        }),
        json!({
            "timestamp": "2026-05-09T00:00:02.000Z",
            "cwd": workspace_path.to_string_lossy(),
            "message": {
                "role": "user",
                "content": "<command-name>/resume</command-name>"
            }
        }),
        json!({
            "timestamp": "2026-05-09T00:00:03.000Z",
            "cwd": workspace_path.to_string_lossy(),
            "message": {
                "role": "assistant",
                "model": "<synthetic>",
                "content": "No response requested."
            }
        }),
    ];
    write_jsonl_lines(&session_path, &lines, "\n");

    let attribution_scopes = vec![ClaudeSessionAttributionScope::workspace_path(
        workspace_path.clone(),
    )];
    let sessions =
        list_claude_sessions_from_base_dir(&base_dir, &workspace_path, &attribution_scopes, None)
            .await
            .expect("list claude sessions");

    assert!(!sessions
        .iter()
        .any(|session| session.session_id == session_id));

    let _ = std::fs::remove_dir_all(&temp_root);
}

#[tokio::test]
async fn continuation_only_transcript_does_not_create_visible_session() {
    let unique = Uuid::new_v4().to_string();
    let temp_root = std::env::temp_dir().join(format!("ccgui-claude-continuation-only-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");
    let project_dir = create_project_dir(&base_dir, &workspace_path);

    let session_id = format!("continuation-only-{}", unique);
    let session_path = project_dir.join(format!("{}.jsonl", session_id));
    let lines = vec![json!({
        "uuid": "synthetic-summary",
        "timestamp": "2026-05-09T08:00:00.000Z",
        "isVisibleInTranscriptOnly": true,
        "isCompactSummary": true,
        "cwd": workspace_path.to_string_lossy(),
        "message": {
            "role": "user",
            "content": synthetic_continuation_summary_text()
        }
    })];
    write_jsonl_lines(&session_path, &lines, "\r\n");

    let attribution_scopes = vec![ClaudeSessionAttributionScope::workspace_path(
        workspace_path.clone(),
    )];
    let sessions =
        list_claude_sessions_from_base_dir(&base_dir, &workspace_path, &attribution_scopes, None)
            .await
            .expect("list claude sessions");

    assert!(!sessions
        .iter()
        .any(|session| session.session_id == session_id));

    let _ = std::fs::remove_dir_all(&temp_root);
}

#[tokio::test]
async fn mixed_transcript_filters_control_plane_and_keeps_real_messages() {
    let unique = Uuid::new_v4().to_string();
    let temp_root = std::env::temp_dir().join(format!("ccgui-claude-control-mixed-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");

    let project_dir = create_project_dir(&base_dir, &workspace_path);

    let session_id = format!("control-mixed-{}", unique);
    let session_path = project_dir.join(format!("{}.jsonl", session_id));
    let lines = vec![
        json!({
            "timestamp": "2026-05-09T00:00:00.000Z",
            "method": "initialize",
            "params": {
                "clientInfo": { "name": "ccgui", "title": "ccgui" },
                "capabilities": { "experimentalApi": true }
            }
        }),
        json!({
            "uuid": "resume-result",
            "timestamp": "2026-05-09T00:00:01.000Z",
            "cwd": workspace_path.to_string_lossy(),
            "message": {
                "role": "user",
                "content": "<local-command-stdout>Session 1778306483383 was not found.</local-command-stdout>"
            }
        }),
        json!({
            "uuid": "real-user",
            "timestamp": "2026-05-09T00:00:02.000Z",
            "cwd": workspace_path.to_string_lossy(),
            "message": { "role": "user", "content": "Fix the sidebar bug" }
        }),
        json!({
            "uuid": "real-assistant",
            "timestamp": "2026-05-09T00:00:03.000Z",
            "message": { "role": "assistant", "content": "I will inspect it." }
        }),
    ];
    write_jsonl_lines(&session_path, &lines, "\n");

    let attribution_scopes = vec![ClaudeSessionAttributionScope::workspace_path(
        workspace_path.clone(),
    )];
    let sessions =
        list_claude_sessions_from_base_dir(&base_dir, &workspace_path, &attribution_scopes, None)
            .await
            .expect("list claude sessions");
    let summary = sessions
        .iter()
        .find(|session| session.session_id == session_id)
        .expect("mixed session should remain visible");
    assert_eq!(summary.first_message, "Fix the sidebar bug");
    assert_eq!(summary.message_count, 2);

    let result = load_claude_session_from_base_dir(&base_dir, &workspace_path, &session_id)
        .await
        .expect("load session");
    assert_eq!(result.messages.len(), 3);
    assert!(result
        .messages
        .iter()
        .any(|message| message.id == "real-user" && message.text == "Fix the sidebar bug"));
    assert!(result
        .messages
        .iter()
        .any(
            |message| message.tool_type.as_deref() == Some(CLAUDE_CONTROL_EVENT_TOOL_TYPE)
                && message.text == "Session 1778306483383 was not found."
        ));
    assert!(!result
        .messages
        .iter()
        .any(|message| message.text.contains("initialize")));

    let _ = std::fs::remove_dir_all(&temp_root);
}

#[tokio::test]
async fn mixed_transcript_filters_continuation_summary_and_keeps_real_messages() {
    let unique = Uuid::new_v4().to_string();
    let temp_root =
        std::env::temp_dir().join(format!("ccgui-claude-continuation-mixed-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");
    let project_dir = create_project_dir(&base_dir, &workspace_path);

    let session_id = format!("continuation-mixed-{}", unique);
    let session_path = project_dir.join(format!("{}.jsonl", session_id));
    let lines = vec![
        json!({
            "uuid": "synthetic-summary",
            "timestamp": "2026-05-09T08:00:00.000Z",
            "isVisibleInTranscriptOnly": true,
            "isCompactSummary": true,
            "cwd": workspace_path.to_string_lossy(),
            "message": {
                "role": "user",
                "content": synthetic_continuation_summary_text()
            }
        }),
        json!({
            "uuid": "real-user",
            "timestamp": "2026-05-09T08:00:01.000Z",
            "cwd": workspace_path.to_string_lossy(),
            "message": { "role": "user", "content": "Fix the file tree flicker" }
        }),
        json!({
            "uuid": "real-assistant",
            "timestamp": "2026-05-09T08:00:02.000Z",
            "message": { "role": "assistant", "content": "I will inspect the file tree restore path." }
        }),
    ];
    write_jsonl_lines(&session_path, &lines, "\n");

    let attribution_scopes = vec![ClaudeSessionAttributionScope::workspace_path(
        workspace_path.clone(),
    )];
    let sessions =
        list_claude_sessions_from_base_dir(&base_dir, &workspace_path, &attribution_scopes, None)
            .await
            .expect("list claude sessions");
    let summary = sessions
        .iter()
        .find(|session| session.session_id == session_id)
        .expect("mixed continuation session should remain visible");
    assert_eq!(summary.first_message, "Fix the file tree flicker");
    assert_eq!(summary.message_count, 2);

    let result = load_claude_session_from_base_dir(&base_dir, &workspace_path, &session_id)
        .await
        .expect("load session");
    assert_eq!(result.messages.len(), 2);
    assert!(result
        .messages
        .iter()
        .any(|message| message.id == "real-user" && message.text == "Fix the file tree flicker"));
    assert!(!result.messages.iter().any(|message| message
        .text
        .contains("This session is being continued from a previous conversation")));

    let _ = std::fs::remove_dir_all(&temp_root);
}
