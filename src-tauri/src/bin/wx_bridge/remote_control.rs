//! WeChat remote-control policy and commands.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionTier {
    ReadOnly,
    Confirm,
    StrongConfirm,
}

impl PermissionTier {
    pub fn access_mode(self) -> &'static str {
        match self {
            PermissionTier::ReadOnly => "full-access",
            PermissionTier::Confirm => "full-access",
            PermissionTier::StrongConfirm => "full-access",
        }
    }

    pub fn safe_mode(self) -> bool {
        false
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteCommand {
    Help,
    NewSession,
    Compact,
    Cancel,
    SwitchWorkspace(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScreenshotTarget {
    CurrentScreen,
    ExplicitPath(String),
    CurrentWorkspace,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileSendTarget {
    ExplicitPath(String),
    WorkspaceFile(String),
}

pub fn parse_command(text: &str) -> Option<RemoteCommand> {
    if let Some(path) = parse_workspace_switch_path(text) {
        return Some(RemoteCommand::SwitchWorkspace(path));
    }
    let normalized = normalize_text(text);
    match normalized.as_str() {
        "/help" | "help" | "帮助" | "菜单" => Some(RemoteCommand::Help),
        "/new" | "new" | "新开会话" | "新会话" | "重开会话" => {
            Some(RemoteCommand::NewSession)
        }
        "/compact" | "compact" | "会话压缩" | "压缩会话" | "压缩上下文" => {
            Some(RemoteCommand::Compact)
        }
        "/cancel" | "cancel" | "取消" | "撤销" => Some(RemoteCommand::Cancel),
        _ => None,
    }
}

fn parse_workspace_switch_path(text: &str) -> Option<String> {
    let normalized = normalize_text(text);
    let asks_switch = normalized.starts_with("切换到")
        || normalized.starts_with("切到")
        || normalized.starts_with("进入")
        || normalized.starts_with("cd ")
        || normalized.starts_with("/cd ");
    if !asks_switch {
        return None;
    }
    extract_absolute_path(text)
}

pub fn bypass_rate_limit(text: &str) -> bool {
    parse_command(text).is_some()
}

pub fn classify_task(text: &str, images: &[String]) -> PermissionTier {
    let normalized = normalize_text(text);
    let strong_markers = [
        "删除",
        "清空",
        "覆盖",
        "rm ",
        "rm-",
        "rm/",
        "git push",
        "git sync",
        "git pull",
        "commit",
        "提交代码",
        "推送",
        "安装依赖",
        "npm install",
        "cargo install",
        "brew install",
        "上传",
        "发到外部",
        "全权",
        "full-access",
        "dangerously",
        "../",
        "/etc/",
        "/users/",
    ];
    if strong_markers
        .iter()
        .any(|marker| normalized.contains(marker))
    {
        return PermissionTier::StrongConfirm;
    }

    let side_effect_markers = [
        "写",
        "修改",
        "改一下",
        "新建",
        "创建",
        "保存",
        "编辑",
        "移动",
        "重命名",
        "运行",
        "执行",
        "打开",
        "截图",
        "截屏",
        "屏幕截图",
        "截个图",
        "发文件",
        "发送文件",
        "发送附件",
        "附件发",
        "导出",
        "操作电脑",
        "控制电脑",
    ];
    if side_effect_markers
        .iter()
        .any(|marker| normalized.contains(marker))
    {
        return PermissionTier::Confirm;
    }

    if asks_to_send_attachment(&normalized) {
        return PermissionTier::Confirm;
    }

    if !images.is_empty() {
        return PermissionTier::ReadOnly;
    }
    PermissionTier::ReadOnly
}

pub fn is_screenshot_request(text: &str) -> bool {
    let normalized = normalize_text(text);
    [
        "截图",
        "截屏",
        "屏幕截图",
        "截个图",
        "screenshot",
        "screencapture",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
}

pub fn parse_screenshot_target(text: &str) -> Option<ScreenshotTarget> {
    if !is_screenshot_request(text) {
        return None;
    }
    if let Some(path) = extract_absolute_path(text) {
        return Some(ScreenshotTarget::ExplicitPath(path));
    }
    let normalized = normalize_text(text);
    if [
        "当前目录",
        "这个目录",
        "当前工作目录",
        "当前工作区",
        "文件夹",
        "路径地址",
    ]
    .iter()
    .any(|marker| normalized.contains(marker))
    {
        return Some(ScreenshotTarget::CurrentWorkspace);
    }
    Some(ScreenshotTarget::CurrentScreen)
}

pub fn parse_file_send_target(text: &str) -> Option<FileSendTarget> {
    let normalized = normalize_text(text);
    if !asks_to_send_attachment(&normalized) {
        return None;
    }
    if asks_to_create_attachment(&normalized) {
        return None;
    }
    if let Some(path) = extract_absolute_path(text) {
        return Some(FileSendTarget::ExplicitPath(path));
    }
    extract_file_name(text).map(FileSendTarget::WorkspaceFile)
}

fn extract_absolute_path(text: &str) -> Option<String> {
    let start = text.find('/')?;
    let candidate = text[start..]
        .split(|ch: char| ch.is_whitespace() || matches!(ch, ',' | '，' | '。' | ';' | '；' | '：'))
        .next()
        .unwrap_or("")
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '`' | ')' | ']' | '}'));
    if candidate.len() > 1 {
        Some(candidate.to_string())
    } else {
        None
    }
}

fn extract_file_name(text: &str) -> Option<String> {
    let lower = text.to_ascii_lowercase();
    for ext in supported_file_exts() {
        let Some(ext_start) = lower.find(ext) else {
            continue;
        };
        let end = ext_start + ext.len();
        let prefix = &text[..end];
        let start = prefix
            .char_indices()
            .rev()
            .find(|(_, ch)| !is_file_name_char(*ch))
            .map(|(idx, ch)| idx + ch.len_utf8())
            .unwrap_or(0);
        let candidate = text[start..end].trim_matches(|ch| matches!(ch, '"' | '\'' | '`'));
        if !candidate.is_empty() && candidate.contains('.') {
            return Some(candidate.to_string());
        }
    }
    None
}

fn is_file_name_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-' | '/' | '@')
}

fn asks_to_send_attachment(text: &str) -> bool {
    let send_markers = ["发给我", "发我", "传给我", "发送给我"];
    if !send_markers.iter().any(|marker| text.contains(marker)) {
        return false;
    }
    if (text.contains("文件") && !text.contains("文件夹")) || text.contains("附件") {
        return true;
    }
    supported_file_exts().iter().any(|ext| text.contains(ext))
}

fn asks_to_create_attachment(text: &str) -> bool {
    let create_markers = [
        "创建",
        "新建",
        "生成",
        "整理",
        "总结",
        "汇总",
        "导出",
        "保存",
        "写入",
        "制作",
        "做一个",
        "做成",
    ];
    create_markers.iter().any(|marker| text.contains(marker))
}

fn supported_file_exts() -> &'static [&'static str] {
    &[
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".zip",
        ".txt",
        ".csv",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".mp4",
        ".mov",
        ".md",
        ".markdown",
        ".json",
        ".toml",
        ".yaml",
        ".yml",
        ".rs",
        ".ts",
        ".tsx",
        ".py",
    ]
}

pub fn help_message() -> String {
    "可用命令：\n- 新开会话：从下一条消息开始新对话\n- 会话压缩：压缩当前会话上下文\n权限规则：微信消息默认按读写电脑操作执行；电脑端也可以随时接管同一个会话。".to_string()
}

pub fn command_ack(command: &RemoteCommand, changed: bool) -> String {
    match command {
        RemoteCommand::Cancel if changed => "已取消。".to_string(),
        RemoteCommand::Cancel => "当前没有正在执行的微信任务；微信消息现在会直接执行。".to_string(),
        RemoteCommand::NewSession => "已新开会话，下一条消息会从新对话开始。".to_string(),
        RemoteCommand::Help => help_message(),
        RemoteCommand::Compact => String::new(),
        RemoteCommand::SwitchWorkspace(_) => String::new(),
    }
}

fn normalize_text(text: &str) -> String {
    text.trim().to_ascii_lowercase().replace('　', " ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_control_policy_classifies_read_confirm_and_strong() {
        assert_eq!(
            classify_task("当前目录地址是啥？有哪些文件？", &[]),
            PermissionTier::ReadOnly
        );
        assert_eq!(
            classify_task("帮我修改 README", &[]),
            PermissionTier::Confirm
        );
        assert_eq!(
            classify_task("给我当前所在的工作区截个图发我", &[]),
            PermissionTier::Confirm
        );
        assert_eq!(
            classify_task("把 report.pdf 发我", &[]),
            PermissionTier::Confirm
        );
        assert_eq!(
            classify_task("把这个文件发给我", &[]),
            PermissionTier::Confirm
        );
        assert_eq!(
            classify_task("把当前目录地址发我", &[]),
            PermissionTier::ReadOnly
        );
        assert_eq!(
            classify_task("删除 target 目录并 git push", &[]),
            PermissionTier::StrongConfirm
        );
        assert_eq!(
            classify_task("分析这张图片", &["data:image/png;base64,AAAA".into()]),
            PermissionTier::ReadOnly
        );
    }

    #[test]
    fn command_parser_recognizes_session_commands() {
        assert_eq!(parse_command("新开会话"), Some(RemoteCommand::NewSession));
        assert_eq!(parse_command("/compact"), Some(RemoteCommand::Compact));
        assert_eq!(parse_command("取消"), Some(RemoteCommand::Cancel));
        assert_eq!(parse_command("帮助"), Some(RemoteCommand::Help));
        assert_eq!(
            parse_command("切换到 /Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot"),
            Some(RemoteCommand::SwitchWorkspace(
                "/Users/wuwenrui/Desktop/code/wwr/icu/lawyer-copilot".to_string()
            ))
        );
        assert_eq!(
            parse_command("cd /tmp/project-alpha"),
            Some(RemoteCommand::SwitchWorkspace(
                "/tmp/project-alpha".to_string()
            ))
        );
        assert_eq!(parse_command("帮我看看文件"), None);
    }

    #[test]
    fn help_message_says_wechat_requests_run_with_read_write_access() {
        let help = help_message();

        assert!(help.contains("微信消息默认按读写电脑操作执行"));
        assert!(help.contains("电脑端也可以随时接管同一个会话"));
        assert!(!help.contains("确认 代码"));
        assert!(!help.contains("强确认 代码"));
    }

    #[test]
    fn screenshot_request_detection_matches_chinese_and_cli_terms() {
        assert!(is_screenshot_request("这个目录下截个图发我看看"));
        assert!(is_screenshot_request("运行 screencapture 后发我"));
        assert!(!is_screenshot_request("当前目录下有什么文件"));
    }

    #[test]
    fn screenshot_target_parser_distinguishes_screen_path_and_workspace() {
        assert_eq!(
            parse_screenshot_target("截图当前屏幕"),
            Some(ScreenshotTarget::CurrentScreen)
        );
        assert_eq!(
            parse_screenshot_target("打开 /Users/wuwenrui/Desktop/code/wwr/icu 后截图"),
            Some(ScreenshotTarget::ExplicitPath(
                "/Users/wuwenrui/Desktop/code/wwr/icu".to_string()
            ))
        );
        assert_eq!(
            parse_screenshot_target("这个目录下截个图发我看看"),
            Some(ScreenshotTarget::CurrentWorkspace)
        );
    }

    #[test]
    fn file_send_target_parser_recognizes_workspace_file_and_absolute_path() {
        assert_eq!(
            parse_file_send_target("把这个目录下的claude.md文件发我"),
            Some(FileSendTarget::WorkspaceFile("claude.md".to_string()))
        );
        assert_eq!(
            parse_file_send_target("把 /Users/wuwenrui/Desktop/code/wwr/icu/CLAUDE.md 发给我"),
            Some(FileSendTarget::ExplicitPath(
                "/Users/wuwenrui/Desktop/code/wwr/icu/CLAUDE.md".to_string()
            ))
        );
        assert_eq!(
            parse_file_send_target(
                "打开 /Users/wuwenrui/Desktop/code/wwr/icu 这个文件夹，然后截图发我"
            ),
            None
        );
        assert_eq!(
            parse_file_send_target("创建 /tmp/wechat-bridge-smoke.xlsx 并发我"),
            None
        );
        assert_eq!(parse_file_send_target("总结成 Excel 发我"), None);
        assert_eq!(parse_file_send_target("当前目录地址发我"), None);
    }
}
