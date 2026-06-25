//! Inbound HTTP server: an OpenAI-compatible `/v1/chat/completions` endpoint
//! that the WeChat transport (WeClaw "HTTP mode") calls with each message.
//!
//! WeClaw owns the WeChat iLink protocol, media upload/download and voice STT;
//! by the time a request reaches us it is plain text (+ optional image parts).
//! We map it to an `IncomingMessage`, run the pipeline, and answer in OpenAI
//! chat-completion shape so WeClaw can relay the reply back into WeChat.
//!
//! Identity/idempotency:
//! - lawyer id from header `x-weclaw-user`, else OpenAI `user`, else `local-wechat`.
//! - message id from header `x-weclaw-msg-id`, else a fingerprint of wxid+full request.

use std::path::Path;
use std::sync::Arc;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::audit::body_fingerprint;
use crate::pipeline::{handle_message, Deps};
use crate::types::{IncomingMessage, OutgoingReply};

/// Extract the latest user message text + image urls from an OpenAI request.
/// Handles both `content: "string"` and `content: [{type,text|image_url}]`.
pub fn extract_user_message(req: &Value) -> (String, Vec<String>) {
    let Some(messages) = req.get("messages").and_then(Value::as_array) else {
        return (String::new(), Vec::new());
    };
    let Some(last_user) = messages
        .iter()
        .rev()
        .find(|m| m.get("role").and_then(Value::as_str) == Some("user"))
    else {
        return (String::new(), Vec::new());
    };

    match last_user.get("content") {
        Some(Value::String(text)) => (text.clone(), Vec::new()),
        Some(Value::Array(parts)) => {
            let mut text = String::new();
            let mut images = Vec::new();
            for part in parts {
                match part.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        if let Some(t) = part.get("text").and_then(Value::as_str) {
                            if !text.is_empty() {
                                text.push('\n');
                            }
                            text.push_str(t);
                        }
                    }
                    Some("image_url") => {
                        if let Some(url) = part
                            .get("image_url")
                            .and_then(|v| v.get("url"))
                            .and_then(Value::as_str)
                        {
                            images.push(url.to_string());
                        }
                    }
                    _ => {}
                }
            }
            (text, images)
        }
        _ => (String::new(), Vec::new()),
    }
}

/// Build an OpenAI chat-completion response carrying `text`.
#[cfg(test)]
pub fn build_completion(text: &str, model: &str, created: i64) -> Value {
    build_completion_reply(&OutgoingReply::text(text), model, created)
}

/// Build an OpenAI chat-completion response carrying text plus optional media.
pub fn build_completion_reply(reply: &OutgoingReply, model: &str, created: i64) -> Value {
    let content = if reply.images.is_empty() && reply.files.is_empty() {
        Value::String(reply.text.clone())
    } else {
        let mut parts = vec![json!({ "type": "text", "text": reply.text.clone() })];
        for image in &reply.images {
            parts.push(
                json!({ "type": "image_url", "image_url": { "url": outgoing_image_url(image) } }),
            );
        }
        for file in &reply.files {
            parts.push(
                json!({ "type": "file_url", "file_url": { "url": outgoing_file_url(file) } }),
            );
        }
        Value::Array(parts)
    };
    json!({
        "id": "chatcmpl-wxbridge",
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [{
            "index": 0,
            "message": { "role": "assistant", "content": content },
            "finish_reason": "stop"
        }],
        "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
    })
}

fn outgoing_image_url(image: &str) -> String {
    outgoing_file_url(image)
}

fn outgoing_file_url(file: &str) -> String {
    let trimmed = file.trim();
    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("file://")
        || trimmed.starts_with("data:")
    {
        return trimmed.to_string();
    }
    if Path::new(trimmed).is_absolute() || looks_like_windows_absolute_path(trimmed) {
        return absolute_path_to_file_url(trimmed);
    }
    trimmed.to_string()
}

fn absolute_path_to_file_url(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if let Some(without_prefix) = normalized.strip_prefix("//") {
        return format!("file://{}", percent_encode_file_path(without_prefix));
    }
    if looks_like_windows_absolute_path(&normalized) {
        return format!("file:///{}", percent_encode_file_path(&normalized));
    }
    format!("file://{}", percent_encode_file_path(&normalized))
}

