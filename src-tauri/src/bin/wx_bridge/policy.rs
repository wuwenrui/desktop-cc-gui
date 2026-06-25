//! Policy / safety layer for the WeChat channel.
//!
//! The daemon authenticates a client but applies NO per-method authorization
//! after auth (cc_gui_daemon.rs:2165 dispatches any method once authenticated).
//! Therefore the ONLY enforcement point for the WeChat channel is here, in the
//! bridge. Posture is DEFAULT-DENY: every one of the daemon's ~162 RPC methods is
//! denied unless explicitly allow-listed for the WeChat control channel.

/// Outcome of a policy check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Deny(String),
}

/// Methods the WeChat channel may invoke. The bridge selects the engine access
/// mode per message through the remote-control risk tier.
const ALLOWED_METHODS: &[&str] = &[
    "engine_send_message_sync", // Claude turn; accessMode is selected per permission tier.
    "skills_list",              // list available legal skills
    "list_workspaces",          // resolve a workspace for the lawyer
    "add_workspace",            // bind a WeChat user to an explicitly requested directory
    "get_active_engine",
    "ping",
];

/// Methods that are explicitly dangerous and must never be called directly from
/// WeChat, listed for defense-in-depth and clear audit messages.
/// (Default-deny already covers these; this makes intent and logs explicit.)
const HIGH_RISK_METHODS: &[&str] = &[
    "file_write",
    "write_external_absolute_file",
    "read_external_absolute_file",
    "git_push",
    "git_sync",
    "git_pull",
    "commit_git",
    "create_git_pr_workflow",
    "delete_workspace_sessions",
    "delete_claude_session",
    "send_user_message", // Codex write path; deferred to P7
    "start_thread",
];

/// Classify a daemon method for the WeChat channel.
pub fn classify_method(method: &str) -> Decision {
    if HIGH_RISK_METHODS.contains(&method) {
        return Decision::Deny(high_risk_reason(method));
    }
    if ALLOWED_METHODS.contains(&method) {
        return Decision::Allow;
    }
    Decision::Deny("该操作未在微信通道开放".to_string())
}

fn high_risk_reason(method: &str) -> String {
    let human = match method {
        "file_write" | "write_external_absolute_file" => "写文件",
        "read_external_absolute_file" => "读取工作区外的文件",
        "git_push" | "git_sync" | "git_pull" | "commit_git" | "create_git_pr_workflow" => {
            "代码/版本操作"
        }
        "delete_workspace_sessions" | "delete_claude_session" => "删除会话",
        "send_user_message" | "start_thread" => "Codex 写操作",
        _ => "高风险操作",
    };
    human.to_string()
}

/// Detect a path that escapes a workspace root: absolute paths or any `..`
/// traversal segment. Used before allowing any (future) file operation.
#[cfg(test)]
pub fn is_path_escape(path: &str) -> bool {
    let p = path.trim();
    if p.starts_with('/') || p.starts_with('\\') {
        return true;
    }
    // Windows drive-letter absolute, e.g. C:\
    let bytes = p.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic() {
        return true;
    }
    p.split(['/', '\\']).any(|seg| seg == "..")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_readonly_conversation() {
        assert_eq!(classify_method("engine_send_message_sync"), Decision::Allow);
        assert_eq!(classify_method("skills_list"), Decision::Allow);
        assert_eq!(classify_method("add_workspace"), Decision::Allow);
    }

    #[test]
    fn denies_high_risk_with_human_reason() {
        match classify_method("file_write") {
            Decision::Deny(reason) => assert!(reason.contains("写文件")),
            _ => panic!("file_write must be denied"),
        }
        assert!(matches!(classify_method("git_push"), Decision::Deny(_)));
        assert!(matches!(
            classify_method("send_user_message"),
            Decision::Deny(_)
        ));
    }

    #[test]
    fn unknown_method_denied_by_default() {
        // Any of the daemon's other ~162 methods must be denied.
        assert!(matches!(
            classify_method("connect_workspace"),
            Decision::Deny(_)
        ));
        assert!(matches!(
            classify_method("checkout_git_branch"),
            Decision::Deny(_)
        ));
        assert!(matches!(
            classify_method("totally_made_up"),
            Decision::Deny(_)
        ));
    }

    #[test]
    fn detects_path_escape() {
        assert!(is_path_escape("/etc/passwd"));
        assert!(is_path_escape("../secret"));
        assert!(is_path_escape("a/../../b"));
        assert!(is_path_escape("C:\\Windows"));
        assert!(!is_path_escape("notes/draft.md"));
        assert!(!is_path_escape("sub/dir/file.txt"));
    }
}
