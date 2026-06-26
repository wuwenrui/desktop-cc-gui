# Spec Delta: curated-skill-bundles

## ADDED Requirements

### Requirement: Client MUST Bundle Curated Skills As Versioned Assets

The desktop client MUST bundle a versioned set of curated skills as application resources under `src-tauri/resources/curated-skills/<skill-id>/`, where each directory contains a `SKILL.md` body file and a `metadata.json` descriptor. The bundle MUST be packed into the application binary via `tauri.conf.json` `bundle.resources` (object schema: `{ "glob": "destination-dir" }`) so that the curated skills are available offline, without network access, and are tied to the client release version. The client MUST NOT fetch curated skills from a remote marketplace or URL at runtime.

#### Scenario: lazy-senior-dev bundled at v0.5.14

- **WHEN** the client is built and started from version `0.5.14` or later
- **THEN** `app.path().resource_dir()` MUST contain a `curated-skills/lazy-senior-dev/` directory
- **AND** the directory MUST contain a valid `SKILL.md` and `metadata.json`
- **AND** the `metadata.json` MUST declare `name = "lazy-senior-dev"`, `version`, `displayName`, `description`, `icon` (kebab-case ASCII), `category` (one of MVP-4: `code-style | ui-design | review | debug`), `tokenEstimate`, `source`, and `license` (one of `MIT | Apache-2.0 | BSD-2-Clause | BSD-3-Clause | ISC`; MPL-2.0 is excluded in v0.5.14) fields.

#### Scenario: no network fetch at startup

- **WHEN** the client scans the curated skills at startup
- **THEN** the client MUST NOT issue any outbound HTTP/HTTPS request related to curated skill discovery or content loading
- **AND** the Network panel / log MUST show zero requests to remote hosts during curated skill enumeration.

### Requirement: Curated Skill Lock Entries In `skills-lock.json` MUST Be Validated At Compile Time

The existing top-level `skills-lock.json` MUST be extended to version `2`, where every entry declares a `kind` field with value `"bundled"` (existing 9 `vercel-labs/agent-skills` / `huashu-design` entries) or `"curated"` (new curated skills). The `src-tauri/build.rs` build script MUST recompute the SHA-256 hash of every `kind == "curated"` entry's `assetPath` at compile time and `compile_error!` if any `computedHash` does not match, or if any `metadata.json` field is missing or `license` is not in the approved whitelist, or if `icon` contains non-ASCII characters, or if `assetPath` contains `..` or is an absolute path. Entries with `kind == "bundled"` or no `kind` field MUST be skipped by the validator (these are placeholders for the next change to handle). The build script MUST declare `cargo:rerun-if-changed` for `src-tauri/resources/curated-skills` and `skills-lock.json` only, so unrelated `cargo check` invocations are not invalidated.

#### Scenario: hash mismatch fails the build

- **WHEN** the contents of `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md` are modified
- **AND** the `skills-lock.json` `computedHash` for `lazy-senior-dev` is not updated to match the new SHA-256
- **THEN** `cargo check --manifest-path src-tauri/Cargo.toml` MUST fail with stderr containing `curated skill lock hash mismatch for lazy-senior-dev`
- **AND** MUST include the expected and the actual SHA-256 hash.

#### Scenario: bundled entry hash mismatch does not fail the build

- **WHEN** an entry with `kind == "bundled"` (e.g. `deploy-to-vercel`) has a `computedHash` that does not match the (placeholder) on-disk asset
- **THEN** `cargo check` MUST succeed
- **AND** the build MUST NOT emit a hash-mismatch error for the `bundled` entry.

#### Scenario: stale lock blocks release

- **WHEN** the lock file is committed with a `computedHash` for a `curated` entry that does not match the on-disk asset
- **THEN** `cargo build --release --manifest-path src-tauri/Cargo.toml` MUST fail with the same `compile_error!` message
- **AND** the release pipeline MUST NOT produce a signed artifact for the affected platform.

#### Scenario: metadata license out of whitelist

- **WHEN** a `curated` entry's `metadata.json` declares `license = "Proprietary"` or `license = "MPL-2.0"`
- **THEN** `cargo check` MUST fail with a build error naming the offending skill and the whitelist of allowed licenses (excluding MPL-2.0 in v0.5.14).

#### Scenario: icon must be kebab-case ASCII

- **WHEN** a `curated` entry's `metadata.json` declares `"icon": "🚀"` or `"icon": "Sparkles"` (PascalCase)
- **THEN** `cargo check` MUST fail with a build error stating that the icon must be kebab-case ASCII (e.g. `sparkles`).

