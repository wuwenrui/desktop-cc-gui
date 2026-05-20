use super::{
    delete_claude_session_with_config, encode_project_path,
    fork_claude_session_from_message_in_base_dir,
};
use serde_json::json;
use uuid::Uuid;

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

#[tokio::test]
async fn fork_claude_session_from_message_truncates_before_target_user_message() {
    let unique = Uuid::new_v4().to_string();
    let temp_root = std::env::temp_dir().join(format!("ccgui-claude-fork-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");

    let project_dir = base_dir.join(encode_project_path(&workspace_path.to_string_lossy()));
    std::fs::create_dir_all(&project_dir).expect("create project dir");

    let source_session_id = format!("source-session-{}", unique);
    let source_path = project_dir.join(format!("{}.jsonl", source_session_id));
    let target_message_id = Uuid::new_v4().to_string();
    let lines = vec![
        json!({
            "uuid": "synthetic-summary",
            "session_id": source_session_id,
            "isVisibleInTranscriptOnly": true,
            "isCompactSummary": true,
            "message": { "role": "user", "content": synthetic_continuation_summary_text() }
        }),
        json!({
            "uuid": "control-instructions",
            "session_id": source_session_id,
            "message": { "role": "user", "content": "developer_instructions=\"follow workspace policy\"" }
        }),
        json!({
            "uuid": Uuid::new_v4().to_string(),
            "session_id": source_session_id,
            "message": { "role": "user", "content": "first user message" }
        }),
        json!({
            "uuid": Uuid::new_v4().to_string(),
            "sessionId": source_session_id,
            "message": { "role": "assistant", "content": "assistant reply" }
        }),
        json!({
            "uuid": target_message_id,
            "session_id": source_session_id,
            "message": { "role": "user", "content": "target user message" }
        }),
        json!({
            "uuid": Uuid::new_v4().to_string(),
            "session_id": source_session_id,
            "message": { "role": "assistant", "content": "must be truncated" }
        }),
    ];
    let payload = lines
        .iter()
        .map(|line| line.to_string())
        .collect::<Vec<String>>()
        .join("\n");
    std::fs::write(&source_path, format!("{}\n", payload)).expect("write source session");

    let forked_session_id = fork_claude_session_from_message_in_base_dir(
        &base_dir,
        &workspace_path,
        &source_session_id,
        &target_message_id,
    )
    .await
    .expect("fork from target message");

    let forked_path = project_dir.join(format!("{}.jsonl", forked_session_id));
    assert!(forked_path.exists());
    let forked_text = std::fs::read_to_string(&forked_path).expect("read forked session");
    assert!(!forked_text.contains("This session is being continued from a previous conversation"));
    assert!(!forked_text.contains("developer_instructions="));
    let forked_lines: Vec<_> = forked_text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    assert_eq!(forked_lines.len(), 2);

    let parsed_lines: Vec<serde_json::Value> = forked_lines
        .iter()
        .map(|line| serde_json::from_str(line).expect("parse forked line"))
        .collect();
    for entry in &parsed_lines {
        let rewritten = entry
            .get("session_id")
            .or_else(|| entry.get("sessionId"))
            .and_then(|value| value.as_str());
        assert_eq!(rewritten, Some(forked_session_id.as_str()));
    }
    assert_eq!(
        parsed_lines[1]
            .get("message")
            .and_then(|message| message.get("role"))
            .and_then(|value| value.as_str()),
        Some("assistant")
    );
    assert!(!parsed_lines
        .iter()
        .any(|entry| entry.get("uuid").and_then(|value| value.as_str())
            == Some(target_message_id.as_str())));

    let _ = std::fs::remove_dir_all(&temp_root);
}

#[tokio::test]
async fn fork_claude_session_from_message_errors_when_target_not_found() {
    let unique = Uuid::new_v4().to_string();
    let temp_root = std::env::temp_dir().join(format!("ccgui-claude-fork-miss-{}", unique));
    let base_dir = temp_root.join("claude-projects");
    let workspace_path = temp_root.join("workspace");
    std::fs::create_dir_all(&workspace_path).expect("create workspace path");
    std::fs::create_dir_all(&base_dir).expect("create base dir");

    let project_dir = base_dir.join(encode_project_path(&workspace_path.to_string_lossy()));
    std::fs::create_dir_all(&project_dir).expect("create project dir");

    let source_session_id = format!("source-session-{}", unique);
    let source_path = project_dir.join(format!("{}.jsonl", source_session_id));
    let lines = vec![
        json!({
            "uuid": Uuid::new_v4().to_string(),
            "session_id": source_session_id,
            "message": { "role": "user", "content": "first user message" }
        }),
        json!({
            "uuid": Uuid::new_v4().to_string(),
            "session_id": source_session_id,
            "message": { "role": "assistant", "content": "assistant reply" }
        }),
    ];
    let payload = lines
        .iter()
        .map(|line| line.to_string())
        .collect::<Vec<String>>()
        .join("\n");
    std::fs::write(&source_path, format!("{}\n", payload)).expect("write source session");

    let before_files: Vec<_> = std::fs::read_dir(&project_dir)
        .expect("list project files")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .collect();
    let error = fork_claude_session_from_message_in_base_dir(
        &base_dir,
        &workspace_path,
        &source_session_id,
        "missing-user-message-id",
    )
    .await
    .expect_err("target message should be missing");
    assert!(error.contains("Target user message not found"));
    let after_files: Vec<_> = std::fs::read_dir(&project_dir)
        .expect("list project files")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .collect();
    assert_eq!(after_files.len(), before_files.len());

    let _ = std::fs::remove_dir_all(&temp_root);
}

#[tokio::test]
async fn load_claude_session_rejects_invalid_session_id() {
    let workspace_path = std::env::temp_dir();
    let error = super::load_claude_session_with_config(&workspace_path, "../secrets", None)
        .await
        .expect_err("invalid session id should fail");
    assert!(error.contains("Invalid Claude session id"));
}

#[tokio::test]
async fn delete_claude_session_rejects_invalid_session_id() {
    let workspace_path = std::env::temp_dir();
    let error = delete_claude_session_with_config(&workspace_path, "..\\secrets", None)
        .await
        .expect_err("invalid session id should fail");
    assert!(error.contains("Invalid Claude session id"));
}

#[tokio::test]
async fn delete_claude_session_rejects_current_directory_session_id() {
    let workspace_path = std::env::temp_dir();
    let error = delete_claude_session_with_config(&workspace_path, ".", None)
        .await
        .expect_err("dot session id should fail");
    assert!(error.contains("Invalid Claude session id"));
}
