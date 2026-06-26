# Spec Delta: engine-deprecation

## REMOVED Requirements

### Requirement: OpenCode CLI Engine Detection And Version Identification

The desktop client MUST detect the OpenCode CLI binary on the system PATH, parse its version, and expose it through the `EngineType::OpenCode` variant of the `EngineType` enum, with a corresponding entry in the engine capability matrix (`src-tauri/src/engine/capability_matrix.rs`) and engine availability check (`src/features/engine/utils/engineAvailability.ts`). The client MUST also expose a settings toggle `AppSettings.opencodeEnabled` (serialized as `opencodeEnabled`) that controls whether the OpenCode engine is selectable in `EngineSelector` and whether OpenCode sessions can be started.

#### Scenario: first-time OpenCode detection

- **WHEN** the user has OpenCode CLI installed
- **THEN** the client runs `opencode --version` and parses the version number into an `EngineStatus` struct
- **AND** the `EngineSelector` UI shows an "OpenCode" option in the engine dropdown.

#### Scenario: OpenCode not installed

- **WHEN** the user does not have OpenCode CLI installed
- **THEN** the detection returns `installed = false` with `error = "OpenCode CLI not found in PATH"`
- **AND** the settings toggle `opencodeEnabled` defaults to `false` and the option is hidden in the UI.

#### Scenario: OpenCode session creation

- **WHEN** the user selects OpenCode as the current engine and opens a new conversation
- **THEN** a new `OpenCodeSession` instance is created with `engine_type = EngineType::OpenCode` and a corresponding `SessionKind::OpenCode` entry in the session management catalog.

### Requirement: OpenCode Session Management And Resume

The desktop client MUST manage OpenCode sessions through `OpenCodeSession` (`src-tauri/src/engine/opencode.rs`), support session resume through the `--resume` argument on the `opencode` subprocess, and integrate with the `selectedAgentSession.resolveThreadEngine` switch (matching thread ID prefixes `opencode:` and `opencode-pending-`). The client MUST persist OpenCode session history to `~/.ccgui/<provider>/threads/opencode-*.jsonl` and load it through `opencodeHistoryLoader.ts` on app startup.

#### Scenario: OpenCode session resume

- **WHEN** the user resumes a previous OpenCode session
- **THEN** the client spawns the `opencode` subprocess with `--resume <session_id>` and replays the persisted `.jsonl` history.

#### Scenario: OpenCode thread ID prefix routing

- **WHEN** the thread list contains a thread with ID starting with `opencode:` or `opencode-pending-`
- **THEN** `selectedAgentSession.resolveThreadEngine` MUST return `"opencode"` as the engine type for that thread.

#### Scenario: OpenCode history load

- **WHEN** the app starts and reads `~/.ccgui/<provider>/threads/opencode-*.jsonl`
- **THEN** the `opencodeHistoryLoader.ts` module MUST enumerate all matching files and return a `Thread[]` list of OpenCode threads.

### Requirement: OpenCode Control Panel UI

The desktop client MUST provide an OpenCode control panel under `src/features/opencode/` (containing `OpenCodeControlPanel.tsx`, `OpenCodeProviderSection.tsx`, `OpenCodeMcpSection.tsx`, `OpenCodeSessionsSection.tsx`, `OpenCodeAdvancedSection.tsx`) and an `useOpenCodeControlPanel` hook, rendered as a dockable panel in the composer footer for the user to manage OpenCode provider, MCP, sessions, and advanced settings. The panel MUST be styled through `src/styles/opencode-panel.css`.

#### Scenario: OpenCode panel mount

- **WHEN** the user selects the OpenCode engine
- **THEN** the `OpenCodeControlPanel` component MUST be rendered in the composer footer
- **AND** the panel MUST show 4 sub-sections: Provider / MCP / Sessions / Advanced.

#### Scenario: OpenCode panel hide

