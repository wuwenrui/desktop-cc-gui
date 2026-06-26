# Verification: 2026-06-25-composer-readiness-bar-indicator-layout

## Code Fact Checks

- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
  imports `CuratedSkillIndicator`, creates the indicator with
  `onOpenSkillsSettings`, and passes it to `ChatInputBoxHeader` via
  `rightAccessory`.
- `src/features/composer/components/ChatInputBox/ChatInputBoxHeader.tsx`
  accepts `rightAccessory?: ReactNode` and forwards it to
  `ComposerReadinessBar`.
- `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`
  accepts `rightAccessory?: ReactNode` and renders it inside
  `.composer-readiness-right-accessory`.
- `src/features/composer/components/ChatInputBox/styles/banners.css`
  defines `.composer-readiness-right-accessory` and `.curated-indicator*`
  rules in the ChatInputBox bundle.
- `src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx`
  asserts the indicator is mounted in the readiness-bar right accessory.

## OpenSpec Checks

- `openspec validate 2026-06-25-composer-readiness-bar-indicator-layout --strict --no-interactive`
  passed after the proposal writeback.
- `openspec validate 2026-06-25-composer-readiness-bar-indicator-layout --strict --no-interactive`
  passed again after the design/tasks/spec/verification writeback.

## Focused Checks Still Required Before Commit

- `npm run typecheck`
- `npm run lint`

## Focused Checks Completed

- `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
  — 2 files / 7 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.

## Manual Verification Still Required

- With at least one curated skill enabled, the indicator appears on the right
  side of the readiness bar and stays single-line on cold startup.
- With no curated skills enabled, the indicator does not render and leaves no
  empty visual slot.
- Toggling a curated skill in Settings is reflected in the composer within
  2 seconds.
- Narrow viewport behavior truncates the indicator before overlapping mode,
  target, context summary, jump, or expand controls.
