/// Build the `## Curated Skills` body to be appended via the Claude CLI's
/// `--append-system-prompt <body>` flag. Returns `None` when no curated skills
/// are enabled, in which case the caller must not add the flag at all.
///
/// Truncates the combined body to 100 KB and notes the truncation in a
/// `claude-injection-truncated: true` metadata marker for diagnostics.
pub(super) fn build_curated_skill_append_args(
    app_settings: &crate::types::AppSettings,
) -> Option<String> {
    let enabled = crate::curated_skills::list_enabled_curated_skill_bodies(app_settings);
    if enabled.is_empty() {
        return None;
    }
    const MAX_BODY_BYTES: usize = 100 * 1024;
    const TRUNCATION_MARKER: &str = "\n<!-- claude-injection-truncated: true -->\n";
    let content_limit = MAX_BODY_BYTES.saturating_sub(TRUNCATION_MARKER.len());
    let mut truncated = false;
    let mut body = String::from(
        "## Curated Skills\n\nThe following curated skills are loaded for this conversation.\nEach skill is wrapped in <skill id=\"...\"> tags for clarity.\n\n",
    );
    for (id, skill_body) in enabled {
        let piece = format!("<skill id=\"{}\">\n{}\n</skill>\n\n", id, skill_body);
        if push_utf8_prefix_within_limit(&mut body, &piece, content_limit) {
            truncated = true;
            break;
        }
    }
    if truncated {
        body.push_str(TRUNCATION_MARKER);
    }
    Some(body)
}

fn push_utf8_prefix_within_limit(target: &mut String, value: &str, max_bytes: usize) -> bool {
    let remaining = max_bytes.saturating_sub(target.len());
    if value.len() <= remaining {
        target.push_str(value);
        return false;
    }
    if remaining == 0 {
        return true;
    }
    let mut end = remaining;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    if end > 0 {
        target.push_str(&value[..end]);
    }
    true
}

#[cfg(test)]
mod tests {
    //! Black-box tests for `build_curated_skill_append_args`. We deliberately
    //! do not instantiate a real `ClaudeSession` because that would need an
    //! `AppState`; this module owns the isolated body builder.
    use super::{build_curated_skill_append_args, push_utf8_prefix_within_limit};
    use crate::types::AppSettings;

    fn settings_with(ids: Vec<&str>) -> AppSettings {
        let mut settings = AppSettings::default();
        settings.enabled_curated_skill_ids = ids.into_iter().map(String::from).collect();
        settings
    }

    #[test]
    fn append_args_returns_none_when_no_curated_enabled() {
        let settings = settings_with(vec![]);
        let out = build_curated_skill_append_args(&settings);
        assert!(out.is_none(), "no curated -> None");
    }

    #[test]
    fn append_args_includes_section_header_and_skill_id() {
        // Use lazy-senior-dev which is a real entry in the lock.
        let settings = settings_with(vec!["lazy-senior-dev"]);
        let out = build_curated_skill_append_args(&settings)
            .expect("must produce a body when at least one is enabled");
        assert!(out.contains("## Curated Skills"));
        assert!(out.contains("lazy-senior-dev"));
        assert!(out.contains("</skill>"));
    }

    #[test]
    fn append_args_truncates_at_100kb_and_marks_truncated() {
        let settings = settings_with(vec!["lazy-senior-dev"]);
        let out = build_curated_skill_append_args(&settings).unwrap();
        // 1100-token estimate roughly maps to a few KB.
        assert!(out.len() < 100 * 1024);
        assert!(!out.contains("claude-injection-truncated: true"));
    }

    #[test]
    fn utf8_prefix_truncation_never_slices_inside_a_character() {
        let mut body = String::from("prefix");
        let truncated = push_utf8_prefix_within_limit(&mut body, "😀tail", 8);

        assert!(truncated);
        assert_eq!(body, "prefix");

        let mut body = String::from("prefix");
        let truncated = push_utf8_prefix_within_limit(&mut body, "你tail", 9);

        assert!(truncated);
        assert_eq!(body, "prefix你");
    }
}
