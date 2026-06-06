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
    // Installing Homebrew itself needs an interactive admin (sudo) password prompt that only a
    // real TTY can satisfy. Such steps are launched in Terminal.app instead of the non-interactive
    // piped runner, so the user can type their password. The UI then asks the user to retry once
    // the terminal finishes, which re-runs detection.
    pub(crate) requires_tty: bool,
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
        if let Err(error) = execute_step(step, &run_id, &app, started).await {
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

#[tauri::command]
pub(crate) async fn environment_install_step_retry(
    step_id: String,
    run_id: Option<String>,
    app: AppHandle,
) -> Result<EnvironmentInstallResult, String> {
    let started = Instant::now();
    let run_id = normalize_run_id(run_id);
    let doctor = build_doctor_result().await;
    let plan = build_install_plan_from_doctor(&doctor);

    // Re-derive the plan from a fresh doctor so the retried step reflects current state. If the
    // dependency already became installed (e.g. Homebrew finished in Terminal), it is no longer in
    // the plan, and we report success after verification rather than re-running it.
    let target = plan.steps.iter().find(|step| step.id == step_id);
    let step_error = match target {
        Some(step) => execute_step(step, &run_id, &app, started).await.err(),
        None => None,
    };

    emit_progress(
        &app,
        EnvironmentInstallProgressEvent {
            run_id: run_id.clone(),
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
    let ok = step_error.is_none()
        && doctor_result
            .dependencies
            .iter()
            .filter(|dependency| dependency.required)
            .all(|dependency| dependency.installed);

    Ok(EnvironmentInstallResult {
        ok,
        exit_code: Some(if ok { 0 } else { 1 }),
        details: step_error.or_else(|| {
            if ok {
                None
            } else {
                Some("Some required dependencies are still missing.".to_string())
            }
        }),
        duration_ms: started.elapsed().as_millis(),
        doctor_result,
    })
}

// Emits Started, runs the step, then emits Finished or Error. Shared by the full run and the
// per-step retry so progress events stay identical across both entry points.
async fn execute_step(
    step: &EnvironmentInstallStep,
    run_id: &str,
    app: &AppHandle,
    started: Instant,
) -> Result<(), String> {
    emit_progress(
        app,
        EnvironmentInstallProgressEvent {
            run_id: run_id.to_string(),
            step_id: Some(step.id.clone()),
            dependency_id: Some(step.dependency_id),
            phase: EnvironmentInstallProgressPhase::Started,
            stream: None,
            message: Some(step.command_preview.join(" ")),
            exit_code: None,
            duration_ms: Some(started.elapsed().as_millis()),
        },
    );

    match run_install_step(step, run_id, app, started).await {
        Ok(()) => {
            emit_progress(
                app,
                EnvironmentInstallProgressEvent {
                    run_id: run_id.to_string(),
                    step_id: Some(step.id.clone()),
                    dependency_id: Some(step.dependency_id),
                    phase: EnvironmentInstallProgressPhase::Finished,
                    stream: None,
                    message: Some(format!("{} completed", step.label)),
                    exit_code: Some(0),
                    duration_ms: Some(started.elapsed().as_millis()),
                },
            );
            Ok(())
        }
        Err(error) => {
            emit_progress(
                app,
                EnvironmentInstallProgressEvent {
                    run_id: run_id.to_string(),
                    step_id: Some(step.id.clone()),
                    dependency_id: Some(step.dependency_id),
                    phase: EnvironmentInstallProgressPhase::Error,
                    stream: None,
                    message: Some(error.clone()),
                    exit_code: None,
                    duration_ms: Some(started.elapsed().as_millis()),
                },
            );
            Err(error)
        }
    }
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

// No dependency is required to launch the app: a missing dependency never blocks startup, it is
// only surfaced for on-demand install from the Environment panel. `required` stays false across the
// board so the required-only verification used by install/retry treats everything as optional.
async fn build_macos_dependencies() -> Vec<EnvironmentDependencyStatus> {
    let brew = detect_brew().await;
    vec![
        dependency_status(
            EnvironmentDependencyId::XcodeCommandLineTools,
            detect_xcode_clt().await,
            false,
            true,
        ),
        // Homebrew is only a tool used to install other brew packages; not required to launch.
        dependency_status(EnvironmentDependencyId::Homebrew, brew, false, true),
        // CMake is never invoked by the app itself (whisper.cpp is compiled into the binary at
        // build time); only the user's own projects might need it, so it is optional.
        dependency_status(EnvironmentDependencyId::Cmake, detect_command("cmake").await, false, true),
        dependency_status(
            EnvironmentDependencyId::ClaudeCli,
            detect_command("claude").await,
            false,
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
            false,
            true,
        ),
        dependency_status(
            EnvironmentDependencyId::ClaudeCli,
            detect_command("claude").await,
            false,
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
        // Homebrew's own installer needs an interactive admin password, so it is launched in
        // Terminal.app rather than the piped runner. The preview reflects that.
        command_preview: vec![
            "open".to_string(),
            "Terminal.app".to_string(),
            "->".to_string(),
            "/bin/bash".to_string(),
            "-c".to_string(),
            "curl -fsSL <install.sh> | bash".to_string(),
        ],
        environment: tuna_homebrew_environment(),
        manual_fallback: Some(homebrew_terminal_shell_command()),
        warnings: vec![
            "Homebrew needs your administrator password. It opens in Terminal so you can type it; after it finishes, click retry.".to_string(),
        ],
        requires_tty: true,
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
        requires_tty: false,
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
        requires_tty: false,
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
        requires_tty: false,
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
            "--accept-source-agreements".to_string(),
            "--accept-package-agreements".to_string(),
            "--source".to_string(),
            "winget".to_string(),
        ],
        environment: Vec::new(),
        manual_fallback: Some(
            "winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements --source winget"
                .to_string(),
        ),
        warnings: vec![
            "Restart the application after Node.js installation for PATH changes to take effect.".to_string(),
        ],
        requires_tty: false,
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
        requires_tty: false,
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

// The full shell command run inside Terminal.app for the Homebrew install. It exports the TUNA
// mirror env and runs the installer interactively. We deliberately do NOT set NONINTERACTIVE:
// Homebrew's installer treats NONINTERACTIVE as `sudo -n`, which suppresses the password prompt
// and aborts with "Need sudo access" for a normal admin. In a real Terminal TTY we want the
// installer to prompt for RETURN + the sudo password. Doubles as the manual_fallback shown in UI.
fn homebrew_terminal_shell_command() -> String {
    format!(
        "export HOMEBREW_BREW_GIT_REMOTE=\"{TUNA_BREW_GIT_REMOTE}\"; \
export HOMEBREW_CORE_GIT_REMOTE=\"{TUNA_CORE_GIT_REMOTE}\"; \
export HOMEBREW_INSTALL_FROM_API=1; \
export HOMEBREW_API_DOMAIN=\"{TUNA_API_DOMAIN}\"; \
export HOMEBREW_BOTTLE_DOMAIN=\"{TUNA_BOTTLE_DOMAIN}\"; \
BREW_INSTALL_DIR=\"$(mktemp -d)/brew-install\"; \
git clone --depth=1 {TUNA_INSTALL_GIT_REMOTE} \"$BREW_INSTALL_DIR\" && /bin/bash \"$BREW_INSTALL_DIR/install.sh\"; \
rm -rf \"$BREW_INSTALL_DIR\""
    )
}

// Launches the Homebrew install command in a fresh Terminal.app window via osascript. We do not
// try to run Homebrew as root; we hand control to a real TTY so the user can complete the sudo
// prompt. Detection (re-run on retry) confirms the result, so a successful spawn is enough here.
async fn launch_homebrew_in_terminal(
    run_id: &str,
    step: &EnvironmentInstallStep,
    app: &AppHandle,
    started: Instant,
) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("Terminal-based Homebrew install is only supported on macOS.".to_string());
    }

    let shell_command = homebrew_terminal_shell_command();
    let escaped = shell_command.replace('\\', "\\\\").replace('"', "\\\"");
    let applescript = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{escaped}\"\nend tell"
    );

    emit_output_event(
        app,
        run_id,
        step,
        EnvironmentInstallOutputStream::Stdout,
        "Opening Terminal to install Homebrew. Enter your password there, then click retry once it finishes.",
        started,
    );

    run_command(
        "osascript",
        &["-e", &applescript],
        &step.environment,
        run_id,
        step,
        app,
        started,
    )
    .await
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
            // Homebrew's installer needs an interactive admin password. The non-interactive piped
            // runner cannot provide a TTY for sudo, which is exactly the line failure seen in the
            // field ("stdin is not a TTY ... Need sudo access"). Launch Terminal.app so the user
            // can type the password, then return early; the UI prompts the user to retry, which
            // re-runs detection to confirm completion.
            launch_homebrew_in_terminal(run_id, step, app, started).await
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
                    // Pin to the community "winget" source. Without this, winget
                    // also refreshes the "msstore" source, which requires the
                    // machine's geographic region + terms agreement and fails
                    // with 0x8a15000f ("missing source data"), aborting install.
                    "--source",
                    "winget",
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
    // First honor the current process PATH: a tool that was already reachable at app launch
    // must keep being detected exactly as before (no behavior change for that path).
    let on_path = command_version(command, &["--version"]).await;
    if on_path.installed {
        return on_path;
    }

    // The app snapshots PATH once at startup (fix_path_env::fix() in main.rs). Tools installed
    // *after* launch (claude into ~/.local/bin, node via nvm/Homebrew, etc.) are invisible to that
    // snapshot, so "check dependencies" keeps reporting them missing even though the terminal sees
    // them. Probe the well-known install locations by absolute path so a freshly installed tool is
    // recognized without restarting the app.
    for candidate in command_install_candidates(command) {
        if candidate.is_file() {
            let probed = command_version(&candidate.to_string_lossy(), &["--version"]).await;
            if probed.installed {
                return probed;
            }
        }
    }

    // Nothing found anywhere: surface the original PATH probe error for diagnostics.
    on_path
}

/// Well-known absolute install locations for `command`, probed when it is not on PATH.
/// These mirror the locations the installer scripts / common package managers use, so a tool
/// installed while the app is already running can still be detected.
fn command_install_candidates(command: &str) -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        windows_command_candidates(command)
    }
    #[cfg(not(target_os = "windows"))]
    {
        unix_command_candidates(command)
    }
}

#[cfg(not(target_os = "windows"))]
fn unix_command_candidates(command: &str) -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    // Directories every CLI we detect may land in. macOS-focused but valid on Linux too.
    let mut dirs: Vec<PathBuf> = vec![
        home.join(".local/bin"),       // claude native installer, pipx, user-local installs
        home.join(".claude/local"),    // claude alternate local layout
        PathBuf::from("/opt/homebrew/bin"), // Homebrew on Apple Silicon
        PathBuf::from("/usr/local/bin"),    // Homebrew on Intel / manual installs
        home.join(".bun/bin"),         // bun global bin
        home.join(".npm-global/bin"),  // npm global prefix override
    ];
    // nvm installs node/npm-managed CLIs under ~/.nvm/versions/node/<ver>/bin; include every
    // installed version's bin so the active one is covered without parsing nvm state.
    dirs.extend(nvm_version_bins(&home));

    dirs.into_iter()
        .map(|dir| dir.join(command))
        .collect()
}

