use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;
use tokio::time::timeout;

const COMMAND_TIMEOUT: Duration = Duration::from_secs(600);
const CHECK_TIMEOUT: Duration = Duration::from_secs(12);
const EVENT_NAME: &str = "environment-installer-event";

const TUNA_BREW_GIT_REMOTE: &str =
    "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git";
const TUNA_CORE_GIT_REMOTE: &str =
    "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git";
const TUNA_INSTALL_GIT_REMOTE: &str =
    "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git";
const TUNA_API_DOMAIN: &str = "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api";
const TUNA_BOTTLE_DOMAIN: &str = "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum EnvironmentPlatform {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EnvironmentDependencyId {
    XcodeCommandLineTools,
    Homebrew,
    Cmake,
    Openssl3,
    NodeJs,
    ClaudeCli,
    CodexCli,
}

impl EnvironmentDependencyId {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::XcodeCommandLineTools => "Xcode Command Line Tools",
            Self::Homebrew => "Homebrew",
            Self::Cmake => "CMake",
            Self::Openssl3 => "OpenSSL 3",
            Self::NodeJs => "Node.js",
            Self::ClaudeCli => "Claude CLI",
            Self::CodexCli => "Codex CLI",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentDependencyStatus {
    pub(crate) id: EnvironmentDependencyId,
    pub(crate) label: String,
    pub(crate) installed: bool,
    pub(crate) required: bool,
    pub(crate) version: Option<String>,
    pub(crate) details: Option<String>,
    pub(crate) installable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentDoctorResult {
    pub(crate) platform: EnvironmentPlatform,
    pub(crate) dependencies: Vec<EnvironmentDependencyStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentInstallStep {
    pub(crate) id: String,
    pub(crate) dependency_id: EnvironmentDependencyId,
    pub(crate) label: String,
    pub(crate) command_preview: Vec<String>,
    pub(crate) environment: Vec<(String, String)>,
    pub(crate) manual_fallback: Option<String>,
    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentInstallPlan {
    pub(crate) platform: EnvironmentPlatform,
    pub(crate) can_run: bool,
    pub(crate) blockers: Vec<String>,
    pub(crate) warnings: Vec<String>,
    pub(crate) steps: Vec<EnvironmentInstallStep>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum EnvironmentInstallProgressPhase {
    Started,
    Stdout,
    Stderr,
    Verifying,
    Finished,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum EnvironmentInstallOutputStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentInstallProgressEvent {
    pub(crate) run_id: String,
    pub(crate) step_id: Option<String>,
    pub(crate) dependency_id: Option<EnvironmentDependencyId>,
    pub(crate) phase: EnvironmentInstallProgressPhase,
    pub(crate) stream: Option<EnvironmentInstallOutputStream>,
    pub(crate) message: Option<String>,
    pub(crate) exit_code: Option<i32>,
    pub(crate) duration_ms: Option<u128>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentInstallResult {
    pub(crate) ok: bool,
    pub(crate) exit_code: Option<i32>,
    pub(crate) details: Option<String>,
    pub(crate) duration_ms: u128,
    pub(crate) doctor_result: EnvironmentDoctorResult,
}

#[tauri::command]
pub(crate) async fn environment_doctor() -> EnvironmentDoctorResult {
    build_doctor_result().await
}

#[tauri::command]
pub(crate) async fn environment_install_plan() -> EnvironmentInstallPlan {
    let doctor = build_doctor_result().await;
    build_install_plan_from_doctor(&doctor)
}

#[tauri::command]
pub(crate) async fn environment_install_run(
    run_id: Option<String>,
    app: AppHandle,
) -> Result<EnvironmentInstallResult, String> {
    let started = Instant::now();
    let run_id = normalize_run_id(run_id);
    let doctor = build_doctor_result().await;
    let plan = build_install_plan_from_doctor(&doctor);

    if !plan.can_run {
        return Ok(EnvironmentInstallResult {
            ok: false,
            exit_code: None,
            details: Some(plan.blockers.join("; ")),
            duration_ms: started.elapsed().as_millis(),
            doctor_result: doctor,
        });
    }

    for step in &plan.steps {
        emit_progress(
            &app,
            EnvironmentInstallProgressEvent {
                run_id: run_id.clone(),
                step_id: Some(step.id.clone()),
                dependency_id: Some(step.dependency_id),
                phase: EnvironmentInstallProgressPhase::Started,
                stream: None,
                message: Some(step.command_preview.join(" ")),
                exit_code: None,
                duration_ms: Some(started.elapsed().as_millis()),
            },
        );

        match run_install_step(step, &run_id, &app, started).await {
            Ok(()) => emit_progress(
                &app,
                EnvironmentInstallProgressEvent {
                    run_id: run_id.clone(),
                    step_id: Some(step.id.clone()),
                    dependency_id: Some(step.dependency_id),
                    phase: EnvironmentInstallProgressPhase::Finished,
                    stream: None,
                    message: Some(format!("{} completed", step.label)),
                    exit_code: Some(0),
                    duration_ms: Some(started.elapsed().as_millis()),
                },
            ),
            Err(error) => {
                emit_progress(
                    &app,
                    EnvironmentInstallProgressEvent {
                        run_id: run_id.clone(),
                        step_id: Some(step.id.clone()),
                        dependency_id: Some(step.dependency_id),
                        phase: EnvironmentInstallProgressPhase::Error,
                        stream: None,
                        message: Some(error.clone()),
                        exit_code: None,
                        duration_ms: Some(started.elapsed().as_millis()),
                    },
                );
                let doctor_result = build_doctor_result().await;
                return Ok(EnvironmentInstallResult {
                    ok: false,
                    exit_code: None,
                    details: Some(error),
                    duration_ms: started.elapsed().as_millis(),
                    doctor_result,
                });
            }
        }
    }

    emit_progress(
        &app,
        EnvironmentInstallProgressEvent {
            run_id,
            step_id: None,
            dependency_id: None,
            phase: EnvironmentInstallProgressPhase::Verifying,
            stream: None,
            message: Some("Re-checking environment".to_string()),
            exit_code: None,
            duration_ms: Some(started.elapsed().as_millis()),
        },
    );
    let doctor_result = build_doctor_result().await;
    let ok = doctor_result
        .dependencies
        .iter()
        .filter(|dependency| dependency.required)
        .all(|dependency| dependency.installed);

    Ok(EnvironmentInstallResult {
        ok,
        exit_code: Some(if ok { 0 } else { 1 }),
        details: if ok {
            None
        } else {
            Some("Some required dependencies are still missing.".to_string())
        },
        duration_ms: started.elapsed().as_millis(),
        doctor_result,
    })
}

// ==================== Doctor: platform-aware dependency detection ====================

async fn build_doctor_result() -> EnvironmentDoctorResult {
    let platform = current_platform();
    let dependencies = match platform {
        EnvironmentPlatform::Macos => build_macos_dependencies().await,
        EnvironmentPlatform::Windows => build_windows_dependencies().await,
        _ => build_macos_dependencies().await,
    };
    EnvironmentDoctorResult {
        platform,
        dependencies,
    }
}

async fn build_macos_dependencies() -> Vec<EnvironmentDependencyStatus> {
    let brew = detect_brew().await;
    vec![
        dependency_status(
            EnvironmentDependencyId::XcodeCommandLineTools,
            detect_xcode_clt().await,
            true,
            true,
        ),
        dependency_status(EnvironmentDependencyId::Homebrew, brew.clone(), true, true),
        dependency_status(EnvironmentDependencyId::Cmake, detect_command("cmake").await, true, true),
        dependency_status(
            EnvironmentDependencyId::Openssl3,
            detect_openssl3(brew.installed).await,
            true,
            true,
        ),
        dependency_status(
            EnvironmentDependencyId::ClaudeCli,
            detect_command("claude").await,
            true,
            true,
        ),
        dependency_status(
            EnvironmentDependencyId::CodexCli,
            detect_command("codex").await,
            false,
            true,
        ),
    ]
}

async fn build_windows_dependencies() -> Vec<EnvironmentDependencyStatus> {
    vec![
        dependency_status(
            EnvironmentDependencyId::NodeJs,
            detect_command("node").await,
            true,
            true,
        ),
        dependency_status(
            EnvironmentDependencyId::ClaudeCli,
            detect_command("claude").await,
            true,
            true,
        ),
        dependency_status(
            EnvironmentDependencyId::CodexCli,
            detect_command("codex").await,
            false,
            true,
        ),
    ]
}

// ==================== Install plan: platform-aware step generation ====================

fn build_install_plan_from_doctor(doctor: &EnvironmentDoctorResult) -> EnvironmentInstallPlan {
    match doctor.platform {
        EnvironmentPlatform::Macos => build_macos_install_plan(doctor),
        EnvironmentPlatform::Windows => build_windows_install_plan(doctor),
        _ => {
            let mut plan = build_macos_install_plan(doctor);
            plan.blockers.push(
                "Automatic environment bootstrap is not yet supported on this platform."
                    .to_string(),
            );
            plan.can_run = false;
            plan
        }
    }
}

fn build_macos_install_plan(doctor: &EnvironmentDoctorResult) -> EnvironmentInstallPlan {
    let mut steps = Vec::new();
    let mut warnings = Vec::new();

    if dependency_missing(doctor, EnvironmentDependencyId::XcodeCommandLineTools) {
        steps.push(build_xcode_clt_step());
        warnings.push(
            "macOS owns the Command Line Tools consent dialog; complete that prompt to continue."
                .to_string(),
        );
    }
    if dependency_missing(doctor, EnvironmentDependencyId::Homebrew) {
        steps.push(build_homebrew_install_step());
    }
    if dependency_missing(doctor, EnvironmentDependencyId::Cmake) {
        steps.push(build_brew_package_step(EnvironmentDependencyId::Cmake, "cmake"));
    }
    if dependency_missing(doctor, EnvironmentDependencyId::Openssl3) {
        steps.push(build_brew_package_step(EnvironmentDependencyId::Openssl3, "openssl@3"));
    }
    if dependency_missing(doctor, EnvironmentDependencyId::ClaudeCli) {
        steps.push(build_macos_claude_cli_step());
    }

    EnvironmentInstallPlan {
        platform: doctor.platform,
        can_run: true,
        blockers: Vec::new(),
        warnings,
        steps,
    }
}

fn build_windows_install_plan(doctor: &EnvironmentDoctorResult) -> EnvironmentInstallPlan {
    let mut steps = Vec::new();
    let mut warnings = Vec::new();

    if dependency_missing(doctor, EnvironmentDependencyId::NodeJs) {
        steps.push(build_windows_nodejs_step());
        warnings.push(
            "Node.js installation may require closing and reopening the application for PATH changes to take effect."
                .to_string(),
        );
    }
    if dependency_missing(doctor, EnvironmentDependencyId::ClaudeCli) {
        steps.push(build_windows_claude_cli_step());
    }

    EnvironmentInstallPlan {
        platform: doctor.platform,
        can_run: true,
        blockers: Vec::new(),
        warnings,
        steps,
    }
}

// ==================== macOS install steps ====================

fn build_homebrew_install_step() -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: "install-homebrew".to_string(),
        dependency_id: EnvironmentDependencyId::Homebrew,
        label: "Install Homebrew".to_string(),
        command_preview: vec![
            "git".to_string(),
            "clone".to_string(),
            "--depth=1".to_string(),
            TUNA_INSTALL_GIT_REMOTE.to_string(),
            "<temp>/brew-install".to_string(),
            "&&".to_string(),
            "/bin/bash".to_string(),
            "<temp>/brew-install/install.sh".to_string(),
        ],
        environment: tuna_homebrew_environment(),
        manual_fallback: Some(format!(
            "export HOMEBREW_BREW_GIT_REMOTE=\"{TUNA_BREW_GIT_REMOTE}\" && export HOMEBREW_CORE_GIT_REMOTE=\"{TUNA_CORE_GIT_REMOTE}\" && export HOMEBREW_API_DOMAIN=\"{TUNA_API_DOMAIN}\" && export HOMEBREW_BOTTLE_DOMAIN=\"{TUNA_BOTTLE_DOMAIN}\" && git clone --depth=1 {TUNA_INSTALL_GIT_REMOTE} brew-install && /bin/bash brew-install/install.sh"
        )),
        warnings: vec![
            "Homebrew installation may trigger a macOS system prompt for confirmation.".to_string(),
        ],
    }
}

fn build_xcode_clt_step() -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: "install-xcode-command-line-tools".to_string(),
        dependency_id: EnvironmentDependencyId::XcodeCommandLineTools,
        label: "Install Xcode Command Line Tools".to_string(),
        command_preview: vec!["xcode-select".to_string(), "--install".to_string()],
        environment: Vec::new(),
        manual_fallback: Some("xcode-select --install".to_string()),
        warnings: vec!["Complete the macOS system dialog to continue.".to_string()],
    }
}

fn build_brew_package_step(
    dependency_id: EnvironmentDependencyId,
    package_name: &str,
) -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: format!("brew-install-{package_name}").replace('@', "-"),
        dependency_id,
        label: format!("Install {}", dependency_id.label()),
        command_preview: vec![
            "brew".to_string(),
            "install".to_string(),
            package_name.to_string(),
        ],
        environment: tuna_homebrew_environment(),
        manual_fallback: Some(format!("brew install {package_name}")),
        warnings: Vec::new(),
    }
}

fn build_macos_claude_cli_step() -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: "install-claude-cli".to_string(),
        dependency_id: EnvironmentDependencyId::ClaudeCli,
        label: "Install Claude CLI".to_string(),
        command_preview: vec![
            "sh".to_string(),
            "-c".to_string(),
            "curl -fsSL https://claude.ai/install.sh | bash".to_string(),
        ],
        environment: Vec::new(),
        manual_fallback: Some("curl -fsSL https://claude.ai/install.sh | bash".to_string()),
        warnings: Vec::new(),
    }
}

