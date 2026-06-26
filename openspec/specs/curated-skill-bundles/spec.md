# curated-skill-bundles Specification

## Purpose

`curated-skill-bundles` defines the client-bundled curated skill system:
version-pinned skill assets ship with the desktop app, users enable them from
Settings, and enabled skill bodies are injected into supported engine launches.
Composer UI is read-only feedback only; Settings remains the only toggle
surface.
## Requirements
### Requirement: Client MUST Bundle Curated Skills As Versioned Assets

The desktop client MUST bundle curated skills as application resources under
`src-tauri/resources/curated-skills/<skill-id>/`. Each skill directory MUST
contain `SKILL.md` and `metadata.json`. The app MUST package those resources via
`tauri.conf.json` `bundle.resources` so curated skills are available offline and
are tied to the client release version. The client MUST NOT fetch curated skill
bodies from a remote marketplace or URL at runtime.

#### Scenario: lazy-senior-dev bundled

- **WHEN** the client is built
- **THEN** the app resources MUST include `curated-skills/lazy-senior-dev/`
- **AND** that directory MUST contain `SKILL.md` and `metadata.json`
- **AND** `metadata.json` MUST declare `name`, `displayName`, `version`,
  `description`, `icon`, `category`, `tokenEstimate`, `source`, `sourceUrl`,
  and `license`.

#### Scenario: no network fetch at startup

- **WHEN** the client enumerates curated skills
- **THEN** it MUST read bundled local resources
- **AND** MUST NOT issue outbound HTTP/HTTPS requests for curated skill
  discovery or content.

### Requirement: Curated Skill Lock Entries MUST Be Validated At Compile Time

The build-time lock validator and runtime curated-skill loader MUST validate
`skills-lock.json` without relying on OS-specific shell commands or path
semantics. SHA-256 hash validation MUST use a Rust implementation that works on
Linux, macOS, and Windows. Curated `SKILL.md` assets MUST be checked out with
LF line endings so `computedHash` is stable across Windows, macOS, and Linux.
`assetPath` and `metadataPath` MUST be non-empty
repo-relative POSIX paths: absolute paths, parent directory traversal, Windows
backslash separators, and drive-prefix-like `:` values MUST be rejected before
any file read is attempted. Cargo MUST watch the repo-root `skills-lock.json`
path for rebuilds, not a stale package-local path.

#### Scenario: build validator works on Windows/macOS/Linux

- **WHEN** `cargo test` or `cargo build` runs on Windows, macOS, or Linux
- **THEN** `build.rs` MUST compute `computedHash` with Rust code
- **AND** it MUST NOT spawn `sha256sum`, `shasum`, shell, cmd.exe, or any
  other external hash utility.

#### Scenario: unsafe lock path is rejected

- **GIVEN** a curated lock entry whose `assetPath` is `../escape/SKILL.md`,
  `/tmp/SKILL.md`, `C:/tmp/SKILL.md`, or `resources\\skill\\SKILL.md`
- **WHEN** the build validator or runtime loader processes the lock
- **THEN** it MUST reject the entry with an actionable error
- **AND** it MUST NOT read outside the curated resource tree.

### Requirement: AppSettings MUST Persist Enabled Curated Skill IDs

`AppSettings` MUST include `enabled_curated_skill_ids: Vec<String>`, serialized
to the frontend as `enabledCuratedSkillIds`, and default it to an empty array.
The setting MUST persist through the normal settings core and MUST be shared
across workspaces for the same client install.
Settings normalization MUST trim, de-duplicate, and drop empty or non
kebab-case ASCII ids before persisting/restoring the field.

Curated skill id changes MUST participate in Codex restart detection because
Codex app-server `developer_instructions` are captured at launch time. Restart
is required so toggling a curated skill off does not leave stale curated skill
instructions in a long-lived app-server process.

#### Scenario: missing field defaults empty

- **WHEN** an existing config file does not contain `enabledCuratedSkillIds`
- **THEN** restore MUST succeed
- **AND** the field MUST default to an empty array.

#### Scenario: toggle persists

