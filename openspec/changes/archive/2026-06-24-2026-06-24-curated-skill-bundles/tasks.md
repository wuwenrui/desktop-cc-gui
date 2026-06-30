# Tasks: 2026-06-24-curated-skill-bundles

## Archive Reconciliation — 2026-06-25

This archived change was the first proposal for curated skill bundles. The
implementation did not land exactly as the original task list described:
the asset / backend / Settings foundation landed, while the composer chip
row and picker were intentionally superseded by later changes.

Canonical follow-up changes:

- `2026-06-24-curated-skill-always-on-simplification`
  - Settings is the only toggle surface.
  - Composer chip row / picker were removed.
  - Composer shows a read-only indicator instead of per-message quick-load.
- `2026-06-25-composer-readiness-bar-indicator-layout`
  - The read-only indicator is rendered via `ComposerReadinessBar.rightAccessory`.

## 1. Foundation Implemented

- [x] Add bundled curated skill assets under
      `src-tauri/resources/curated-skills/lazy-senior-dev/`.
- [x] Add `metadata.json` for `lazy-senior-dev` with display name, version,
      description, icon, category, token estimate, source URL, and MIT license.
- [x] Extend `skills-lock.json` to version `2`, mark existing entries as
      `kind: "bundled"`, and add `lazy-senior-dev` as `kind: "curated"`.
- [x] Add `src-tauri/build.rs` lock validation for curated entries, including
      SHA-256, metadata fields, license whitelist, path safety, icon format, and
      category/token checks.
- [x] Add `sha2` / `serde_json` build dependencies required by the validator.
- [x] Package curated skill resources and `skills-lock.json` through
      `src-tauri/tauri.conf.json` `bundle.resources`.
- [x] Add `docs/curated-skill-onboarding.md`.
- [x] Add archived onboarding checklist at
      `openspec/changes/archive/2026-06-24-2026-06-24-curated-skill-bundles/docs/onboarding-checklist.md`.

## 2. Backend Implemented

- [x] Add `src-tauri/src/curated_skills.rs` for loading curated metadata,
      reading bodies, normalizing enabled ids, and exposing IPC handlers.
- [x] Register curated skill IPC commands:
      `get_curated_skills`, `get_enabled_curated_skill_ids`,
      `get_curated_skill_bodies`, and `set_curated_skill_enabled`.
- [x] Add `AppSettings.enabled_curated_skill_ids`, serialized to frontend as
      `enabledCuratedSkillIds`.
- [x] Persist enabled curated skill ids through settings core.
- [x] Validate `set_curated_skill_enabled` inputs: trim ids, reject empty ids,
      reject unknown ids, de-duplicate persisted ids.
- [x] Add curated skill entries to skills listing with `source:
      "curated_bundled"` and computed `enabled` state.
- [x] Align daemon / app-server spawn paths so enabled curated skill ids are
      captured when launching engine processes.
- [x] Inject enabled curated skills into Codex app-server launch args through
      merged `developer_instructions`.
- [x] Inject enabled curated skills into Claude via
      `--append-system-prompt <body>`.
- [x] Include curated skill id changes in Codex restart detection so long-lived
      app-server sessions do not keep stale `developer_instructions` snapshots.

## 3. Frontend Implemented

- [x] Add frontend Tauri wrappers for curated skill IPC in `src/services/tauri.ts`.
- [x] Add frontend `CuratedSkillOption` / `enabledCuratedSkillIds` types.
- [x] Add `src/features/curated-skills/components/CuratedSection.tsx`.
- [x] Render `CuratedSection` in Settings > Skills above the existing skill list.
- [x] Add `useCuratedSkills` / `useCuratedSkillToggle`-style state flow and keep
      CuratedSection state aligned with `useAppSettings`.
- [x] Add `CuratedSkillIndicator` as a read-only composer indicator for enabled
      curated skills.
- [x] Move indicator CSS into the ChatInputBox style bundle so cold startup has
      correct single-line styling.

## 4. Superseded By Later Changes

- [x] Original `CuratedSkillChipRow` below the input — **superseded** by
      `2026-06-24-curated-skill-always-on-simplification`.
- [x] Original `CuratedSkillPicker` popover and `+` button — **superseded** by
      Settings-only always-on activation.
- [x] Per-message quick-load mental model — **superseded** by global Settings
      toggle plus read-only composer indicator.
- [x] Original "toggle does not restart Codex" assumption — **superseded** by
      implementation reality: Codex app-server launch args are startup
      snapshots, so curated skill changes must restart Codex to avoid stale
      `developer_instructions`.
- [x] Original Claude `--append-system-prompt-file <temp_path>` plan —
      **superseded** by current `--append-system-prompt <body>` implementation.

## 5. Verification Recorded Elsewhere

- [x] `2026-06-24-curated-skill-always-on-simplification/tasks.md` records the
      follow-up verification for Settings-only activation, indicator behavior,
      lock hardening, Codex parity, and Rust/frontend focused tests.
- [x] `2026-06-25-composer-readiness-bar-indicator-layout/tasks.md` records the
      right-accessory indicator verification and OpenSpec validation.
- [x] Main spec `openspec/specs/curated-skill-bundles/spec.md` has been rewritten
      to the final always-on + read-only indicator contract.

## 6. Final Review Verification — 2026-06-25

- [x] Full frontend heavy-test-noise gate was re-run during final review:
      `npm run check:heavy-test-noise` completed 723 Vitest files.
- [x] Large-file hard gate was re-run during final review:
      `npm run check:large-files:gate` reported found=0.
- [x] Large-file advisory was re-run during final review:
      `npm run check:large-files:near-threshold` reported watch-list warnings
      only; `src-tauri/src/engine/claude.rs` was reduced to 2345 lines by
      moving curated prompt construction to
      `src-tauri/src/engine/claude/curated_skill_prompt.rs`.
- [x] OpenSpec main specs were revalidated:
      `openspec validate --specs --strict --no-interactive` passed.
- [x] Archive command was not re-run because this directory is already under
      `openspec/changes/archive/`.
