//! Message orchestration: the bridge "brain".
//!
//! For each inbound WeChat message:
//!   dedup -> policy guard -> resolve workspace/session -> dedicated daemon
//!   connection -> Claude sync turn -> record session -> redact -> audit -> reply.
//!
//! A FRESH `DaemonLink` is opened per message so a long (up to 900s) sync call
//! never blocks other lawyers' traffic and never collides with event frames on a
//! shared socket (deadlock fix; cc_gui_daemon.rs:2116-2172 serial read loop).

use crate::audit::{body_fingerprint, Audit, AuditEntry};
use crate::daemon_link::DaemonLink;
use crate::dedup::Dedup;
use crate::entitlement::EntitlementChecker;
use crate::policy::{self, Decision};
use crate::rate_limit::{ReplyRateLimitDecision, ReplyRateLimiter};
use crate::redactor::{redact_outbound, RedactionMode};
use crate::remote_control::{self, PermissionTier, RemoteCommand};
use crate::session_map::SessionMap;
use crate::types::{BridgeError, IncomingMessage, OutgoingReply};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(not(test))]
use std::process::Command;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::sync::Mutex as AsyncMutex;

const PRODUCTION_DAEMON_TURN_TIMEOUT_SECS: u64 = 900;

#[cfg(not(test))]
fn daemon_turn_timeout() -> Duration {
    Duration::from_secs(PRODUCTION_DAEMON_TURN_TIMEOUT_SECS)
}

#[cfg(test)]
fn daemon_turn_timeout() -> Duration {
    Duration::from_millis(75)
}

fn timeout_label(timeout: Duration) -> String {
    if timeout.as_secs() > 0 {
        format!("{}s", timeout.as_secs())
    } else {
        format!("{}ms", timeout.as_millis())
    }
}

/// Shared, process-wide bridge dependencies.
pub struct Deps {
    pub daemon_host: String,
    pub token: Option<String>,
    pub entitlement: Option<EntitlementChecker>,
    pub default_workspace: String,
    pub redaction_mode: RedactionMode,
    pub max_reply_len: usize,
    pub media_dir: String,
    pub reply_rate_limiter: ReplyRateLimiter,
    pub dedup_ttl_secs: i64,
    pub dedup: Dedup,
    pub sessions: SessionMap,
    pub turn_locks: TurnLocks,
    pub audit: Audit,
}

pub struct TurnLocks {
    inner: StdMutex<HashMap<String, Arc<AsyncMutex<()>>>>,
}

impl TurnLocks {
    pub fn new() -> Self {
        Self {
            inner: StdMutex::new(HashMap::new()),
        }
    }

    fn lock_for(&self, wxid: &str) -> Arc<AsyncMutex<()>> {
        let mut guard = self.inner.lock().expect("turn locks lock");
        Arc::clone(
            guard
                .entry(wxid.to_string())
                .or_insert_with(|| Arc::new(AsyncMutex::new(()))),
        )
    }
}

impl Default for TurnLocks {
    fn default() -> Self {
        Self::new()
    }
}

fn now_secs() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Handle one inbound message. Returns `None` when nothing should be sent back
/// (e.g. a de-duplicated redelivery). Time is injected for deterministic tests.
pub async fn handle_message_at(
    deps: &Deps,
    msg: &IncomingMessage,
    now: i64,
) -> Option<OutgoingReply> {
    // 1. De-duplicate redeliveries (R3): drop silently if already processed.
    match deps
        .dedup
        .check_and_record(&msg.msg_id, now, deps.dedup_ttl_secs)
    {
        Ok(true) => {}
        Ok(false) => return None,
        Err(_) => { /* dedup store hiccup: fail-open to not drop a real message */ }
    }

    if !remote_control::bypass_rate_limit(&msg.text) {
        match deps.reply_rate_limiter.check_and_record(&msg.wxid, now) {
            Ok(ReplyRateLimitDecision::Allow) => {}
            Ok(ReplyRateLimitDecision::Limited { retry_after_secs }) => {
                let reply = rate_limit_message(retry_after_secs);
                let _ = deps.audit.append(&AuditEntry {
                    ts_secs: now,
                    wxid: msg.wxid.clone(),
                    method: "engine_send_message_sync".to_string(),
                    workspace: deps
                        .sessions
                        .workspace_for(&msg.wxid, &deps.default_workspace),
                    decision: "deny".to_string(),
                    body_hash: body_fingerprint(&msg.text),
                });
                return Some(OutgoingReply::text(reply));
            }
            Err(_) => { /* limiter hiccup: fail-open to avoid losing a real message */ }
        }
    }

    if let Some(checker) = deps.entitlement.as_ref() {
        match checker.has_wechat_bridge().await {
            Ok(true) => {}
            Ok(false) => {
                return Some(OutgoingReply::text(
                    "微信高级功能未开通。请在桌面端「高级功能」里开通后再使用。",
                ));
            }
            Err(_) => {
                return Some(OutgoingReply::text(
                    "暂时无法校验微信高级功能权益，请稍后在微信里重试。",
                ));
            }
        }
    }

    let outcome = {
        let turn_lock = deps.turn_locks.lock_for(&msg.wxid);
        let _turn_guard = turn_lock.lock().await;
        run_turn(deps, msg, now).await
    };

    let (reply, decision) = match outcome {
        Ok(reply) => (reply, "allow"),
        Err(err @ BridgeError::Denied(_)) => (OutgoingReply::text(err.user_message()), "deny"),
        Err(err) => (OutgoingReply::text(err.user_message()), "error"),
    };

    let _ = deps.audit.append(&AuditEntry {
        ts_secs: now,
        wxid: msg.wxid.clone(),
        method: "engine_send_message_sync".to_string(),
        workspace: deps
            .sessions
            .workspace_for(&msg.wxid, &deps.default_workspace),
        decision: decision.to_string(),
        body_hash: body_fingerprint(&msg.text),
    });

    Some(reply)
}

fn rate_limit_message(retry_after_secs: i64) -> String {
    let retry_after_secs = retry_after_secs.max(1);
    format!("消息太密集了，我已先暂停自动回复，请 {retry_after_secs} 秒后再发。")
}

struct WechatOnboardingContext {
    workspace_path: String,
}

fn build_wechat_system_prompt(
    tier: PermissionTier,
    onboarding: Option<&WechatOnboardingContext>,
) -> String {
    let permission_note = match tier {
        PermissionTier::ReadOnly => {
            "当前微信通道已授权读写电脑操作。可以读取目录、文件、图片和搜索结果，也可以按用户要求修改当前工作区文件、运行必要命令、截图、发送文件或操作本地应用。"
        }
        PermissionTier::Confirm => {
            "当前微信消息已授权普通电脑操作。可以按用户要求修改当前工作区文件、运行必要命令、截图并通过 <wechat-image> 发回、用 <wechat-file> 发回本地文件、或操作本地应用，但要保持最小改动。"
        }
        PermissionTier::StrongConfirm => {
            "当前微信消息已授权高风险电脑操作。只执行用户明确要求的高风险步骤，避免扩大范围，并在回复中简短说明结果。"
        }
    };
    let onboarding_note = onboarding
        .map(|ctx| {
            format!(
                "- 如果用户在打招呼、问你是谁或问你能做什么，请用伙伴语气先简短回应：你会和用户一起处理问题，不要像同事交接任务一样生硬。\n\
                 - 这类首次回应要体现能力，但不要把能力、目录和下一步说明挤成一段。\n\
                 - 首次回应格式固定为三段：第一段 1 句问候；第二段标题“我可以帮你：”，能力用短列表，每行一个能力点；第三段标题“当前目录：”，当前目录单独一行，最后一行说明“需要换项目就发：切换到 绝对路径”。\n\
                 - 能力列表控制在 4 行以内，优先写：读写文件/查看或切换目录、搜索资料/分析图片、截图、创建并发送 Excel/文档/图片/文件、操作本地应用。\n\
                 - 当前工作目录：{}\n\
                 - 可以告诉用户：需要换项目时，直接发“切换到 绝对路径”，你会在新目录里继续帮他处理。\n",
                ctx.workspace_path
            )
        })
        .unwrap_or_default();
    format!(
        "你正在通过微信回复律师用户。请遵守以下规则：\n\
         - 只输出最终要发给微信用户的正文，不要输出分析、判断、过程或任务分类。\n\
         - 禁止输出你对消息的分析；禁止说“这是一个...”“用户只是...”“微信发来的...”“我直接...”。\n\
         - 直接回答用户问题，使用简洁中文。\n\
         - 不要提及计划模式。不要提及 plan mode、开发者模式、工具权限或后台实现；用户明确询问当前目录或文件时，可以直接给出工作区路径和文件列表。\n\
         - 不使用 emoji。\n\
         - 微信是远程入口，电脑端可以随时接管同一个会话。不要要求用户离开微信或换入口继续。\n\
         - 权限边界：{permission_note}\n\
         - 用户要求 Excel、表格、文档、图片、截图、文件或附件时，必须创建真实的本地文件或图片，并用下方标签发回微信；只回答文字不算完成。\n\
         - 用户要求 Excel 时，创建真实的 .xlsx 文件，并在正文中单独写 <wechat-file>绝对路径或URL</wechat-file>。\n\
         - 如果需要把本地图片发回微信，请在正文中单独写 <wechat-image>绝对路径或URL</wechat-image>。\n\
         - 如果需要把本地文件发回微信，请在正文中单独写 <wechat-file>绝对路径或URL</wechat-file>。\n\
         - 如果遇到系统权限、网络或上游服务阻塞，只说明具体阻塞、已完成部分，以及用户可在微信继续发送的下一步指令。\n\
         {onboarding_note}\
         - 如果可以，请把正文放在 <wechat-reply>...</wechat-reply> 内；不要在标签外输出内容。"
    )
}

