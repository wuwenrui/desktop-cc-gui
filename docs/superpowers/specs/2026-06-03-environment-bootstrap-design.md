# Environment Bootstrap Design

## Goal

Add a one-click environment bootstrap flow for LawyerCopilot users who do not
have the required local tools installed. The flow must check dependencies,
install missing dependencies in the correct order, and show visible progress.

The first macOS priority is Homebrew. If Homebrew is missing, the bootstrapper
installs Homebrew first using a domestic mirror, then installs package
dependencies such as `cmake` and `openssl@3`, then continues with the existing
Claude/Codex CLI installation flow.

## Existing Context

- The startup dependency gate already checks and installs Claude CLI through
  Tauri commands: `src/features/setup/DependencyGate.tsx:33` and
  `src/features/setup/DependencyGate.tsx:50`.
- CLI install progress already has an event subscription pattern:
  `src/services/events.ts:116`.
- The existing CLI installer is scoped to `codex` and `claude` only:
  `src/types.ts:1146` and `src-tauri/src/codex/installer.rs:22`.
- The current doctor script only prints manual install hints for system
  dependencies: `scripts/doctor.mjs:31`.

## Sources For Homebrew Domestic Mirror

Default mirror: Tsinghua TUNA.

TUNA documents that its Homebrew mirror includes `brew`, `homebrew-core`,
`homebrew-cask`, `homebrew-command-not-found`, and `install`. It also documents
first-time Homebrew installation via cloning the mirrored `install.git` repo.
TUNA's bottles help page documents `HOMEBREW_API_DOMAIN` and
`HOMEBREW_BOTTLE_DOMAIN` for binary package downloads.

The implementation should use TUNA by default and keep mirror URLs
configurable so USTC or another domestic mirror can be added later without
changing UI code.

References:

- https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/
- https://mirrors.tuna.tsinghua.edu.cn/help/homebrew-bottles/

## User Flow

1. App starts and opens the environment bootstrap gate before the main UI.
2. The gate runs a preflight check and shows each dependency:
   - Xcode Command Line Tools on macOS.
   - Homebrew.
   - `cmake`.
   - `openssl@3`.
   - Claude CLI.
   - Codex CLI, when needed by the selected engine configuration.
3. If anything is missing, the UI shows an install plan with command preview,
   mirror source, estimated steps, and warnings.
4. User clicks one primary action: "开始安装".
5. The backend runs steps in order and emits progress events:
   - checking
   - installing
   - stdout/stderr
   - verifying
   - completed/failed
6. On success, the gate re-runs doctor checks and enters the main app.
7. On failure, the UI shows the failed step, sanitized log tail, retry button,
   and manual fallback command.

## macOS Homebrew Install Strategy

If `brew` is not available:

1. Check `xcode-select -p`.
2. If Command Line Tools are missing, run `xcode-select --install`, mark the
   step as waiting, and poll until `xcode-select -p` succeeds. This is not a
   silent install because macOS owns the consent UI.
3. Set Homebrew mirror environment for this run:
   - `HOMEBREW_BREW_GIT_REMOTE=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git`
   - `HOMEBREW_CORE_GIT_REMOTE=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git`
   - `HOMEBREW_INSTALL_FROM_API=1`
   - `HOMEBREW_API_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api`
   - `HOMEBREW_BOTTLE_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles`
4. Clone the mirrored Homebrew installer into a temporary directory:
   `git clone --depth=1 https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git`.
5. Run `/bin/bash install.sh` from that temporary checkout.
6. Verify Homebrew through the expected binary path:
   - Apple Silicon: `/opt/homebrew/bin/brew`.
   - Intel macOS: `/usr/local/bin/brew`.
7. Persist mirror variables only inside a managed shell profile block, after
   the user confirms persistence in the plan. The block must be identifiable
   and replaceable without editing unrelated user shell config.

