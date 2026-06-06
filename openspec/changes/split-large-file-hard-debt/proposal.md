## Why

`npm run check:large-files:gate` now passes only because four existing hard-debt files are captured in the baseline. That restores CI signal for new growth, but the repository still carries retained oversized debt in Project Map relationship UI, layout orchestration, Rust relationship scanning, and Project Map relationship styles.

## 目标与边界

- Remove the retained hard-debt entries by reducing each selected source file below its matched fail threshold:
  - `src/features/project-map/components/ProjectMapRelationshipSection.tsx` from 3683 lines to below 3000.
  - `src/features/layout/hooks/useLayoutNodes.tsx` from 3312 lines to below 3000.
  - `src-tauri/src/project_map_relations.rs` from 3090 lines to below 3000.
  - `src/styles/project-map.relationship.css` from 2802 lines to below 2800.
- Preserve public component entrypoints, hook return contracts, Tauri command behavior, persisted storage shape, CSS selector contracts, and existing tests.
- Treat this as boundary-driven modularization and debt elimination, not a product behavior redesign.

## What Changes

- Split Project Map relationship UI into cohesive feature-local modules for API view, graph view helpers, file/read panels, and derived projection helpers while keeping `ProjectMapRelationshipSection` as the public facade.
- Split `useLayoutNodes.tsx` by extracting code-selection relationship graph helpers and layout node section builders into layout-local modules while keeping `useLayoutNodes` return shape stable.
- Split `project_map_relations.rs` by extracting storage/path validation, scanner indexing/resolution, and context-pack enrichment helpers into Rust submodules while preserving existing command registration and response payloads.
- Split `project-map.relationship.css` into imported Project Map relationship stylesheet parts by surface region, preserving class names and cascade order.
- Regenerate large-file baseline only after the four selected files are below their fail thresholds.

## 技术方案取舍

| Option | Summary | Trade-off |
|---|---|---|
| Keep retained baseline only | Do nothing after baseline capture | Lowest short-term risk, but leaves hard-debt noise and makes cleanup optional forever |
| Boundary-driven split behind facades | Move cohesive helpers/surfaces/styles into local modules while preserving public contracts | Best risk/value ratio; reduces line count without behavior redesign |
| Deep Project Map/layout/scanner rewrite | Redesign UI architecture, scanner model, and layout ownership together | Potentially cleaner long term, but too risky for a gate cleanup pass |

Recommended: boundary-driven split behind existing facades.

## 非目标

- No Project Map relationship UX redesign.
- No layout behavior changes, panel visibility changes, keyboard shortcut changes, or persisted state migration.
- No Tauri command name, command registry, payload shape, storage directory, or scan output schema changes.
- No CSS class renaming or markup rewrites solely for style cleanup.
- No deleting baseline entries while selected files still exceed their fail threshold.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `large-file-modularization-governance`: add a concrete retained hard-debt cleanup contract for the four current baseline entries, with per-file boundary and validation requirements.

## Impact

- Frontend:
  - `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
  - new Project Map relationship component/helper modules under `src/features/project-map/components/`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - new layout-local helper modules under `src/features/layout/hooks/`
- Backend:
  - `src-tauri/src/project_map_relations.rs`
  - new Rust submodules under `src-tauri/src/project_map_relations/` or an equivalent existing module boundary.
- Styles:
  - `src/styles/project-map.relationship.css`
  - new imported relationship stylesheet parts under `src/styles/`.
- Governance:
  - `docs/architecture/large-file-baseline.json`
  - `docs/architecture/large-file-baseline.md`

## 验收标准

- All four selected files are below their matched fail thresholds.
- `npm run check:large-files:gate` passes with no retained fail-scope entries for the four selected files.
- Focused Project Map relationship UI tests pass.
- Focused layout hook tests pass.
- Rust relationship scanner tests or compile checks pass.
- `npm run typecheck` passes.
- `openspec validate split-large-file-hard-debt --strict --no-interactive` passes.