fn needs_onboarding_prompt(text: &str, is_first_turn: bool) -> bool {
    let normalized = text.trim().to_ascii_lowercase().replace('　', " ");
    let compact = normalized
        .chars()
        .filter(|ch| !ch.is_whitespace() && !matches!(ch, '，' | '。' | '？' | '?' | '！' | '!'))
        .collect::<String>();
    let is_greeting = matches!(
        compact.as_str(),
        "你好" | "您好" | "hi" | "hello" | "在吗" | "你是谁"
    );
    let asks_capability = [
        "你能做什么",
        "能做什么",
        "可以做什么",
        "有什么能力",
        "怎么用",
        "介绍一下",
        "你是谁",
    ]
    .iter()
    .any(|marker| compact.contains(marker));
    (is_first_turn && is_greeting) || asks_capability
}

fn requires_file_delivery(user_text: &str) -> bool {
    let normalized = user_text.to_lowercase();
    let asks_to_send = normalized.contains("发我")
        || normalized.contains("发给我")
        || normalized.contains("发送给我")
        || normalized.contains("给我发")
        || normalized.contains("附件");
    let asks_for_artifact = normalized.contains("excel")
        || normalized.contains(".xlsx")
        || normalized.contains("表格")
        || normalized.contains("文件")
        || normalized.contains("文档")
        || normalized.contains("附件");
    asks_to_send && asks_for_artifact
}

fn build_file_retry_system_prompt(previous_reply: &str) -> String {
    format!(
        "上一轮回复没有附上文件，因此任务还没有完成。请继续同一个任务，创建用户要求的真实本地文件，并只把最终微信回复放入 <wechat-reply> 标签内。\n\
         必须在回复中单独写 <wechat-file>绝对路径或URL</wechat-file>。只回答文字不算完成。不要要求用户离开微信。\n\n\
         <previous-reply>\n{previous_reply}\n</previous-reply>"
    )
}

fn extract_tagged_wechat_reply(text: &str) -> Option<String> {
    let (_, rest) = text.split_once("<wechat-reply>")?;
    let (reply, _) = rest.split_once("</wechat-reply>")?;
    let trimmed = reply.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn strip_leading_internal_preamble(text: &str) -> String {
    let trimmed = text.trim();
    let internal_markers = [
        "通过微信发来的",
        "用户只是",
        "计划流程",
        "探索代码",
        "制定实施方案",
        "我直接",
        "我应该",
    ];
    if !internal_markers
        .iter()
        .any(|marker| trimmed.contains(marker))
    {
        return trimmed.to_string();
    }
    for marker in [
        "我直接简洁回答即可。",
        "我直接回答即可。",
        "我直接回复即可。",
    ] {
        if let Some((_, rest)) = trimmed.split_once(marker) {
            let candidate = rest.trim();
            if !candidate.is_empty() {
                return candidate.to_string();
            }
        }
    }
    trimmed.to_string()
}

fn collect_tagged_values(text: &str, start_tag: &str, end_tag: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut rest = text;
    while let Some((_, after_start)) = rest.split_once(start_tag) {
        let Some((value, after_end)) = after_start.split_once(end_tag) else {
            break;
        };
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            values.push(trimmed.to_string());
        }
        rest = after_end;
    }
    values
}

fn strip_tagged_values(text: &str, start_tag: &str, end_tag: &str) -> String {
    let mut output = String::new();
    let mut rest = text;
    while let Some((before, after_start)) = rest.split_once(start_tag) {
        output.push_str(before);
        let Some((_, after_end)) = after_start.split_once(end_tag) else {
            output.push_str(start_tag);
            output.push_str(after_start);
            return output;
        };
        rest = after_end;
    }
    output.push_str(rest);
    output
}

fn finalize_wechat_output(text: &str) -> OutgoingReply {
    let raw_images = dedupe_values(collect_tagged_values(
        text,
        "<wechat-image>",
        "</wechat-image>",
    ));
    let raw_files = dedupe_values(collect_tagged_values(
        text,
        "<wechat-file>",
        "</wechat-file>",
    ));
    let raw_reply =
        extract_tagged_wechat_reply(text).unwrap_or_else(|| strip_leading_internal_preamble(text));
    let reply_without_images = strip_tagged_values(&raw_reply, "<wechat-image>", "</wechat-image>");
    let reply_without_files =
        strip_tagged_values(&reply_without_images, "<wechat-file>", "</wechat-file>");
    OutgoingReply {
        text: reply_without_files.trim().to_string(),
        images: raw_images,
        files: raw_files,
    }
}

fn dedupe_values(values: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::new();
    for value in values {
        if !deduped.contains(&value) {
            deduped.push(value);
        }
    }
    deduped
}

/// Production entry point (uses the real clock).
pub async fn handle_message(deps: &Deps, msg: &IncomingMessage) -> Option<OutgoingReply> {
    handle_message_at(deps, msg, now_secs()).await
}

async fn run_turn(
    deps: &Deps,
    msg: &IncomingMessage,
    now: i64,
) -> Result<OutgoingReply, BridgeError> {
    // 2. Policy guards. The WeChat channel uses one daemon method for model
    //    turns; message risk only selects the engine accessMode.
    if let Decision::Deny(reason) = policy::classify_method("engine_send_message_sync") {
        return Err(BridgeError::Denied(reason));
    }

    let workspace = deps
        .sessions
        .workspace_for(&msg.wxid, &deps.default_workspace);

    if let Some(command) = remote_control::parse_command(&msg.text) {
        return handle_command(deps, msg, &workspace, command).await;
    }

    if let Some(target) = remote_control::parse_file_send_target(&msg.text) {
        return Ok(handle_file_send_request(deps, &workspace, target).await);
    }

    if let Some(target) = remote_control::parse_screenshot_target(&msg.text) {
        return Ok(handle_screenshot_request(deps, &workspace, now, target).await);
    }

    let previous_session = deps.sessions.last_session(&msg.wxid);
    let tier = remote_control::classify_task(&msg.text, &msg.images);
    execute_action(
        deps,
        &msg.wxid,
        &workspace,
        previous_session,
        &msg.text,
        &msg.images,
        tier,
    )
    .await
}