### Requirement: `AppSettings.enabled_curated_skill_ids` MUST Persist And Not Trigger Codex Restart

The `AppSettings` struct MUST gain a new field `enabled_curated_skill_ids: Vec<String>` (serialized as `enabledCuratedSkillIds`) that defaults to an empty array. The field MUST be persisted to the provider-home config file (`~/.ccgui/<provider-home>/config.json`) and MUST be shared across all workspaces and all sessions for the same client install. The field MUST NOT be added to the field set checked by `app_settings_change_requires_codex_restart` (defined in `src-tauri/src/shared/settings_core.rs`); a change to `enabled_curated_skill_ids` MUST NOT cause any running Codex session to be restarted.

#### Scenario: toggle does not trigger restart

- **WHEN** a user has an active Codex session running
- **AND** the user toggles a curated skill on via the `set_curated_skill_enabled` IPC
- **THEN** the Codex session's process MUST NOT be killed and respawned
- **AND** the Codex session's next prompt (after the toggle) MUST use the new `enabled_curated_skill_ids` set when constructing its `developer_instructions` config arg.

#### Scenario: missing field is not an error

- **WHEN** the persisted `config.json` does not contain the `enabledCuratedSkillIds` field (e.g. upgraded from a pre-v0.5.14 config)
- **THEN** the client MUST default the field to an empty array
- **AND** MUST NOT log an error or panic.

#### Scenario: persist across restart

- **WHEN** the user enables `lazy-senior-dev` in workspace A
- **AND** then quits the client
- **AND** restarts the client
- **THEN** the `AppSettings.enabled_curated_skill_ids` array MUST contain `"lazy-senior-dev"`
- **AND** the toggle in the `Curated` section MUST render in the on state.

#### Scenario: shared across workspaces

- **WHEN** the user enables `lazy-senior-dev` in workspace A
- **AND** switches to workspace B
- **THEN** workspace B MUST show `lazy-senior-dev` as enabled in both the `Curated` section and the chip row.

### Requirement: Curated Skills MUST Appear In The Settings View Above The Project Skills Section

The `Settings` view, when the user navigates to the Skills section, MUST render a new `CuratedSection` component above the existing `SkillsSection` component (the `SkillsSection` MUST continue to render unchanged). The `CuratedSection` MUST display every curated skill returned by `useSkills` whose `source` field equals `"curated_bundled"`. Each row MUST show the `displayName`, the `description` (truncated to two lines), the lucide-react icon (loaded via `import <Icon> from "lucide-react/dist/esm/icons/<icon>"` where `<icon>` is the kebab-case metadata value), the `tokenEstimate` formatted as `≈<value>K tokens`, and a per-row toggle control. The section header MUST display `Curated` and a one-line source note that explains `客户端内置, 发版打包, 零网络`. All curated skill toggles MUST default to off. Toggling a curated skill MUST call the `set_curated_skill_enabled` IPC; the IPC MUST return a new `AppSettings` value; the frontend MUST update its `useAppSettings` state from the returned value (no new Tauri event is introduced).

#### Scenario: defaults are off

- **WHEN** the client starts for the first time on a workspace
- **THEN** the `Curated` section MUST list every bundled curated skill
- **AND** every curated skill toggle MUST be in the off state.

#### Scenario: toggle on persists

- **WHEN** the user turns the `Lazy senior dev` toggle on in the Curated section
- **THEN** the `set_curated_skill_enabled` IPC MUST be invoked with `("lazy-senior-dev", true)`
- **AND** the `AppSettings.enabled_curated_skill_ids` array MUST contain `"lazy-senior-dev"`
- **AND** after restarting the client, the toggle MUST be restored to on.

#### Scenario: SkillsSection is unchanged

- **WHEN** the Curated section is rendered above SkillsSection
- **THEN** the `SkillsSection` component (`src/features/settings/components/SkillsSection.tsx`) MUST NOT be modified
- **AND** MUST continue to render the existing 12 source buckets (`workspace_managed`, `project_claude`, `project_codex`, `project_agents`, `project_gemini`, `custom`, `global_claude`, `global_claude_plugin`, `global_codex`, `global_agents`, `global_gemini`, and now `curated_bundled` if not filtered out).

### Requirement: Composer MUST Show A Curated Skill Chip Row Below The Input

