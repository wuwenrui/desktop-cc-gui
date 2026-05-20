use super::*;
use serde_json::json;

fn test_workspace_path() -> PathBuf {
    std::env::temp_dir().join("ccgui-claude-test-workspace")
}

#[test]
fn build_mode_blocked_signal_from_error_maps_claude_ask_user_question_denial() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-a", "tool-ask-1", "AskUserQuestion", None);

    let event = session
        .build_mode_blocked_signal_from_error("turn-a", "AskUserQuestion tool permission denied")
        .expect("expected mode blocked signal");

    match event {
        EngineEvent::Raw { data, .. } => {
            assert_eq!(
                data.get("blockedMethod").and_then(|value| value.as_str()),
                Some("item/tool/requestUserInput")
            );
            assert_eq!(
                data.get("requestId").and_then(|value| value.as_str()),
                Some("tool-ask-1")
            );
            assert_eq!(
                data.get("reasonCode").and_then(|value| value.as_str()),
                Some("claude_ask_user_question_permission_denied")
            );
        }
        other => panic!("expected raw mode-blocked signal, got {:?}", other),
    }
}

#[test]
fn build_mode_blocked_signal_from_error_maps_claude_file_change_denial_to_approval_request() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool(
        "turn-a",
        "tool-edit-1",
        "Edit",
        Some(&json!({
            "file_path": "demo.txt",
            "content": "hello from fallback"
        })),
    );
    session.cache_tool_name("tool-edit-1", "Edit");
    session.cache_tool_input_value(
        "tool-edit-1",
        &json!({
            "file_path": "demo.txt",
            "content": "hello from fallback"
        }),
    );

    let event = session
        .build_mode_blocked_signal_from_error("turn-a", "Edit tool permission denied")
        .expect("expected approval request");

    match event {
        EngineEvent::ApprovalRequest {
            request_id,
            tool_name,
            input,
            message,
            ..
        } => {
            assert_eq!(request_id, Value::String("tool-edit-1".to_string()));
            assert_eq!(tool_name, "Edit");
            assert_eq!(
                input,
                Some(json!({
                    "file_path": "demo.txt",
                    "content": "hello from fallback"
                }))
            );
            assert_eq!(
                message.as_deref(),
                Some(
                    "Approve to let the GUI apply this file change locally. Preview currently supports structured file tools plus safe single-path file commands."
                )
            );
        }
        other => panic!("expected approval request, got {:?}", other),
    }
}

#[test]
fn build_mode_blocked_signal_from_error_maps_claude_command_denial() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-a", "tool-bash-1", "Bash", None);

    let event = session
        .build_mode_blocked_signal_from_error(
            "turn-a",
            "Output redirection was blocked. For security, Claude Code may only write to files in the allowed working directories for this session.",
        )
        .expect("expected mode blocked signal");

    match event {
        EngineEvent::Raw { data, .. } => {
            assert_eq!(
                data.get("blockedMethod").and_then(|value| value.as_str()),
                Some("item/commandExecution/requestApproval")
            );
            assert_eq!(
                data.get("requestId").and_then(|value| value.as_str()),
                Some("tool-bash-1")
            );
            assert_eq!(
                data.get("reasonCode").and_then(|value| value.as_str()),
                Some("claude_command_execution_permission_denied")
            );
        }
        other => panic!("expected raw mode-blocked signal, got {:?}", other),
    }
}

#[test]
fn build_mode_blocked_signal_from_error_maps_native_command_denial() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-a", "tool-native-1", "NativeCommand", None);

    let event = session
        .build_mode_blocked_signal_from_error(
            "turn-a",
            "Native command requires permission to access protected paths in the allowed working directories.",
        )
        .expect("expected mode blocked signal");

    match event {
        EngineEvent::Raw { data, .. } => {
            assert_eq!(
                data.get("blockedMethod").and_then(|value| value.as_str()),
                Some("item/commandExecution/requestApproval")
            );
            assert_eq!(
                data.get("requestId").and_then(|value| value.as_str()),
                Some("tool-native-1")
            );
            assert_eq!(
                data.get("toolName").and_then(|value| value.as_str()),
                Some("NativeCommand")
            );
        }
        other => panic!("expected raw mode-blocked signal, got {:?}", other),
    }
}

#[test]
fn convert_error_event_maps_command_permission_denial_to_mode_blocked() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-error", "tool-exec-1", "ExecuteCommand", None);

    let event = json!({
        "type": "error",
        "error": {
            "message": "ExecuteCommand was blocked for security because it may only write to files in the allowed working directories."
        }
    });

    let converted = session.convert_event("turn-error", &event);
    match converted {
        Some(EngineEvent::Raw { data, .. }) => {
            assert_eq!(
                data.get("blockedMethod").and_then(|value| value.as_str()),
                Some("item/commandExecution/requestApproval")
            );
            assert_eq!(
                data.get("requestId").and_then(|value| value.as_str()),
                Some("tool-exec-1")
            );
            assert_eq!(
                data.get("toolName").and_then(|value| value.as_str()),
                Some("ExecuteCommand")
            );
        }
        other => panic!("expected raw mode-blocked signal, got {:?}", other),
    }
}

#[test]
fn convert_error_event_maps_string_permission_denial_to_mode_blocked() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-error-string", "tool-shell-string", "Shell", None);

    let event = json!({
        "type": "error",
        "error": "Shell requires approval before running this command"
    });

    let converted = session.convert_event("turn-error-string", &event);
    match converted {
        Some(EngineEvent::Raw { data, .. }) => {
            assert_eq!(
                data.get("blockedMethod").and_then(|value| value.as_str()),
                Some("item/commandExecution/requestApproval")
            );
            assert_eq!(
                data.get("requestId").and_then(|value| value.as_str()),
                Some("tool-shell-string")
            );
        }
        other => panic!("expected raw mode-blocked signal, got {:?}", other),
    }
}

#[test]
fn build_mode_blocked_signal_from_error_ignores_non_permission_errors() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    session.register_pending_tool("turn-a", "tool-ask-1", "AskUserQuestion", None);

    assert!(session
        .build_mode_blocked_signal_from_error("turn-a", "tool timed out")
        .is_none());
}

#[test]
fn looks_like_claude_runtime_error_detects_api_json_eof() {
    assert!(looks_like_claude_runtime_error(
        "API Error: Unexpected end of JSON input"
    ));
    assert!(looks_like_claude_runtime_error(
        "error: transport dropped unexpectedly"
    ));
}

#[test]
fn looks_like_claude_runtime_error_ignores_regular_output() {
    assert!(!looks_like_claude_runtime_error("你好，我继续给你方案"));
    assert!(!looks_like_claude_runtime_error("{\"type\":\"assistant\"}"));
}
