# Tasks: 2026-06-25-composer-readiness-bar-indicator-layout

## 1. Standardize readiness bar right accessory

- [x] Edit `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`:
  - Add `rightAccessory?: ReactNode` to props.
  - Render `rightAccessory` inside `.composer-readiness-right-accessory` within
    `.composer-readiness-activity`.
  - Keep the readiness bar generic: it MUST NOT import curated-skills directly.
- [x] Edit `src/features/composer/components/ChatInputBox/ChatInputBoxHeader.tsx`:
  - Add `rightAccessory?: ReactNode`.
  - Forward it to `ComposerReadinessBar`.
- [x] Edit `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`:
  - Import `CuratedSkillIndicator` from `../../../curated-skills`.
  - Create `<CuratedSkillIndicator onOpenSkillsSettings={onOpenSkillsSettings} />`.
  - Pass it through `ChatInputBoxHeader.rightAccessory`.

## 2. Keep cold-start indicator CSS in the ChatInputBox bundle

- [x] Edit `src/features/composer/components/ChatInputBox/styles/banners.css`:
  - Add `.composer-readiness-right-accessory`.
  - Add `.curated-indicator*` rules to the ChatInputBox style bundle so the
    indicator is correctly styled before Settings styles are ever loaded.
  - Constrain the accessory width with `min-width: 0`, `max-width`, nowrap,
    ellipsis, and compact overflow chips.
- [x] Keep indicator styles out of lazy Settings-only CSS for cold-start layout
      correctness.

## 3. Update tests to match right-accessory placement

- [x] Update / add
      `src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx`:
  - Assert the mocked `CuratedSkillIndicator` is rendered inside
    `.composer-readiness-right-accessory`.
  - Assert the `onOpenSkillsSettings` callback is forwarded.
  - Assert the indicator is not mounted as an input/footer strip.
- [x] Update `src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
      to keep readiness bar core behavior covered while allowing the generic
      `rightAccessory` slot.
- [x] Keep `ChatInputBox.incrementalUndoRedo.smoke.test.tsx` mocked indicator
      lightweight so composer editing behavior is not coupled to polling.

## 4. Sync OpenSpec artifacts to current code facts

- [x] Rewrite `proposal.md` so the change describes the right-accessory scheme
      instead of the stale input/footer strip scheme.
- [x] Rewrite `design.md` so the root cause and decision match the implemented
      `rightAccessory` prop chain and cold-start CSS placement.
- [x] Rewrite `specs/curated-skill-bundles/spec.md` so the requirement says the
      indicator is rendered inside `.composer-readiness-right-accessory`, not
      between `input-editable-wrapper` and `ChatInputBoxFooter`.
- [x] Rewrite `verification.md` so it reports code facts and validation status
      without claiming unrelated full-suite checks from the stale strip plan.

## 5. Verify

- [x] `openspec validate 2026-06-25-composer-readiness-bar-indicator-layout --strict --no-interactive`
      — valid after proposal rewrite.
- [x] Re-run after this tasks/design/spec/verification writeback:
      `openspec validate 2026-06-25-composer-readiness-bar-indicator-layout --strict --no-interactive`
      — valid.
- [x] Focused frontend verification:
      `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
      — 2 files / 7 tests passed.
- [x] Standard gates before commit/archive:
      `npm run typecheck` and `npm run lint` — both passed.

## 6. Archive

- [x] After user sign-off and focused verification, run
      `openspec archive 2026-06-25-composer-readiness-bar-indicator-layout --yes`
      and confirm the `curated-skill-bundles` main spec receives the
      right-accessory indicator requirement.
