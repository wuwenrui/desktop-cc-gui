//! JSON-RPC client for cc_gui_daemon (line-delimited JSON over TCP :4732).
//!
//! Protocol pinned from source (worktree paths under src-tauri/src):
//! - Framing: one JSON object per line, `\n` terminated
//!   (remote_backend.rs:160-163 writes; cc_gui_daemon.rs:2116 reads lines).
//! - Request: `{ "id": <u64>, "method": <str>, "params": <value> }`.
//! - Success: `{ "id": <u64>, "result": <value> }`.
//! - Error: `{ "id": <u64>, "error": { "message": <str> } }` — error is always
//!   an object with a `message` field (cc_gui_daemon.rs:507-517).
//! - Auth: first frame `auth` with `{ "token": <str> }`; success returns
//!   `{ "ok": true }`; failure `{ "error": { "message": "invalid token" } }`;
//!   any other method before auth -> `unauthorized` (cc_gui_daemon.rs:2135-2154,
//!   parse_auth_token at :547-556).
//! - Server pushes notifications as `{ "method": "app-server-event", "params": .. }`
//!   with NO `id` (cc_gui_daemon.rs:529-544); the bridge ignores these on the
//!   sync request connection.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::OwnedWriteHalf;
use tokio::net::TcpStream;
use tokio::sync::{oneshot, Mutex};
use tokio::task::JoinHandle;

use super::types::{BridgeError, ClaudeReply};

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

/// Build a request frame body (no trailing newline). Pure, unit-tested.
pub fn build_request(id: u64, method: &str, params: &Value) -> String {
    json!({ "id": id, "method": method, "params": params }).to_string()
}

/// Parse one inbound line. Returns:
/// - `Some((id, Ok(result)))` for a success response,
/// - `Some((id, Err(message)))` for an error response,
/// - `None` for notifications (no id) or unparseable lines.
/// Pure, unit-tested.
pub fn parse_response_line(line: &str) -> Option<(u64, Result<Value, String>)> {
    let v: Value = serde_json::from_str(line).ok()?;
    let id = v.get("id").and_then(Value::as_u64)?;
    if let Some(err) = v.get("error") {
        let message = err
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("daemon error")
            .to_string();
        return Some((id, Err(message)));
    }
    Some((id, Ok(v.get("result").cloned().unwrap_or(Value::Null))))
}

fn build_claude_sync_params(
    workspace_id: &str,
    text: &str,
    images: &[String],
    session_id: Option<&str>,
    continue_session: bool,
    access_mode: &str,
    safe_mode: bool,
    append_system_prompt: Option<&str>,
) -> Value {
    let mut params = json!({
        "workspaceId": workspace_id,
        "text": text,
        "engine": "claude",
        "accessMode": access_mode,
        "safeMode": safe_mode,
    });
    if !images.is_empty() {
        params["images"] = json!(images);
    }
    if let Some(sid) = session_id {
        params["sessionId"] = json!(sid);
    }
    if continue_session {
        params["continueSession"] = json!(true);
    }
    if let Some(prompt) = append_system_prompt
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params["appendSystemPrompt"] = json!(prompt);
    }
    params
}

fn build_add_workspace_params(path: &str) -> Value {
    json!({ "path": path })
}

/// A single authenticated connection to the daemon.
///
/// One `DaemonLink` owns one TCP connection. The MVP opens a dedicated link per
/// in-flight blocking `engine_send_message_sync` call so a long (up to 900s)
/// sync request never blocks other traffic on the same socket
/// (deadlock fix, cc_gui_daemon.rs:2116-2172 serial read loop).
pub struct DaemonLink {
    writer: Mutex<OwnedWriteHalf>,
    pending: Pending,
    next_id: AtomicU64,
    reader_task: JoinHandle<()>,
}