- **WHEN** the user switches to a non-OpenCode engine
- **THEN** the `OpenCodeControlPanel` MUST be unmounted from the composer footer.

### Requirement: Gemini CLI Engine Detection And Version Identification

The desktop client MUST detect the Gemini CLI binary on the system PATH, parse its version, and expose it through the `EngineType::Gemini` variant of the `EngineType` enum, with a corresponding entry in the engine capability matrix and a settings toggle `AppSettings.geminiEnabled` (serialized as `geminiEnabled`). The client MUST also expose a proxy channel through `src-tauri/src/vendors/commands.rs` to mediate Gemini CLI traffic for the engine, and integrate with the `selectedAgentSession.resolveThreadEngine` switch (matching thread ID prefix `gemini:`).

#### Scenario: first-time Gemini detection

- **WHEN** the user has Gemini CLI installed
- **THEN** the client runs `gemini --version` and parses the version number
- **AND** the `EngineSelector` UI shows a "Gemini" option in the engine dropdown.

#### Scenario: Gemini session creation

- **WHEN** the user selects Gemini as the current engine and opens a new conversation
- **THEN** a new `GeminiSession` instance is created with `engine_type = EngineType::Gemini` and a corresponding `SessionKind::Gemini` entry in the session management catalog.

#### Scenario: Gemini proxy routing

- **WHEN** the user sends a message to a Gemini session
- **THEN** the message MUST flow through the `vendors::commands::gemini_proxy_*` functions
- **AND** the response stream MUST be parsed by `src-tauri/src/engine/gemini_event_parsing.rs`.

### Requirement: Gemini Session History And Persistence

The desktop client MUST persist Gemini session history to `~/.ccgui/<provider>/threads/gemini-*.jsonl` and load it through `src-tauri/src/local_usage/gemini_sessions.rs::list_local_gemini_sessions` on app startup. The history MUST be filtered by `SessionKind::Gemini` in the session management catalog projection.

#### Scenario: Gemini history enumeration

- **WHEN** the app starts and reads `~/.ccgui/<provider>/threads/gemini-*.jsonl`
- **THEN** `gemini_sessions::list_local_gemini_sessions` MUST return a `Vec<LocalSessionMeta>` of all matching files.

#### Scenario: Gemini history deletion

- **WHEN** the user requests deletion of a Gemini session
- **THEN** the corresponding `gemini-*.jsonl` file MUST be removed from disk by `session_delete.rs`.

### Requirement: OpenCode And Gemini In Capability Matrix And Scan Scripts

The desktop client MUST include OpenCode and Gemini entries in the engine capability matrix fixture (`scripts/check-engine-capability-matrix.mjs`) and the `scan-engine-name-branches.mjs` engine name detection list, with corresponding test coverage in `src/features/engine/engineCapabilityMatrix.test.ts`. The `pricingRegistry` MUST register pricing fixtures for both engines, including the `src/features/context-ledger/pricing/fixtures/opencode.ts` fixture.

#### Scenario: capability matrix coverage

- **WHEN** `node scripts/check-engine-capability-matrix.mjs` runs
- **THEN** the script MUST verify that OpenCode and Gemini have entries in the matrix
- **AND** must report 4 engines total (Codex / Claude / OpenCode / Gemini).

#### Scenario: engine name branch scan

- **WHEN** `node scripts/scan-engine-name-branches.mjs` runs
- **THEN** the scanner MUST find active `match` / `if` branches referencing `EngineType::OpenCode` or `EngineType::Gemini` across the codebase
- **AND** must report a non-zero count of branches per engine.

#### Scenario: pricing registry coverage

- **WHEN** the user sends a message through an OpenCode or Gemini session
- **THEN** `pricingRegistry.getPriceForEngine(engine, model)` MUST return a price for that engine
- **AND** the cost ledger MUST record the cost under the engine's name.

## ADDED Requirements

### Requirement: Desktop Client MUST Operate With Codex And Claude As The Only Two Engines

