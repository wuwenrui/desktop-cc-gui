# Design: 2026-06-25-composer-readiness-bar-indicator-layout

## Context

The curated-skill always-on follow-up removed the composer chip row / picker and
introduced `CuratedSkillIndicator` as a read-only status signal. The current code
places that signal in the composer readiness bar through a generic
`rightAccessory` slot.

The OpenSpec artifacts for this change previously described the opposite
direction: moving the indicator out of the readiness bar and into a dedicated
strip between the input and footer. That stale description no longer matches
the implementation and would cause archive-time spec drift.

## Decision

Keep the implemented **readiness bar right accessory** scheme and make it the
spec contract.

The prop chain is:

```text
ChatInputBox
  -> ChatInputBoxHeader.rightAccessory
  -> ComposerReadinessBar.rightAccessory
  -> .composer-readiness-right-accessory
  -> CuratedSkillIndicator
```

`ComposerReadinessBar` owns only the layout slot. `ChatInputBox` owns the
domain-specific decision to render `CuratedSkillIndicator`, which keeps
readiness bar reusable and avoids importing curated-skills from the bar module.

## Layout Contract

- `.composer-readiness-right-accessory` is an inline-flex right-side accessory
  inside `.composer-readiness-activity`.
- The accessory has `min-width: 0`, bounded `max-width`, and `flex: 0 1 auto`
  so it can shrink before it crowds the core readiness controls.
- `.curated-indicator*` styles live in
  `src/features/composer/components/ChatInputBox/styles/banners.css`, not in
  Settings-only styles, so cold startup and post-Settings return use the same
  CSS.
- The indicator chip is nowrap and truncates long skill names. Overflow skills
  may collapse into a `+N` chip.
- The indicator is read-only. Clicking a button-style chip may navigate to
  Settings > Skills, but it MUST NOT toggle a curated skill directly.

## Why Not Add A Separate Input/Footer Strip

A strip between `input-editable-wrapper` and `ChatInputBoxFooter` would reduce
horizontal pressure in the bar, but it adds another vertical band to the
composer and makes a status indicator compete with the editing surface. The
implemented right-accessory slot is smaller, keeps the signal near the
readiness context it explains, and preserves the existing composer structure.

The actual risk is narrow viewport crowding, so the design solves that with
bounded width and truncation rather than a new row.

## Non-Goals

- Do not reintroduce the curated-skill chip row or picker.
- Do not change backend injection, Settings persistence, polling cadence, or
  curated skill metadata.
- Do not make `ComposerReadinessBar` depend on curated-skills.
- Do not redesign the whole readiness bar responsive system.
