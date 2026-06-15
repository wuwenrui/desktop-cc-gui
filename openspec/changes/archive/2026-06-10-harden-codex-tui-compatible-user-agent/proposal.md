## Why

Some relay/proxy services filter requests by the leading token of the HTTP `User-Agent`.
The current GUI-launched Codex app-server path can surface as `ccgui/... unknown (...)`,
which is rejected by relays that only allow `codex*` clients.

The product needs a Codex-only compatibility boundary:

- Codex engine conversations should present a `codex-tui` compatible network identity.
- Other engines must keep their existing launch/runtime behavior.
- Internal GUI control-plane filtering must continue to work after the external identity changes.

## What Changed

### Codex app-server network identity

- The Codex app-server spawn path now sets terminal host environment values before launching the child process:
  - `TERM_PROGRAM`
  - `TERM_PROGRAM_VERSION`
- Existing environment values are preserved when present.
- Missing terminal values fall back to:
  - `Apple_Terminal`
  - `470.2`

### Codex initialize client info

- The Codex app-server `initialize` payload now uses:
  - `clientInfo.name = "codex-tui"`
  - `clientInfo.title = "codex-tui"`
- `clientInfo.version` is resolved from the configured Codex CLI via `codex --version` parsing.
- If Codex CLI version resolution fails or returns no parseable version, the fallback is `0.137.0`.

### Internal control-plane compatibility

- Claude history/control-plane filtering now treats both `ccgui` and `codex-tui` client info as GUI control-plane signals when paired with `capabilities.experimentalApi`.
- This keeps internal transcript filtering compatible with previous `ccgui` records and new `codex-tui` compatibility records.

## Scope

### In Scope

- Codex app-server launch path.
- Codex app-server `initialize` payload.
- Internal control-plane filtering compatibility for `ccgui` and `codex-tui`.
- Focused regression tests for version parsing and control-plane classification.

### Out of Scope

- Global application branding.
- Claude, Gemini, OpenCode, or custom provider launch behavior.
- Full `User-Agent` construction inside upstream Codex CLI.
- Mainline OpenSpec spec sync/archive.

## Implementation Evidence

- `src-tauri/src/backend/app_server.rs`
  - Adds `codex-tui` compatibility constants.
  - Adds terminal environment fallback injection for the Codex app-server child process.
  - Adds Codex CLI version parsing and fallback.
  - Sends `codex-tui` client info in the Codex app-server `initialize` request.

- `src-tauri/src/engine/claude_history_entries.rs`
  - Renames the client-info predicate to a GUI control-plane predicate.
  - Accepts both `ccgui` and `codex-tui`.

- `src-tauri/src/backend/app_server_tests.rs`
  - Adds focused coverage for common Codex CLI version output formats.

- `src-tauri/src/engine/claude_history_filter_tests.rs`
  - Adds focused coverage proving `codex-tui + experimentalApi` remains control-plane.

## Spec Sync

- Behavior spec added at `openspec/changes/harden-codex-tui-compatible-user-agent/specs/codex-tui-compatible-user-agent/spec.md`.
- Executable backend contract is captured in `.trellis/spec/backend/codex-provider-scoped-runtime.md` under the Codex app-server launch identity contract.
- Current code is the source of truth:
  - constants: `CODEX_TUI_COMPAT_CLIENT_NAME = "codex-tui"`, `FALLBACK_CODEX_TUI_COMPAT_VERSION = "0.137.0"`, `FALLBACK_TERM_PROGRAM = "Apple_Terminal"`, `FALLBACK_TERM_PROGRAM_VERSION = "470.2"`;
  - launch path: `spawn_workspace_session_once` applies terminal env hints before `codex app-server` args and optional `CODEX_HOME`;
  - initialize path: app-server `initialize` payload uses `codex-tui` name/title and resolved/fallback version;
  - filtering path: GUI control-plane predicate accepts both legacy `ccgui` and new `codex-tui` identities only with structured experimental API signals.

## Validation Evidence

Executed:

```bash
cargo test --manifest-path src-tauri/Cargo.toml parse_codex_cli_version_accepts_common_outputs
cargo test --manifest-path src-tauri/Cargo.toml codex_tui_client_info_with_experimental_api_is_control_plane
```

Result:

- Both focused Rust test filters passed.
- The tests ran against both relevant Rust unit-test targets emitted by Cargo for this crate.

## Expected Runtime Shape

The relay-visible `User-Agent` is expected to move from a `ccgui/... unknown (...)` shape toward a Codex-compatible shape such as:

```text
codex-tui/<dynamic-codex-version> (Mac OS <codex-cli-os-version>; <arch>) Apple_Terminal/470.2 (codex-tui; <dynamic-codex-version>)
```

The exact OS/version/architecture formatting remains owned by upstream Codex CLI.
This change supplies the Codex-compatible client identity and terminal host hints used by that path.

## Risks

- If upstream Codex CLI stops deriving network identity from `initialize.clientInfo`, the prefix behavior may need a deeper upstream override.
- If a relay validates exact Codex release versions instead of only the `codex` prefix, the fallback `0.137.0` may need to be updated.
- The terminal host fallback intentionally reports `Apple_Terminal/470.2` for compatibility when no real terminal host env is available.