impl DaemonLink {
    /// Connect, spawn the read loop, and authenticate.
    ///
    /// `token` is `None` only when the daemon runs with `--insecure-no-auth`
    /// (tests / dev). Production deployments must pass a token (enforced by G0).
    pub async fn connect(host: &str, token: Option<&str>) -> Result<Self, BridgeError> {
        let stream = TcpStream::connect(host)
            .await
            .map_err(|e| BridgeError::Daemon(format!("connect {host}: {e}")))?;
        let (reader, writer) = stream.into_split();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));

        let pending_for_reader = Arc::clone(&pending);
        let reader_task = tokio::spawn(async move {
            read_loop(reader, pending_for_reader).await;
        });

        let link = Self {
            writer: Mutex::new(writer),
            pending,
            next_id: AtomicU64::new(1),
            reader_task,
        };
        link.authenticate(token).await?;
        Ok(link)
    }

    async fn authenticate(&self, token: Option<&str>) -> Result<(), BridgeError> {
        let params = match token {
            Some(t) => json!({ "token": t }),
            None => json!({ "token": "" }),
        };
        let result = self
            .call("auth", params)
            .await
            .map_err(BridgeError::Daemon)?;
        if result.get("ok").and_then(Value::as_bool).unwrap_or(false) {
            Ok(())
        } else {
            Err(BridgeError::Daemon(format!("auth rejected: {result}")))
        }
    }

    /// Issue one RPC call and await its matching response.
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let frame = build_request(id, method, &params);
        {
            let mut writer = self.writer.lock().await;
            writer
                .write_all(frame.as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            writer.write_all(b"\n").await.map_err(|e| e.to_string())?;
            writer.flush().await.map_err(|e| e.to_string())?;
        }

        rx.await
            .map_err(|_| "daemon connection closed".to_string())?
    }

    /// Primary call: a Claude turn via the synchronous path.
    ///
    /// `access_mode` is selected by the bridge remote-control risk tier.
    /// `session_id` enables continuation for fluent multi-turn.
    pub async fn send_claude_sync(
        &self,
        workspace_id: &str,
        text: &str,
        images: &[String],
        session_id: Option<&str>,
        continue_session: bool,
        access_mode: &str,
        safe_mode: bool,
        append_system_prompt: Option<&str>,
    ) -> Result<ClaudeReply, BridgeError> {
        let params = build_claude_sync_params(
            workspace_id,
            text,
            images,
            session_id,
            continue_session,
            access_mode,
            safe_mode,
            append_system_prompt,
        );
        let result = self
            .call("engine_send_message_sync", params)
            .await
            .map_err(BridgeError::Daemon)?;
        serde_json::from_value(result)
            .map_err(|e| BridgeError::Daemon(format!("unexpected sync reply shape: {e}")))
    }

    pub async fn interrupt_workspace(&self, workspace_id: &str) -> Result<(), BridgeError> {
        self.call("engine_interrupt", json!({ "workspaceId": workspace_id }))
            .await
            .map_err(BridgeError::Daemon)?;
        Ok(())
    }

    pub async fn workspace_path(&self, workspace_id: &str) -> Result<Option<String>, BridgeError> {
        let result = self
            .call("list_workspaces", json!({}))
            .await
            .map_err(BridgeError::Daemon)?;
        let Some(workspaces) = result.as_array() else {
            return Err(BridgeError::Daemon(
                "unexpected list_workspaces reply shape".to_string(),
            ));
        };
        Ok(workspaces
            .iter()
            .find(|workspace| workspace.get("id").and_then(Value::as_str) == Some(workspace_id))
            .and_then(|workspace| workspace.get("path").and_then(Value::as_str))
            .map(str::to_string))
    }

    pub async fn add_workspace(&self, path: &str) -> Result<(String, String), BridgeError> {
        let result = self
            .call("add_workspace", build_add_workspace_params(path))
            .await
            .map_err(BridgeError::Daemon)?;
        let workspace_id = result
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| BridgeError::Daemon("add_workspace reply missing id".to_string()))?
            .to_string();
        let resolved_path = result
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or(path)
            .to_string();
        Ok((workspace_id, resolved_path))
    }

    pub async fn compact_claude_thread(
        &self,
        workspace_id: &str,
        session_id: &str,
    ) -> Result<String, BridgeError> {
        let result = self
            .call(
                "thread_compact",
                json!({
                    "workspaceId": workspace_id,
                    "threadId": format!("claude:{session_id}"),
                }),
            )
            .await
            .map_err(BridgeError::Daemon)?;
        Ok(result
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("会话压缩已完成。")
            .to_string())
    }
}

