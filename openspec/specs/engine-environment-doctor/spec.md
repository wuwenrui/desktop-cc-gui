# engine-environment-doctor Specification

## Purpose
TBD - created by archiving change harden-client-runtime-environment-recovery. Update Purpose after archive.
## Requirements
### Requirement: Engine Doctor MUST Resolve Executables With Platform-Aware Fallbacks

系统 MUST diagnose engine executable availability through a cross-platform resolver rather than relying only on the GUI process PATH.

#### Scenario: macOS resolver checks common shell paths

- **WHEN** Codex executable is not found in configured path or GUI process PATH on macOS
- **THEN** doctor MUST probe platform common paths including `/opt/homebrew/bin`, `/usr/local/bin`, and `/usr/bin`
- **AND** doctor MAY use a bounded login shell fallback such as `$SHELL -lc 'command -v codex'`

#### Scenario: Windows resolver handles executable wrappers

- **WHEN** Codex executable is not found in configured path or GUI process PATH on Windows
- **THEN** doctor MUST probe npm/global candidate paths and `where.exe codex`
- **AND** doctor MUST classify discovered `.exe`, `.cmd`, or `.ps1` wrappers with a wrapper kind or equivalent metadata

#### Scenario: Linux resolver checks local and shell paths

- **WHEN** Codex executable is not found in configured path or GUI process PATH on Linux
- **THEN** doctor MUST probe `/usr/local/bin`, `/usr/bin`, `$HOME/.local/bin`, and equivalent configured candidates
- **AND** doctor MAY use `$SHELL -lc 'command -v codex'` as a bounded fallback

### Requirement: Engine Doctor MUST Explain Environment Drift

系统 MUST return structured diagnosis when an executable exists in one environment but is invisible to the GUI runtime.

#### Scenario: engine switch refreshes stale Codex availability before failing

- **WHEN** user switches the active engine to Codex
- **AND** cached engine status says Codex is unavailable or missing
- **THEN** UI MUST perform a fresh engine detection before reporting switch failure
- **AND** if refreshed detection shows Codex installed, the switch MUST proceed without requiring user restart

#### Scenario: Codex switch failure includes doctor evidence

- **WHEN** user switches the active engine to Codex
- **AND** fresh detection still says Codex is unavailable
- **THEN** UI MUST run Codex doctor or equivalent diagnostic path
- **AND** debug/error evidence MUST include structured fields such as `doctorOk`, `environmentDiagnosis`, `resolvedBinaryPath`, and `pathEnvUsed`
- **AND** UI MUST NOT emit only the generic `Engine codex is not installed` message when doctor evidence is available

### Requirement: Network Doctor MUST Classify Local Probe And Proxy Evidence

系统 MUST diagnose local engine probe failures and process proxy evidence with bounded categories rather than only exposing raw request errors.

#### Scenario: process proxy environment is reported

- **WHEN** doctor inspects network settings
- **THEN** result MUST include whether process proxy env is in effect
- **AND** secret-bearing proxy values MUST be redacted
- **AND** unset proxy variables MUST NOT create noisy normal-state UI rows

#### Scenario: local app-server probe classifies failure

- **WHEN** the local engine app-server probe fails
- **THEN** doctor MUST classify the failure as `missingProxy`, `proxyUnreachable`, `dnsFailure`, `tlsFailure`, `timeout`, `httpStatus`, or `unknown`
- **AND** UI MUST show the category only when it is actionable

#### Scenario: successful probe hides unknown network state

- **WHEN** the local probe succeeds and no actionable network category exists
- **THEN** UI MUST NOT show `unknown` network diagnosis

### Requirement: Claude Doctor MUST Report Windows Runtime Wrapper Selection

The engine environment doctor MUST expose the Windows Claude executable path and wrapper kind used or preferred for managed runtime execution.

#### Scenario: Windows Claude candidates include wrapper kind

- **WHEN** the doctor resolves Claude executable candidates on Windows
- **THEN** the diagnosis MUST include wrapper kind metadata for `.cmd`, `.bat`, `.exe`, `.ps1`, or direct candidates
- **AND** the diagnosis MUST identify the selected runtime candidate

#### Scenario: implicit Windows resolution prefers stable managed-runtime wrapper

- **WHEN** implicit Windows Claude resolution finds both stable candidates such as `.cmd` or `.exe` and a `.ps1` candidate
- **THEN** the runtime resolver MUST prefer the stable non-`.ps1` candidate
- **AND** the doctor MUST make the selected candidate visible in diagnostic output

#### Scenario: explicit ps1 configuration remains supported

- **WHEN** the user explicitly configures a Claude `.ps1` path
- **THEN** the runtime MUST preserve that configured path
- **AND** the doctor MUST classify it as `ps1-wrapper` or equivalent metadata

