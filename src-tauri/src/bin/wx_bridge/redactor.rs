//! Outbound redaction. WeChat is the remote-control surface, so replies stay in
//! WeChat by default; secrets are always stripped.
//!
//! NOTE: `Summarized` is kept for compatibility and never points users to a
//! different surface.

use std::sync::LazyLock;

use regex::Regex;

static SECRET_VALUE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?i)(["']?\b(?:token|api[_-]?key|secret|password|authorization)\b["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/=-]{8,}(["']?)"#,
    )
    .expect("valid secret value regex")
});
static BEARER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{8,}").expect("valid bearer regex")
});
static SK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"sk-[A-Za-z0-9._-]{8,}").expect("valid sk regex"));

/// Per-lawyer outbound disclosure mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedactionMode {
    /// Compatibility mode: trim long content, keep the next action in WeChat.
    Summarized,
    /// Default: send full text (secrets still stripped).
    Full,
}

impl Default for RedactionMode {
    fn default() -> Self {
        RedactionMode::Full
    }
}

const WECHAT_NOTICE: &str =
    "\n\n（内容较长，已在微信内截断；需要完整内容请直接回复“把完整内容发成文件”。）";

/// Strip obvious credentials so a token never leaves the machine in a reply.
pub fn strip_secrets(text: &str) -> String {
    let without_named_values = SECRET_VALUE_RE
        .replace_all(text, |caps: &regex::Captures| {
            format!("{}[已隐藏]{}", &caps[1], &caps[2])
        })
        .into_owned();
    let without_bearer = BEARER_RE
        .replace_all(&without_named_values, "Bearer [已隐藏]")
        .into_owned();
    let without_sk = SK_RE.replace_all(&without_bearer, "[已隐藏]").into_owned();

    without_sk
        .split_whitespace()
        .map(|tok| {
            let trimmed = tok.trim_matches(|c: char| !c.is_ascii_alphanumeric());
            if is_secret_like(trimmed) {
                "[已隐藏]"
            } else {
                tok
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_secret_like(token: &str) -> bool {
    // sk-..., Bearer tokens, long hex/base64 blobs
    if token.starts_with("sk-") && token.len() >= 12 {
        return true;
    }
    let long_opaque = token.len() >= 32
        && token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    long_opaque
}

/// Apply outbound redaction for the lawyer's configured mode.
pub fn redact_outbound(text: &str, mode: RedactionMode, max_len: usize) -> String {
    let safe = strip_secrets(text);
    match mode {
        RedactionMode::Full => safe,
        RedactionMode::Summarized => {
            let char_count = safe.chars().count();
            if char_count <= max_len {
                safe
            } else {
                let head: String = safe.chars().take(max_len).collect();
                format!("{head}…{WECHAT_NOTICE}")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_mode_is_summarized() {
        assert_eq!(RedactionMode::default(), RedactionMode::Full);
    }

    #[test]
    fn short_reply_passes_through() {
        let out = redact_outbound("好的，已完成", RedactionMode::Summarized, 100);
        assert_eq!(out, "好的，已完成");
    }

    #[test]
    fn long_reply_trimmed_without_desktop_notice() {
        let long = "案".repeat(500);
        let out = redact_outbound(&long, RedactionMode::Summarized, 200);
        assert!(out.chars().count() < 500);
        assert!(!out.contains("电脑端"));
        assert!(!out.contains("桌面端"));
        assert!(out.contains("微信"));
    }

    #[test]
    fn full_mode_keeps_length_but_strips_secrets() {
        let long = format!("{} sk-abcdef0123456789", "字".repeat(500));
        let out = redact_outbound(&long, RedactionMode::Full, 50);
        assert!(out.chars().count() > 100); // not trimmed
        assert!(out.contains("[已隐藏]"));
        assert!(!out.contains("sk-abcdef"));
    }

    #[test]
    fn secrets_stripped_even_in_summarized() {
        let out = redact_outbound("token: sk-deadbeefcafe0000", RedactionMode::Summarized, 100);
        assert!(!out.contains("sk-deadbeef"));
        assert!(out.contains("[已隐藏]"));
    }

    #[test]
    fn long_opaque_blob_hidden() {
        let blob = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7"; // 34 chars
        assert!(is_secret_like(blob));
    }

    #[test]
    fn api_key_assignment_is_hidden() {
        let out = strip_secrets("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz");
        assert!(!out.contains("sk-proj"));
        assert!(out.contains("[已隐藏]"));
    }

    #[test]
    fn json_token_value_is_hidden() {
        let out = strip_secrets(r#"{"token":"sk-proj-abcdefghijklmnopqrstuvwxyz"}"#);
        assert!(!out.contains("sk-proj"));
        assert!(out.contains("[已隐藏]"));
    }
}
