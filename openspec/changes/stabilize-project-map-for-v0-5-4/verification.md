## Verification

Updated: 2026-05-28

## Automated Checks

| Command | Result | Notes |
|---|---:|---|
| `npm exec vitest run src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/incrementalGeneration.test.ts src/features/project-map/utils/interactiveLayout.test.ts src/features/project-map/utils/autoIngestion.test.ts src/features/project-map/components/ProjectMapPanel.test.tsx` | Passed | 7 files, 118 tests passed. |
| `npm exec vitest run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/utils/interactiveLayout.test.ts` | Passed | 37 tests passed after adding normalized-inspector projection coverage. |
| `npm exec vitest run src/features/project-map/hooks/useProjectMapGenerationOptions.test.tsx` | Passed | Covers Codex fallback model availability when runtime model catalogs fail or return empty. |
| `cargo test --manifest-path src-tauri/Cargo.toml project_map` | Passed | 11 Rust tests passed, including manifest ownership and root-level snapshot lock coverage. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Passed | Rust formatting check passed after applying `cargo fmt`. |
| `npm run lint` | Passed | ESLint project pass. |
| `npm run typecheck` | Passed | TypeScript full typecheck passed. |
| `openspec validate stabilize-project-map-for-v0-5-4 --strict --no-interactive` | Passed | Change is valid under strict OpenSpec validation. |
| `git diff --check` | Passed | No whitespace errors. |

## Covered Release Risks

- In-flight Project Map workers keep writing to their captured workspace/storage ownership after active workspace or read view changes.
- Frontend and backend storage boundaries reject mismatched or malformed Project Map manifests before trusted rendering/writing.
- Auto Ingestion evaluates from active workspace lifecycle, queues real `kind="auto"` runs, respects interval and duplicate-run guards, and marks memories processed only after successful completion.
- Duplicate stable node ids are normalized before persistence/layout/inspector projection without schema migration.
- Node body drag, action click boundaries, and viewport stability remain covered by component regression tests.
- Malformed model output fails closed before persistence and failed runs expose concise category/diagnostic text in the task drawer.
- `createCandidate` and `autoApplyEvidenceBacked` keep distinct candidate-safety semantics.
- Codex Project Map generation options remain available during runtime model catalog outages by reusing the canonical Codex model catalog.

## Manual QA Qualifiers

- Local automated checks were completed in this environment.
- Desktop visual smoke across packaged macOS, Windows, and Linux builds was not run in this session.
- No claim is made that platform-specific path dialogs, filesystem permission prompts, or packaged-webview pointer behavior were manually verified here.
- Because no schema migration is introduced, rollback does not require data migration; the narrow rollback path is reverting the Project Map stabilization code and artifacts from this change.