// ==================== Windows install steps ====================

fn build_windows_nodejs_step() -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: "install-nodejs".to_string(),
        dependency_id: EnvironmentDependencyId::NodeJs,
        label: "Install Node.js".to_string(),
        command_preview: vec![
            "winget".to_string(),
            "install".to_string(),
            "OpenJS.NodeJS.LTS".to_string(),
            "--silent".to_string(),
        ],
        environment: Vec::new(),
        manual_fallback: Some(
            "winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements"
                .to_string(),
        ),
        warnings: vec![
            "Restart the application after Node.js installation for PATH changes to take effect.".to_string(),
        ],
    }
}

fn build_windows_claude_cli_step() -> EnvironmentInstallStep {
    EnvironmentInstallStep {
        id: "install-claude-cli".to_string(),
        dependency_id: EnvironmentDependencyId::ClaudeCli,
        label: "Install Claude CLI".to_string(),
        command_preview: vec![
            "npm".to_string(),
            "install".to_string(),
            "-g".to_string(),
            "@anthropic-ai/claude-code".to_string(),
        ],
        environment: Vec::new(),
        manual_fallback: Some("npm install -g @anthropic-ai/claude-code".to_string()),
        warnings: Vec::new(),
    }
}

// ==================== Install step execution ====================

fn tuna_homebrew_environment() -> Vec<(String, String)> {
    vec![
        (
            "HOMEBREW_BREW_GIT_REMOTE".to_string(),
            TUNA_BREW_GIT_REMOTE.to_string(),
        ),
        (
            "HOMEBREW_CORE_GIT_REMOTE".to_string(),
            TUNA_CORE_GIT_REMOTE.to_string(),
        ),
        ("HOMEBREW_INSTALL_FROM_API".to_string(), "1".to_string()),
        ("HOMEBREW_API_DOMAIN".to_string(), TUNA_API_DOMAIN.to_string()),
        (
            "HOMEBREW_BOTTLE_DOMAIN".to_string(),
            TUNA_BOTTLE_DOMAIN.to_string(),
        ),
    ]
}

