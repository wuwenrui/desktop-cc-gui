# Proposal: 2026-06-24-curated-skill-always-on-simplification

## Why

Archived change `2026-06-24-curated-skill-bundles` delivered the curated-skill
backing assets, the Settings toggle, the composer chip row + picker, and the
always-on injection into the engine `--append-system-prompt` path. After the
user tried it on the live build three follow-up decisions landed:

1. The Settings toggle **does not flip visually** when clicked.
2. The chip row / picker in the composer is a `$`-style "optional chip" UI
   surface, which conflicts with the new mental model: enabling a curated
   skill in Settings should make it **default in every conversation**, full
   stop. The composer should not have a per-message picker for these.
3. Even after the toggle is fixed, **the user has no way to tell that
   the skill is in effect** — the engine injects it into the system
   prompt silently, so "I just turned it on" / "did it actually take
   effect for the next message?" is unanswerable from the UI.

This change fixes #1, removes #2, and adds a non-intrusive read-only
indicator for #3. The always-on injection that lives in
`engine::claude::ClaudeSession::build_curated_skill_append_args` is kept
unchanged — it already matches the new model.

## What Changes

- **Lift the `AppSettings` state slot** to `CuratedSection` so that
  `useCuratedSkills` and `useCuratedSkillToggle` share a single React
  state slot. Without this lift, calling `useAppSettings()` inside each
  child hook creates two independent state slots; `setSettings` lands in
  a different slot from the one the rendering hook reads, and the
  `<Switch checked={entry.enabled}>` never flips. The contract for
  both hooks is now `({ settings.enabledCuratedSkillIds | setSettings })`
  injected from the parent.
- **Remove `CuratedSkillChipRow` and `CuratedSkillPicker`** components,
  the composer mount in `ChatInputBox.tsx`, their CSS, and their
  Vitest specs. The composer no longer carries any curated-skill UI.
- **Add a read-only composer header indicator** (`CuratedSkillIndicator`)
  mounted through `ComposerReadinessBar.rightAccessory`. It renders a
  compact single-line icon + display-name chip on the right side of the
  composer title/readiness bar, and renders nothing when zero skills are
  enabled (zero visual weight by default). Polls the backend every 2s
  (Tauri in-process IPC) for the live `enabled_curated_skill_ids` set so
  toggling in Settings is reflected in the composer without a remount.
  The chip may open `Settings > Skills` as a navigation shortcut, but it
  MUST NOT toggle a curated skill directly.
- **Keep composer indicator CSS in the ChatInputBox initial style bundle.**
  The `.curated-indicator*` rules live in
  `src/features/composer/components/ChatInputBox/styles/banners.css`, not
  in lazy Settings-only styles such as `src/styles/settings.skills.css`.
  Otherwise first app load renders browser-default button layout (icon and
  label split across two lines) until the user visits Settings.
- **Settings > Skills > Curated remains the only on/off surface.**
  Toggling a curated skill there continues to write
  `AppSettings.enabledCuratedSkillIds` via the `set_curated_skill_enabled`
  IPC, and the engine continues to inject the enabled skill bodies as
  a `<skill id="…">` block in `--append-system-prompt` for every
  conversation (no per-message opt-in).
- **Harden curated-skill boundaries for CI and cross-platform builds.**
  `build.rs` validates the lock file with a pure Rust SHA-256 implementation
  (no `sha256sum` / `shasum` process), and both build-time and runtime loaders
  reject absolute paths, `..`, Windows separators, drive-prefix-like `:`, and
  malformed `sourceUrl` values. The toggle IPC trims ids, rejects empty or
  unknown skill ids, and normalizes persisted enabled ids by trimming,
  de-duplicating, and dropping empty entries.
- **Update the change archive** so the README / docs no longer describe
  the chip row / picker as a supported surface.

## Out of Scope

- A real `$`-trigger picker (V1.1) — the chip row was a placeholder for
  this; with the always-on model it is not needed.
- Rewriting the AppSettings hook into a context-based provider. The
  per-component `useAppSettings()` pattern is the project's existing
  convention; this change fixes the curated-skill toggle by lifting
  state locally and surfaces the live state in the composer by polling
  the backend, rather than refactoring the global hook.
- Any change to backend command names, lock file format, or the
  resource bundle.
  The boundary hardening is constrained to validation of the existing fields.

## Acceptance

- `npm run typecheck` clean
- `npm run lint` clean
- `npx vitest run` clean (all 5837 tests)
- `cd src-tauri && cargo test` clean (lib 1308 + daemon 800 + integration 1)
- `openspec validate 2026-06-24-curated-skill-always-on-simplification` clean
- In Settings > Skills, clicking the switch next to "Lazy senior dev"
  visually flips the switch and persists across an app restart.
- The composer has no chip row, no `+` button, no picker popover, and
  no per-message curated-skill toggle. `Settings > Skills > Curated`
  remains the only on/off surface.
- A read-only indicator appears in the composer title/readiness bar's
  right side **only when** at least one curated skill is enabled,
  showing each visible skill's lucide icon and display name on one line
  (for example `Lazy senior dev`). Long names truncate instead of
  wrapping; overflow is represented by a compact `+N` chip. Toggling a
  skill on or off in Settings is reflected in the indicator within 2
  seconds.
- On a cold app start, before the user opens Settings, the same indicator
  layout MUST already be single-line. Visiting Settings and returning to
  the composer MUST NOT be required for the correct CSS to load.
- Builds MUST pass on Linux, macOS, and Windows without relying on external
  hash utilities being present. Curated lock paths MUST remain repo-relative
  POSIX paths, and malformed optional `sourceUrl` values MUST be hidden rather
  than serialized to the frontend as `null` or unsafe links.

## Risk

- **Low** for the toggle fix: same `set_curated_skill_enabled` IPC, same
  field in `AppSettings`, just a lifted state pattern.
- **Low** for the chip row removal: the components were internal and
  only mounted in `ChatInputBox`; removing the mount plus the
  components and their tests is a clean delete. The CSS block is
  removed in one pass and verified not to be referenced elsewhere.
- **Low** for the indicator: a polled IPC every 2s is in-process and
  cheap; the only consumer-visible change is a title-bar chip that
  appears/disappears based on `enabled_curated_skill_ids`. A failed
  poll is silently retried on the next tick. The main UI risk is CSS
  load order, so the indicator styles are kept in the ChatInputBox
  bundle instead of Settings-only CSS.
- **Medium avoided by review** for cross-platform CI: an external shell hash
  command in `build.rs` would be OS/toolchain dependent, so the validator uses
  Rust `sha2` directly and is covered by Rust tests.

## Rollback

- Revert the commits in `2026-06-24-curated-skill-always-on-simplification`.
- The backend injection (already always-on) is untouched, so toggling
  off in Settings and reverting restores the pre-change behavior.