The composer (the text input area used to send messages to the agent) MUST render a `CuratedSkillChipRow` component between the input element and the send button. The chip row MUST display one chip per currently enabled curated skill (read from `useAppSettings().settings.enabledCuratedSkillIds`). Each chip MUST show the lucide-react icon and the `displayName`, and on hover MUST show a tooltip containing the `tokenEstimate` and the note `下次发送生效`. The right side of the chip row MUST show a `+` button that opens the `CuratedSkillPicker` popover. When no curated skill is enabled, the chip row MUST render nothing (zero visual weight). Changing a toggle inside the picker MUST update the chip row in the same render frame (synchronous re-read after IPC acknowledgement).

#### Scenario: empty state renders nothing

- **WHEN** `AppSettings.enabled_curated_skill_ids` is empty
- **THEN** the chip row component MUST NOT render any DOM element
- **AND** MUST NOT introduce any vertical space below the input.

#### Scenario: chip appears after enable

- **WHEN** the user enables `Lazy senior dev` from the picker
- **THEN** the chip row MUST render one chip with the `sparkles` icon and the text `Lazy senior dev`
- **AND** hovering the chip MUST show a tooltip with text matching the regex `Lazy senior dev.*\\d+(\\.\\d+)?K tokens.*下次发送生效`.

#### Scenario: chip disappears after disable

- **WHEN** the user disables a previously enabled curated skill
- **THEN** the corresponding chip MUST be removed from the chip row
- **AND** the chip row MUST NOT be left in a broken state (e.g. trailing separator or extra padding).

### Requirement: Codex Engine MUST Append Curated Skill Bodies As A `developer_instructions` Config Arg

The Codex engine's `build_codex_app_server_args` function (in `src-tauri/src/backend/app_server_cli.rs`) MUST, after parsing the user-supplied `codex_args`, append an additional `-c developer_instructions="<merged>"` config arg constructed from the enabled curated skill bodies when (and only when) all of the following hold: `AppSettings.enabled_curated_skill_ids` is non-empty; the user-supplied `codex_args` does NOT already contain a `developer_instructions=` (or `instructions=`) override (detected by `codex_args_contain_instruction_override`); the merged value was TOML-escaped via the existing `encode_toml_string` helper. The merge MUST follow the same pattern as `merge_developer_instructions` in `src-tauri/src/codex/collaboration_policy.rs` — append the `## Curated Skills` section after any existing developer instructions. The arg MUST be inserted before the final `app-server` arg, NOT replacing or reordering any other arg.

#### Scenario: empty enabled set produces no extra arg

- **WHEN** `AppSettings.enabled_curated_skill_ids` is empty
- **THEN** `build_codex_app_server_args` MUST return an args list byte-identical to the baseline (v0.5.13) with no `-c developer_instructions=` for curated skills.

#### Scenario: one enabled skill appears as developer_instructions arg

- **WHEN** `enabled_curated_skill_ids = ["lazy-senior-dev"]`
- **AND** the user's `codex_args` is `None` or does not contain `developer_instructions=`
- **THEN** the returned args MUST contain a `-c` arg followed by `developer_instructions="..."`
- **AND** the value MUST contain exactly one `<skill id="lazy-senior-dev" version="4.8.1" source="upstream: DietrichGebert/ponytail v4.8.1">` opening tag
- **AND** the value MUST contain the full body of `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md` between the opening and closing `</skill>` tags
- **AND** the arg MUST be positioned before the final `app-server` arg.

#### Scenario: user override wins

- **WHEN** the user's `codex_args` already contains `-c developer_instructions="my custom instructions"`
- **THEN** the curated skills `-c developer_instructions=...` arg MUST NOT be appended
- **AND** the user's existing arg MUST remain unchanged.

#### Scenario: TOML escaping preserves special characters

- **WHEN** a curated skill body contains a newline, a double quote, or a backslash
- **THEN** the resulting `developer_instructions="..."` value MUST be valid TOML (parseable by a TOML parser)
- **AND** after TOML un-escaping, the original body MUST be recoverable byte-for-byte.

### Requirement: Claude Engine MUST Append Curated Skill Bodies As An Append-System-Prompt-File Flag

The Claude engine's `build_command` function (in `src-tauri/src/engine/claude.rs`) MUST, when `AppSettings.enabled_curated_skill_ids` is non-empty, write a temporary file containing the merged curated skill bodies (with a `## Curated Skills` section) to `std::env::temp_dir()` with a filename matching `ccgui-curated-<workspace_id>-<unix_timestamp_ms>.md`, open the file with `OpenOptions::new().create_new(true)` (failing if the file already exists), and pass `--append-system-prompt-file <temp_path>` as additional args to the `claude` subprocess invocation. The temp file path MUST be unique per (workspace, invocation) and MUST NOT collide with another concurrent invocation. When `enabled_curated_skill_ids` is empty, no temp file MUST be created and no flag MUST be added.