/// All `~/.nvm/versions/node/*/bin` directories that currently exist.
#[cfg(not(target_os = "windows"))]
fn nvm_version_bins(home: &std::path::Path) -> Vec<PathBuf> {
    let versions_dir = home.join(".nvm/versions/node");
    let Ok(entries) = std::fs::read_dir(&versions_dir) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("bin"))
        .filter(|bin| bin.is_dir())
        .collect()
}

#[cfg(target_os = "windows")]
fn windows_command_candidates(command: &str) -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // Per-user npm global (claude/codex install here via `npm i -g`). npm ships CLIs as both a
    // `.cmd` shim and an extensionless script; probe both, plus the raw command name.
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let npm = PathBuf::from(&appdata).join("npm");
        candidates.push(npm.join(format!("{command}.cmd")));
        candidates.push(npm.join(format!("{command}.exe")));
        candidates.push(npm.join(command));
    }

    // node MSI / winget installs into Program Files.
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        candidates.push(PathBuf::from(&program_files).join("nodejs").join(format!("{command}.exe")));
    }

    // winget "Links" shim directory (claude native installer + many winget packages land here).
    if let Some(local_appdata) = std::env::var_os("LOCALAPPDATA") {
        let links = PathBuf::from(&local_appdata).join("Microsoft").join("WinGet").join("Links");
        candidates.push(links.join(format!("{command}.exe")));
        candidates.push(links.join(format!("{command}.cmd")));
    }

    // claude native installer per-user location.
    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        let local_bin = PathBuf::from(&user_profile).join(".local").join("bin");
        candidates.push(local_bin.join(format!("{command}.exe")));
        candidates.push(local_bin.join(format!("{command}.cmd")));
    }

    candidates
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

