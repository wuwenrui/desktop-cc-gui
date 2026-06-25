//! Shared types for the WeChat <-> cc_gui_daemon bridge (wx_bridge).
//!
//! The bridge is an independent, self-contained binary (like cc_gui_daemon). It
//! does NOT reuse `remote_backend` from the Tauri lib because that module is
//! `pub(crate)` and coupled to Tauri's `AppHandle`/`AppState`. The bridge speaks
//! the daemon's line-delimited JSON-RPC protocol over TCP directly.

use serde::{Deserialize, Serialize};

/// A normalized inbound message coming from the WeChat transport (WeClaw).
///
/// `text` already contains voice-to-text output when the original WeChat message
/// was a voice note (the transport performs STT before handing it to us).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IncomingMessage {
    /// The lawyer's WeChat id. This is the binding key: each lawyer drives their
    /// own local daemon, identified by this id.
    pub wxid: String,
    /// WeChat message id, used for idempotent de-duplication.
    pub msg_id: String,
    /// Text content (or STT transcript of a voice note).
    pub text: String,
    /// Image references (URLs or base64) forwarded to the daemon `images` param.
    pub images: Vec<String>,
}

/// A reply to send back into WeChat.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct OutgoingReply {
    pub text: String,
    pub images: Vec<String>,
    pub files: Vec<String>,
}

impl OutgoingReply {
    pub fn text(value: impl Into<String>) -> Self {
        Self {
            text: value.into(),
            images: Vec::new(),
            files: Vec::new(),
        }
    }
}

/// Result of the daemon's `engine_send_message_sync` for a Claude turn.
///
/// Shape verified against cc_gui_daemon/daemon_state.rs:1613-1617
/// `{ "engine": "claude", "sessionId": <string|null>, "text": <string> }`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaudeReply {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub text: String,
}

/// Bridge-level error surfaced to the lawyer as a human-readable WeChat reply.
#[derive(Debug, Clone)]
pub enum BridgeError {
    /// Request was rejected by the policy layer (e.g. high-risk method).
    Denied(String),
    /// The daemon could not be reached or returned an error.
    Daemon(String),
}

impl BridgeError {
    /// A lawyer-facing message: plain language, no stack traces or internals.
    pub fn user_message(&self) -> String {
        match self {
            BridgeError::Denied(reason) => {
                format!("本机安全策略拦截了这一步：{reason}。我没有执行；请在微信里补充更明确的授权或调整指令。")
            }
            BridgeError::Daemon(_) => {
                "本机 agent 暂时没有返回结果。这条微信请求没有完成，请直接在微信里重发或发送“继续”。".to_string()
            }
        }
    }
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgeError::Denied(reason) => write!(f, "denied: {reason}"),
            BridgeError::Daemon(reason) => write!(f, "daemon: {reason}"),
        }
    }
}

impl std::error::Error for BridgeError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_message_never_leaks_internal_detail() {
        let err = BridgeError::Daemon("TcpStream connect refused at 127.0.0.1:4732".into());
        let msg = err.user_message();
        assert!(!msg.contains("127.0.0.1"));
        assert!(!msg.contains("TcpStream"));
    }

    #[test]
    fn denied_message_surfaces_reason_in_plain_language() {
        let err = BridgeError::Denied("写文件".into());
        let msg = err.user_message();
        assert!(msg.contains("写文件"));
        assert!(!msg.contains("电脑端"));
        assert!(!msg.contains("桌面端"));
    }

    #[test]
    fn claude_reply_deserializes_daemon_shape() {
        let raw = serde_json::json!({
            "engine": "claude",
            "sessionId": "sess-1",
            "text": "你好",
        });
        let reply: ClaudeReply = serde_json::from_value(raw).unwrap();
        assert_eq!(reply.session_id.as_deref(), Some("sess-1"));
        assert_eq!(reply.text, "你好");
    }

    #[test]
    fn claude_reply_tolerates_null_session() {
        let raw = serde_json::json!({ "engine": "claude", "sessionId": null, "text": "hi" });
        let reply: ClaudeReply = serde_json::from_value(raw).unwrap();
        assert_eq!(reply.session_id, None);
    }
}
