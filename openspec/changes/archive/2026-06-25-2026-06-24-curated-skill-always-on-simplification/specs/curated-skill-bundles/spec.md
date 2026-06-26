# curated-skill-bundles Spec Delta

## MODIFIED Requirements

### Requirement: Composer Shows A Read-Only Always-On Indicator In The Readiness Bar

The desktop client MUST render a read-only **always-on indicator** in
the composer title/readiness bar's right side whenever at least one
curated skill is enabled. The indicator MUST be mounted through the
`ComposerReadinessBar.rightAccessory` surface (or an equivalent header
right-accessory surface), not as a row between the editor and footer.
The indicator MUST be hidden (zero visual weight) when zero curated
skills are enabled. For each visible enabled skill, the indicator MUST
show the skill's lucide icon and display name on a single line (e.g.
`Lazy senior dev`); long names MUST truncate instead of wrapping, and
overflow MUST be represented by a compact `+N` chip. The indicator MUST
reflect the live `AppSettings.enabledCuratedSkillIds` set within a
polling cadence of 2 seconds so toggling a skill on or off in Settings
is visible to the user in the composer without an app restart. The
indicator MAY navigate to `Settings > Skills`, but it MUST NOT expose
an on/off affordance — the toggle surface is the Settings > Skills >
Curated switch.

#### Scenario: indicator hidden when no skills are enabled

- **GIVEN** `AppSettings.enabledCuratedSkillIds` is empty
- **WHEN** the user opens the composer
- **THEN** the composer MUST NOT contain any element matching
  `.curated-indicator` (the indicator is not rendered at all).

#### Scenario: indicator visible when one or more skills are enabled

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user opens the composer
- **THEN** a `[data-testid="curated-indicator"]` element MUST be
  rendered
- **AND** it MUST be contained by the composer readiness/header right
  accessory (for example `.composer-readiness-right-accessory`)
- **AND** the element MUST contain a child
  `[data-testid="curated-indicator-chip-lazy-senior-dev"]` whose
  textContent includes "Lazy senior dev"
- **AND** the chip MUST stay on one line; its icon and name MUST NOT
  wrap into separate rows on cold app start.

#### Scenario: Settings toggle change is reflected within 2 seconds

- **GIVEN** the composer is open and the indicator is visible
- **WHEN** the user toggles a new curated skill on in
  `Settings > Skills`
- **THEN** within 2 seconds the indicator MUST add a chip for the
  newly enabled skill
- **AND** within 2 seconds of toggling it off, the indicator MUST
  remove the chip.

#### Scenario: indicator polling test does not create heavy-test noise

- **WHEN** `CuratedSkillIndicator` polling behavior is tested
- **THEN** the test MUST use deterministic fake timers or an equivalent
  controlled clock
- **AND** it MUST NOT wait for a real 2-second interval or emit
  React `act(...)` warnings.

#### Scenario: indicator CSS is available before Settings loads

- **GIVEN** the app opens directly to the composer with
  `lazy-senior-dev` enabled
- **AND** the user has not opened Settings during this app lifetime
- **WHEN** `CuratedSkillIndicator` first renders
- **THEN** the `.curated-indicator*` layout rules MUST already be
  available from the ChatInputBox style bundle
- **AND** the indicator MUST render as a single title-bar line without
  requiring a Settings-page visit.

## ADDED Requirements

### Requirement: Settings > Skills > Curated Surfaces An Optional Upstream Source Link

When a curated skill's `metadata.json` declares a `sourceUrl` field
that resolves to an absolute `http://` or `https://` URL, the
desktop client MUST render an inline **"View on GitHub"** link in the
per-row title strip, immediately to the right of the category pill.
The link MUST open the URL in the system browser using
`target="_blank" rel="noopener noreferrer"`, MUST be tagged with
`data-testid="curated-row-source-<name>"` so it can be exercised in
tests, and MUST surface both a visible label and an `aria-label`
(derived from `common.curatedViewOnGithub` / `common.curatedViewOnGithubAria`)
so screen readers can announce the destination. When the field is
absent, malformed (non-absolute URL, wrong scheme), or set to an
empty string, the link MUST NOT be rendered at all (rather than
rendering a broken anchor). The text of the link is taken from the
`common.curatedViewOnGithub` i18n key and the `common.curatedSectionTitle`
i18n key (or its English fallback) is the section heading; both
have full coverage in `en.part1.base.ts` and `zh.part1.ts`.

