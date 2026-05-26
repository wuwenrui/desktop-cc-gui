## Verification

- `openspec validate sharpen-project-map-generation-prompts --strict`：通过。
- `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/hooks/useProjectMapDataset.test.tsx --maxWorkers 1 --minWorkers 1`：通过，27 tests。
- `npm run typecheck`：通过。
- `npm run lint`：通过，保留 2 个既有 `react-hooks/exhaustive-deps` warnings：
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/threads/hooks/useThreadActionsResumeThread.ts`
- `npm run check:large-files`：通过，`found=0`。
- Regression fix: incomplete AI `profile` payloads are normalized before returning the runtime dataset, and the Project Map header has a safe profile summary fallback.
- `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts --maxWorkers 1 --minWorkers 1`：通过，29 tests，覆盖缺失 `profile.shapes` 不再白屏。
- Regression fix: AI output using JS object-literal keys such as `{ profile: ... }` is repaired by the worker boundary without `eval`, then flows through the existing normalization path.
- Regression fix: AI output using bare Chinese string values such as `title: 登录认证` is repaired by the worker boundary without `eval`, then flows through the existing normalization path.
- `npm exec vitest -- run src/features/project-map/services/projectMapGenerationWorker.test.ts --maxWorkers 1 --minWorkers 1`：通过，14 tests，覆盖 unquoted property name / bare string value / trailing comma 解析失败回归。
- `npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/utils/candidates.test.ts --maxWorkers 1 --minWorkers 1`：通过，51 tests。
- `openspec validate sharpen-project-map-generation-prompts --strict`：通过。
- `npm run typecheck`：通过。
- `npm run lint`：通过，保留 1 个既有 `react-hooks/exhaustive-deps` warning：
  - `src/features/threads/hooks/useThreadActionsResumeThread.ts`
- `git diff --check`：通过。
- `npm run check:large-files`：通过，`found=0`。

## Result

- Global collection prompt now stays compact and no longer dumps full existing profile JSON or every node id.
- Complete Node prompt now uses `completeNode` intent, selected node snapshot, selected node evidence, and optional subtree scope.
- Calibrate Node prompt now uses `calibrateNode` intent and focuses on verification/correction/confidence instead of broad expansion.
- Node scoped AI output may omit lenses; existing lenses are preserved during scoped merge.

## Archive Note

Keep this change active until `add-project-xray-panel` is archived or synced into main specs. The main `project-xray-panel` spec is still owned by the active parent change, so archiving this narrow prompt change first could create an incomplete main spec surface.
