## Verification

- `openspec validate add-project-map-candidate-review-actions --strict`：通过。
- `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1`：通过，36 tests。
- `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1`：通过，48 tests。
- `npm run typecheck`：通过。
- `npm run lint`：通过，保留 1 个既有 warning：`src/features/threads/hooks/useThreadActionsResumeThread.ts` missing deps。
- `npm run check:large-files`：通过，`found=0`。

## Result

- Pending candidate records targeting the selected node now surface Confirm / Reject actions in the inspector.
- Confirm applies the existing evidence-gated candidate patch and appends candidate evidence.
- Reject marks the candidate rejected without mutating the active node.
- Invalid confirm attempts keep the active node unchanged and expose the gate error through the existing Project Map error state.

## Archive Note

Keep this change active with the other Project Map changes until the parent `add-project-xray-panel` capability is synced or archived into main specs.