- **WHEN** the user enables `lazy-senior-dev`
- **THEN** `enabledCuratedSkillIds` MUST include `lazy-senior-dev`
- **AND** the value MUST be restored after app restart.

#### Scenario: curated toggle requires Codex restart

- **WHEN** `enabledCuratedSkillIds` changes
- **THEN** `app_settings_change_requires_codex_restart` MUST return true
- **AND** the next Codex app-server launch MUST use the updated curated skill
  set.

### Requirement: Curated Skills MUST Appear In Settings

Settings > Skills MUST render a `CuratedSection` above the regular skills
surface. The section MUST list bundled curated skills and expose Settings as the
only on/off surface. Each row SHOULD show icon, display name, description,
token estimate, source/license affordances where available, and a toggle.

#### Scenario: default off

- **WHEN** the client starts with no enabled curated skill ids
- **THEN** curated skills MUST be listed in Settings
- **AND** their toggles MUST be off.

#### Scenario: toggle updates app settings

- **WHEN** the user turns on `Lazy senior dev`
- **THEN** the frontend MUST call `set_curated_skill_enabled`
- **AND** update local `useAppSettings` state from the returned `AppSettings`.

#### Scenario: unknown skill rejected

- **WHEN** `set_curated_skill_enabled` receives an empty or unknown skill id
- **THEN** it MUST return an error
- **AND** MUST NOT persist the id.

### Requirement: Composer MUST Show A Read-Only Curated Skill Indicator

The composer MUST NOT provide per-message curated skill toggles, chip rows, or
pickers. When at least one curated skill is enabled, composer UI MUST render a
read-only `CuratedSkillIndicator` as a right-side accessory in
`ComposerReadinessBar` via the prop chain
`ChatInputBox -> ChatInputBoxHeader.rightAccessory ->
ComposerReadinessBar.rightAccessory`.

The indicator MUST render inside `.composer-readiness-right-accessory`, MUST use
ChatInputBox-bundled CSS for cold-start correctness, and MUST not toggle skills
directly. If clickable, it MAY navigate to Settings > Skills.

#### Scenario: hidden when none enabled

- **WHEN** no curated skills are enabled
- **THEN** the indicator MUST render nothing
- **AND** MUST leave no visible empty accessory.

#### Scenario: visible in readiness bar accessory

- **WHEN** `lazy-senior-dev` is enabled
- **THEN** `[data-testid="curated-indicator"]` MUST render inside
  `.composer-readiness-right-accessory`
- **AND** MUST NOT render as a separate input/footer chip row.

#### Scenario: Settings change reflected

- **WHEN** Settings toggles a curated skill on or off
- **THEN** the indicator MUST reflect the enabled set within its polling cadence
  without requiring a renderer reload.

### Requirement: Codex Engine MUST Append Curated Skill Bodies As Developer Instructions

Codex app-server launch args MUST include enabled curated skill bodies as a
merged `developer_instructions` config arg when curated skills are enabled and
the user has not supplied an instruction override. The merge MUST preserve
existing internal developer instructions and append a `## Curated Skills`
section containing `<skill id="...">...</skill>` blocks.

#### Scenario: empty enabled set produces no curated arg

- **WHEN** no curated skills are enabled
- **THEN** Codex args MUST not add a curated `developer_instructions` block.

#### Scenario: enabled skill is injected

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** Codex launch args MUST include a `-c developer_instructions=...`
  config value containing `<skill id="lazy-senior-dev">`.

#### Scenario: user override wins

- **WHEN** user-supplied Codex args already include `developer_instructions=` or
  `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override.

### Requirement: Claude Engine MUST Append Curated Skill Bodies As System Prompt

Claude launch construction MUST append enabled curated skill bodies through the
Claude CLI `--append-system-prompt <body>` flag. User prompt bytes MUST continue
to use the existing stdin / stream-json path.

#### Scenario: empty enabled set produces no flag

- **WHEN** no curated skills are enabled
- **THEN** Claude launch args MUST NOT include `--append-system-prompt` for
  curated skills.

#### Scenario: enabled skill is injected

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** Claude launch args MUST include `--append-system-prompt`
- **AND** the following argument MUST contain the `## Curated Skills` section and
  `<skill id="lazy-senior-dev">` block.

