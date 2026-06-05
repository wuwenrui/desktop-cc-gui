# Design: Reduce Project Map Large-File And Test Pressure

## Decision

Treat this as gate hygiene with bounded refactoring:

1. The Orchestration Center component must not allocate new fallback arrays during render. Optional `taskRuns` and `modelOptions` should resolve through module-level empty constants so effects depending on those values see stable identities.
2. The Orchestration Center test should isolate the bridge boundary. It only asserts queue UI behavior, not Tauri model discovery. Therefore the test file should mock `getEngineModels`, `getModelList`, and `getConfigModel`.
3. The Project Map stylesheet can be split safely because CSS selector contracts remain unchanged. `project-map.css` imports a feature-local detail stylesheet; components keep the same class names.
4. The Project Map layout CSS sentry should follow the graph-first information architecture. The removed work-queue banner is not the primary surface anymore; the test should guard the lens shell, graph canvas, and empty-state grid placement instead.
5. The Task Center unit test should follow the current executable-action contract. Unavailable actions are intentionally omitted from the DOM instead of rendered as disabled buttons; external open-run events must be wrapped in React `act` before asserting selected-run details.
6. The large-file baseline should capture remaining known hard debt after the safe stylesheet split. This makes the gate enforce "no new or regressed hard debt" without forcing risky TSX/Rust surgery in the same pass.

## Trade-offs

- Stabilizing fallback arrays is a production-safe bug fix because it preserves the public props contract while removing an accidental render-loop trigger.
- Mocking the Tauri bridge keeps the unit test scoped to UI behavior and avoids coupling jsdom tests to runtime model discovery.
- Splitting CSS now is low risk and removes real style-file pressure.
- Splitting `ProjectMapPanel.tsx` now is high risk because the component has dense shared local state, callbacks, and helper types. It needs a planned component extraction pass.
- Splitting `daemon_state.rs` now is outside the frontend/test gate scope and risks runtime behavior regressions.
- Updating the baseline is acceptable only because it records known hard debt after targeted reduction; it is not a substitute for future modularization.

## Current State Calibration

- `OrchestrationCenterView.test.tsx` has been verified as the concrete OOM/stall trigger.
- The OOM was not solved by heap size. It was solved by removing the render loop and keeping the Tauri bridge mocked in the unit test.
- `TaskCenterView.test.tsx` was a stale full-suite gate failure after the OOM blocker was removed; its runtime UI already omits unavailable actions.
- `project-map.css` has been reduced by moving inspector/detail CSS into `project-map.inspector.css`.
- `ProjectMapPanel.tsx` and `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs` remain intentional baseline debt, not completed modularization.
- The Project Map work queue remains de-emphasized by the graph-first change; this cleanup must not drift into resurrecting it as the central surface.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/agent-orchestration/components/OrchestrationCenterView.test.tsx`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/tasks/components/TaskCenterView.test.tsx`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/project-map/projectMapLayoutCss.test.ts`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/services/projectMapPersistence.test.ts`
- `npm run check:large-files`
- `openspec validate reduce-project-map-large-file-and-test-pressure --strict --no-interactive`