fn looks_like_windows_absolute_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

fn percent_encode_file_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for byte in path.as_bytes() {
        let allowed = byte.is_ascii_alphanumeric()
            || matches!(*byte, b'-' | b'.' | b'_' | b'~' | b'/' | b':');
        if allowed {
            out.push(char::from(*byte));
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

fn header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RequestIdentity {
    wxid: String,
    msg_id: String,
}

fn request_identity(headers: &HeaderMap, req: &Value, latest_text: &str) -> RequestIdentity {
    let wxid = header(headers, "x-weclaw-user")
        .or_else(|| req.get("user").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| "local-wechat".to_string());
    let msg_id = header(headers, "x-weclaw-msg-id").unwrap_or_else(|| {
        let body = serde_json::to_string(req).unwrap_or_else(|_| format!("latest:{latest_text}"));
        body_fingerprint(&format!("{wxid}:{body}"))
    });
    RequestIdentity { wxid, msg_id }
}

async fn chat_completions(
    State(deps): State<Arc<Deps>>,
    headers: HeaderMap,
    Json(req): Json<Value>,
) -> Json<Value> {
    let (text, images) = extract_user_message(&req);
    let identity = request_identity(&headers, &req, &text);
    let model = req
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("claude")
        .to_string();

    let incoming = IncomingMessage {
        wxid: identity.wxid,
        msg_id: identity.msg_id,
        text,
        images,
    };
    let reply = handle_message(deps.as_ref(), &incoming)
        .await
        .unwrap_or_else(|| OutgoingReply::text("这条消息已处理过，不重复执行。"));

    Json(build_completion_reply(&reply, &model, 0))
}

async fn health() -> &'static str {
    "ok"
}

/// Build the router with shared dependencies.
pub fn router(deps: Arc<Deps>) -> Router {
    Router::new()
        .route("/v1/chat/completions", post(chat_completions))
        .route("/healthz", get(health))
        .with_state(deps)
}

/// Bind and serve forever (production entry point).
pub async fn serve(deps: Arc<Deps>, listen: &str) -> Result<(), String> {
    let listener = tokio::net::TcpListener::bind(listen)
        .await
        .map_err(|e| format!("bind {listen}: {e}"))?;
    axum::serve(listener, router(deps))
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_plain_string_content() {
        let req = json!({
            "messages": [
                {"role": "system", "content": "x"},
                {"role": "user", "content": "起草租赁合同"}
            ]
        });
        let (text, images) = extract_user_message(&req);
        assert_eq!(text, "起草租赁合同");
        assert!(images.is_empty());
    }

    #[test]
    fn extracts_multimodal_text_and_image() {
        let req = json!({
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "看看这张合同照片"},
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}
                ]
            }]
        });
        let (text, images) = extract_user_message(&req);
        assert_eq!(text, "看看这张合同照片");
        assert_eq!(images, vec!["data:image/png;base64,AAAA".to_string()]);
    }

    #[test]
    fn picks_last_user_message() {
        let req = json!({
            "messages": [
                {"role": "user", "content": "第一条"},
                {"role": "assistant", "content": "好"},
                {"role": "user", "content": "第二条"}
            ]
        });
        assert_eq!(extract_user_message(&req).0, "第二条");
    }

    #[test]
    fn missing_messages_is_empty() {
        assert_eq!(extract_user_message(&json!({})).0, "");
    }

    #[test]
    fn completion_has_openai_shape() {
        let v = build_completion("你好", "claude", 0);
        assert_eq!(v["object"], "chat.completion");
        assert_eq!(v["choices"][0]["message"]["content"], "你好");
        assert_eq!(v["choices"][0]["message"]["role"], "assistant");
        assert_eq!(v["choices"][0]["finish_reason"], "stop");
    }

    #[test]
    fn completion_with_images_uses_content_parts_for_patched_weclaw() {
        let v = build_completion_reply(
            &OutgoingReply {
                text: "已生成图片".to_string(),
                images: vec!["file:///tmp/a.png".to_string()],
                files: vec![],
            },
            "claude",
            0,
        );

        assert_eq!(v["choices"][0]["message"]["content"][0]["type"], "text");
        assert_eq!(
            v["choices"][0]["message"]["content"][0]["text"],
            "已生成图片"
        );
        assert_eq!(
            v["choices"][0]["message"]["content"][1]["image_url"]["url"],
            "file:///tmp/a.png"
        );
    }

    #[test]
    fn completion_with_absolute_image_paths_uses_file_urls() {
        let v = build_completion_reply(
            &OutgoingReply {
                text: "已生成图片".to_string(),
                images: vec!["/tmp/微信 图片.png".to_string()],
                files: vec![],
            },
            "claude",
            0,
        );

        assert_eq!(
            v["choices"][0]["message"]["content"][1]["image_url"]["url"],
            "file:///tmp/%E5%BE%AE%E4%BF%A1%20%E5%9B%BE%E7%89%87.png"
        );
    }

    #[test]
    fn completion_with_files_uses_file_url_parts_for_patched_weclaw() {
        let v = build_completion_reply(
            &OutgoingReply {
                text: "已生成文件".to_string(),
                images: vec![],
                files: vec!["/tmp/report.pdf".to_string()],
            },
            "claude",
            0,
        );

        assert_eq!(v["choices"][0]["message"]["content"][0]["type"], "text");
        assert_eq!(v["choices"][0]["message"]["content"][1]["type"], "file_url");
        assert_eq!(
            v["choices"][0]["message"]["content"][1]["file_url"]["url"],
            "file:///tmp/report.pdf"
        );
    }

    #[test]
    fn request_identity_defaults_to_local_wechat() {
        let req = json!({
            "model": "claude",
            "messages": [{"role": "user", "content": "你好"}]
        });
        let headers = HeaderMap::new();

        let identity = request_identity(&headers, &req, "你好");

        assert_eq!(identity.wxid, "local-wechat");
        assert!(!identity.msg_id.is_empty());
    }

    #[test]
    fn request_identity_uses_openai_user_when_header_missing() {
        let req = json!({
            "model": "claude",
            "user": "wxid_rich",
            "messages": [{"role": "user", "content": "你好"}]
        });
        let headers = HeaderMap::new();

        let identity = request_identity(&headers, &req, "你好");

        assert_eq!(identity.wxid, "wxid_rich");
    }

    #[test]
    fn request_identity_fallback_hash_uses_full_body() {
        let headers = HeaderMap::new();
        let req_a = json!({
            "model": "claude",
            "messages": [
                {"role": "user", "content": "前文A"},
                {"role": "assistant", "content": "答A"},
                {"role": "user", "content": "继续"}
            ]
        });
        let req_b = json!({
            "model": "claude",
            "messages": [
                {"role": "user", "content": "前文B"},
                {"role": "assistant", "content": "答B"},
                {"role": "user", "content": "继续"}
            ]
        });

        let identity_a = request_identity(&headers, &req_a, "继续");
        let identity_b = request_identity(&headers, &req_b, "继续");

        assert_ne!(identity_a.msg_id, identity_b.msg_id);
    }

    // --- HTTP-level end-to-end: WeClaw(HTTP) -> bridge router -> mock daemon ---

    use crate::dedup::Dedup;
    use crate::redactor::RedactionMode;
    use crate::session_map::SessionMap;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    use tokio::net::{TcpListener, TcpStream};

    async fn spawn_mock_daemon() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let (reader, mut writer) = stream.into_split();
                    let mut lines = BufReader::new(reader).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let req: Value = match serde_json::from_str(&line) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };
                        let id = req.get("id").and_then(Value::as_u64).unwrap_or(0);
                        let method = req.get("method").and_then(Value::as_str).unwrap_or("");
                        let resp = if method == "engine_send_message_sync" {
                            let t = req["params"]["text"].as_str().unwrap_or("");
                            json!({"id": id, "result": {
                                "engine":"claude",
                                "sessionId":"s",
                                "text": format!("答:{}", extract_wechat_user_message(t)),
                            }})
                        } else {
                            json!({"id": id, "result": {"ok": true}})
                        };
                        let mut frame = resp.to_string();
                        frame.push('\n');
                        if writer.write_all(frame.as_bytes()).await.is_err() {
                            break;
                        }
                    }
                });
            }
        });
        addr
    }

    fn extract_wechat_user_message(text: &str) -> String {
        let Some((_, rest)) = text.split_once("<wechat-user-message>\n") else {
            return text.to_string();
        };
        let Some((message, _)) = rest.split_once("\n</wechat-user-message>") else {
            return text.to_string();
        };
        message.to_string()
    }

    fn test_deps(daemon: String) -> Arc<Deps> {
        Arc::new(Deps {
            daemon_host: daemon,
            token: Some("tok".into()),
            entitlement: None,
            default_workspace: "ws".into(),
            redaction_mode: RedactionMode::Full,
            max_reply_len: 1000,
            media_dir: std::env::temp_dir()
                .join("wx_bridge_http_media")
                .to_string_lossy()
                .to_string(),
            reply_rate_limiter: crate::rate_limit::ReplyRateLimiter::new(20, 60),
            dedup_ttl_secs: 600,
            dedup: Dedup::open(":memory:").unwrap(),
            sessions: SessionMap::new(),
            turn_locks: crate::pipeline::TurnLocks::new(),
            audit: crate::audit::Audit::new(
                std::env::temp_dir()
                    .join("wx_bridge_http_test.log")
                    .to_string_lossy()
                    .to_string(),
            ),
        })
    }

    async fn post_chat_json(addr: std::net::SocketAddr, body: String) -> Value {
        let request = format!(
			"POST /v1/chat/completions HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
			body.as_bytes().len(),
			body
		);
        let mut stream = TcpStream::connect(addr).await.unwrap();
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).await.unwrap();
        let text = String::from_utf8_lossy(&raw);
        assert!(text.starts_with("HTTP/1.1 200"), "status line: {text}");
        let json_body = text.split("\r\n\r\n").nth(1).unwrap_or("");
        serde_json::from_str(json_body.trim()).unwrap()
    }

    #[tokio::test]
    async fn http_chat_completions_end_to_end() {
        let daemon = spawn_mock_daemon().await;
        let deps = test_deps(daemon);

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, router(deps)).await.ok();
        });

        let body = json!({
            "model": "claude",
            "user": "wx-lawyer-1",
            "messages": [{"role": "user", "content": "你好"}]
        })
        .to_string();
        let request = format!(
            "POST /v1/chat/completions HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.as_bytes().len(),
            body
        );

        let mut stream = TcpStream::connect(addr).await.unwrap();
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).await.unwrap();
        let text = String::from_utf8_lossy(&raw);

        assert!(text.starts_with("HTTP/1.1 200"), "status line: {text}");
        let json_body = text.split("\r\n\r\n").nth(1).unwrap_or("");
        let parsed: Value = serde_json::from_str(json_body.trim()).unwrap();
        assert_eq!(parsed["choices"][0]["message"]["content"], "答:你好");
    }

    #[tokio::test]
    async fn http_chat_completions_duplicate_fallback_is_not_empty() {
        let daemon = spawn_mock_daemon().await;
        let deps = test_deps(daemon);

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, router(deps)).await.ok();
        });

        let body = json!({
            "model": "claude",
            "user": "wx-lawyer-duplicate",
            "messages": [{"role": "user", "content": "同一句话重复发"}]
        })
        .to_string();

        let first = post_chat_json(addr, body.clone()).await;
        let second = post_chat_json(addr, body).await;

        assert_eq!(
            first["choices"][0]["message"]["content"],
            "答:同一句话重复发"
        );
        assert_eq!(
            second["choices"][0]["message"]["content"],
            "这条消息已处理过，不重复执行。"
        );
    }

    #[tokio::test]
    async fn http_healthz_ok() {
        let deps = test_deps("127.0.0.1:1".into());
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, router(deps)).await.ok();
        });
        let mut stream = TcpStream::connect(addr).await.unwrap();
        stream
            .write_all(b"GET /healthz HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).await.unwrap();
        let text = String::from_utf8_lossy(&raw);
        assert!(text.starts_with("HTTP/1.1 200"));
        assert!(text.trim_end().ends_with("ok"));
    }
}
