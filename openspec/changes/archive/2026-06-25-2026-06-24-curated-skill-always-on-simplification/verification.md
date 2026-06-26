# Verification: 2026-06-24-curated-skill-always-on-simplification

## Code-level checks (cumulative, including the i18n + GitHub link round)

- `npm run typecheck` — 0 errors
- `npm run lint` — 0 warnings
- `npx vitest run` — 5839 tests pass across 722 files (was 5837 in
  the previous round; +2 from new GitHub-link specs in
  `CuratedSection.test.tsx`).
- `cd src-tauri && cargo test` — 2109 tests pass (lib 1308 + daemon
  800 + integration 1).
- `openspec validate 2026-06-24-curated-skill-always-on-simplification`
  — valid.

## Latest targeted checks (composer header indicator round)

- `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
  — 7 tests pass.
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 warnings.

## Review hardening checks (boundary / cross-platform / gate round)

- `npx vitest run src/features/curated-skills/components/CuratedSkillIndicator.test.tsx src/features/curated-skills/components/CuratedSection.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
  — 19 tests pass, no `act(...)` warnings.
- `cargo test --manifest-path src-tauri/Cargo.toml curated_skills --lib`
  — 18 tests pass.
- `npm run typecheck` — 0 errors.
- `npm run lint` — 0 warnings.
- `npm run check:large-files` — 0 failing files.
- `npm run check:heavy-test-noise` — pass across 723 test files; summary:
  environment warnings 1, `act warnings: 0`, stdout payload lines 0, stderr
  payload lines 0.
- `openspec validate 2026-06-24-curated-skill-always-on-simplification --strict`
  — valid.
- `npm run check:runtime-contracts` — `check-app-shell-runtime-contract: OK`
  and `check-git-history-runtime-contract: OK`.
- `node --test scripts/check-large-files.test.mjs` — 15 tests pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  — 21 tests pass.
- `git diff --check` — clean.

## Files touched

### Toggle fix (round 1)

- `src/features/curated-skills/hooks/useCuratedSkillToggle.ts` —
  rewritten to take `setSettings` from caller.
- `src/features/curated-skills/hooks/useCuratedSkills.ts` — rewritten
  to take `enabledCuratedSkillIds` from caller.
- `src/features/curated-skills/components/CuratedSection.tsx` —
  calls `useAppSettings()` once and threads the read/write sides
  into the two child hooks.
- `src/features/curated-skills/components/CuratedSection.test.tsx` —
  mock signatures updated to match the new hook contracts.

### Chip row + picker removal (round 1)

- `src/features/curated-skills/components/CuratedSkillChipRow.tsx` —
  deleted.
- `src/features/curated-skills/components/CuratedSkillChipRow.test.tsx` —
  deleted.
- `src/features/curated-skills/components/CuratedSkillPicker.tsx` —
  deleted.
- `src/features/curated-skills/index.ts` — chip row + picker exports
  removed.
- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx` —
  import + `<CuratedSkillChipRow />` mount removed.
- `src/features/composer/components/ChatInputBox/ChatInputBox.incrementalUndoRedo.smoke.test.tsx`
  — stale useAppSettings / useCuratedSkills stubs removed (later
  re-added as a `vi.mock('../../../curated-skills', ...)` stub of
  `CuratedSkillIndicator` to keep the smoke test from tripping on
  the indicator's `setInterval` poll).
- `src/styles/settings.skills.css` — chip row + picker block
  (pre-change lines 681..868) removed.

### Always-on composer indicator (round 2)

- `src/features/curated-skills/components/CuratedSkillIndicator.tsx`
  + spec — new read-only always-on indicator. Polls every 2s. Renders
  nothing when zero skills are enabled.

### Composer header placement + cold-start CSS (round 4)

- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx` —
  forwards `<CuratedSkillIndicator />` to `ChatInputBoxHeader` as a
  right-side accessory instead of rendering it below the editor.
- `src/features/composer/components/ChatInputBox/ChatInputBoxHeader.tsx`
  — accepts `rightAccessory?: ReactNode` and passes it to
  `ComposerReadinessBar`.
- `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`
  — adds `rightAccessory?: ReactNode` and renders it inside
  `.composer-readiness-right-accessory` on the right side of the
  title/readiness bar.
- `src/features/composer/components/ChatInputBox/styles/banners.css` —
  owns `.composer-readiness-right-accessory` plus `.curated-indicator*`
  so the indicator is single-line on cold composer load, before
  Settings CSS is loaded.
- `src/styles/settings.skills.css` — no longer owns composer indicator
  layout; it only owns Settings/CuratedSection styling for this feature.
- `src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx`
  — asserts the indicator is mounted inside the readiness bar right
  accessory and still forwards `onOpenSkillsSettings`.

### Boundary / cross-platform review fixes (round 5)