#### Scenario: oversized body is bounded

- **WHEN** the combined curated skill prompt body exceeds the implementation
  budget
- **THEN** it MUST be truncated safely
- **AND** the body MUST include a `claude-injection-truncated: true` marker.

### Requirement: Skills List Paths MUST Expose Curated Skill Enabled State

The Tauri command path and daemon path MUST expose curated skill entries with
`source: "curated_bundled"` and an `enabled` boolean computed from
`AppSettings.enabled_curated_skill_ids`. Non-curated skill entries MUST keep
their existing behavior and default enabled state.

#### Scenario: enabled curated entry is true

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the `lazy-senior-dev` curated skill list entry MUST have
  `enabled: true`.

#### Scenario: disabled curated entry is false

- **WHEN** `enabledCuratedSkillIds` is empty
- **THEN** the `lazy-senior-dev` curated skill list entry MUST have
  `enabled: false`.

### Requirement: Adding A New Curated Skill MUST Follow The Onboarding Checklist

New curated skill entries MUST follow `docs/curated-skill-onboarding.md` and the
archived onboarding checklist. Required checks include attribution, metadata
schema, SHA-256 lock consistency, approved license, icon format, category,
token estimate, naming collision avoidance, and a "When NOT to enable" section.

#### Scenario: invalid addition is rejected

- **WHEN** a curated skill addition violates the build-time validator rules
- **THEN** `cargo check` MUST fail before release packaging.

### Requirement: Rollback Paths MUST Be Documented

The curated skill onboarding documentation MUST document compile-time, asset,
and runtime rollback paths for emergency response.

#### Scenario: runtime soft-disable path exists

- **WHEN** curated skill activation needs to be disabled quickly
- **THEN** maintainers MUST have a documented path to keep UI/config schema
  compatible while preventing new enabled curated skill ids from taking effect.

### Requirement: Composer Shows A Read-Only Always-On Indicator In The Readiness Bar

The desktop client MUST render a read-only **always-on indicator** in the
composer readiness bar whenever at least one curated skill is enabled. The
indicator MUST be supplied by `ChatInputBox` through the generic
`ChatInputBoxHeader.rightAccessory -> ComposerReadinessBar.rightAccessory`
prop chain and MUST render inside `.composer-readiness-right-accessory`.
`ComposerReadinessBar` MUST NOT directly import the curated-skills domain.

The indicator MUST be hidden (zero visual weight) when zero curated skills are
enabled. For each enabled skill, the indicator MUST show the skill's lucide
icon and display name in a single-line chip. Long names MUST truncate instead
of wrapping, and additional enabled skills MAY collapse into a compact `+N`
overflow chip. The indicator MUST reflect the live
`AppSettings.enabledCuratedSkillIds` set within a polling cadence of 2 seconds
so toggling a skill on or off in Settings is visible to the user in the
composer without an app restart. The indicator MUST NOT provide an on/off
affordance; Settings > Skills > Curated remains the only toggle surface.

The `.composer-readiness-right-accessory` and `.curated-indicator*` CSS MUST
ship in the ChatInputBox style bundle so cold composer startup uses the same
single-line layout as the post-Settings return path.

#### Scenario: indicator hidden when no skills are enabled

- **GIVEN** `AppSettings.enabledCuratedSkillIds` is empty
- **WHEN** the user opens the composer
- **THEN** the composer MUST NOT contain any element matching
  `.curated-indicator`.

#### Scenario: indicator visible in readiness bar accessory

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user opens the composer
- **THEN** a `[data-testid="curated-indicator"]` element MUST be rendered
- **AND** the element MUST be a descendant of
  `.composer-readiness-right-accessory`
- **AND** the element MUST NOT be rendered in a
  `home-chat-curated-skill-strip` input/footer strip.

#### Scenario: indicator chip stays single-line on cold start

- **GIVEN** the user has not opened Settings in the current renderer session
- **AND** `AppSettings.enabledCuratedSkillIds` contains `lazy-senior-dev`
- **WHEN** the composer first renders the indicator
- **THEN** the chip MUST show the lucide icon and display name on one line
- **AND** long display names MUST truncate with ellipsis instead of wrapping.

