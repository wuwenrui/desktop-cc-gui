use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(not(target_os = "macos"))]
use std::process::Stdio;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout, Duration};
use uuid::Uuid;

use crate::state::AppState;
use crate::storage::write_settings;
use crate::types::AppSettings;

const DEFAULT_REMOTE_HOST: &str = "127.0.0.1:4732";
const STARTUP_RETRY_TIMES: usize = 20;
const STARTUP_RETRY_INTERVAL_MS: u64 = 100;
const DAEMON_AUTH_PROBE_TIMEOUT_MS: u64 = 1_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DaemonControlStatus {
    pub(crate) running: bool,
    pub(crate) host: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_error: Option<String>,
}

pub(crate) async fn maybe_start_local_daemon_for_remote(
    state: &AppState,
    app: &AppHandle,
) -> Result<bool, String> {
    let resolved_host = read_remote_host(state).await;

    if !is_local_loopback_host(&resolved_host) {
        return Ok(false);
    }

    let token =
        ensure_persisted_remote_backend_token(&state.app_settings, &state.settings_path).await?;

    if is_host_reachable(&resolved_host).await {
        match probe_daemon_auth(&resolved_host, &token).await {
            DaemonAuthProbe::Accepted => return Ok(true),
            DaemonAuthProbe::Unavailable(_) => {}
            DaemonAuthProbe::Rejected(reason) => {
                stop_reachable_local_daemon(&resolved_host).await.map_err(|error| {
                    format!(
                        "Daemon at {resolved_host} rejected the configured token ({reason}); restart failed: {error}"
                    )
                })?;
            }
        }
    }

    let daemon_binary = resolve_or_build_daemon_binary(app).await?;
    let data_dir = app.path().app_data_dir().ok();
    spawn_local_daemon(&daemon_binary, &resolved_host, &token, data_dir.as_deref())?;

    for _ in 0..STARTUP_RETRY_TIMES {
        sleep(Duration::from_millis(STARTUP_RETRY_INTERVAL_MS)).await;
        if is_host_reachable(&resolved_host).await {
            return Ok(true);
        }
    }

    Err(format!(
        "Daemon started but endpoint '{resolved_host}' is still unreachable."
    ))
}

fn spawn_local_daemon(
    daemon_binary: &Path,
    host: &str,
    token: &str,
    data_dir: Option<&Path>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        spawn_local_daemon_launch_agent(daemon_binary, host, token, data_dir)
    }
    #[cfg(not(target_os = "macos"))]
    {
        spawn_local_daemon_direct(daemon_binary, host, token, data_dir)
    }
}