async fn handle_command(
    deps: &Deps,
    msg: &IncomingMessage,
    workspace: &str,
    command: RemoteCommand,
) -> Result<OutgoingReply, BridgeError> {
    match command {
        RemoteCommand::Help => Ok(OutgoingReply::text(remote_control::help_message())),
        RemoteCommand::Cancel => Ok(OutgoingReply::text(remote_control::command_ack(
            &RemoteCommand::Cancel,
            false,
        ))),
        RemoteCommand::NewSession => {
            deps.sessions.clear_session(&msg.wxid);
            Ok(OutgoingReply::text(remote_control::command_ack(
                &RemoteCommand::NewSession,
                true,
            )))
        }
        RemoteCommand::Compact => compact_current_session(deps, &msg.wxid, workspace).await,
        RemoteCommand::SwitchWorkspace(path) => switch_workspace(deps, &msg.wxid, path).await,
    }
}

async fn switch_workspace(
    deps: &Deps,
    wxid: &str,
    path: String,
) -> Result<OutgoingReply, BridgeError> {
    if let Decision::Deny(reason) = policy::classify_method("add_workspace") {
        return Err(BridgeError::Denied(reason));
    }

    let timeout = daemon_turn_timeout();
    let result = tokio::time::timeout(timeout, async {
        let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref()).await?;
        link.add_workspace(&path).await
    })
    .await;

    let (workspace_id, resolved_path) = match result {
        Ok(Ok(value)) => value,
        Ok(Err(_)) => {
            return Ok(OutgoingReply::text(
                "没切过去：请发一个存在的本机绝对目录路径。".to_string(),
            ));
        }
        Err(_) => {
            return Ok(OutgoingReply::text(
                "这次还没切过去，本机 agent 暂时没返回结果。你可以稍后在微信里重发这条切换指令。"
                    .to_string(),
            ));
        }
    };

    deps.sessions.bind_workspace(wxid, &workspace_id);
    Ok(OutgoingReply::text(format!(
        "已切换到：{resolved_path}\n接下来你在微信里说的需求，我会在这个目录里和你一起处理。"
    )))
}

async fn compact_current_session(
    deps: &Deps,
    wxid: &str,
    workspace: &str,
) -> Result<OutgoingReply, BridgeError> {
    let Some(session_id) = deps.sessions.last_session(wxid) else {
        return Ok(OutgoingReply::text(
            "当前没有可压缩的会话。先发一条正常消息建立会话，再发送「会话压缩」。",
        ));
    };

    let timeout = daemon_turn_timeout();
    let text = match tokio::time::timeout(timeout, async {
        let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref()).await?;
        link.compact_claude_thread(workspace, &session_id).await
    })
    .await
    {
        Ok(result) => result?,
        Err(_) => {
            return Err(BridgeError::Daemon(format!(
                "desktop compact timed out after {}",
                timeout_label(timeout)
            )));
        }
    };

    Ok(OutgoingReply::text(redact_outbound(
        &finalize_wechat_output(&text).text,
        deps.redaction_mode,
        deps.max_reply_len,
    )))
}

async fn execute_action(
    deps: &Deps,
    wxid: &str,
    workspace: &str,
    previous_session: Option<String>,
    text: &str,
    images: &[String],
    tier: PermissionTier,
) -> Result<OutgoingReply, BridgeError> {
    let is_first_turn = previous_session.is_none();
    let continue_session = !is_first_turn;
    let session_id_for_send = previous_session.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let onboarding = if needs_onboarding_prompt(text, is_first_turn) {
        resolve_current_workspace_path(deps, workspace)
            .await
            .ok()
            .map(|workspace_path| WechatOnboardingContext { workspace_path })
    } else {
        None
    };

    // 3. Dedicated daemon connection for this turn, bounded below WeClaw's
    //    HTTP client timeout so the lawyer gets a controlled reply.
    let timeout = daemon_turn_timeout();
    let system_prompt = build_wechat_system_prompt(tier, onboarding.as_ref());
    let mut reply = match tokio::time::timeout(timeout, async {
        let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref()).await?;
        link.send_claude_sync(
            workspace,
            text,
            images,
            Some(&session_id_for_send),
            continue_session,
            tier.access_mode(),
            tier.safe_mode(),
            Some(&system_prompt),
        )
        .await
    })
    .await
    {
        Ok(result) => result?,
        Err(_) => {
            eprintln!(
                "[pipeline] daemon turn timed out after {} wxid={} workspace={}",
                timeout_label(timeout),
                wxid,
                workspace
            );
            if let Err(error) = interrupt_daemon_workspace(deps, workspace).await {
                eprintln!(
                    "[pipeline] failed to interrupt daemon after timeout wxid={} workspace={}: {}",
                    wxid, workspace, error
                );
            }
            return Err(BridgeError::Daemon(format!(
                "desktop turn timed out after {}",
                timeout_label(timeout)
            )));
        }
    };

    // 4. Resolve session for fluent follow-ups.
    let mut reply_session = reply
        .session_id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| session_id_for_send.clone());

    // 5. If a requested file was not attached, correct the agent once in the
    // same session before replying to WeChat.
    let mut finalized = finalize_wechat_output(&reply.text);
    if requires_file_delivery(text) && finalized.files.is_empty() {
        let retry_system_prompt = build_file_retry_system_prompt(&reply.text);
        if let Ok(Ok(retry_reply)) = tokio::time::timeout(timeout, async {
            let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref()).await?;
            link.send_claude_sync(
                workspace,
                text,
                &[],
                Some(&reply_session),
                true,
                tier.access_mode(),
                tier.safe_mode(),
                Some(&retry_system_prompt),
            )
            .await
        })
        .await
        {
            reply = retry_reply;
            reply_session = reply
                .session_id
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(reply_session);
            finalized = finalize_wechat_output(&reply.text);
        }
    }

    deps.sessions.record(wxid, workspace, Some(reply_session));

    // 6. Redact for outbound.
    let text = redact_outbound(&finalized.text, deps.redaction_mode, deps.max_reply_len);
    Ok(OutgoingReply {
        text,
        images: finalized.images,
        files: finalized.files,
    })
}

async fn handle_screenshot_request(
    deps: &Deps,
    workspace: &str,
    now: i64,
    target: remote_control::ScreenshotTarget,
) -> OutgoingReply {
    let opened_path = match resolve_screenshot_path(deps, workspace, target).await {
        Ok(path) => path,
        Err(reason) => return OutgoingReply::text(format!("截屏失败：{reason}。")),
    };
    if let Some(path) = opened_path.as_deref() {
        if let Err(reason) = open_path_for_screenshot(path) {
            return OutgoingReply::text(format!("截屏失败：{reason}。"));
        }
    }
    match capture_screen_to_media(&deps.media_dir, now) {
        Ok(path) => OutgoingReply {
            text: opened_path
                .map(|path| format!("已打开并截屏：{path}"))
                .unwrap_or_else(|| "已截屏。".to_string()),
            images: vec![path],
            files: Vec::new(),
        },
        Err(reason) => OutgoingReply::text(screenshot_permission_error_message(&reason)),
    }
}

fn screenshot_permission_error_message(reason: &str) -> String {
    format!(
        "截屏失败：{reason}。需要在这台 Mac 的系统设置 > 隐私与安全性 > 录屏与系统录音中授权 Terminal、iTerm、LawyerCopilot、Claude；授权后直接在微信里重发同一句。"
    )
}