Effective v0.5.14, the desktop client MUST operate as a dual-engine client with `Codex` and `Claude` as the only two `EngineType` variants. The `EngineType` enum MUST be defined as `{ Codex, Claude }` (no `OpenCode`, no `Gemini`). The capability matrix fixture and `scan-engine-name-branches.mjs` MUST be hardcoded to exactly the array `["codex", "claude"]`. The `EngineSelector` UI dropdown MUST show only the Codex and Claude options, in that order. Settings toggles `opencodeEnabled` and `geminiEnabled` MUST always evaluate to `false` in the UI; their persisted values in `~/.ccgui/<provider>/config.json` MUST be ignored after v0.5.14.

#### Scenario: enum variant count

- **WHEN** a developer inspects `src-tauri/src/engine/mod.rs` for the `EngineType` enum
- **THEN** the enum MUST have exactly 2 variants: `Codex` and `Claude`
- **AND** MUST NOT contain `OpenCode` or `Gemini` variants.

#### Scenario: settings toggle always false

- **WHEN** a user with `opencodeEnabled: true` in `~/.ccgui/<provider>/config.json` upgrades to v0.5.14
- **THEN** the client MUST start without error
- **AND** the opencode-related UI affordances MUST NOT be visible
- **AND** the `opencodeEnabled` field MUST be ignored (logged once as a deprecation warning).

#### Scenario: engine selector visible options

- **WHEN** the user opens the engine dropdown in the composer
- **THEN** the dropdown MUST show exactly 2 options: "Codex" and "Claude"
- **AND** MUST NOT show "OpenCode" or "Gemini" entries.

#### Scenario: capability matrix size

- **WHEN** `node scripts/check-engine-capability-matrix.mjs` runs against v0.5.14
- **THEN** the script MUST report exactly 2 engines (Codex + Claude)
- **AND** MUST fail if any other engine name appears in the matrix.

### Requirement: EngineType Deserialization MUST Tolerate Legacy OpenCode And Gemini Strings

The `EngineType` enum MUST define a custom `Deserialize` implementation that, when encountering the legacy string values `"opencode"`, `"gemini"`, or any other unrecognized engine name, deserializes to `EngineType::Codex` (the canonical default) and emits exactly one `tracing::warn!` log per deserialization event with the original string value. The default deserialization MUST NOT panic, return an error, or block app startup. The behavior MUST be covered by unit tests for at least 3 cases: `"opencode"`, `"gemini"`, and `"unknown_engine"`.

#### Scenario: opencode string fallback

- **WHEN** a `.jsonl` file containing `{"engine": "opencode", ...}` is deserialized
- **THEN** the deserialized `EngineType` MUST be `Codex`
- **AND** a `tracing::warn!` line MUST be emitted containing the string `"opencode"`.

#### Scenario: gemini string fallback

- **WHEN** a `.jsonl` file containing `{"engine": "gemini", ...}` is deserialized
- **THEN** the deserialized `EngineType` MUST be `Codex`
- **AND** a `tracing::warn!` line MUST be emitted containing the string `"gemini"`.

#### Scenario: unknown string fallback

- **WHEN** a `.jsonl` file containing `{"engine": "future_engine_v2", ...}` is deserialized
- **THEN** the deserialized `EngineType` MUST be `Codex`
- **AND** a `tracing::warn!` line MUST be emitted containing the string `"future_engine_v2"`.

#### Scenario: codex and claude unchanged

- **WHEN** a `.jsonl` file containing `{"engine": "codex", ...}` or `{"engine": "claude", ...}` is deserialized
- **THEN** the deserialized `EngineType` MUST be `Codex` or `Claude` respectively
- **AND** NO `tracing::warn!` line MUST be emitted for those values.

### Requirement: Historical OpenCode And Gemini Session Files MUST Be Preserved On Disk With Soft-Disable Behavior

