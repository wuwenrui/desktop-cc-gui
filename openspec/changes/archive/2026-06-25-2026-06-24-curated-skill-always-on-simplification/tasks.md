# Tasks: 2026-06-24-curated-skill-always-on-simplification

## 1. Fix the Settings toggle flip (root-cause: split React state slots)

- [x] Refactor `useCuratedSkills` to accept
      `{ enabledCuratedSkillIds }` from the caller instead of calling
      `useAppSettings()` internally. The decoration in the `useMemo`
      (the `enabledIds.has(entry.name)` check) stays.
- [x] Refactor `useCuratedSkillToggle` to accept `{ setSettings }`
      from the caller instead of calling `useAppSettings()` internally.
      Drop the now-redundant `settings` field on the returned value.
- [x] In `CuratedSection`, call `useAppSettings()` once and pass
      `settings.enabledCuratedSkillIds` / `setSettings` down to the two
      child hooks so they share a single React state slot.
- [x] Update `CuratedSection.test.tsx` mocks so the two child-hook
      mocks match the new signatures (best-effort: vitest mocks that
      ignore their argument are also fine, but be explicit).

## 2. Remove the composer chip row + picker

- [x] Remove the `CuratedSkillChipRow` import + mount in
      `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`.
- [x] Delete `src/features/curated-skills/components/CuratedSkillChipRow.tsx`
      and its Vitest spec.
- [x] Delete `src/features/curated-skills/components/CuratedSkillPicker.tsx`
      (no spec existed).
- [x] Remove the chip row + picker block from
      `src/styles/settings.skills.css` (lines 681..868 in the
      pre-change file).
- [x] Drop the `CuratedSkillChipRow` / `CuratedSkillPicker` exports
      from `src/features/curated-skills/index.ts`.
- [x] Drop the now-stale `useAppSettings` / `useCuratedSkills` mocks
      and their leading comments in
      `ChatInputBox.incrementalUndoRedo.smoke.test.tsx`.

## 3. Verify

- [x] `npm run typecheck` — 0 errors
- [x] `npm run lint` — 0 warnings
- [x] `npx vitest run` — 5833 tests pass (721 files)
- [x] `cd src-tauri && cargo test` — 2109 tests pass (lib 1308 + daemon
      800 + integration 1)
- [x] `openspec validate 2026-06-24-curated-skill-always-on-simplification` — clean

## 4. Align composer indicator placement and cold-start CSS

- [x] Mount `CuratedSkillIndicator` through
      `ComposerReadinessBar.rightAccessory` so the indicator appears in
      the composer title/readiness bar's right side.
- [x] Remove the content-area strip placement that rendered the indicator
      between the editor and footer.
- [x] Keep `.curated-indicator*` styles in
      `src/features/composer/components/ChatInputBox/styles/banners.css`
      so cold composer load uses the same single-line layout as the
      post-Settings return path.
- [x] Update `ChatInputBoxIndicatorMount.test.tsx` to assert the
      indicator is inside `.composer-readiness-right-accessory`.