async fn handle_file_send_request(
    deps: &Deps,
    workspace: &str,
    target: remote_control::FileSendTarget,
) -> OutgoingReply {
    match resolve_file_send_path(deps, workspace, target).await {
        Ok(path) => {
            let file_name = Path::new(&path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(&path);
            OutgoingReply {
                text: format!("已发送文件：{file_name}"),
                images: Vec::new(),
                files: vec![path],
            }
        }
        Err(reason) => OutgoingReply::text(format!("发送文件失败：{reason}。")),
    }
}

async fn resolve_file_send_path(
    deps: &Deps,
    workspace: &str,
    target: remote_control::FileSendTarget,
) -> Result<String, String> {
    let path = match target {
        remote_control::FileSendTarget::ExplicitPath(path) => PathBuf::from(path),
        remote_control::FileSendTarget::WorkspaceFile(file_name) => {
            let workspace_path = resolve_current_workspace_path(deps, workspace).await?;
            resolve_workspace_file(Path::new(&workspace_path), &file_name)?
        }
    };
    let metadata = fs::metadata(&path).map_err(|_| format!("找不到文件：{}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("不是文件：{}", path.display()));
    }
    fs::canonicalize(&path)
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("无法读取文件路径：{error}"))
}

fn resolve_workspace_file(workspace_path: &Path, file_name: &str) -> Result<PathBuf, String> {
    let requested = file_name.trim();
    if requested.is_empty() {
        return Err("没有识别到要发送的文件名".to_string());
    }

    let direct = workspace_path.join(requested);
    if direct.is_file() {
        return Ok(direct);
    }
    resolve_case_insensitive_path(workspace_path, requested)
        .filter(|path| path.is_file())
        .ok_or_else(|| format!("当前工作区下找不到文件：{requested}"))
}

fn resolve_case_insensitive_path(root: &Path, requested: &str) -> Option<PathBuf> {
    let mut current = root.to_path_buf();
    for component in Path::new(requested).components() {
        let std::path::Component::Normal(name) = component else {
            return None;
        };
        let name = name.to_string_lossy();
        let exact = current.join(name.as_ref());
        if exact.exists() {
            current = exact;
            continue;
        }
        let matched = fs::read_dir(&current)
            .ok()?
            .filter_map(Result::ok)
            .find(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&name)
            })?;
        current = matched.path();
    }
    Some(current)
}

async fn resolve_screenshot_path(
    deps: &Deps,
    workspace: &str,
    target: remote_control::ScreenshotTarget,
) -> Result<Option<String>, String> {
    match target {
        remote_control::ScreenshotTarget::CurrentScreen => Ok(None),
        remote_control::ScreenshotTarget::ExplicitPath(path) => Ok(Some(path)),
        remote_control::ScreenshotTarget::CurrentWorkspace => {
            resolve_current_workspace_path(deps, workspace)
                .await
                .map(Some)
        }
    }
}

async fn resolve_current_workspace_path(deps: &Deps, workspace: &str) -> Result<String, String> {
    let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    link.workspace_path(workspace)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("找不到当前工作区路径：{workspace}"))
}

#[cfg(test)]
fn opened_screenshot_paths() -> &'static StdMutex<Vec<String>> {
    static PATHS: std::sync::OnceLock<StdMutex<Vec<String>>> = std::sync::OnceLock::new();
    PATHS.get_or_init(|| StdMutex::new(Vec::new()))
}

#[cfg(test)]
fn take_opened_screenshot_paths() -> Vec<String> {
    std::mem::take(&mut *opened_screenshot_paths().lock().expect("opened paths"))
}

#[cfg(test)]
fn open_path_for_screenshot(path: &str) -> Result<(), String> {
    opened_screenshot_paths()
        .lock()
        .expect("opened paths")
        .push(path.to_string());
    Ok(())
}

#[cfg(not(test))]
fn open_path_for_screenshot(path: &str) -> Result<(), String> {
    let target = Path::new(path);
    if !target.exists() {
        return Err(format!("路径不存在：{path}"));
    }
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    let status = Command::new(opener)
        .arg(path)
        .status()
        .map_err(|error| format!("无法打开路径：{error}"))?;
    if !status.success() {
        return Err(format!("打开路径失败：{status}"));
    }
    std::thread::sleep(Duration::from_millis(900));
    Ok(())
}

fn screenshot_file_path(media_dir: &str, now: i64) -> PathBuf {
    Path::new(media_dir).join(format!(
        "wechat-screenshot-{now}-{}.png",
        uuid::Uuid::new_v4()
    ))
}

#[cfg(test)]
fn capture_screen_to_media(media_dir: &str, now: i64) -> Result<String, String> {
    fs::create_dir_all(media_dir).map_err(|error| error.to_string())?;
    let path = screenshot_file_path(media_dir, now);
    fs::write(&path, b"test-png").map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(not(test))]