The desktop client MUST preserve all existing `~/.ccgui/<provider>/threads/opencode-*.jsonl` and `gemini-*.jsonl` files on disk across the v0.5.14 upgrade without deletion, move, or rename. The client MUST NOT enumerate, display, or process these files in any user-visible path. Specifically:

- `src/features/threads/loaders/opencodeHistoryLoader.ts::loadOpencodeHistory` MUST return an empty array `[]` without reading the disk, and MUST emit a single `console.warn` line in development mode: `"opencodeHistoryLoader: deprecated since v0.5.14, returning empty"`.
- `src-tauri/src/local_usage/gemini_sessions.rs::list_local_gemini_sessions` MUST return `Vec::new()` without reading the disk, and MUST emit a single `tracing::warn!` line: `"gemini_sessions: deprecated since v0.5.14, returning empty"`.
- The file `src/features/threads/loaders/opencodeHistoryLoader.ts` MUST be retained in the repository (not deleted) with the no-op export signature preserved, so that the `useThreadActions.historyLoaderFactory` dispatch can still import it.
- The file `src-tauri/src/local_usage/gemini_sessions.rs` MUST be retained in the repository (not deleted) with the `pub mod` declaration preserved in `local_usage.rs`.

#### Scenario: opencode history loader is no-op

- **WHEN** `loadOpencodeHistory()` is called at app startup
- **THEN** the function MUST return an empty array `[]`
- **AND** MUST NOT perform any file system read
- **AND** MUST emit a single `console.warn` line in development mode.

#### Scenario: gemini sessions list is no-op

- **WHEN** `gemini_sessions::list_local_gemini_sessions(_root)` is called at app startup
- **THEN** the function MUST return `Vec::new()`
- **AND** MUST NOT perform any file system read
- **AND** MUST emit a single `tracing::warn!` line.

#### Scenario: on-disk files preserved

- **WHEN** a user upgrades from v0.5.13 to v0.5.14 and inspects `~/.ccgui/<provider>/threads/`
- **THEN** any pre-existing `opencode-*.jsonl` and `gemini-*.jsonl` files MUST still be present on disk
- **AND** MUST be byte-for-byte identical to their v0.5.13 state.

#### Scenario: file and module preservation

- **WHEN** a developer inspects the v0.5.14 repository
- **THEN** the file `src/features/threads/loaders/opencodeHistoryLoader.ts` MUST still exist in the source tree
- **AND** `src-tauri/src/local_usage/gemini_sessions.rs` MUST still exist
- **AND** `src-tauri/src/local_usage.rs` MUST still contain the `pub mod gemini_sessions;` declaration.

### Requirement: Legacy Opencode-Pending And Gemini Thread ID Prefixes MUST Fall Back To Codex In Resolution

The `selectedAgentSession.resolveThreadEngine` function MUST include a legacy fallback branch that maps thread IDs starting with `opencode:`, `opencode-pending-`, or `gemini:` to the engine type `"codex"` (rather than returning `null` or throwing). This fallback MUST be retained in v0.5.14 and is scheduled for removal in v0.5.15. The fallback MUST be covered by a Vitest test case that asserts `resolveThreadEngine("opencode:session-1") === "codex"`, `resolveThreadEngine("opencode-pending-abc") === "codex"`, and `resolveThreadEngine("gemini:session-1") === "codex"`.

#### Scenario: opencode colon prefix

- **WHEN** `resolveThreadEngine("opencode:session-1")` is called
- **THEN** the function MUST return `"codex"`.

#### Scenario: opencode-pending prefix

- **WHEN** `resolveThreadEngine("opencode-pending-abc")` is called
- **THEN** the function MUST return `"codex"`.

#### Scenario: gemini colon prefix

- **WHEN** `resolveThreadEngine("gemini:session-1")` is called
- **THEN** the function MUST return `"codex"`.

#### Scenario: real codex and claude prefixes unchanged

