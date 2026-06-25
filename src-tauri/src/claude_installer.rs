//! Lawyer copilot: detect / auto-install the official Claude Code CLI.
//!
//! On first launch the app self-checks for the `claude` CLI. When it is
//! missing, the official **native installer** (self-contained, no node/npm
//! required, no sudo) is run on the user's behalf:
//!
//! - macOS / Linux / WSL: `curl -fsSL https://claude.ai/install.sh | bash`
//! - Windows PowerShell:   `irm https://claude.ai/install.ps1 | iex`
//!
//! The native installer drops the binary at `~/.local/bin/claude` (unix) /
//! `%USERPROFILE%\.local\bin\claude.exe` (windows). Source:
//! https://code.claude.com/docs/en/setup
//!
//! New file (fork-friendly): no upstream module is modified here. Only the
//! `mod` declaration in `lib.rs` and the handler list in `command_registry.rs`
//! reference this module.

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde::Serialize;

/// Timeout for the install command. The native installer downloads a
/// self-contained binary; 180s leaves headroom for slow networks.
const INSTALL_TIMEOUT: Duration = Duration::from_secs(180);
/// Timeout for a quick `claude --version` probe.
const VERSION_TIMEOUT: Duration = Duration::from_secs(15);
/// Trailing characters of combined stdout/stderr to surface on failure.
const ERROR_TAIL_LEN: usize = 500;

/// CLI detection result returned to the frontend.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub(crate) struct ClaudeCliStatus {
    /// True when a working `claude` CLI was found on PATH or at the native path.
    pub installed: bool,
    /// Parsed version string (best-effort) when detected.
    pub version: Option<String>,
}

/// Absolute path to the native-installer location of the `claude` binary.
fn native_claude_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let local_bin = home.join(".local").join("bin");
    if cfg!(windows) {
        Some(local_bin.join("claude.exe"))
    } else {
        Some(local_bin.join("claude"))
    }
}

/// Extract a version string from `claude --version` stdout.
///
/// The CLI prints lines like `1.2.3 (Claude Code)`; we keep the first
/// non-empty trimmed line so the UI can show something meaningful even if the
/// exact format shifts.
fn parse_version(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

/// Run `<program> --version`, returning the parsed version on success.
async fn probe_version(program: &str) -> Option<String> {
    let output = tokio::time::timeout(
        VERSION_TIMEOUT,
        tokio::process::Command::new(program)
            .arg("--version")
            .stdin(Stdio::null())
            .output(),
    )
    .await
    .ok()?
    .ok()?;

    if output.status.success() {
        parse_version(&String::from_utf8_lossy(&output.stdout))
    } else {
        None
    }
}

/// Probe the `claude` CLI: PATH first, then well-known install locations.
///
/// PATH is snapshotted once at startup (fix_path_env::fix() in main.rs), so a `claude` installed
/// after launch (native installer into ~/.local/bin, or `npm i -g` into the npm global prefix) is
/// invisible to the PATH probe. Falling back to absolute paths lets the dependency check recognize
/// it without restarting the app.
async fn detect_claude() -> Option<String> {
    if let Some(version) = probe_version("claude").await {
        return Some(version);
    }
    for path in claude_fallback_paths() {
        if path.is_file() {
            if let Some(version) = probe_version(&path.to_string_lossy()).await {
                return Some(version);
            }
        }
    }
    None
}

/// Absolute fallback locations for the `claude` binary, probed when it is not on PATH.
fn claude_fallback_paths() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();
    if let Some(path) = native_claude_path() {
        paths.push(path);
    }
    let home = dirs::home_dir().unwrap_or_default();
    if cfg!(windows) {
        // npm global prefix on Windows ships CLIs as a `.cmd` shim and an extensionless script.
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let npm = PathBuf::from(&appdata).join("npm");
            paths.push(npm.join("claude.cmd"));
            paths.push(npm.join("claude.exe"));
        }
    } else {
        paths.push(home.join(".claude/local/claude")); // claude alternate local layout
        paths.push(home.join(".npm-global/bin/claude")); // npm global prefix override
    }
    paths
}