fn capture_screen_to_media(media_dir: &str, now: i64) -> Result<String, String> {
    fs::create_dir_all(media_dir).map_err(|error| error.to_string())?;
    let path = screenshot_file_path(media_dir, now);
    let output = Command::new("screencapture")
        .arg("-x")
        .arg(&path)
        .output()
        .map_err(|error| format!("无法启动 screencapture：{error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let detail = if stderr.is_empty() {
            format!("screencapture 退出码 {}", output.status)
        } else {
            stderr
        };
        let _ = fs::remove_file(&path);
        return Err(detail);
    }
    let size = fs::metadata(&path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if size == 0 {
        let _ = fs::remove_file(&path);
        return Err("系统没有产出截图文件".to_string());
    }
    Ok(path.to_string_lossy().to_string())
}

async fn interrupt_daemon_workspace(deps: &Deps, workspace: &str) -> Result<(), BridgeError> {
    let link = DaemonLink::connect(&deps.daemon_host, deps.token.as_deref()).await?;
    link.interrupt_workspace(workspace).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex as StdMutex};
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    /// A deterministic mock cc_gui_daemon speaking the real line-JSON protocol.
    /// Returns its bound address. `text_reply` is echoed back from sync calls.
    async fn spawn_mock_daemon(
        expect_token: Option<&'static str>,
        text_reply: &'static str,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    break;
                };
                tokio::spawn(handle_conn(stream, expect_token, text_reply));
            }
        });
        addr
    }

    async fn handle_conn(
        stream: tokio::net::TcpStream,
        expect_token: Option<&'static str>,
        text_reply: &'static str,
    ) {
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let req: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let id = req.get("id").and_then(Value::as_u64).unwrap_or(0);
            let method = req.get("method").and_then(Value::as_str).unwrap_or("");
            let resp = match method {
                "auth" => {
                    let provided = req
                        .get("params")
                        .and_then(|p| p.get("token"))
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    match expect_token {
                        Some(tok) if tok != provided => {
                            json!({"id": id, "error": {"message": "invalid token"}})
                        }
                        _ => json!({"id": id, "result": {"ok": true}}),
                    }
                }
                "ping" => json!({"id": id, "result": {"ok": true}}),
                "engine_send_message_sync" => {
                    let user_text = req
                        .get("params")
                        .and_then(|p| p.get("text"))
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    json!({"id": id, "result": {
                        "engine": "claude",
                        "sessionId": "sess-mock",
                        "text": format!("{text_reply}{}", extract_wechat_user_message(user_text)),
                    }})
                }
                _ => json!({"id": id, "error": {"message": "unknown"}}),
            };
            let mut frame = resp.to_string();
            frame.push('\n');
            if writer.write_all(frame.as_bytes()).await.is_err() {
                break;
            }
        }
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

    async fn spawn_silent_sync_daemon(
        expect_token: Option<&'static str>,
    ) -> (String, Arc<AtomicBool>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let interrupted = Arc::new(AtomicBool::new(false));
        let interrupted_for_listener = Arc::clone(&interrupted);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    break;
                };
                tokio::spawn(handle_silent_sync_conn(
                    stream,
                    expect_token,
                    Arc::clone(&interrupted_for_listener),
                ));
            }
        });
        (addr, interrupted)
    }

    async fn spawn_recording_daemon(
        delay: Duration,
    ) -> (String, Arc<StdMutex<Vec<Value>>>, Arc<AtomicUsize>) {
        spawn_recording_daemon_with_workspace_path(delay, PathBuf::from("/tmp/ws-default")).await
    }

    async fn spawn_entitlement_server(active: bool) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    break;
                };
                tokio::spawn(handle_entitlement_conn(stream, active));
            }
        });
        format!("http://{addr}")
    }

    async fn handle_entitlement_conn(stream: tokio::net::TcpStream, active: bool) {
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.is_empty() {
                break;
            }
        }
        let body =
            format!(r#"{{"success":true,"data":{{"features":{{"wechat_bridge":{active}}}}}}}"#);
        let response = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        let _ = writer.write_all(response.as_bytes()).await;
    }

    async fn spawn_sequence_daemon(responses: Vec<String>) -> (String, Arc<StdMutex<Vec<Value>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let calls = Arc::new(StdMutex::new(Vec::new()));
        let responses = Arc::new(StdMutex::new(responses));
        let calls_for_listener = Arc::clone(&calls);
        let responses_for_listener = Arc::clone(&responses);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    break;
                };
                tokio::spawn(handle_sequence_conn(
                    stream,
                    Arc::clone(&calls_for_listener),
                    Arc::clone(&responses_for_listener),
                ));
            }
        });
        (addr, calls)
    }

    async fn spawn_recording_daemon_with_workspace_path(
        delay: Duration,
        workspace_path: PathBuf,
    ) -> (String, Arc<StdMutex<Vec<Value>>>, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let calls = Arc::new(StdMutex::new(Vec::new()));
        let active = Arc::new(AtomicUsize::new(0));
        let max_active = Arc::new(AtomicUsize::new(0));
        let workspace_path = workspace_path.to_string_lossy().to_string();
        let calls_for_listener = Arc::clone(&calls);
        let active_for_listener = Arc::clone(&active);
        let max_for_listener = Arc::clone(&max_active);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    break;
                };
                let workspace_path_for_conn = workspace_path.clone();
                tokio::spawn(handle_recording_conn(
                    stream,
                    delay,
                    workspace_path_for_conn,
                    Arc::clone(&calls_for_listener),
                    Arc::clone(&active_for_listener),
                    Arc::clone(&max_for_listener),
                ));
            }
        });
        (addr, calls, max_active)
    }

    async fn handle_sequence_conn(
        stream: tokio::net::TcpStream,
        calls: Arc<StdMutex<Vec<Value>>>,
        responses: Arc<StdMutex<Vec<String>>>,
    ) {
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let req: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let id = req.get("id").and_then(Value::as_u64).unwrap_or(0);
            let method = req.get("method").and_then(Value::as_str).unwrap_or("");
            let resp = match method {
                "auth" => json!({"id": id, "result": {"ok": true}}),
                "engine_send_message_sync" => {
                    let mut params = req.get("params").cloned().unwrap_or(Value::Null);
                    if let Some(map) = params.as_object_mut() {
                        map.insert("_method".to_string(), Value::String(method.to_string()));
                    }
                    calls.lock().unwrap().push(params.clone());
                    let text = {
                        let mut queued = responses.lock().unwrap();
                        if queued.is_empty() {
                            String::new()
                        } else {
                            queued.remove(0)
                        }
                    };
                    json!({"id": id, "result": {
                        "engine": "claude",
                        "sessionId": params.get("sessionId").cloned().unwrap_or(Value::Null),
                        "text": text,
                    }})
                }
                _ => json!({"id": id, "error": {"message": "unknown"}}),
            };
            let mut frame = resp.to_string();
            frame.push('\n');
            if writer.write_all(frame.as_bytes()).await.is_err() {
                break;
            }
        }
    }

    async fn handle_recording_conn(
        stream: tokio::net::TcpStream,
        delay: Duration,
        workspace_path: String,
        calls: Arc<StdMutex<Vec<Value>>>,
        active: Arc<AtomicUsize>,
        max_active: Arc<AtomicUsize>,
    ) {
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let req: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let id = req.get("id").and_then(Value::as_u64).unwrap_or(0);
            let method = req.get("method").and_then(Value::as_str).unwrap_or("");
            let resp = match method {
                "auth" => json!({"id": id, "result": {"ok": true}}),
                "engine_send_message_sync" => {
                    let mut params = req.get("params").cloned().unwrap_or(Value::Null);
                    if let Some(map) = params.as_object_mut() {
                        map.insert("_method".to_string(), Value::String(method.to_string()));
                    }
                    calls.lock().unwrap().push(params.clone());
                    let now_active = active.fetch_add(1, Ordering::SeqCst) + 1;
                    max_active.fetch_max(now_active, Ordering::SeqCst);
                    tokio::time::sleep(delay).await;
                    active.fetch_sub(1, Ordering::SeqCst);
                    let text = params
                        .get("text")
                        .and_then(Value::as_str)
                        .map(extract_wechat_user_message)
                        .unwrap_or_default();
                    json!({"id": id, "result": {
                        "engine": "claude",
                        "sessionId": params.get("sessionId").cloned().unwrap_or(Value::Null),
                        "text": format!("回复:{text}"),
                    }})
                }
                "list_workspaces" => {
                    calls.lock().unwrap().push(json!({
                        "_method": method,
                    }));
                    json!({"id": id, "result": [{
                        "id": "ws-default",
                        "name": "workspace",
                        "path": workspace_path,
                        "connected": true,
                        "codex_bin": null,
                        "kind": "main",
                        "parentId": null,
                        "worktree": null,
                        "settings": {},
                    }]})
                }
                "add_workspace" => {
                    let mut params = req.get("params").cloned().unwrap_or(Value::Null);
                    if let Some(map) = params.as_object_mut() {
                        map.insert("_method".to_string(), Value::String(method.to_string()));
                    }
                    calls.lock().unwrap().push(params.clone());
                    json!({"id": id, "result": {
                        "id": "ws-added",
                        "name": "workspace",
                        "path": params.get("path").cloned().unwrap_or(Value::Null),
                        "connected": true,
                        "codex_bin": null,
                        "kind": "main",
                        "parentId": null,
                        "worktree": null,
                        "settings": {},
                    }})
                }
                "thread_compact" => {
                    let mut params = req.get("params").cloned().unwrap_or(Value::Null);
                    if let Some(map) = params.as_object_mut() {
                        map.insert("_method".to_string(), Value::String(method.to_string()));
                    }
                    calls.lock().unwrap().push(params);
                    json!({"id": id, "result": {
                        "engine": "claude",
                        "threadId": req["params"]["threadId"].clone(),
                        "turnId": "compact-turn",
                        "text": "会话压缩已完成。",
                        "status": "completed",
                    }})
                }
                _ => json!({"id": id, "error": {"message": "unknown"}}),
            };
            let mut frame = resp.to_string();
            frame.push('\n');
            if writer.write_all(frame.as_bytes()).await.is_err() {
                break;
            }
        }
    }

    async fn handle_silent_sync_conn(
        stream: tokio::net::TcpStream,
        expect_token: Option<&'static str>,
        interrupted: Arc<AtomicBool>,
    ) {
        let (reader, mut writer) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let req: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let id = req.get("id").and_then(Value::as_u64).unwrap_or(0);
            let method = req.get("method").and_then(Value::as_str).unwrap_or("");
            match method {
                "auth" => {
                    let provided = req
                        .get("params")
                        .and_then(|p| p.get("token"))
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    let resp = match expect_token {
                        Some(tok) if tok != provided => {
                            json!({"id": id, "error": {"message": "invalid token"}})
                        }
                        _ => json!({"id": id, "result": {"ok": true}}),
                    };
                    let mut frame = resp.to_string();
                    frame.push('\n');
                    if writer.write_all(frame.as_bytes()).await.is_err() {
                        break;
                    }
                }
                "engine_send_message_sync" => {
                    tokio::time::sleep(Duration::from_secs(30)).await;
                }
                "engine_interrupt" => {
                    interrupted.store(true, Ordering::SeqCst);
                    let mut frame = json!({"id": id, "result": {"ok": true}}).to_string();
                    frame.push('\n');
                    if writer.write_all(frame.as_bytes()).await.is_err() {
                        break;
                    }
                }
                _ => {
                    let mut frame = json!({"id": id, "error": {"message": "unknown"}}).to_string();
                    frame.push('\n');
                    if writer.write_all(frame.as_bytes()).await.is_err() {
                        break;
                    }
                }
            }
        }
    }

    fn deps_for(addr: String, token: Option<String>) -> Deps {
        deps_for_with_audit(
            addr,
            token,
            std::env::temp_dir()
                .join("wx_bridge_pipeline_test.log")
                .to_string_lossy()
                .to_string(),
        )
    }

    fn deps_for_with_audit(addr: String, token: Option<String>, audit_path: String) -> Deps {
        Deps {
            daemon_host: addr,
            token,
            entitlement: None,
            default_workspace: "ws-default".to_string(),
            redaction_mode: RedactionMode::Full, // keep text intact for assertions
            max_reply_len: 1000,
            media_dir: std::env::temp_dir()
                .join("wx_bridge_pipeline_media")
                .to_string_lossy()
                .to_string(),
            reply_rate_limiter: crate::rate_limit::ReplyRateLimiter::new(1, 60),
            dedup_ttl_secs: 600,
            dedup: Dedup::open(":memory:").unwrap(),
            sessions: SessionMap::new(),
            turn_locks: TurnLocks::new(),
            audit: Audit::new(audit_path),
        }
    }

    fn deps_for_high_rate(addr: String) -> Deps {
        Deps {
            daemon_host: addr,
            token: Some("tok".into()),
            entitlement: None,
            default_workspace: "ws-default".to_string(),
            redaction_mode: RedactionMode::Full,
            max_reply_len: 1000,
            media_dir: std::env::temp_dir()
                .join("wx_bridge_pipeline_media")
                .to_string_lossy()
                .to_string(),
            reply_rate_limiter: crate::rate_limit::ReplyRateLimiter::new(20, 60),
            dedup_ttl_secs: 600,
            dedup: Dedup::open(":memory:").unwrap(),
            sessions: SessionMap::new(),
            turn_locks: TurnLocks::new(),
            audit: Audit::new(
                std::env::temp_dir()
                    .join("wx_bridge_pipeline_recording_test.log")
                    .to_string_lossy()
                    .to_string(),
            ),
        }
    }

    fn msg(wxid: &str, msg_id: &str, text: &str) -> IncomingMessage {
        IncomingMessage {
            wxid: wxid.into(),
            msg_id: msg_id.into(),
            text: text.into(),
            images: vec![],
        }
    }

    #[test]
    fn wechat_system_prompt_hides_desktop_internal_modes() {
        let prompt = build_wechat_system_prompt(PermissionTier::ReadOnly, None);

        assert!(prompt.contains("只输出最终要发给微信用户的正文"));
        assert!(prompt.contains("禁止输出你对消息的分析"));
        assert!(prompt.contains("<wechat-reply>"));
        assert!(prompt.contains("不要提及计划模式"));
        assert!(prompt.contains("不要提及 plan mode"));
        assert!(prompt.contains("不使用 emoji"));
        assert!(prompt.contains("当前微信通道已授权读写电脑操作"));
        assert!(!prompt.contains("只读电脑操作"));
        assert!(prompt.contains("可以直接给出工作区路径和文件列表"));
        assert!(prompt.contains("微信是远程入口"));
        assert!(!prompt.contains("微信是唯一交互入口"));
        assert!(prompt.contains("电脑端可以随时接管同一个会话"));
        assert!(!prompt.contains("回到电脑端"));
        assert!(!prompt.contains("<wechat-user-message>"));
        assert!(!prompt.contains("测试 2:你现在能回复吗"));
    }

    #[test]
    fn file_artifact_requests_require_wechat_file_delivery() {
        let prompt = build_wechat_system_prompt(PermissionTier::Confirm, None);

        assert!(prompt.contains("创建真实的本地文件"));
        assert!(prompt.contains(".xlsx"));
        assert!(prompt.contains("<wechat-file>绝对路径或URL</wechat-file>"));
        assert!(prompt.contains("只回答文字不算完成"));
        assert!(requires_file_delivery(
            "帮我看一下今日金价，总结成 Excel 发我"
        ));
    }

    #[test]
    fn production_daemon_turn_timeout_allows_long_wechat_tasks() {
        assert!(PRODUCTION_DAEMON_TURN_TIMEOUT_SECS >= 900);
    }

    #[test]
    fn direct_wechat_prompt_allows_screenshot_and_image_reply() {
        let prompt = build_wechat_system_prompt(PermissionTier::Confirm, None);

        assert!(prompt.contains("截图并通过 <wechat-image> 发回"));
        assert!(!prompt.contains("确认普通电脑操作"));
        assert!(prompt.contains("<wechat-image>绝对路径或URL</wechat-image>"));
        assert!(prompt.contains("用 <wechat-file> 发回本地文件"));
        assert!(prompt.contains("<wechat-file>绝对路径或URL</wechat-file>"));
        assert!(!prompt.contains("<wechat-user-message>"));
        assert!(!prompt.contains("给我当前所在的工作区截个图发我"));
    }

    #[test]
    fn finalizer_extracts_tagged_wechat_reply_only() {
        let reply = "分析内容\n<wechat-reply>你好，我可以帮你审合同。</wechat-reply>\n其他内容";

        assert_eq!(
            finalize_wechat_output(reply).text,
            "你好，我可以帮你审合同。"
        );
    }

    #[test]
    fn finalizer_removes_leading_internal_analysis() {
        let reply = "这是一个通过微信发来的简单问候。用户只是问功能，这不需要进入计划流程、探索代码或制定实施方案。我直接简洁回答即可。你好，我可以帮你审合同、写律师函、整理案件材料。";
        let finalized = finalize_wechat_output(reply).text;

        assert!(finalized.starts_with("你好，我可以"));
        assert!(!finalized.contains("计划流程"));
        assert!(!finalized.contains("用户只是"));
    }

    #[test]
    fn finalizer_extracts_outbound_image_tags() {
        let reply =
            "<wechat-reply>已生成图片。\n<wechat-image>/tmp/a.png</wechat-image></wechat-reply>";

        let finalized = finalize_wechat_output(reply);

        assert_eq!(finalized.text, "已生成图片。");
        assert_eq!(finalized.images, vec!["/tmp/a.png".to_string()]);
    }

    #[test]
    fn finalizer_extracts_outbound_file_tags() {
        let reply =
            "<wechat-reply>已生成文件。\n<wechat-file>/tmp/report.pdf</wechat-file></wechat-reply>";

        let finalized = finalize_wechat_output(reply);

        assert_eq!(finalized.text, "已生成文件。");
        assert_eq!(finalized.files, vec!["/tmp/report.pdf".to_string()]);
    }

    #[test]
    fn finalizer_deduplicates_outbound_file_tags() {
        let reply = "<wechat-reply>已生成文件。\n<wechat-file>/tmp/report.pdf</wechat-file>\n<wechat-file>/tmp/report.pdf</wechat-file></wechat-reply>";

        let finalized = finalize_wechat_output(reply);

        assert_eq!(finalized.files, vec!["/tmp/report.pdf".to_string()]);
    }

    #[test]
    fn screenshot_permission_error_keeps_next_step_in_wechat() {
        let msg = screenshot_permission_error_message("权限不足");

        assert!(!msg.contains("请在电脑端"));
        assert!(!msg.contains("回到电脑端"));
        assert!(msg.contains("微信里重发"));
    }

    #[tokio::test]
    async fn end_to_end_conversation_via_mock_daemon() {
        let addr = spawn_mock_daemon(Some("tok"), "回复:").await;
        let deps = deps_for(addr, Some("tok".into()));
        let out = handle_message_at(&deps, &msg("wx-a", "m1", "你好"), 1000)
            .await
            .expect("should reply");
        assert_eq!(out.text, "回复:你好");
        // session recorded for continuation
        assert_eq!(deps.sessions.last_session("wx-a"), Some("sess-mock".into()));
    }

    #[tokio::test]
    async fn inactive_entitlement_replies_upgrade_prompt_without_daemon_turn() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let entitlement_base = spawn_entitlement_server(false).await;
        let mut deps = deps_for_high_rate(addr);
        deps.entitlement =
            Some(EntitlementChecker::for_test(entitlement_base, "tok".into()).unwrap());

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "你好"), 1000)
            .await
            .expect("should reply with upgrade prompt");

        assert!(out.text.contains("微信高级功能"));
        assert!(out.text.contains("开通"));
        assert!(calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn file_request_without_attachment_retries_until_file_tag() {
        let (addr, calls) = spawn_sequence_daemon(vec![
            "这里只有文字总结，没有文件。".to_string(),
            "<wechat-reply>已生成 Excel。\n<wechat-file>/tmp/gold.xlsx</wechat-file></wechat-reply>"
                .to_string(),
        ])
        .await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(
            &deps,
            &msg("wx-a", "m-file", "帮我看一下今日金价，总结成 Excel 发我"),
            1000,
        )
        .await
        .expect("should reply");

        assert_eq!(out.files, vec!["/tmp/gold.xlsx".to_string()]);
        assert!(out.text.contains("已生成 Excel"));
        let calls = calls.lock().unwrap();
        let engine_calls: Vec<_> = calls
            .iter()
            .filter(|call| {
                call.get("_method").and_then(Value::as_str) == Some("engine_send_message_sync")
            })
            .collect();
        assert_eq!(engine_calls.len(), 2);
        let retry_text = engine_calls[1]
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert_eq!(retry_text, "帮我看一下今日金价，总结成 Excel 发我");
        let retry_system_prompt = engine_calls[1]
            .get("appendSystemPrompt")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert!(retry_system_prompt.contains("上一轮回复没有附上文件"));
        assert!(retry_system_prompt.contains("<wechat-file>"));
    }

    #[tokio::test]
    async fn first_wechat_turn_starts_stable_daemon_session() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "你好"), 1000)
            .await
            .expect("should reply");

        assert_eq!(out.text, "回复:你好");
        let calls = calls.lock().unwrap();
        let first = calls
            .iter()
            .find(|call| {
                call.get("_method").and_then(Value::as_str) == Some("engine_send_message_sync")
            })
            .expect("daemon should receive one sync call");
        let session_id = first
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("first turn should provide a stable sessionId");
        assert!(!session_id.trim().is_empty());
        assert_ne!(first.get("continueSession"), Some(&Value::Bool(true)));
        assert_eq!(
            deps.sessions.last_session("wx-a").as_deref(),
            Some(session_id)
        );
    }

    #[tokio::test]
    async fn first_greeting_hidden_prompt_introduces_capabilities_and_workspace() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "你好"), 1000)
            .await
            .expect("greeting should reply");

        assert_eq!(out.text, "回复:你好");
        let calls = calls.lock().unwrap();
        assert!(calls
            .iter()
            .any(|call| call.get("_method").and_then(Value::as_str) == Some("list_workspaces")));
        let engine_call = calls
            .iter()
            .find(|call| {
                call.get("_method").and_then(Value::as_str) == Some("engine_send_message_sync")
            })
            .expect("greeting should still be sent to the agent");
        assert_eq!(engine_call["text"], "你好");
        let system_prompt = engine_call
            .get("appendSystemPrompt")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert!(system_prompt.contains("伙伴"));
        assert!(system_prompt.contains("当前工作目录：/tmp/ws-default"));
        assert!(system_prompt.contains("读写文件"));
        assert!(system_prompt.contains("Excel"));
        assert!(system_prompt.contains("截图"));
        assert!(system_prompt.contains("切换到"));
        assert!(system_prompt.contains("不要把能力、目录和下一步说明挤成一段"));
        assert!(system_prompt.contains("能力用短列表"));
        assert!(system_prompt.contains("当前目录单独一行"));
    }

    #[tokio::test]
    async fn same_wechat_user_turns_are_serialized_and_continue_session() {
        let (addr, calls, max_active) = spawn_recording_daemon(Duration::from_millis(50)).await;
        let deps = deps_for_high_rate(addr);

        let first_msg = msg("wx-a", "m1", "第一条");
        let second_msg = msg("wx-a", "m2", "第二条");
        let first = handle_message_at(&deps, &first_msg, 1000);
        let second = handle_message_at(&deps, &second_msg, 1000);
        let (first_out, second_out) = tokio::join!(first, second);

        assert_eq!(first_out.expect("first reply").text, "回复:第一条");
        assert_eq!(second_out.expect("second reply").text, "回复:第二条");
        assert_eq!(max_active.load(Ordering::SeqCst), 1);
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 2);
        let first_session = calls[0]
            .get("sessionId")
            .and_then(Value::as_str)
            .expect("first call should start a stable session");
        assert_eq!(
            calls[1].get("sessionId").and_then(Value::as_str),
            Some(first_session)
        );
        assert_eq!(calls[1].get("continueSession"), Some(&Value::Bool(true)));
    }

    #[tokio::test]
    async fn directory_query_runs_immediately_with_full_access() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(
            &deps,
            &msg("wx-a", "m1", "当前目录地址是啥？有哪些文件？"),
            1000,
        )
        .await
        .expect("directory question should reply");

        assert!(out.text.contains("当前目录地址是啥"));
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["text"], "当前目录地址是啥？有哪些文件？");
        assert_eq!(calls[0]["accessMode"], "full-access");
        assert_eq!(calls[0]["safeMode"], false);
        let system_prompt = calls[0]
            .get("appendSystemPrompt")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert!(system_prompt.contains("当前微信通道已授权读写电脑操作"));
        assert!(system_prompt.contains("电脑端可以随时接管同一个会话"));
        assert!(!system_prompt.contains("<wechat-user-message>"));
    }

    #[tokio::test]
    async fn switch_workspace_command_adds_workspace_and_uses_it_for_next_turn() {
        let workspace_dir = std::env::temp_dir().join(format!(
            "wx_bridge_switch_workspace_{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&workspace_dir).expect("workspace dir");
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let switch_text = format!("切换到 {}", workspace_dir.display());
        let out = handle_message_at(&deps, &msg("wx-a", "m1", &switch_text), 1000)
            .await
            .expect("switch should reply");

        assert!(out.text.contains("已切换到"));
        assert!(out
            .text
            .contains(&workspace_dir.to_string_lossy().to_string()));
        assert_eq!(deps.sessions.workspace_for("wx-a", "d"), "ws-added");
        assert_eq!(deps.sessions.last_session("wx-a"), None);

        let follow_up = handle_message_at(&deps, &msg("wx-a", "m2", "当前目录地址是啥？"), 1001)
            .await
            .expect("follow-up should run in switched workspace");
        assert_eq!(follow_up.text, "回复:当前目录地址是啥？");

        let calls = calls.lock().unwrap();
        let add_workspace = calls
            .iter()
            .find(|call| call.get("_method").and_then(Value::as_str) == Some("add_workspace"))
            .expect("switch should call add_workspace");
        assert_eq!(
            add_workspace["path"],
            workspace_dir.to_string_lossy().to_string()
        );
        let follow_up_call = calls
            .iter()
            .filter(|call| {
                call.get("_method").and_then(Value::as_str) == Some("engine_send_message_sync")
            })
            .last()
            .expect("follow-up should be sent to agent");
        assert_eq!(follow_up_call["workspaceId"], "ws-added");
        let _ = fs::remove_dir_all(workspace_dir);
    }

    #[tokio::test]
    async fn explicit_path_screenshot_opens_path_before_capture_without_daemon_turn() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);
        let path = "/Users/wuwenrui/Desktop/code/wwr/icu";
        take_opened_screenshot_paths();

        let out = handle_message_at(
            &deps,
            &msg(
                "wx-a",
                "m1",
                &format!("打开 {path} 这个文件夹，然后截图发我"),
            ),
            1000,
        )
        .await
        .expect("screenshot should execute");

        assert!(out.text.contains("截屏"));
        assert!(out.text.contains(path));
        assert_eq!(out.images.len(), 1);
        assert!(out.images[0].ends_with(".png"));
        assert_eq!(take_opened_screenshot_paths(), vec![path.to_string()]);
        let calls = calls.lock().unwrap();
        assert!(calls.is_empty());
    }

    #[tokio::test]
    async fn workspace_screenshot_resolves_workspace_path_before_capture() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);
        take_opened_screenshot_paths();

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "这个目录下截个图发我看看"), 1000)
            .await
            .expect("screenshot should execute");

        assert!(out.text.contains("截屏"));
        assert!(out.text.contains("/tmp/ws-default"));
        assert_eq!(out.images.len(), 1);
        assert_eq!(
            take_opened_screenshot_paths(),
            vec!["/tmp/ws-default".to_string()]
        );
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["_method"], "list_workspaces");
    }

    #[tokio::test]
    async fn workspace_file_send_returns_file_attachment_without_daemon_turn() {
        let workspace_dir =
            std::env::temp_dir().join(format!("wx_bridge_file_send_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&workspace_dir).expect("workspace dir");
        let file_path = workspace_dir.join("CLAUDE.md");
        fs::write(&file_path, "# Agent notes").expect("workspace file");
        let (addr, calls, _) =
            spawn_recording_daemon_with_workspace_path(Duration::ZERO, workspace_dir.clone()).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(
            &deps,
            &msg("wx-a", "m1", "把这个目录下的claude.md文件发我"),
            1000,
        )
        .await
        .expect("file send should execute");

        assert!(out.text.contains("已发送文件"));
        assert_eq!(out.images.len(), 0);
        assert_eq!(
            out.files,
            vec![fs::canonicalize(&file_path)
                .expect("canonical file")
                .to_string_lossy()
                .to_string()]
        );
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["_method"], "list_workspaces");
    }

    #[tokio::test]
    async fn write_task_runs_immediately_with_full_access() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "帮我修改 README"), 1000)
            .await
            .expect("write task should execute");

        assert_eq!(out.text, "回复:帮我修改 README");
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["accessMode"], "full-access");
        assert_eq!(calls[0]["safeMode"], false);
    }

    #[tokio::test]
    async fn high_risk_task_runs_immediately_with_full_access() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "删除 target 并 git push"), 1000)
            .await
            .expect("high-risk task should execute");

        assert_eq!(out.text, "回复:删除 target 并 git push");
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["accessMode"], "full-access");
        assert_eq!(calls[0]["safeMode"], false);
    }

    #[tokio::test]
    async fn new_session_command_resets_only_current_wechat_session() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        handle_message_at(&deps, &msg("wx-a", "m1", "第一条"), 1000).await;
        let first_session = calls.lock().unwrap()[0]["sessionId"]
            .as_str()
            .unwrap()
            .to_string();

        let ack = handle_message_at(&deps, &msg("wx-a", "m2", "新开会话"), 1001)
            .await
            .expect("new session should reply");
        assert!(ack.text.contains("已新开会话"));
        assert_eq!(deps.sessions.last_session("wx-a"), None);

        handle_message_at(&deps, &msg("wx-a", "m3", "第二条"), 1002).await;
        let calls = calls.lock().unwrap();
        let second_session = calls[1]["sessionId"].as_str().unwrap();
        assert_ne!(second_session, first_session);
        assert_ne!(calls[1].get("continueSession"), Some(&Value::Bool(true)));
    }

    #[tokio::test]
    async fn compact_command_calls_thread_compact_for_current_claude_session() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        handle_message_at(&deps, &msg("wx-a", "m1", "第一条"), 1000).await;
        let session_id = deps.sessions.last_session("wx-a").unwrap();
        let out = handle_message_at(&deps, &msg("wx-a", "m2", "会话压缩"), 1001)
            .await
            .expect("compact should reply");

        assert!(out.text.contains("压缩"));
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[1]["_method"], "thread_compact");
        assert_eq!(calls[1]["threadId"], format!("claude:{session_id}"));
    }

    #[tokio::test]
    async fn compact_command_without_session_is_actionable() {
        let (addr, calls, _) = spawn_recording_daemon(Duration::ZERO).await;
        let deps = deps_for_high_rate(addr);

        let out = handle_message_at(&deps, &msg("wx-a", "m1", "会话压缩"), 1000)
            .await
            .expect("compact should reply");

        assert!(out.text.contains("没有可压缩"));
        assert!(calls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn duplicate_message_is_dropped() {
        let addr = spawn_mock_daemon(Some("tok"), "回复:").await;
        let deps = deps_for(addr, Some("tok".into()));
        assert!(handle_message_at(&deps, &msg("wx-a", "dup", "一"), 1000)
            .await
            .is_some());
        assert!(handle_message_at(&deps, &msg("wx-a", "dup", "一"), 1001)
            .await
            .is_none());
    }

    #[tokio::test]
    async fn auth_failure_yields_user_facing_error() {
        let addr = spawn_mock_daemon(Some("right"), "x").await;
        let deps = deps_for(addr, Some("wrong".into()));
        let out = handle_message_at(&deps, &msg("wx-a", "m1", "hi"), 1000)
            .await
            .expect("should reply with error");
        assert!(out.text.contains("本机 agent"));
        assert!(!out.text.contains("电脑端"));
        assert!(!out.text.contains("桌面端"));
        assert!(!out.text.contains("token")); // no internal leak
    }

    #[tokio::test]
    async fn daemon_down_yields_friendly_error_not_panic() {
        // point at a closed port
        let deps = deps_for("127.0.0.1:1".to_string(), Some("tok".into()));
        let out = handle_message_at(&deps, &msg("wx-a", "m1", "hi"), 1000)
            .await
            .expect("should reply");
        assert!(out.text.contains("本机 agent"));
        assert!(!out.text.contains("电脑端"));
        assert!(!out.text.contains("桌面端"));
    }

    #[tokio::test]
    async fn silent_daemon_sync_times_out_with_friendly_error_and_audit() {
        let (addr, interrupted) = spawn_silent_sync_daemon(Some("tok")).await;
        let audit_path = std::env::temp_dir()
            .join(format!(
                "wx_bridge_pipeline_timeout_{}.log",
                body_fingerprint("timeout")
            ))
            .to_string_lossy()
            .to_string();
        let _ = std::fs::remove_file(&audit_path);
        let deps = deps_for_with_audit(addr, Some("tok".into()), audit_path.clone());

        let out = tokio::time::timeout(
            Duration::from_millis(250),
            handle_message_at(&deps, &msg("wx-a", "m-timeout", "hi"), 1000),
        )
        .await
        .expect("bridge should enforce its own daemon deadline")
        .expect("should reply with a friendly timeout");

        assert!(out.text.contains("本机 agent"));
        assert!(!out.text.contains("电脑端"));
        assert!(!out.text.contains("桌面端"));
        assert!(!out.text.contains("127.0.0.1"));
        let audit = std::fs::read_to_string(&audit_path).unwrap();
        assert!(audit.contains("decision=error"));
        assert!(interrupted.load(Ordering::SeqCst));
        let _ = std::fs::remove_file(&audit_path);
    }

    #[tokio::test]
    async fn two_lawyers_keep_independent_sessions() {
        let addr = spawn_mock_daemon(Some("tok"), "r:").await;
        let deps = deps_for(addr, Some("tok".into()));
        handle_message_at(&deps, &msg("wx-a", "a1", "甲"), 1000).await;
        handle_message_at(&deps, &msg("wx-b", "b1", "乙"), 1000).await;
        assert_eq!(deps.sessions.last_session("wx-a"), Some("sess-mock".into()));
        assert_eq!(deps.sessions.last_session("wx-b"), Some("sess-mock".into()));
        // distinct wxids tracked separately (no cross-talk panic / overwrite)
        assert_eq!(deps.sessions.workspace_for("wx-a", "d"), "ws-default");
    }

    #[tokio::test]
    async fn same_lawyer_messages_inside_reply_window_are_rate_limited() {
        let addr = spawn_mock_daemon(Some("tok"), "回复:").await;
        let deps = deps_for(addr, Some("tok".into()));
        let first = handle_message_at(&deps, &msg("wx-a", "m1", "第一条"), 1000)
            .await
            .expect("first message should reply");
        let second = handle_message_at(&deps, &msg("wx-a", "m2", "第二条"), 1001)
            .await
            .expect("second message should receive a rate-limit notice");

        assert_eq!(first.text, "回复:第一条");
        assert!(second.text.contains("消息太密集"));
        assert!(!second.text.contains("回复:第二条"));
    }
}