- **WHEN** `resolveThreadEngine("codex-thread-123")` is called
- **THEN** the function MUST return `"codex"`.

- **WHEN** `resolveThreadEngine("claude-thread-456")` is called
- **THEN** the function MUST return `"claude"`.

### Requirement: Daemon Engine Bridge MUST Only Dispatch Codex And Claude Sessions

The `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs` module MUST dispatch engine startup to exactly 2 paths: the Codex `app-server` path and the Claude `--print` path. The module MUST NOT contain a switch arm for `EngineType::OpenCode` or `EngineType::Gemini`. Raw daemon request parsing MUST map legacy or unrecognized engine strings to `EngineType::Codex` and emit a `tracing::warn!` log that includes the original string before constructing the typed bridge request. After parsing, the typed bridge dispatch MUST only receive `EngineType::Codex` or `EngineType::Claude`. The bridge and parser MUST be covered by unit tests that exercise both dispatch paths and the raw unknown fallback path.

#### Scenario: codex dispatch

- **WHEN** the daemon receives a session start request for a Codex session
- **THEN** the engine bridge MUST dispatch the request to the `app_server_cli::start_codex_app_server` path.

#### Scenario: claude dispatch

- **WHEN** the daemon receives a session start request for a Claude session
- **THEN** the engine bridge MUST dispatch the request to the `claude::build_command` path.

#### Scenario: raw unknown engine fallback

- **WHEN** the daemon receives a session start request with `engine = "opencode_v1_legacy"` (an unknown engine value)
- **THEN** raw request parsing MUST map it to `EngineType::Codex`
- **AND** MUST emit a `tracing::warn!` line containing the original engine string.
- **AND** the typed bridge dispatch MUST use the Codex `app-server` path.

### Requirement: Capability Matrix And Pricing Registry MUST Cover Exactly Codex And Claude

The `src-tauri/src/engine/capability_matrix.rs` module MUST define capability entries for exactly 2 engines: `Codex` and `Claude`. The `scripts/check-engine-capability-matrix.mjs` script MUST hardcode the engine list as `["codex", "claude"]` and MUST fail with a non-zero exit code if any other engine name appears in the matrix. The `src/features/context-ledger/pricing/pricingRegistry.ts` MUST register pricing entries for exactly the Codex and Claude engines, and the file `src/features/context-ledger/pricing/fixtures/opencode.ts` MUST be removed from the repository. The `scan-engine-name-branches.mjs` scanner MUST NOT report any active `match` or `if` branch referencing `EngineType::OpenCode` or `EngineType::Gemini` in the production source tree (`src/**` and `src-tauri/src/**` excluding `openspec/changes/archive/**` and `docs/**`).

#### Scenario: capability matrix shape

- **WHEN** a developer inspects `src-tauri/src/engine/capability_matrix.rs`
- **THEN** the module MUST define capabilities for exactly `Codex` and `Claude` engines
- **AND** MUST NOT define any entry keyed on `OpenCode` or `Gemini`.

#### Scenario: capability matrix script exit

- **WHEN** `node scripts/check-engine-capability-matrix.mjs` runs
- **THEN** the script MUST exit with code 0
- **AND** MUST report exactly 2 engines.

#### Scenario: pricing registry shape

- **WHEN** the cost ledger records a session cost
- **THEN** the `pricingRegistry.getPriceForEngine(engine, model)` lookup MUST return a price for Codex and Claude engines
- **AND** the file `src/features/context-ledger/pricing/fixtures/opencode.ts` MUST NOT exist in the repository.

#### Scenario: scan-engine-name-branches result

- **WHEN** `node scripts/scan-engine-name-branches.mjs` runs against the v0.5.14 source tree
- **THEN** the scanner MUST report 0 active branches for `opencode` and 0 active branches for `gemini` in the production source tree
- **AND** MUST report ≥ 1 active branch for `codex` and ≥ 1 active branch for `claude`.
