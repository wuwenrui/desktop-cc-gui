use super::*;
use serde_json::json;
use tokio::sync::broadcast::error::TryRecvError;

fn test_workspace_path() -> PathBuf {
    std::env::temp_dir().join("ccgui-claude-context-usage-test-workspace")
}

#[test]
fn convert_event_ignores_invalid_context_usage_numbers() {
    let session = ClaudeSession::new("test-workspace".to_string(), test_workspace_path(), None);
    let mut receiver = session.subscribe();
    let event = json!({
        "type": "system",
        "subtype": "status",
        "context_window": {
            "current_usage": {
                "input_tokens": -1,
                "cache_creation_input_tokens": i64::MAX,
                "cache_read_input_tokens": 1,
                "output_tokens": "NaN"
            },
            "context_window_size": -258_400,
            "used_percentage": "NaN",
            "remaining_percentage": -1
        }
    });

    let _ = session.convert_event("turn-invalid-usage", &event);

    assert!(matches!(receiver.try_recv(), Err(TryRecvError::Empty)));
}