If Homebrew installation requires an interactive system password, the app must
not capture or log the password. The acceptable behavior is to surface the
interactive macOS prompt or fall back to a visible Terminal command and keep
polling for `brew` availability.

## Architecture

### Backend

Add a new Rust module:

- `src-tauri/src/environment_installer.rs`

Responsibilities:

- Build an environment install plan.
- Detect missing dependencies.
- Execute ordered install steps.
- Stream progress events.
- Redact sensitive output.
- Return final doctor results.

Add Tauri commands:

- `environment_install_plan`
- `environment_install_run`
- `environment_doctor`

Do not overload the current `cli_install_run` path. It is typed around
`codex`/`claude`, so environment bootstrap should use a dedicated event:

- `environment-installer-event`

The new event should copy the structure of `CliInstallProgressEvent` but use
generic dependency step ids instead of CLI engine ids.

### Frontend

Replace the narrow startup dependency gate with an environment bootstrap gate:

- `src/features/setup/EnvironmentBootstrapGate.tsx`

The UI should show:

- Dependency checklist.
- Current step status.
- Linear progress based on completed steps.
- Collapsible log output.
- Retry and manual fallback.

Settings can reuse the same bootstrap panel later, but the first delivery
should focus on startup so new users can enter the app.

### Shared Types

Add typed dependency records:

- `EnvironmentDependencyId`
- `EnvironmentDependencyStatus`
- `EnvironmentInstallPlan`
- `EnvironmentInstallProgressEvent`
- `EnvironmentInstallResult`

Keep dependency ids stable and lower camel case:

- `xcodeCommandLineTools`
- `homebrew`
- `cmake`
- `openssl3`
- `claudeCli`
- `codexCli`

## Data Flow

```text
EnvironmentBootstrapGate
  -> environment_doctor
  -> environment_install_plan
  -> environment_install_run(runId)
  <- environment-installer-event
  -> environment_doctor
  -> main app
```

## Error Handling

- Missing CLT: open the macOS installer and poll; do not fake success.
- Homebrew mirror unreachable: show mirror-specific failure and manual fallback.
- Brew installed but not on PATH: use explicit brew paths and offer profile
  update.
- Package install failure: show failed package, exit code, and sanitized log
  tail.
- CLI install failure: delegate to the existing CLI install result once system
  dependencies are ready.

## Security

- Show the install plan before running external commands.
- Use HTTPS mirror URLs only.
- Do not capture sudo passwords.
- Do not log tokens, env secrets, or full shell profiles.
- Redact home directory paths in user-facing logs where possible.
- Persist shell profile changes only in a managed marker block.

## Testing

Unit tests:

- Rust plan builder orders Homebrew before brew packages.
- Rust plan builder uses TUNA URLs for macOS Homebrew install by default.
- Rust detector handles existing brew, missing brew, and brew not on PATH.
- Rust output sanitizer redacts home paths and secrets.
- TypeScript gate renders checking, ready, installing, failed, and retry states.

Integration tests:

- Mock Tauri commands and progress events in `EnvironmentBootstrapGate`.
- Verify missing Homebrew produces the ordered plan:
  CLT -> Homebrew -> brew packages -> CLI.
- Verify failed Homebrew install shows retry and manual fallback.

No test should install Homebrew or mutate the real host environment.

## Non-Goals

- Linux package manager auto-install in the first iteration.
- Windows Chocolatey/winget bootstrap in the first iteration.
- Silent installation of macOS CLT or privileged Homebrew operations.
- Refactoring the existing Codex/Claude installer beyond composition.

## Acceptance Criteria

- A fresh macOS user without Homebrew sees a single environment bootstrap flow.
- The flow installs Homebrew first using TUNA mirror settings.
- The UI shows progress for each step and terminal output.
- After successful install, doctor checks pass and the main app opens.
- If CLT, Homebrew, or a brew package fails, the UI shows the exact failed step
  and a manual fallback.
- Existing CLI installer behavior for settings remains compatible.