- `src-tauri/build.rs` — replaced external hash utilities with Rust
  `sha2`, added repo-root `skills-lock.json` as the actual Cargo
  `rerun-if-changed` path, validates both `assetPath` and
  `metadataPath` as repo-relative POSIX paths, and rejects malformed
  `sourceUrl` values at build time.
- `src-tauri/Cargo.toml` — added `sha2` to `build-dependencies` so the
  build script does not depend on platform shell tools.
- `src-tauri/src/curated_skills.rs` — mirrors path validation at runtime,
  strictly sanitizes `sourceUrl`, omits absent `sourceUrl` from IPC JSON
  rather than serializing `null`, normalizes enabled ids, and rejects empty
  or unknown ids at `set_curated_skill_enabled`.
- `src/features/curated-skills/components/CuratedSkillIndicator.tsx` —
  corrected the polling comment: polling must continue while mounted even
  when the component renders null, otherwise Settings changes cannot be
  discovered.
- `src/features/curated-skills/components/CuratedSkillIndicator.test.tsx`
  — polling test uses fake timers instead of a real 2-second wait.
- `src/features/curated-skills/components/CuratedSection.test.tsx` —
  mock path now matches the component import, preventing accidental mount
  of the real async settings hook and React `act(...)` warnings.

### i18n + GitHub link round (round 3)

- `src/i18n/locales/en.part1.base.ts` — added `curatedSectionTitle`,
  `curatedToggleAria`, `curatedViewOnGithub`, `curatedViewOnGithubAria`
  under `common`.
- `src/i18n/locales/zh.part1.ts` — same keys translated:
  `内置精选`, `开关 {{name}}`, `在 GitHub 查看`,
  `在浏览器打开 {{name}} 的上游源码`. (This is the first locale
  that has the full set; previously the Chinese locale fell back to
  the English defaults for every curated key, which is why the
  Settings panel rendered English text for a Chinese-locale user.)
- `src/features/curated-skills/i18n/categoryLabels.ts` — added
  `sectionTitle`, `viewOnGithub`, `viewOnGithubAria` defaults.
- `src/features/curated-skills/components/CuratedSection.tsx` —
  hardcoded `Curated` heading replaced with `sectionTitleLabel`; the
  per-row Switch `aria-label` and the new GitHub link's label /
  `aria-label` are all `translateOrFallback` driven.
- `src/features/curated-skills/components/CuratedSection.test.tsx` —
  added two new specs (GitHub link present / hidden when sourceUrl
  absent), and updated the visual snapshot to assert the link.
- `src-tauri/resources/curated-skills/lazy-senior-dev/metadata.json`
  — added `sourceUrl: "https://github.com/DietrichGebert/ponytail"`.
- `src-tauri/src/curated_skills.rs` — `CuratedSkillEntry` gained an
  `Option<String> source_url`; `load_curated_skills_with_base` parses
  it from `metadata.json` (with strict http(s) allow-list);
  `build_curated_skills_json` includes it in the IPC payload. Two
  test sites updated to construct the new field.
- `src/types.ts` — `CuratedSkillOption` gained an optional
  `sourceUrl?: string`.
- `src/styles/settings.skills.css` — added `.curated-section-row-source`
  (~30 lines): uppercase, faint, hover state.

## Files NOT touched (intentional)

- `src-tauri/src/skills.rs` — `build_curated_skill_entries` already
  filters by `enabled_curated_skill_ids`; no change.
- `src-tauri/tauri.conf.json` / `package.json` — version stays
  0.5.14 (no release boundary crossed for this revision).
- `openspec/specs/curated-skill-bundles/spec.md` — main spec sync is
  deferred to archive time (see `tasks.md` step 4).

## License check (round 3, GitHub link)

- `lazy-senior-dev` is a verbatim copy of the public
  `DietrichGebert/ponytail` skill (MIT license). MIT is on
  `ALLOWED_LICENSES` in `src-tauri/build.rs` and is therefore
  enforced at compile time — any future curated skill that does
  not declare an approved license (MIT, Apache-2.0, BSD-2-Clause,
  BSD-3-Clause, ISC) will fail `cargo build` with a panic in
  `build.rs` rather than slipping into the bundle.

## Manual verification still required

- The user has not yet visually confirmed that:
  - the switch flips in the live `npm run tauri:dev` build (this
    was the previous round's manual check),
  - the composer title-bar indicator appears / disappears as toggles
    change, with the correct icon and name,
  - on cold app start, before visiting Settings, the indicator renders
    as one line on the right side of the title/readiness bar,
  - the Chinese-locale "Curated" heading now reads "内置精选" with
    the GitHub link rendering as "在 GitHub 查看",
  - the link opens the configured upstream URL in the system
    browser.
- Until they do, this change is in the "review iteration" phase and
  must not be committed.
