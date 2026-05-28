## Implementation Inventory

Updated: 2026-05-28

This artifact records the current implementation surface used to complete the v0.5.4 Project Map stabilization tasks.

## Ownership And Storage Boundaries

- Run creation flows in `src/features/project-map/hooks/useProjectMapDataset.ts` now attach immutable ownership context to generation requests:
  - `workspaceId`
  - `workspacePath`
  - `storageKey`
  - `storageLocation`
- Worker claim keys include workspace id, storage key, and run id, preventing same-run collisions across storage views.
- Worker progress, completion, and failure writes route through the captured ownership context instead of the mutable active workspace/view.
- Frontend persistence rejects writes when `dataset.manifest.storageKey` does not match `expectedStorageKey`.
- Rust snapshot writes in `src-tauri/src/project_map.rs` require a matching `manifest.json`, reject malformed manifests, and reject storage-key mismatch before writing files.
- Rust project-map writes now hold a root-level snapshot lock across backup plus all file writes, while each file still uses the shared atomic write helper.

## Auto Ingestion Scheduler Boundary

- Scheduler evaluation is handled by `useProjectMapDataset`, which is mounted from `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` for the active workspace rather than being owned by `ProjectMapPanel` visibility.
- Project Map panel remains the configuration, visibility, and task-drawer surface.
- Auto Ingestion uses helper logic in `src/features/project-map/utils/autoIngestion.ts` for:
  - enabled/disabled gate
  - interval gate
  - threshold gate
  - duplicate pending/running auto-run guard
  - success-only processed marker behavior
- A failed or cancelled auto run leaves consumed messages retryable.

## Projection And Interaction Boundaries

- Duplicate node normalization is centralized in `normalizeProjectMapNodeTopology` inside `src/features/project-map/utils/incrementalGeneration.ts`.
- Persistence and graph layout both normalize nodes before rendering/layout, preserving evidence, related artifacts, children, stale/candidate/confidence signals, and generation metadata.
- Graph layout in `src/features/project-map/utils/interactiveLayout.ts` consumes normalized projection nodes before calculating visible nodes, positions, edges, and bounds.
- `ProjectMapPanel` builds its inspector/action node index from the same normalized projection, so graph selection and details do not diverge when duplicate stable node ids are present.
- Existing in-house SVG/HTML graph renderer remains in place; no graph dependency was introduced.
- `ProjectMapPanel` keeps node-body drag, group drag preview, action-button boundaries, and viewport stability covered by focused component tests.

## Failure And Candidate Boundaries

- `ProjectMapRunFailureCategory` records compact failure categories:
  - `output_parse_failed`
  - `ownership_mismatch`
  - `evidence_read_failed`
  - `persistence_failed`
  - `cancelled`
- `ProjectMapTaskDrawer` displays failure category and latest diagnostic message without blocking review of existing map data.
- Worker structured-output parsing still repairs known malformed envelopes, but unrecoverable output fails closed before persistence.
- Auto Ingestion candidate safety preserves both modes:
  - `createCandidate` always keeps generated updates as candidate-safe.
  - `autoApplyEvidenceBacked` can apply source-backed evidence-gated updates while weak, stale, memory-only, or unsupported updates remain candidates.

## Generation Option Availability

- `src/features/project-map/hooks/useProjectMapGenerationOptions.ts` keeps runtime-provided model catalogs and workspace config as the preferred source of Project Map generation model options.
- When Codex runtime model catalogs are unavailable or empty, Project Map falls back to the canonical `CODEX_MODEL_CATALOG` from `src/features/models/codexModelCatalog.ts`.
- Project Map does not maintain a parallel Codex fallback model list, preventing drift from the rest of the app's Codex model selection surface.

## Focused Regression Surface

- Frontend hook and service:
  - `src/features/project-map/hooks/useProjectMapDataset.test.tsx`
  - `src/features/project-map/services/projectMapGenerationWorker.test.ts`
  - `src/features/project-map/services/projectMapPersistence.test.ts`
- Frontend projection and interaction:
  - `src/features/project-map/utils/incrementalGeneration.test.ts`
  - `src/features/project-map/utils/interactiveLayout.test.ts`
  - `src/features/project-map/utils/autoIngestion.test.ts`
  - `src/features/project-map/components/ProjectMapPanel.test.tsx`
  - `src/features/project-map/hooks/useProjectMapGenerationOptions.test.tsx`
- Backend storage boundary:
  - `src-tauri/src/project_map.rs`

## Fixture Notes

- Existing fixtures cover matching/mismatched/malformed manifest ownership, root-level snapshot lock waiting, duplicate node projection across graph and inspector details, auto-ingestion interval and duplicate-run guards, success-only processed markers, malformed AI output, candidate modes, node drag, action click boundaries, viewport stability, and failed run diagnostics.
- No schema migration fixture is needed because this change keeps existing Project Map snapshot schema and rejects/quarantines mismatched data without deleting local files.