- [x] Targeted verification:
      `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
      — 7 tests pass.
- [x] `npm run typecheck` — 0 errors
- [x] `npm run lint` — 0 warnings

## 5. Review hardening: boundaries, cross-platform, and noise gates

- [x] Replace `build.rs` external `sha256sum` / `shasum` hashing with
      Rust `sha2`, and add `sha2` to `build-dependencies`.
- [x] Fix Codex app-server curated-skill injection parity: merge the
      internal `developer_instructions` hint and enabled curated-skill
      block into a single auto-generated `-c developer_instructions=...`
      argument, so Codex does not skip `lazy-senior-dev` merely because
      the internal hint was inserted first.
- [x] Fix Codex app-server stale snapshot on toggle-off: curated-skill id
      changes now participate in `app_settings_change_requires_codex_restart`,
      and `set_curated_skill_enabled` runs the same restart + rollback path as
      `update_app_settings` so a disabled curated skill is removed from the
      next Codex turn instead of lingering in the long-lived app-server.
- [x] Validate curated lock `assetPath` and `metadataPath` at build time
      and runtime: reject absolute paths, `..`, backslashes, drive-prefix
      `:`, empty strings, and leading/trailing whitespace.
- [x] Validate optional `sourceUrl` as an absolute http(s) URL with a
      non-empty host; malformed values are omitted from the IPC payload,
      not serialized as `null`.
- [x] Normalize enabled curated skill ids by trimming, de-duplicating, and
      dropping empty ids; `set_curated_skill_enabled` rejects empty or
      unknown ids instead of persisting them.
- [x] Centralize curated skill id validation across build-time lock validation,
      runtime curated skill loading, toggle IPC, and settings
      get/update/restore normalization. Invalid ids now fail early instead of
      leaking into `<skill id="...">`, frontend state, or persisted settings.
- [x] Fix Claude curated-skill `--append-system-prompt` truncation to respect
      UTF-8 character boundaries and reserve room for the truncation marker, so
      non-ASCII skill content cannot panic when the 100 KB body cap is reached.
- [x] Split Claude curated-skill prompt body construction into
      `src-tauri/src/engine/claude/curated_skill_prompt.rs` instead of growing
      the P0 `src-tauri/src/engine/claude.rs` large file.
- [x] Guard `useCuratedSkills` async refresh state updates after component
      unmount, avoiding React set-state-after-unmount behavior on slow IPC.
- [x] Fix `CuratedSection.test.tsx` mock path so tests do not mount the
      real `useAppSettings` async loader and emit `act(...)` warnings.
- [x] Convert `CuratedSkillIndicator` polling test to fake timers so it
      does not wait for a real 2-second interval.
- [x] Targeted verification:
      `npx vitest run src/features/curated-skills/components/CuratedSkillIndicator.test.tsx src/features/curated-skills/components/CuratedSection.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxIndicatorMount.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx`
      — 19 tests pass, no `act(...)` warning output.
- [x] Targeted Rust verification:
      `cargo test --manifest-path src-tauri/Cargo.toml curated_skills --lib`
      — 18 tests pass.
- [x] Targeted Codex parity verification:
      `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli::curated_skill_injection_tests --lib`
      — 11 tests pass, including the primary launch case that contains both
      the internal hint and `lazy-senior-dev`.
- [x] Targeted Codex app-server args verification:
      `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli::tests::app_server --lib`
      — 6 tests pass.
- [x] Targeted Codex restart predicate verification:
      `cargo test --manifest-path src-tauri/Cargo.toml shared::settings_core::tests::enabled_curated_skill_ids_change_requires_restart --lib`
      — 3 tests pass.
- [x] `npm run check:large-files` — 0 failing files.
- [x] 收口 verification:
      `npm run check:heavy-test-noise` — 723 Vitest files completed; environment
      warnings 1, act warnings 0, stdout payload lines 0, stderr payload lines 0.
- [x] 收口 large-file governance:
      `npm run check:large-files:gate` — found=0, and
      `npm run check:large-files:near-threshold` — advisory warnings only. The
      Claude P0 file is still watch-listed but reduced to 2345 lines after the
      `curated_skill_prompt.rs` split.
- [x] 收口 Rust verification:
      `cargo test --manifest-path src-tauri/Cargo.toml curated_skill --lib` —
      36 tests pass, including UTF-8 truncation and settings sanitization.
- [x] 收口 repo validation:
      `npm run typecheck`, `npm run lint`,
      `npm run check:runtime-contracts`, `openspec validate --specs --strict
      --no-interactive`, and `git diff --check` all passed.

## 6. Archive

- [x] After user sign-off, run `openspec archive
      2026-06-24-curated-skill-always-on-simplification --yes` and
      copy the resulting capability delta onto the existing
      `curated-skill-bundles` main spec as a new
      "Always-On Activation" requirement group. The user has not
      approved the commit; defer archive + spec sync until they
      visually confirm the toggle in the live build.