impl Drop for DaemonLink {
    fn drop(&mut self) {
        self.reader_task.abort();
    }
}

async fn read_loop(reader: tokio::net::tcp::OwnedReadHalf, pending: Pending) {
    let mut lines = BufReader::new(reader).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if let Some((id, outcome)) = parse_response_line(&line) {
                    if let Some(tx) = pending.lock().await.remove(&id) {
                        let _ = tx.send(outcome);
                    }
                }
                // notifications (no id) are ignored on this connection
            }
            _ => break,
        }
    }
    // Connection closed: wake every waiter so callers never hang forever
    // (mirrors remote_backend.rs DISCONNECTED_MESSAGE behavior).
    let mut guard = pending.lock().await;
    for (_, tx) in guard.drain() {
        let _ = tx.send(Err("daemon connection closed".to_string()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_request_is_line_json() {
        let frame = build_request(7, "ping", &json!({}));
        assert!(!frame.contains('\n'));
        let parsed: Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(parsed["id"], 7);
        assert_eq!(parsed["method"], "ping");
        assert_eq!(parsed["params"], json!({}));
    }

    #[test]
    fn claude_sync_params_enable_safe_mode_for_wechat_bridge() {
        let params = build_claude_sync_params(
            "workspace-1",
            "hello",
            &[],
            None,
            false,
            "read-only",
            true,
            Some("微信规则"),
        );

        assert_eq!(params["engine"], "claude");
        assert_eq!(params["text"], "hello");
        assert_eq!(params["accessMode"], "read-only");
        assert_eq!(params["safeMode"], true);
        assert_eq!(params["appendSystemPrompt"], "微信规则");
    }

    #[test]
    fn claude_sync_params_can_start_named_session_without_continue() {
        let params = build_claude_sync_params(
            "workspace-1",
            "hello",
            &[],
            Some("sess-1"),
            false,
            "read-only",
            true,
            None,
        );

        assert_eq!(params["sessionId"], "sess-1");
        assert!(params.get("continueSession").is_none());
    }

    #[test]
    fn claude_sync_params_can_elevate_for_high_risk_tier() {
        let params = build_claude_sync_params(
            "workspace-1",
            "hello",
            &[],
            None,
            false,
            "full-access",
            false,
            None,
        );

        assert_eq!(params["accessMode"], "full-access");
        assert_eq!(params["safeMode"], false);
    }

    #[test]
    fn add_workspace_params_only_send_requested_path() {
        let params = build_add_workspace_params("/tmp/project-alpha");

        assert_eq!(params["path"], "/tmp/project-alpha");
        assert!(params.get("codex_bin").is_none());
    }

    #[test]
    fn parse_success_response() {
        let (id, outcome) = parse_response_line(r#"{"id":3,"result":{"ok":true}}"#).unwrap();
        assert_eq!(id, 3);
        assert_eq!(outcome.unwrap(), json!({"ok": true}));
    }

    #[test]
    fn parse_error_response_object_message() {
        let (id, outcome) =
            parse_response_line(r#"{"id":4,"error":{"message":"invalid token"}}"#).unwrap();
        assert_eq!(id, 4);
        assert_eq!(outcome.unwrap_err(), "invalid token");
    }

    #[test]
    fn parse_notification_returns_none() {
        // app-server-event notifications carry no id and must be skipped here.
        assert!(parse_response_line(r#"{"method":"app-server-event","params":{}}"#).is_none());
    }

    #[test]
    fn parse_garbage_returns_none() {
        assert!(parse_response_line("not json").is_none());
        assert!(parse_response_line("").is_none());
    }

    #[test]
    fn parse_result_defaults_to_null_when_absent() {
        let (_id, outcome) = parse_response_line(r#"{"id":9}"#).unwrap();
        assert_eq!(outcome.unwrap(), Value::Null);
    }
}