#[cfg(not(target_os = "macos"))]
fn spawn_local_daemon_direct(
    daemon_binary: &Path,
    host: &str,
    token: &str,
    data_dir: Option<&Path>,
) -> Result<(), String> {
    let mut command = crate::utils::async_command(daemon_binary);
    command.arg("--listen").arg(host);
    command.arg("--token").arg(token);
    if let Some(data_dir) = data_dir {
        command.arg("--data-dir").arg(data_dir);
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command.spawn().map_err(|error| {
        format!(
            "Failed to spawn daemon binary at '{}': {error}",
            daemon_binary.display()
        )
    })?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn spawn_local_daemon_launch_agent(
    daemon_binary: &Path,
    host: &str,
    token: &str,
    data_dir: Option<&Path>,
) -> Result<(), String> {
    let port = parse_port_from_host(host)
        .ok_or_else(|| format!("Failed to parse daemon port from host: {host}"))?;
    let label = macos_launch_agent_label(port);
    let root = data_dir
        .map(Path::to_path_buf)
        .or_else(dirs::data_dir)
        .unwrap_or_else(env::temp_dir);
    let launch_dir = root.join("daemon");
    fs::create_dir_all(&launch_dir).map_err(|error| {
        format!(
            "Failed to create daemon LaunchAgent directory '{}': {error}",
            launch_dir.display()
        )
    })?;
    let plist_path = launch_dir.join(format!("{label}.plist"));
    let stdout_path = launch_dir.join(format!("{label}.out.log"));
    let stderr_path = launch_dir.join(format!("{label}.err.log"));
    let plist = build_macos_launch_agent_plist(
        &label,
        daemon_binary,
        host,
        token,
        data_dir,
        &stdout_path,
        &stderr_path,
    );
    fs::write(&plist_path, plist).map_err(|error| {
        format!(
            "Failed to write daemon LaunchAgent plist '{}': {error}",
            plist_path.display()
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&plist_path, fs::Permissions::from_mode(0o600));
    }

    let uid = unsafe { libc::getuid() };
    let service = format!("gui/{uid}/{label}");
    let _ = Command::new("/bin/launchctl")
        .arg("bootout")
        .arg(&service)
        .output();
    let output = Command::new("/bin/launchctl")
        .arg("bootstrap")
        .arg(format!("gui/{uid}"))
        .arg(&plist_path)
        .output()
        .map_err(|error| format!("Failed to run launchctl bootstrap: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "launchctl bootstrap failed for '{}': {}",
            plist_path.display(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_launch_agent_label(port: u16) -> String {
    format!("com.zhukunpenglinyutong.ccgui.daemon.{port}")
}

#[cfg(target_os = "macos")]
fn build_macos_launch_agent_plist(
    label: &str,
    daemon_binary: &Path,
    host: &str,
    token: &str,
    data_dir: Option<&Path>,
    stdout_path: &Path,
    stderr_path: &Path,
) -> String {
    let mut args = vec![
        daemon_binary.to_string_lossy().to_string(),
        "--listen".to_string(),
        host.to_string(),
        "--token".to_string(),
        token.to_string(),
    ];
    if let Some(data_dir) = data_dir {
        args.push("--data-dir".to_string());
        args.push(data_dir.to_string_lossy().to_string());
    }
    let args_xml = args
        .iter()
        .map(|arg| format!("    <string>{}</string>", escape_plist_xml(arg)))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n\
<dict>\n\
  <key>Label</key><string>{}</string>\n\
  <key>ProgramArguments</key>\n\
  <array>\n{}\n\
  </array>\n\
  <key>RunAtLoad</key><true/>\n\
  <key>StandardOutPath</key><string>{}</string>\n\
  <key>StandardErrorPath</key><string>{}</string>\n\
</dict>\n\
</plist>\n",
        escape_plist_xml(label),
        args_xml,
        escape_plist_xml(&stdout_path.to_string_lossy()),
        escape_plist_xml(&stderr_path.to_string_lossy())
    )
}

#[cfg(target_os = "macos")]
fn escape_plist_xml(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub(crate) async fn get_local_daemon_status(state: &AppState) -> DaemonControlStatus {
    let host = read_remote_host(state).await;
    let running = if is_local_loopback_host(&host) {
        is_host_reachable(&host).await
    } else {
        false
    };
    DaemonControlStatus {
        running,
        host,
        last_error: None,
    }
}

pub(crate) async fn start_local_daemon_for_remote(
    state: &AppState,
    app: &AppHandle,
) -> Result<DaemonControlStatus, String> {
    let host = read_remote_host(state).await;
    if !is_local_loopback_host(&host) {
        return Err(format!(
            "Only loopback remote host is supported for daemon control: {host}"
        ));
    }

    maybe_start_local_daemon_for_remote(state, app).await?;
    let running = is_host_reachable(&host).await;
    Ok(DaemonControlStatus {
        running,
        host,
        last_error: None,
    })
}

pub(crate) async fn stop_local_daemon_for_remote(
    state: &AppState,
) -> Result<DaemonControlStatus, String> {
    let host = read_remote_host(state).await;
    if !is_local_loopback_host(&host) {
        return Err(format!(
            "Only loopback remote host is supported for daemon control: {host}"
        ));
    }

    if !is_host_reachable(&host).await {
        return Ok(DaemonControlStatus {
            running: false,
            host,
            last_error: None,
        });
    }

    stop_reachable_local_daemon(&host).await?;

    Ok(DaemonControlStatus {
        running: false,
        host,
        last_error: None,
    })
}

async fn stop_reachable_local_daemon(host: &str) -> Result<(), String> {
    if !is_host_reachable(host).await {
        return Ok(());
    }

    let port = parse_port_from_host(host)
        .ok_or_else(|| format!("Failed to parse daemon port from host: {host}"))?;
    let listener_pids = collect_listener_pids(port)?;
    if listener_pids.is_empty() {
        return Err(format!(
            "Daemon is reachable at {host}, but no LISTEN process was found on port {port}."
        ));
    }
    let daemon_pids = filter_moss_daemon_pids(&listener_pids)?;
    if daemon_pids.is_empty() {
        return Err(format!(
            "Refusing to stop port {port}: no moss daemon process matched listener PIDs {:?}.",
            listener_pids
        ));
    }
    terminate_pids(&daemon_pids)?;

    for _ in 0..STARTUP_RETRY_TIMES {
        sleep(Duration::from_millis(STARTUP_RETRY_INTERVAL_MS)).await;
        if !is_host_reachable(host).await {
            return Ok(());
        }
    }

    Err(format!(
        "Daemon stop timeout: endpoint '{host}' is still reachable after kill attempts."
    ))
}

pub(crate) async fn read_remote_host(state: &AppState) -> String {
    let settings = state.app_settings.lock().await;
    let host = settings.remote_backend_host.trim().to_string();
    if host.is_empty() {
        DEFAULT_REMOTE_HOST.to_string()
    } else {
        host
    }
}

struct ResolvedRemoteBackendToken {
    token: String,
    changed: bool,
}

fn generated_remote_backend_token() -> String {
    format!("rb-{}", Uuid::new_v4().simple())
}

#[cfg(test)]
fn is_generated_remote_backend_token(token: &str) -> bool {
    token
        .strip_prefix("rb-")
        .is_some_and(|rest| rest.len() == 32 && rest.chars().all(|c| c.is_ascii_hexdigit()))
}

fn ensure_remote_backend_token(settings: &mut AppSettings) -> ResolvedRemoteBackendToken {
    let normalized = settings
        .remote_backend_token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let token = normalized.unwrap_or_else(generated_remote_backend_token);
    let changed = settings.remote_backend_token.as_deref() != Some(token.as_str());
    settings.remote_backend_token = Some(token.clone());

    ResolvedRemoteBackendToken { token, changed }
}

async fn ensure_persisted_remote_backend_token(
    app_settings: &tokio::sync::Mutex<AppSettings>,
    settings_path: &PathBuf,
) -> Result<String, String> {
    let mut settings = app_settings.lock().await;
    let resolved = ensure_remote_backend_token(&mut settings);
    if resolved.changed {
        write_settings(settings_path, &settings)
            .map_err(|error| format!("failed to write remote backend token: {error}"))?;
    }
    Ok(resolved.token)
}

pub(crate) async fn ensure_local_daemon_token(state: &AppState) -> Result<String, String> {
    ensure_persisted_remote_backend_token(&state.app_settings, &state.settings_path).await
}

#[derive(Debug, PartialEq, Eq)]
enum DaemonAuthProbe {
    Accepted,
    Rejected(String),
    Unavailable(String),
}

async fn probe_daemon_auth(host: &str, token: &str) -> DaemonAuthProbe {
    let stream = match timeout(
        Duration::from_millis(DAEMON_AUTH_PROBE_TIMEOUT_MS),
        TcpStream::connect(host),
    )
    .await
    {
        Ok(Ok(stream)) => stream,
        Ok(Err(error)) => return DaemonAuthProbe::Unavailable(error.to_string()),
        Err(_) => return DaemonAuthProbe::Unavailable("connect timeout".to_string()),
    };

    let (reader, mut writer) = stream.into_split();
    let request = json!({
        "id": 1,
        "method": "auth",
        "params": { "token": token },
    });
    let payload = match serde_json::to_string(&request) {
        Ok(value) => value,
        Err(error) => return DaemonAuthProbe::Rejected(error.to_string()),
    };
    if let Err(error) = writer.write_all(payload.as_bytes()).await {
        return DaemonAuthProbe::Rejected(format!("write auth request failed: {error}"));
    }
    if let Err(error) = writer.write_all(b"\n").await {
        return DaemonAuthProbe::Rejected(format!("write auth newline failed: {error}"));
    }

    let mut lines = BufReader::new(reader).lines();
    let line = match timeout(
        Duration::from_millis(DAEMON_AUTH_PROBE_TIMEOUT_MS),
        lines.next_line(),
    )
    .await
    {
        Ok(Ok(Some(line))) => line,
        Ok(Ok(None)) => return DaemonAuthProbe::Rejected("auth connection closed".to_string()),
        Ok(Err(error)) => return DaemonAuthProbe::Rejected(error.to_string()),
        Err(_) => return DaemonAuthProbe::Rejected("auth response timeout".to_string()),
    };
    let response = match serde_json::from_str::<Value>(&line) {
        Ok(value) => value,
        Err(error) => return DaemonAuthProbe::Rejected(format!("invalid auth response: {error}")),
    };
    if response
        .get("result")
        .and_then(|result| result.get("ok"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return DaemonAuthProbe::Accepted;
    }
    let reason = response
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("auth rejected")
        .to_string();
    DaemonAuthProbe::Rejected(reason)
}

async fn is_host_reachable(host: &str) -> bool {
    TcpStream::connect(host).await.is_ok()
}

fn is_local_loopback_host(host: &str) -> bool {
    let lower = host.to_ascii_lowercase();
    lower.starts_with("127.0.0.1:")
        || lower.starts_with("localhost:")
        || lower.starts_with("[::1]:")
}

fn parse_port_from_host(host: &str) -> Option<u16> {
    if let Ok(addr) = host.parse::<std::net::SocketAddr>() {
        return Some(addr.port());
    }
    host.rsplit_once(':')
        .and_then(|(_, value)| value.parse::<u16>().ok())
}

#[cfg(unix)]
fn collect_listener_pids(port: u16) -> Result<Vec<u32>, String> {
    let target = format!("-iTCP:{port}");
    let output = crate::utils::std_command("lsof")
        .arg("-n")
        .arg("-P")
        .arg("-t")
        .arg(target)
        .arg("-sTCP:LISTEN")
        .output()
        .map_err(|error| format!("failed to execute lsof: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let pids = stdout
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .collect::<Vec<_>>();
    Ok(pids)
}

#[cfg(windows)]
fn collect_listener_pids(port: u16) -> Result<Vec<u32>, String> {
    let output = crate::utils::std_command("netstat")
        .arg("-ano")
        .arg("-p")
        .arg("tcp")
        .output()
        .map_err(|error| format!("failed to execute netstat: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let needle_ipv4 = format!(":{port}");
    let needle_ipv6 = format!("]:{port}");

    let mut pids = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let cols = line.split_whitespace().collect::<Vec<_>>();
        if cols.len() < 5 {
            continue;
        }
        let local_addr = cols[1];
        let state = cols[3];
        let pid = cols[4];
        if !state.eq_ignore_ascii_case("LISTENING") {
            continue;
        }
        if !(local_addr.ends_with(&needle_ipv4) || local_addr.ends_with(&needle_ipv6)) {
            continue;
        }
        if let Ok(parsed) = pid.parse::<u32>() {
            pids.push(parsed);
        }
    }
    Ok(pids)
}

#[cfg(unix)]
fn filter_moss_daemon_pids(pids: &[u32]) -> Result<Vec<u32>, String> {
    let mut matches = Vec::new();
    for pid in pids {
        if let Some(identity) = read_process_identity(*pid)? {
            if is_moss_daemon_identity(&identity) {
                matches.push(*pid);
            }
        }
    }
    Ok(matches)
}

#[cfg(windows)]
fn filter_moss_daemon_pids(pids: &[u32]) -> Result<Vec<u32>, String> {
    let mut matches = Vec::new();
    for pid in pids {
        if let Some(identity) = read_process_identity(*pid)? {
            if is_moss_daemon_identity(&identity) {
                matches.push(*pid);
            }
        }
    }
    Ok(matches)
}

#[cfg(not(any(unix, windows)))]
fn filter_moss_daemon_pids(_pids: &[u32]) -> Result<Vec<u32>, String> {
    Err("daemon stop is not supported on this platform".to_string())
}

#[cfg(unix)]
fn read_process_identity(pid: u32) -> Result<Option<String>, String> {
    let output = crate::utils::std_command("ps")
        .arg("-p")
        .arg(pid.to_string())
        .arg("-o")
        .arg("command=")
        .output()
        .map_err(|error| format!("failed to inspect process identity for pid {pid}: {error}"))?;
    if !output.status.success() {
        return Ok(None);
    }
    let identity = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if identity.is_empty() {
        Ok(None)
    } else {
        Ok(Some(identity))
    }
}

#[cfg(windows)]
fn read_process_identity(pid: u32) -> Result<Option<String>, String> {
    let output = crate::utils::std_command("tasklist")
        .arg("/FI")
        .arg(format!("PID eq {pid}"))
        .arg("/FO")
        .arg("CSV")
        .arg("/NH")
        .output()
        .map_err(|error| format!("failed to inspect process identity for pid {pid}: {error}"))?;
    if !output.status.success() {
        return Ok(None);
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().next().map(str::trim).unwrap_or_default();
    if line.is_empty() || line.starts_with("INFO:") {
        return Ok(None);
    }
    let image_name = line
        .split(',')
        .next()
        .map(|value| value.trim_matches('"').trim())
        .unwrap_or_default()
        .to_string();
    if image_name.is_empty() {
        Ok(None)
    } else {
        Ok(Some(image_name))
    }
}

fn is_moss_daemon_identity(identity: &str) -> bool {
    let lower_identity = identity.to_ascii_lowercase();
    daemon_binary_names()
        .iter()
        .any(|name| lower_identity.contains(&name.to_ascii_lowercase()))
}

#[cfg(not(any(unix, windows)))]
fn collect_listener_pids(_port: u16) -> Result<Vec<u32>, String> {
    Err("daemon stop is not supported on this platform".to_string())
}

fn terminate_pids(pids: &[u32]) -> Result<(), String> {
    let mut seen = HashSet::new();
    for pid in pids {
        if !seen.insert(*pid) {
            continue;
        }
        terminate_pid(*pid)?;
    }
    Ok(())
}

#[cfg(unix)]
fn terminate_pid(pid: u32) -> Result<(), String> {
    let status = Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .status()
        .map_err(|error| format!("failed to terminate pid {pid}: {error}"))?;
    if !status.success() {
        let _ = Command::new("kill")
            .arg("-KILL")
            .arg(pid.to_string())
            .status();
    }
    Ok(())
}

#[cfg(windows)]
fn terminate_pid(pid: u32) -> Result<(), String> {
    let status = crate::utils::std_command("taskkill")
        .arg("/PID")
        .arg(pid.to_string())
        .arg("/T")
        .arg("/F")
        .status()
        .map_err(|error| format!("failed to terminate pid {pid}: {error}"))?;
    if !status.success() {
        return Err(format!("taskkill failed for pid {pid}"));
    }
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn terminate_pid(_pid: u32) -> Result<(), String> {
    Err("daemon stop is not supported on this platform".to_string())
}

fn resolve_daemon_binary(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            append_daemon_candidates(parent, &mut candidates);
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        append_daemon_candidates(&resource_dir, &mut candidates);
    }

    for binary_name in daemon_binary_names() {
        if let Some(path) = find_in_path(binary_name) {
            candidates.push(path);
        }
    }

    let mut seen = HashSet::new();
    for candidate in candidates {
        let key = candidate.to_string_lossy().to_string();
        if seen.insert(key) && candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

async fn resolve_or_build_daemon_binary(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = resolve_daemon_binary(app) {
        return Ok(path);
    }

    // Dev-only fallback: tauri dev usually doesn't build secondary bin targets
    // unless explicitly requested. Build cc_gui_daemon once, then retry resolve.
    if cfg!(debug_assertions) {
        if let Some(manifest_path) = find_dev_manifest_path() {
            build_dev_daemon_binary(&manifest_path).await?;
            if let Some(path) = resolve_daemon_binary(app) {
                return Ok(path);
            }
        }
    }

    Err("Failed to locate cc_gui_daemon binary for local auto-start.".to_string())
}

fn find_dev_manifest_path() -> Option<PathBuf> {
    let mut seen = HashSet::new();
    let mut candidates = Vec::new();

    // compile-time source path, usually valid for local debug builds.
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"));

    if let Ok(current_exe) = env::current_exe() {
        for ancestor in current_exe.ancestors() {
            candidates.push(ancestor.join("Cargo.toml"));
            candidates.push(ancestor.join("src-tauri").join("Cargo.toml"));
        }
    }

    if let Ok(cwd) = env::current_dir() {
        for ancestor in cwd.ancestors() {
            candidates.push(ancestor.join("Cargo.toml"));
            candidates.push(ancestor.join("src-tauri").join("Cargo.toml"));
        }
    }

    for candidate in candidates {
        let key = candidate.to_string_lossy().to_string();
        if seen.insert(key) && candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

async fn build_dev_daemon_binary(manifest_path: &Path) -> Result<(), String> {
    let status = crate::utils::async_command("cargo")
        .arg("build")
        .arg("--manifest-path")
        .arg(manifest_path)
        .arg("--bin")
        .arg("cc_gui_daemon")
        .status()
        .await
        .map_err(|error| format!("Failed to execute cargo build for cc_gui_daemon: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "cargo build --bin cc_gui_daemon failed with status {status}"
        ))
    }
}

fn append_daemon_candidates(base: &Path, output: &mut Vec<PathBuf>) {
    for name in daemon_binary_names() {
        output.push(base.join(name));
    }
}

fn daemon_binary_names() -> &'static [&'static str] {
    #[cfg(windows)]
    {
        &[
            "cc_gui_daemon.exe",
            "moss_x_daemon.exe",
            "moss-x-daemon.exe",
            "cc_gui_daemon",
            "moss_x_daemon",
            "moss-x-daemon",
        ]
    }
    #[cfg(not(windows))]
    {
        &["cc_gui_daemon", "moss_x_daemon", "moss-x-daemon"]
    }
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for dir in env::split_paths(&path_var) {
        let candidate = dir.join(binary);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::read_settings;
    use crate::types::AppSettings;
    use tokio::sync::Mutex;
    use uuid::Uuid;

    #[test]
    fn ensure_remote_backend_token_generates_when_missing() {
        let mut settings = AppSettings::default();
        settings.remote_backend_token = None;

        let resolved = ensure_remote_backend_token(&mut settings);

        assert!(resolved.changed);
        assert!(is_generated_remote_backend_token(&resolved.token));
        assert_eq!(
            settings.remote_backend_token.as_deref(),
            Some(resolved.token.as_str())
        );
    }

    #[test]
    fn ensure_remote_backend_token_reuses_existing_trimmed_token() {
        let mut settings = AppSettings::default();
        settings.remote_backend_token = Some("  existing-token  ".to_string());

        let resolved = ensure_remote_backend_token(&mut settings);

        assert!(resolved.changed);
        assert_eq!(resolved.token, "existing-token");
        assert_eq!(
            settings.remote_backend_token.as_deref(),
            Some("existing-token")
        );
    }

    #[tokio::test]
    async fn ensure_persisted_remote_backend_token_writes_generated_token() {
        let root = std::env::temp_dir().join(format!("daemon-token-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("create temp root");
        let settings_path = root.join("settings.json");
        let app_settings = Mutex::new(AppSettings::default());

        let token = ensure_persisted_remote_backend_token(&app_settings, &settings_path)
            .await
            .expect("token generated");

        assert!(is_generated_remote_backend_token(&token));
        assert_eq!(
            app_settings.lock().await.remote_backend_token.as_deref(),
            Some(token.as_str())
        );
        let persisted = read_settings(&settings_path).expect("read settings");
        assert_eq!(
            persisted.remote_backend_token.as_deref(),
            Some(token.as_str())
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn probe_daemon_auth_accepts_ok_response() {
        let host = spawn_auth_probe_server(r#"{"id":1,"result":{"ok":true}}"#).await;

        let result = probe_daemon_auth(&host, "token").await;

        assert_eq!(result, DaemonAuthProbe::Accepted);
    }

    #[tokio::test]
    async fn probe_daemon_auth_rejects_invalid_token_response() {
        let host = spawn_auth_probe_server(r#"{"id":1,"error":{"message":"invalid token"}}"#).await;

        let result = probe_daemon_auth(&host, "wrong-token").await;

        assert_eq!(
            result,
            DaemonAuthProbe::Rejected("invalid token".to_string())
        );
    }

    async fn spawn_auth_probe_server(response: &'static str) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind auth probe server");
        let host = listener
            .local_addr()
            .expect("auth probe local addr")
            .to_string();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.expect("accept auth probe");
            let (reader, mut writer) = stream.into_split();
            let mut lines = BufReader::new(reader).lines();
            let _ = lines.next_line().await.expect("read auth probe request");
            writer
                .write_all(response.as_bytes())
                .await
                .expect("write auth probe response");
            writer
                .write_all(b"\n")
                .await
                .expect("write auth probe newline");
        });
        host
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_launch_agent_plist_escapes_daemon_arguments() {
        let plist = build_macos_launch_agent_plist(
            "com.zhukunpenglinyutong.ccgui.daemon.4732",
            Path::new("/Applications/Lawyer & Copilot.app/Contents/MacOS/cc_gui_daemon"),
            "127.0.0.1:4732",
            "token<&>\"",
            Some(Path::new(
                "/Users/example/Library/Application Support/ccgui",
            )),
            Path::new("/tmp/out.log"),
            Path::new("/tmp/err.log"),
        );

        assert!(plist.contains("<string>com.zhukunpenglinyutong.ccgui.daemon.4732</string>"));
        assert!(plist.contains("Lawyer &amp; Copilot.app"));
        assert!(plist.contains("<string>token&lt;&amp;&gt;&quot;</string>"));
        assert!(plist.contains("<string>--data-dir</string>"));
        assert!(plist.contains("Application Support/ccgui"));
    }
}