/// Check whether the Claude CLI is installed and reachable.
#[tauri::command]
pub(crate) async fn check_claude_cli() -> ClaudeCliStatus {
    match detect_claude().await {
        Some(version) => ClaudeCliStatus {
            installed: true,
            version: Some(version),
        },
        None => ClaudeCliStatus {
            installed: false,
            version: None,
        },
    }
}

/// Build the OS-specific install `(program, args)` for the official native
/// installer. Pure function so it can be unit-tested without spawning a shell.
fn install_command() -> (String, Vec<String>) {
    if cfg!(windows) {
        (
            "powershell".to_string(),
            vec![
                "-NoProfile".to_string(),
                "-Command".to_string(),
                "irm https://claude.ai/install.ps1 | iex".to_string(),
            ],
        )
    } else {
        (
            "sh".to_string(),
            vec![
                "-c".to_string(),
                "curl -fsSL https://claude.ai/install.sh | bash".to_string(),
            ],
        )
    }
}

/// Truncate to the trailing `ERROR_TAIL_LEN` characters for error reporting.
fn tail(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= ERROR_TAIL_LEN {
        text.to_string()
    } else {
        chars[chars.len() - ERROR_TAIL_LEN..].iter().collect()
    }
}

/// Run the official native installer, then verify the binary is reachable.
///
/// Returns the detected version string on success, or an error carrying the
/// tail of the combined stdout/stderr for troubleshooting.
#[tauri::command]
pub(crate) async fn install_claude_cli() -> Result<String, String> {
    let (program, args) = install_command();

    let output = tokio::time::timeout(
        INSTALL_TIMEOUT,
        tokio::process::Command::new(&program)
            .args(&args)
            .stdin(Stdio::null())
            .output(),
    )
    .await
    .map_err(|_| "安装超时(180s)，请检查网络后重试，或使用手动命令安装".to_string())?
    .map_err(|e| format!("启动安装程序失败: {e}"))?;

    let combined = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    // Verify via the explicit native-installer path: the just-installed binary
    // is not on the current process PATH, so a plain `claude` probe may miss it.
    let verified = match native_claude_path() {
        Some(path) if path.exists() => probe_version(&path.to_string_lossy()).await,
        _ => None,
    }
    // Fall back to a PATH probe in case the installer targeted a different dir.
    .or(probe_version("claude").await);

    match verified {
        Some(version) => Ok(version),
        None => {
            if output.status.success() {
                Err(format!(
                    "安装命令已执行但未检测到 claude，可能需要重启应用以刷新 PATH。输出末尾:\n{}",
                    tail(&combined)
                ))
            } else {
                Err(format!("安装失败。输出末尾:\n{}", tail(&combined)))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_command_uses_official_installer() {
        let (program, args) = install_command();
        if cfg!(windows) {
            assert_eq!(program, "powershell");
            assert!(
                args.iter().any(|a| a.contains("claude.ai/install.ps1")),
                "windows args must reference the official install.ps1 URL: {args:?}"
            );
        } else {
            assert_eq!(program, "sh");
            assert!(
                args.iter().any(|a| a.contains("claude.ai/install.sh")),
                "unix args must reference the official install.sh URL: {args:?}"
            );
        }
    }

    #[test]
    fn parse_version_takes_first_non_empty_line() {
        assert_eq!(
            parse_version("\n  1.2.3 (Claude Code)  \nextra"),
            Some("1.2.3 (Claude Code)".to_string())
        );
        assert_eq!(parse_version("   \n  "), None);
    }

    #[test]
    fn tail_keeps_trailing_chars() {
        let short = "abc";
        assert_eq!(tail(short), "abc");
        let long: String = std::iter::repeat('x').take(ERROR_TAIL_LEN + 50).collect();
        assert_eq!(tail(&long).chars().count(), ERROR_TAIL_LEN);
    }

    #[test]
    fn native_path_targets_local_bin() {
        if let Some(path) = native_claude_path() {
            let display = path.to_string_lossy();
            assert!(
                display.contains(".local"),
                "expected .local/bin path: {display}"
            );
            if cfg!(windows) {
                assert!(display.ends_with("claude.exe"));
            } else {
                assert!(display.ends_with("claude"));
            }
        }
    }
}