// True when the dependency is present in the doctor result but not yet installed, regardless of
// whether it blocks startup. Optional deps (Homebrew, CMake) still get an on-demand install step;
// startup-blocking is decided separately by the required-only verification.
fn dependency_missing(doctor: &EnvironmentDoctorResult, id: EnvironmentDependencyId) -> bool {
    doctor
        .dependencies
        .iter()
        .any(|dependency| dependency.id == id && !dependency.installed)
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
                EnvironmentDependencyId::ClaudeCli,
            ]
        );
    }

    #[tokio::test]
    async fn macos_doctor_marks_all_dependencies_optional() {
        // No dependency blocks startup anymore: every macOS dependency stays optional so a missing
        // one never gates the app. detection populates `installed`, but `required` is fixed false.
        let deps = build_macos_dependencies().await;

        let required = |id: EnvironmentDependencyId| {
            deps.iter()
                .find(|dep| dep.id == id)
                .map(|dep| dep.required)
        };

        assert_eq!(required(EnvironmentDependencyId::XcodeCommandLineTools), Some(false));
        assert_eq!(required(EnvironmentDependencyId::ClaudeCli), Some(false));
        assert_eq!(required(EnvironmentDependencyId::Homebrew), Some(false));
        assert_eq!(required(EnvironmentDependencyId::Cmake), Some(false));
        assert_eq!(required(EnvironmentDependencyId::CodexCli), Some(false));
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
        // Pin to the winget source so msstore terms/region failures cannot abort it.
        assert!(preview.contains("--source winget"));
        assert!(preview.contains("--accept-source-agreements"));
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
        let shell = step.manual_fallback.clone().unwrap_or_default();

        assert!(shell.contains("mirrors.tuna.tsinghua.edu.cn"));
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
    fn homebrew_install_step_requires_tty_via_terminal() {
        // Homebrew is the only step that needs an interactive sudo password, so it is flagged for
        // the Terminal-based path and runs interactively (NO NONINTERACTIVE, which would suppress
        // the sudo password prompt and abort the install).
        let step = build_homebrew_install_step();
        assert!(step.requires_tty);
        let shell = step.manual_fallback.clone().unwrap_or_default();
        assert!(!shell.contains("NONINTERACTIVE"));
        assert!(shell.contains("install.sh"));
    }

    #[test]
    fn non_homebrew_steps_do_not_require_tty() {
        assert!(!build_xcode_clt_step().requires_tty);
        assert!(!build_macos_claude_cli_step().requires_tty);
        assert!(
            !build_brew_package_step(EnvironmentDependencyId::Cmake, "cmake").requires_tty
        );
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

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn unix_candidates_cover_known_install_dirs() {
        // The well-known fallback locations must be probed for a command not on PATH so a tool
        // installed after launch (e.g. claude into ~/.local/bin) is still detected.
        let home = dirs::home_dir().unwrap_or_default();
        let candidates = unix_command_candidates("claude");
        let expected = [
            home.join(".local/bin/claude"),
            home.join(".claude/local/claude"),
            PathBuf::from("/opt/homebrew/bin/claude"),
            PathBuf::from("/usr/local/bin/claude"),
            home.join(".bun/bin/claude"),
            home.join(".npm-global/bin/claude"),
        ];
        for path in expected {
            assert!(
                candidates.contains(&path),
                "expected candidate {path:?} to be probed, got {candidates:?}"
            );
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_candidates_cover_npm_and_program_files() {
        // npm global (.cmd shim), Program Files nodejs, and the winget Links dir must be probed.
        std::env::set_var("APPDATA", r"C:\Users\test\AppData\Roaming");
        std::env::set_var("ProgramFiles", r"C:\Program Files");
        std::env::set_var("LOCALAPPDATA", r"C:\Users\test\AppData\Local");
        let candidates = windows_command_candidates("claude");
        assert!(candidates.contains(&PathBuf::from(r"C:\Users\test\AppData\Roaming\npm\claude.cmd")));
        let node = windows_command_candidates("node");
        assert!(node.contains(&PathBuf::from(r"C:\Program Files\nodejs\node.exe")));
        assert!(candidates.contains(&PathBuf::from(
            r"C:\Users\test\AppData\Local\Microsoft\WinGet\Links\claude.exe"
        )));
    }

    #[cfg(not(target_os = "windows"))]
    #[tokio::test]
    async fn command_version_resolves_absolute_path_off_path() {
        // Simulates a tool installed into a well-known dir after launch: it is NOT on PATH, but
        // probing it by absolute path (the fallback detect_command performs) must succeed.
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let dir = std::env::temp_dir().join(format!("envtest-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let bin = dir.join("faketool");
        let mut file = std::fs::File::create(&bin).expect("create fake binary");
        file.write_all(b"#!/bin/sh\necho '9.9.9 (fake)'\n").expect("write script");
        file.flush().expect("flush");
        drop(file);
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755))
            .expect("chmod +x");

        let result = command_version(&bin.to_string_lossy(), &["--version"]).await;
        std::fs::remove_dir_all(&dir).ok();

        assert!(result.installed, "absolute-path probe should succeed: {result:?}");
        assert_eq!(result.version.as_deref(), Some("9.9.9 (fake)"));
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
