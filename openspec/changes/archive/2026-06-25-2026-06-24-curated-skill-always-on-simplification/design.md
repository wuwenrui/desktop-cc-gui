# Design: 2026-06-24-curated-skill-always-on-simplification

## Root cause: the toggle does not flip

`useAppSettings` is a plain `useState` inside
`src/features/settings/hooks/useAppSettings.ts` (no React context, no
external store). Every call site gets its own independent state slot.

In the pre-change `CuratedSection`, both `useCuratedSkills()` and
`useCuratedSkillToggle()` called `useAppSettings()` themselves. They
landed on two different slots in the same component's hook list:

- slot 1: `useCuratedSkills` → `useAppSettings` → `useState` (settings A)
- slot 2: `useCuratedSkillToggle` → `useAppSettings` → `useState` (settings B)

When the user clicks the switch:

1. `useCuratedSkillToggle.setEnabled` calls the `set_curated_skill_enabled`
   IPC, which writes the new `AppSettings` to disk and returns it.
2. `useCuratedSkillToggle` calls `setSettings(next)` on **settings B**.
3. `useCuratedSkills` re-renders because its parent re-rendered, but
   `settings.enabledCuratedSkillIds` it reads is from **settings A** —
   unchanged.
4. `decorated` still has `enabled: false`; the `<Switch checked={...}>`
   stays off.

Backend write was correct; the UI just never saw the new flag.

## Fix: lift the state slot

`CuratedSection` is the only place that needs both the read and the
write side. We lift `useAppSettings()` into `CuratedSection` itself and
inject the two values into the two child hooks:

```ts
const { settings, setSettings } = useAppSettings();
const { skills, loading, error, refresh } = useCuratedSkills({
  enabledCuratedSkillIds: settings.enabledCuratedSkillIds,
});
const { setEnabled, pendingId, error: toggleError } =
  useCuratedSkillToggle({ setSettings });
```

Both child hooks then read from / write to the same React state slot.
After the IPC round-trip, the read path sees the new
`enabledCuratedSkillIds`, the `decorated` memo recomputes, and the
switch flips.

## Removing the chip row + picker

The chip row + picker were the v0.5.14 placeholder for a future `$`
trigger. The user's new mental model is: "toggling on in Settings =
this skill is in every conversation's system prompt." That makes the
chip row redundant — the chip is a UI representation of state that the
user has already committed to globally — and the picker redundant —
the toggle surface is now in Settings.

The backend side (`build_curated_skill_append_args`) was already always-on
in the archived change; it filters by `enabled_curated_skill_ids` and
injects the body for every conversation. Nothing on the backend changes
here.

The removal is a clean delete: the two components were only mounted in
`ChatInputBox`, their CSS is a contiguous block in
`settings.skills.css` (lines 681..868 pre-change), and their Vitest
specs are isolated. The only place the chip row's mocks bled into
another test file was `ChatInputBox.incrementalUndoRedo.smoke.test.tsx`,
which has a comment-only reference plus two stubs that became dead code
once the chip row was gone; we deleted both stubs in this change.

## Composer indicator placement

The always-on indicator is not a second composer toolbar and not a
message-scoped chip surface. It is mounted through
`ComposerReadinessBar.rightAccessory`, which places it on the right side
of the composer title/readiness bar next to the send target metadata
(`Codex / gpt-5.5`, access mode, collaboration mode, etc.).

This preserves the product semantics:

- `Settings > Skills > Curated` remains the only toggle surface.
- The composer only answers "which always-on curated skills are active
  right now?"
- The indicator must be visually compact: icon + display name on a
  single line, long names truncated, overflow represented as `+N`.
- Clicking the chip may navigate to Settings, but must not enable or
  disable the skill directly.

The React path is:

```tsx
<ChatInputBoxHeader
  rightAccessory={<CuratedSkillIndicator onOpenSkillsSettings={...} />}
/>

<ComposerReadinessBar rightAccessory={rightAccessory} />
```

## CSS load-order guard

The indicator is visible on cold composer load, before the user visits
Settings. Therefore its layout CSS cannot live in `src/styles/settings.skills.css`,
which is only guaranteed after the Settings surface has been loaded.

Observed failure mode:

1. App opens directly to the composer with one curated skill enabled.
2. `CuratedSkillIndicator` renders, but `.curated-indicator*` rules are
   absent because the Settings CSS chunk has not been loaded.
3. The button uses browser-default layout, so the icon and display name
   stack into two rows.
4. User clicks the chip to open Settings; `settings.skills.css` loads.
5. Returning to the composer now appears "fixed" because the missing CSS
   is finally present.

Fix: keep `.curated-indicator*` in
`src/features/composer/components/ChatInputBox/styles/banners.css`, which
is imported by `ChatInputBox/styles.css` and loaded with the composer.
`settings.skills.css` owns Settings row styling only; it must not be the
source of truth for composer indicator layout.

## Why not turn `useAppSettings` into a context provider?

`useAppSettings` is the project's existing convention for reading
settings; it is called from ~19 files across the codebase and is
intentionally a per-component `useState` (each component owns its
loader + normalize logic). Refactoring it into a context provider
would touch every call site and is well outside the scope of "fix
the curated-skill toggle". Lifting state locally inside
`CuratedSection` is the minimal-risk fix that addresses the specific
bug.