#### Scenario: empty enabled set produces no temp file

- **WHEN** `AppSettings.enabled_curated_skill_ids` is empty
- **THEN** `build_command` MUST NOT invoke any temp file creation
- **AND** the returned `Command` MUST NOT include `--append-system-prompt-file`.

#### Scenario: one enabled skill creates temp file and flag

- **WHEN** `enabled_curated_skill_ids = ["lazy-senior-dev"]`
- **THEN** a temp file at `std::env::temp_dir()/ccgui-curated-<workspace_id>-<ts>.md` MUST exist
- **AND** the file body MUST contain the `## Curated Skills` section and the `<skill id="lazy-senior-dev" ...> ... </skill>` block
- **AND** the `Command` argv MUST contain `--append-system-prompt-file` followed by that temp file path
- **AND** the temp file MUST be created with `create_new(true)` semantics (refusing to overwrite an existing file).

#### Scenario: Claude CLI flag compatibility

- **WHEN** a `tauri dev` startup is performed and the `claude` CLI subprocess is spawned
- **THEN** the spawned argv MUST include the `--append-system-prompt-file <path>` flag
- **AND** if the `claude` CLI rejects the flag (e.g. exits with a "unknown flag" error), the `metadata.json` for that curated skill MUST be annotated with `"claude-injection-unsupported": true`
- **AND** the Claude engine MUST NOT add the flag for that skill in subsequent invocations.

#### Scenario: user prompt bytes remain in stdin

- **WHEN** the Claude engine spawns a subprocess with the curated skill temp file
- **THEN** the user prompt text MUST continue to be sent via `--input-format stream-json` over stdin
- **AND** MUST NOT be placed in the argv.

### Requirement: Daemon Binary Path MUST Return Skill Lists Consistent With Tauri Command Path

The `cc_gui_daemon` binary's `skills_list` handler (in `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`) MUST produce skill list responses that are field-compatible with the Tauri command path's `skills_list_local_core` output, in particular: every entry MUST include an `enabled` boolean field, computed from the daemon's own `AppSettings.enabled_curated_skill_ids` for `source == "curated_bundled"` entries (defaulting to `true` for all other source entries); and the daemon MUST NOT silently drop the `enabled` field on the fallback path that calls `codex_core::skills_list_core`. The two paths MUST agree on the `enabled` value for every skill name when given the same `AppSettings` and the same workspace.

#### Scenario: daemon and Tauri paths agree on enabled

- **WHEN** the same `AppSettings.enabled_curated_skill_ids = ["lazy-senior-dev"]` is set
- **AND** the same workspace has 1 `curated_bundled` entry (`lazy-senior-dev`) and 1 `project_codex` entry
- **THEN** the daemon `skills_list` response MUST include both entries
- **AND** the `lazy-senior-dev` entry MUST have `enabled: true`
- **AND** the `project_codex` entry MUST have `enabled: true`
- **AND** the Tauri command path `skills_list_local_core` output MUST contain the same two entries with the same `enabled` values.

#### Scenario: disabled curated entry is disabled in daemon response

- **WHEN** `AppSettings.enabled_curated_skill_ids` is empty
- **THEN** any `curated_bundled` entry in the daemon `skills_list` response MUST have `enabled: false`
- **AND** non-curated entries MUST have `enabled: true`.

### Requirement: Adding A New Curated Skill MUST Follow The Onboarding Checklist

A pull request that adds a new curated skill entry with `kind: "curated"` to `skills-lock.json` MUST satisfy all of the following, enforced by code review against `docs/curated-skill-onboarding.md` and (where automated) by the `src-tauri/build.rs` lock validator: the asset directory name MUST equal the `metadata.json` `name` field in kebab-case; `metadata.json` MUST contain all required fields (`name`, `displayName`, `version`, `description`, `icon`, `category`, `tokenEstimate`, `source`, `license`); `license` MUST be in the approved whitelist (`MIT | Apache-2.0 | BSD-2-Clause | BSD-3-Clause | ISC`; MPL-2.0 is excluded in v0.5.14); `icon` MUST be kebab-case ASCII (e.g. `sparkles`, `file-text`); `category` MUST be one of MVP-4 (`code-style | ui-design | review | debug`); `tokenEstimate` MUST be ≤ 3000; the `SKILL.md` MUST contain an attribution comment at the top referencing the upstream source and license; the skill id MUST NOT collide with any existing entry in `skills-lock.json`; and the `SKILL.md` MUST contain a "何时不启用 / When NOT to enable" section explaining the skill's anti-patterns.