async fn run_install_step(
    step: &EnvironmentInstallStep,
    run_id: &str,
    app: &AppHandle,
    started: Instant,
) -> Result<(), String> {
    let platform = current_platform();
    match (step.dependency_id, platform) {
        // ---- macOS steps ----
        (EnvironmentDependencyId::XcodeCommandLineTools, _) => {
            run_command(
                "xcode-select",
                &["--install"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        (EnvironmentDependencyId::Homebrew, _) => {
            let install_dir = temporary_homebrew_install_dir();
            let install_dir_string = install_dir.to_string_lossy().to_string();
            let script_path = install_dir.join("install.sh").to_string_lossy().to_string();
            let _ = tokio::fs::remove_dir_all(&install_dir).await;
            run_command(
                "git",
                &["clone", "--depth=1", TUNA_INSTALL_GIT_REMOTE, &install_dir_string],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await?;
            let result = run_command(
                "/bin/bash",
                &[&script_path],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await;
            let _ = tokio::fs::remove_dir_all(&install_dir).await;
            result
        }
        (EnvironmentDependencyId::Cmake, EnvironmentPlatform::Macos) => {
            let brew = brew_binary().ok_or_else(|| "Homebrew is not available.".to_string())?;
            run_command(
                &brew.to_string_lossy(),
                &["install", "cmake"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        (EnvironmentDependencyId::Openssl3, EnvironmentPlatform::Macos) => {
            let brew = brew_binary().ok_or_else(|| "Homebrew is not available.".to_string())?;
            run_command(
                &brew.to_string_lossy(),
                &["install", "openssl@3"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        // ---- Windows steps ----
        (EnvironmentDependencyId::NodeJs, EnvironmentPlatform::Windows) => {
            run_command(
                "winget",
                &[
                    "install",
                    "OpenJS.NodeJS.LTS",
                    "--silent",
                    "--accept-source-agreements",
                    "--accept-package-agreements",
                ],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        (EnvironmentDependencyId::ClaudeCli, EnvironmentPlatform::Windows) => {
            run_command(
                "npm",
                &["install", "-g", "@anthropic-ai/claude-code"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        // ---- Cross-platform steps ----
        (EnvironmentDependencyId::ClaudeCli, _) => {
            run_command(
                "sh",
                &["-c", "curl -fsSL https://claude.ai/install.sh | bash"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        (EnvironmentDependencyId::CodexCli, _) => {
            run_command(
                "npm",
                &["install", "-g", "@openai/codex@latest"],
                &step.environment,
                run_id,
                step,
                app,
                started,
            )
            .await
        }
        _ => Err(format!(
            "No install handler for {:?} on {:?}",
            step.dependency_id, platform
        )),
    }
}

// ==================== Shared utilities ====================

async fn run_command(
    program: &str,
    args: &[&str],
    envs: &[(String, String)],
    run_id: &str,
    step: &EnvironmentInstallStep,
    app: &AppHandle,
    started: Instant,
) -> Result<(), String> {
    let mut command = Command::new(program);
    command.args(args);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    for (key, value) in envs {
        command.env(key, value);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let output = timeout(COMMAND_TIMEOUT, command.output())
        .await
        .map_err(|_| format!("{} timed out.", step.label))?
        .map_err(|error| format!("Failed to start {}: {error}", step.label))?;

    emit_output_event(
        app,
        run_id,
        step,
        EnvironmentInstallOutputStream::Stdout,
        &String::from_utf8_lossy(&output.stdout),
        started,
    );
    emit_output_event(
        app,
        run_id,
        step,
        EnvironmentInstallOutputStream::Stderr,
        &String::from_utf8_lossy(&output.stderr),
        started,
    );

    if output.status.success() {
        Ok(())
    } else {
        let stderr = sanitize_installer_output(&String::from_utf8_lossy(&output.stderr));
        Err(if stderr.trim().is_empty() {
            format!("{} failed with status {:?}", step.label, output.status.code())
        } else {
            stderr
        })
    }
}

fn emit_output_event(
    app: &AppHandle,
    run_id: &str,
    step: &EnvironmentInstallStep,
    stream: EnvironmentInstallOutputStream,
    output: &str,
    started: Instant,
) {
    let message = sanitize_installer_output(output);
    if message.trim().is_empty() {
        return;
    }
    emit_progress(
        app,
        EnvironmentInstallProgressEvent {
            run_id: run_id.to_string(),
            step_id: Some(step.id.clone()),
            dependency_id: Some(step.dependency_id),
            phase: match stream {
                EnvironmentInstallOutputStream::Stdout => EnvironmentInstallProgressPhase::Stdout,
                EnvironmentInstallOutputStream::Stderr => EnvironmentInstallProgressPhase::Stderr,
            },
            stream: Some(stream),
            message: Some(message),
            exit_code: None,
            duration_ms: Some(started.elapsed().as_millis()),
        },
    );
}

fn emit_progress(app: &AppHandle, event: EnvironmentInstallProgressEvent) {
    let _ = app.emit(EVENT_NAME, event);
}

fn current_platform() -> EnvironmentPlatform {
    if cfg!(target_os = "macos") {
        EnvironmentPlatform::Macos
    } else if cfg!(target_os = "windows") {
        EnvironmentPlatform::Windows
    } else if cfg!(target_os = "linux") {
        EnvironmentPlatform::Linux
    } else {
        EnvironmentPlatform::Unknown
    }
}

#[derive(Debug, Clone)]
struct ProbeResult {
    installed: bool,
    version: Option<String>,
    details: Option<String>,
}

fn dependency_status(
    id: EnvironmentDependencyId,
    probe: ProbeResult,
    required: bool,
    installable: bool,
) -> EnvironmentDependencyStatus {
    EnvironmentDependencyStatus {
        id,
        label: id.label().to_string(),
        installed: probe.installed,
        required,
        version: probe.version,
        details: probe.details,
        installable,
    }
}

// ==================== Detection functions ====================

async fn detect_xcode_clt() -> ProbeResult {
    if !cfg!(target_os = "macos") {
        return ProbeResult {
            installed: true,
            version: None,
            details: Some("Not required on this platform.".to_string()),
        };
    }
    match command_output("xcode-select", &["-p"]).await {
        Ok(output) => ProbeResult {
            installed: true,
            version: None,
            details: Some(output.trim().to_string()),
        },
        Err(error) => ProbeResult {
            installed: false,
            version: None,
            details: Some(error),
        },
    }
}

async fn detect_brew() -> ProbeResult {
    if let Some(path) = brew_binary() {
        return command_version(&path.to_string_lossy(), &["--version"]).await;
    }
    command_version("brew", &["--version"]).await
}

async fn detect_command(command: &str) -> ProbeResult {
    command_version(command, &["--version"]).await
}

async fn detect_openssl3(brew_installed: bool) -> ProbeResult {
    if brew_installed {
        if let Some(brew) = brew_binary() {
            if let Ok(prefix) = command_output(&brew.to_string_lossy(), &["--prefix", "openssl@3"]).await
            {
                return ProbeResult {
                    installed: true,
                    version: None,
                    details: Some(prefix.trim().to_string()),
                };
            }
        }
    }

    for candidate in [
        "/opt/homebrew/opt/openssl@3",
        "/usr/local/opt/openssl@3",
        "/home/linuxbrew/.linuxbrew/opt/openssl@3",
    ] {
        if std::path::Path::new(candidate).exists() {
            return ProbeResult {
                installed: true,
                version: None,
                details: Some(candidate.to_string()),
            };
        }
    }

    ProbeResult {
        installed: false,
        version: None,
        details: Some("openssl@3 not found".to_string()),
    }
}

async fn command_version(program: &str, args: &[&str]) -> ProbeResult {
    match command_output(program, args).await {
        Ok(output) => ProbeResult {
            installed: true,
            version: output.lines().next().map(str::trim).map(str::to_string),
            details: None,
        },
        Err(error) => ProbeResult {
            installed: false,
            version: None,
            details: Some(error),
        },
    }
}

async fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = timeout(
        CHECK_TIMEOUT,
        Command::new(program)
            .args(args)
            .stdin(Stdio::null())
            .output(),
    )
    .await
    .map_err(|_| format!("{program} check timed out"))?
    .map_err(|error| error.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("{program} exited with status {:?}", output.status.code())
        } else {
            stderr
        })
    }
}

fn dependency_missing(doctor: &EnvironmentDoctorResult, id: EnvironmentDependencyId) -> bool {
    doctor
        .dependencies
        .iter()
        .any(|dependency| dependency.id == id && dependency.required && !dependency.installed)
}

fn brew_binary() -> Option<PathBuf> {
    for candidate in [
        "/opt/homebrew/bin/brew",
        "/usr/local/bin/brew",
        "/home/linuxbrew/.linuxbrew/bin/brew",
    ] {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }
    None
}

fn temporary_homebrew_install_dir() -> PathBuf {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("lawyer-copilot-brew-install-{millis}"))
}

fn normalize_run_id(run_id: Option<String>) -> String {
    run_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "environment-bootstrap".to_string())
}

fn sanitize_installer_output(text: &str) -> String {
    let home_path_pattern = Regex::new(r"(/Users|/home|C:\\Users)[/\\][^/\\\s:]+").expect("valid home path regex");
    let env_secret_pattern =
        Regex::new(r"(?i)(token|password|secret|api[_-]?key)=\S+").expect("valid env regex");
    let bearer_pattern = Regex::new(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]+").expect("valid bearer regex");

    let redacted = home_path_pattern.replace_all(text, "<home>");
    let redacted = env_secret_pattern.replace_all(&redacted, "$1=<redacted>");
    bearer_pattern
        .replace_all(&redacted, "bearer <redacted>")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_plan_installs_homebrew_before_brew_packages() {
        let doctor = EnvironmentDoctorResult {
            platform: EnvironmentPlatform::Macos,
            dependencies: vec![
                missing(EnvironmentDependencyId::Homebrew),
                missing(EnvironmentDependencyId::Cmake),
                missing(EnvironmentDependencyId::Openssl3),
                missing(EnvironmentDependencyId::ClaudeCli),
            ],
        };

        let plan = build_install_plan_from_doctor(&doctor);
        let step_ids: Vec<EnvironmentDependencyId> =
            plan.steps.iter().map(|step| step.dependency_id).collect();

        assert!(plan.can_run);
        assert_eq!(
            step_ids,
            vec![
                EnvironmentDependencyId::Homebrew,
                EnvironmentDependencyId::Cmake,
                EnvironmentDependencyId::Openssl3,
                EnvironmentDependencyId::ClaudeCli,
            ]
        );
    }

    #[test]
    fn windows_plan_installs_nodejs_then_claude_cli() {
        let doctor = EnvironmentDoctorResult {
            platform: EnvironmentPlatform::Windows,
            dependencies: vec![
                missing(EnvironmentDependencyId::NodeJs),
                missing(EnvironmentDependencyId::ClaudeCli),
            ],
        };

        let plan = build_install_plan_from_doctor(&doctor);
        let step_ids: Vec<EnvironmentDependencyId> =
            plan.steps.iter().map(|step| step.dependency_id).collect();

        assert!(plan.can_run);
        assert!(plan.blockers.is_empty());
        assert_eq!(
            step_ids,
            vec![
                EnvironmentDependencyId::NodeJs,
                EnvironmentDependencyId::ClaudeCli,
            ]
        );
    }

    #[test]
    fn windows_plan_skips_installed_deps() {
        let doctor = EnvironmentDoctorResult {
            platform: EnvironmentPlatform::Windows,
            dependencies: vec![
                installed(EnvironmentDependencyId::NodeJs),
                missing(EnvironmentDependencyId::ClaudeCli),
            ],
        };

        let plan = build_install_plan_from_doctor(&doctor);
        assert_eq!(plan.steps.len(), 1);
        assert_eq!(plan.steps[0].dependency_id, EnvironmentDependencyId::ClaudeCli);
    }

    #[test]
    fn windows_nodejs_step_uses_winget() {
        let step = build_windows_nodejs_step();
        let preview = step.command_preview.join(" ");
        assert!(preview.contains("winget"));
        assert!(preview.contains("OpenJS.NodeJS.LTS"));
    }

    #[test]
    fn windows_claude_cli_step_uses_npm() {
        let step = build_windows_claude_cli_step();
        let preview = step.command_preview.join(" ");
        assert!(preview.contains("npm"));
        assert!(preview.contains("@anthropic-ai/claude-code"));
    }

    #[test]
    fn homebrew_install_step_uses_tuna_mirror() {
        let step = build_homebrew_install_step();
        let preview = step.command_preview.join(" ");

        assert!(preview.contains("mirrors.tuna.tsinghua.edu.cn"));
        assert!(step.environment.iter().any(|(key, value)| {
            key == "HOMEBREW_API_DOMAIN"
                && value == "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
        }));
        assert!(step.environment.iter().any(|(key, value)| {
            key == "HOMEBREW_BOTTLE_DOMAIN"
                && value == "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
        }));
    }

    #[test]
    fn sanitize_output_redacts_home_paths_and_secrets() {
        let raw = "/Users/alice/.zprofile\nTOKEN=secret\nAuthorization: bearer abc";
        let sanitized = sanitize_installer_output(raw);

        assert!(!sanitized.contains("/Users/alice"));
        assert!(!sanitized.contains("secret"));
        assert!(!sanitized.contains("bearer abc"));
        assert!(sanitized.contains("<home>"));
        assert!(sanitized.contains("<redacted>"));
    }

    #[test]
    fn sanitize_output_redacts_windows_home_paths() {
        let raw = r"C:\Users\bob\AppData\Local";
        let sanitized = sanitize_installer_output(raw);
        assert!(!sanitized.contains(r"C:\Users\bob"));
        assert!(sanitized.contains("<home>"));
    }

    fn missing(id: EnvironmentDependencyId) -> EnvironmentDependencyStatus {
        EnvironmentDependencyStatus {
            id,
            label: id.label().to_string(),
            installed: false,
            required: true,
            version: None,
            details: None,
            installable: true,
        }
    }

    fn installed(id: EnvironmentDependencyId) -> EnvironmentDependencyStatus {
        EnvironmentDependencyStatus {
            id,
            label: id.label().to_string(),
            installed: true,
            required: true,
            version: Some("1.0.0".to_string()),
            details: None,
            installable: true,
        }
    }
}