#### Scenario: Settings toggle change is reflected within 2 seconds

- **GIVEN** the composer is open and the indicator is visible
- **WHEN** the user toggles a new curated skill on in `Settings > Skills`
- **THEN** within 2 seconds the indicator MUST add a chip for the newly enabled
  skill
- **AND** within 2 seconds of toggling it off, the indicator MUST remove the
  chip.

#### Scenario: readiness bar core controls remain usable

- **GIVEN** one or more curated skills are enabled
- **WHEN** the readiness bar renders the right accessory
- **THEN** mode, target, context summary, jump-to-request, and context-source
  expand controls MUST remain visible or gracefully truncated according to the
  existing readiness bar responsive rules
- **AND** the indicator MUST truncate itself before overlapping those controls.

### Requirement: Curated Skill Activation Is Always-On Per User

The engine MUST treat the set of curated skill ids in
`AppSettings.enabledCuratedSkillIds` as **always-on for every
conversation**: when an id is present, the engine MUST inject that
skill's `SKILL.md` body into the conversation's system prompt for
**every** subsequent message in **every** workspace, with no further
user action. The injection MUST be applied identically to fresh
sessions and resumed sessions. There is no per-conversation, per-turn,
or per-message opt-in / opt-out path for curated skills in this
change. Toggling a skill off (removing it from
`enabledCuratedSkillIds`) MUST cause the engine to stop injecting it
on the next conversation; the change is observed on the next CLI
launch, not retroactively on in-flight turns.

#### Scenario: enabled skill appears in every conversation's system prompt

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user starts a new conversation in any workspace
- **THEN** the engine's `--append-system-prompt` (or equivalent
  system-prompt assembly path) MUST include a `<skill id="lazy-senior-dev">…</skill>`
  block sourced from the bundled `SKILL.md`
- **AND** the block MUST be present on the first turn and on every
  subsequent turn in the same session.

#### Scenario: Codex internal developer instructions do not suppress curated skills

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **AND** the Codex app-server launch path also needs to inject an
  internal `developer_instructions` hint
- **WHEN** the desktop client builds the Codex `app-server` argv
- **THEN** it MUST produce a single merged auto-generated
  `-c developer_instructions=...` argument
- **AND** that argument MUST contain both the internal hint and the
  `## Curated Skills` block for `lazy-senior-dev`
- **AND** the presence of the internal hint MUST NOT cause the curated
  skill block to be skipped.

#### Scenario: disabled skill is not injected

- **GIVEN** `AppSettings.enabledCuratedSkillIds` does not contain
  `lazy-senior-dev`
- **WHEN** the user starts a new conversation
- **THEN** the engine MUST NOT include a `<skill id="lazy-senior-dev">`
  block in the system prompt.

#### Scenario: toggle change is observed on the next CLI launch

- **GIVEN** a session is mid-flight and the user toggles
  `lazy-senior-dev` off in Settings
- **WHEN** the user sends the next message in the same session
- **THEN** Claude-style per-turn CLI launches and Codex app-server
  replacement launches MUST both pick up the new `enabledCuratedSkillIds`
- **AND** disabling a curated skill MUST remove its `<skill id="...">`
  block from the next turn's prompt/instructions
- **AND** in-flight turns are not retroactively rewritten.

#### Scenario: Settings toggle restarts Codex app-server snapshots

- **GIVEN** `lazy-senior-dev` is enabled and a Codex app-server runtime is
  already connected
- **WHEN** the user toggles `lazy-senior-dev` off in
  `Settings > Skills > Curated`
- **THEN** the toggle IPC MUST update `AppSettings.enabledCuratedSkillIds`
  through the same restart-aware settings path as other Codex launch-affecting
  settings
- **AND** `app_settings_change_requires_codex_restart` MUST return true for
  additions, removals, or reordering of `enabledCuratedSkillIds`
- **AND** the existing Codex app-server runtime MUST be replaced so the next
  Codex turn cannot observe the stale `developer_instructions` block
- **AND** if replacement fails, the settings write MUST be rolled back and an
  actionable error returned instead of leaving UI state and runtime prompt
  state inconsistent.