#### Scenario: invalid license rejected at build

- **WHEN** a new curated skill declares `license = "Proprietary"` or `license = "MPL-2.0"`
- **THEN** `cargo check` MUST fail with a build error naming the offending skill and the whitelist of allowed licenses (excluding MPL-2.0 in v0.5.14).

#### Scenario: token estimate over 3000 rejected at build

- **WHEN** a new curated skill declares `tokenEstimate = 5000`
- **THEN** `cargo check` MUST fail with a build error stating the 3000 token ceiling.

#### Scenario: naming collision rejected

- **WHEN** a new curated skill entry id is `lazy-senior-dev` and that id already exists in `skills-lock.json`
- **THEN** the build script MUST fail with a build error naming the colliding id.

### Requirement: Curated Skill Picker MUST Surface Total Token Estimate And Warn Above 5000

The `CuratedSkillPicker` popover MUST display a status bar at the top showing `已加载 X / Y tokens, 上限 8000` where `X` is the sum of `tokenEstimate` of all currently enabled curated skills, `Y` is the same value formatted. When the sum exceeds 5000 tokens, the status bar MUST render with an amber warning style; when it exceeds 8000 tokens, the picker MUST block further enable actions and display an inline error explaining that the system prompt context budget would be exceeded.

#### Scenario: under 5000 tokens

- **WHEN** the user has enabled `lazy-senior-dev` (1100 tokens)
- **THEN** the status bar MUST show `已加载 1100 / 1100 tokens, 上限 8000`
- **AND** MUST NOT show any warning style.

#### Scenario: amber warning above 5000

- **WHEN** the user enables a second curated skill whose `tokenEstimate` brings the total to 5500
- **THEN** the status bar MUST show `已加载 5500 / 5500 tokens, 上限 8000`
- **AND** MUST render with the amber warning style class.

#### Scenario: block above 8000

- **WHEN** the user attempts to enable a third curated skill whose `tokenEstimate` would bring the total to 9000
- **THEN** the picker MUST NOT call `set_curated_skill_enabled` with `enabled = true`
- **AND** MUST display an inline error near the offending row explaining that the 8000 token ceiling would be exceeded.

### Requirement: Rollback Paths MUST Be Documented

The `docs/curated-skill-onboarding.md` file MUST document three independent rollback paths for emergency response: (a) **compile-time rollback**: temporarily change `compile_error!` in `src-tauri/build.rs` to `compile_warn!`, allowing release with a stale curated skill lock; (b) **asset rollback**: remove the `resources/curated-skills/**/*` and `../skills-lock.json` mappings from `tauri.conf.json` `bundle.resources` AND remove every `kind: "curated"` entry from `skills-lock.json`, producing a release that ships without curated skills; (c) **runtime rollback**: keep the `AppSettings.enabled_curated_skill_ids` field, but add a feature flag in `set_curated_skill_enabled` that returns success without writing the field, achieving a soft kill-switch where the toggle UI remains visible but does nothing.

#### Scenario: rollback (a) is reversible

- **WHEN** the `compile_error!` is changed to `compile_warn!` in `src-tauri/build.rs`
- **THEN** `cargo build --release` MUST succeed even with a stale `computedHash` for a `curated` entry
- **AND** a follow-up change MUST revert the `compile_warn!` back to `compile_error!` to restore the lock validation.

#### Scenario: rollback (b) produces a clean release

- **WHEN** `bundle.resources` no longer contains the curated-skills glob
- **AND** `skills-lock.json` no longer contains any `kind: "curated"` entry
- **THEN** the released binary MUST NOT contain a `curated-skills/` resource directory
- **AND** the `Curated` section in the settings view MUST render as empty.

#### Scenario: rollback (c) is a soft kill-switch

- **WHEN** the runtime feature flag is set to disable `set_curated_skill_enabled` writes
- **THEN** the IPC MUST return success
- **AND** the `AppSettings.enabled_curated_skill_ids` field MUST remain unchanged
- **AND** the toggle UI in the chip row and the `Curated` section MUST continue to render
- **AND** the next LLM call's Codex/Claude injection MUST use the unchanged (empty or stale) enabled set.
