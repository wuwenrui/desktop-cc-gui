//! Maps a lawyer (WeChat id) to their workspace and last Claude session.
//!
//! Two jobs:
//! 1. Resolve which daemon `workspaceId` a message acts on (required param of
//!    engine_send_message_sync).
//! 2. Track the last `sessionId` per lawyer so follow-up messages continue the
//!    same Claude conversation (fluency).
//!
//! Strict per-wxid isolation: one lawyer's session is never visible to another
//! (R1 cross-talk prevention at the bridge's own state layer).

use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Default)]
struct SessionState {
    workspace_id: Option<String>,
    session_id: Option<String>,
}

pub struct SessionMap {
    inner: Mutex<HashMap<String, SessionState>>,
}

impl SessionMap {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Resolve the workspace for `wxid`, falling back to `default_ws` when the
    /// lawyer has no explicitly bound workspace yet.
    pub fn workspace_for(&self, wxid: &str, default_ws: &str) -> String {
        let guard = self.inner.lock().expect("session map lock");
        guard
            .get(wxid)
            .and_then(|s| s.workspace_id.clone())
            .unwrap_or_else(|| default_ws.to_string())
    }

    /// The last Claude session id for `wxid`, used to continue the conversation.
    pub fn last_session(&self, wxid: &str) -> Option<String> {
        let guard = self.inner.lock().expect("session map lock");
        guard.get(wxid).and_then(|s| s.session_id.clone())
    }

    /// Record the workspace + session produced by a turn for `wxid`.
    pub fn record(&self, wxid: &str, workspace_id: &str, session_id: Option<String>) {
        let mut guard = self.inner.lock().expect("session map lock");
        let entry = guard.entry(wxid.to_string()).or_default();
        entry.workspace_id = Some(workspace_id.to_string());
        if session_id.is_some() {
            entry.session_id = session_id;
        }
    }

    /// Clear only the active Claude session for `wxid`; keep workspace binding.
    pub fn clear_session(&self, wxid: &str) {
        let mut guard = self.inner.lock().expect("session map lock");
        if let Some(entry) = guard.get_mut(wxid) {
            entry.session_id = None;
        }
    }

    /// Bind `wxid` to a new workspace and start a fresh agent session there.
    pub fn bind_workspace(&self, wxid: &str, workspace_id: &str) {
        let mut guard = self.inner.lock().expect("session map lock");
        let entry = guard.entry(wxid.to_string()).or_default();
        entry.workspace_id = Some(workspace_id.to_string());
        entry.session_id = None;
    }
}

impl Default for SessionMap {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_lawyer_gets_default_workspace_and_no_session() {
        let m = SessionMap::new();
        assert_eq!(m.workspace_for("wx-a", "ws-default"), "ws-default");
        assert_eq!(m.last_session("wx-a"), None);
    }

    #[test]
    fn records_and_continues_session() {
        let m = SessionMap::new();
        m.record("wx-a", "ws-1", Some("sess-1".into()));
        assert_eq!(m.workspace_for("wx-a", "ws-default"), "ws-1");
        assert_eq!(m.last_session("wx-a"), Some("sess-1".into()));
    }

    #[test]
    fn sessions_isolated_between_lawyers() {
        let m = SessionMap::new();
        m.record("wx-a", "ws-a", Some("sess-a".into()));
        m.record("wx-b", "ws-b", Some("sess-b".into()));
        assert_eq!(m.last_session("wx-a"), Some("sess-a".into()));
        assert_eq!(m.last_session("wx-b"), Some("sess-b".into()));
        // a's workspace never leaks to b
        assert_eq!(m.workspace_for("wx-b", "ws-default"), "ws-b");
    }

    #[test]
    fn workspace_preserved_when_session_update_is_none() {
        let m = SessionMap::new();
        m.record("wx-a", "ws-1", Some("sess-1".into()));
        m.record("wx-a", "ws-1", None); // a turn that returned no session id
        assert_eq!(m.last_session("wx-a"), Some("sess-1".into()));
        assert_eq!(m.workspace_for("wx-a", "d"), "ws-1");
    }

    #[test]
    fn clear_session_preserves_workspace_binding() {
        let m = SessionMap::new();
        m.record("wx-a", "ws-1", Some("sess-1".into()));

        m.clear_session("wx-a");

        assert_eq!(m.last_session("wx-a"), None);
        assert_eq!(m.workspace_for("wx-a", "d"), "ws-1");
    }

    #[test]
    fn bind_workspace_resets_session_for_new_directory_context() {
        let m = SessionMap::new();
        m.record("wx-a", "ws-1", Some("sess-1".into()));

        m.bind_workspace("wx-a", "ws-2");

        assert_eq!(m.workspace_for("wx-a", "d"), "ws-2");
        assert_eq!(m.last_session("wx-a"), None);
    }
}