#### Scenario: row renders a GitHub link when sourceUrl is present

- **GIVEN** a curated skill with `sourceUrl = "https://github.com/DietrichGebert/ponytail"`
- **WHEN** `CuratedSection` renders the row for that skill
- **THEN** the row MUST contain a
  `[data-testid="curated-row-source-<name>"]` element
- **AND** the element's `tagName` MUST be `A`
- **AND** its `href` MUST equal the configured `sourceUrl`
- **AND** its `target` MUST be `_blank` and `rel` MUST include
  `noopener noreferrer`.

#### Scenario: row hides the GitHub link when sourceUrl is absent

- **GIVEN** a curated skill whose `metadata.json` does not declare
  `sourceUrl` (or declares a non-http(s) value)
- **WHEN** `CuratedSection` renders the row for that skill
- **THEN** the row MUST NOT contain any element with the
  `[data-testid="curated-row-source-<name>"]` attribute
- **AND** the rest of the row (icon, name, category, description,
  meta) MUST still render as before.

#### Scenario: malformed sourceUrl is omitted from IPC payload

- **GIVEN** a curated skill metadata file declares `sourceUrl = "https://"`
  or another value without an http(s) host
- **WHEN** `get_curated_skills` serializes the skill
- **THEN** the returned JSON MUST omit `sourceUrl`
- **AND** it MUST NOT return `sourceUrl: null`
- **AND** the Settings row MUST hide the upstream link.

## ADDED Requirements

### Requirement: Settings > Skills > Curated Is The Only Toggle Surface For A Curated Skill

The desktop client MUST expose **exactly one** UI surface for toggling
whether a curated skill is enabled for the user: a `<Switch>` rendered
inside the existing `CuratedSection` in **Settings > Skills**. The
composer (input area) MAY render a read-only always-on indicator, but
MUST NOT render a chip row, a "+" button, or a picker popover for
curated skills; the toggle has no per-message opt-in/out path. Toggling
a curated skill in `CuratedSection` MUST write
`AppSettings.enabledCuratedSkillIds` via the
`set_curated_skill_enabled` IPC and the engine MUST treat the result
as **always-on** for every conversation (see
`curated-skill-bundles > Always-On Activation`).

#### Scenario: composer has no chip row, no "+" button, no picker

- **WHEN** the user opens the composer (chat input area) on any
  workspace
- **THEN** the composer MUST NOT contain any element matching
  `.curated-chip-row`, `.curated-chip-row-add`, or `.curated-picker`
- **AND** the composer MUST NOT import or render `CuratedSkillChipRow`
  or `CuratedSkillPicker` (verified by absence of those symbols from
  `ChatInputBox.tsx`).

#### Scenario: Settings > Skills > Curated switch flips and persists

- **WHEN** the user clicks the `<Switch>` next to a curated skill in
  `CuratedSection` (e.g. "Lazy senior dev")
- **THEN** the switch MUST visually flip to the new `checked` state
  in the same render tick
- **AND** the new state MUST persist to disk (round-trip
  `get_app_settings` returns the new `enabledCuratedSkillIds`)
- **AND** the switch MUST survive an app restart.

#### Scenario: settings read and toggle write share a React state slot

- **WHEN** `CuratedSection` renders
- **THEN** `useCuratedSkills` and `useCuratedSkillToggle` MUST both
  read from / write to the same `useAppSettings()` instance, so a
  successful `setEnabled` call results in the next render reading the
  new `enabledCuratedSkillIds`. The two hooks MUST NOT each call
  `useAppSettings()` independently.

#### Scenario: toggle IPC rejects invalid curated skill ids

- **WHEN** `set_curated_skill_enabled` receives an empty, whitespace-only,
  non-kebab-case ASCII, path-like, or unknown `skillId`
- **THEN** the command MUST return an error and MUST NOT persist that id
  into `AppSettings.enabledCuratedSkillIds`
- **AND** existing persisted ids MUST be normalized by trimming,
  de-duplicating, and dropping empty or invalid entries before the command
  writes the updated settings.

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Curated Skill Lock Entries MUST Be Validated At Compile Time

The build-time lock validator and runtime curated-skill loader MUST validate
`skills-lock.json` without relying on OS-specific shell commands or path
semantics. SHA-256 hash validation MUST use a Rust implementation that works on
Linux, macOS, and Windows. `assetPath` and `metadataPath` MUST be non-empty
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
