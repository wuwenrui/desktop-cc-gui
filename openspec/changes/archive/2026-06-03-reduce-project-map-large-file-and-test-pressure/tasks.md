## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for test and large-file pressure cleanup.
- [x] 1.2 Create design with bounded refactor and baseline strategy.
- [x] 1.3 Create delta specs for large-file governance and orchestration test isolation.

## 2. Test Pressure

- [x] 2.1 Stabilize optional `taskRuns` and `modelOptions` fallback arrays in `OrchestrationCenterView.tsx`.
- [x] 2.2 Mock Tauri model bridge calls in `OrchestrationCenterView.test.tsx`.
- [x] 2.3 Verify the orchestration center test no longer stalls/OOMs.
- [x] 2.4 Calibrate `TaskCenterView.test.tsx` for executable-action rendering and open-run event flushing.

## 3. Large File Pressure

- [x] 3.1 Extract Project Map inspector/detail CSS into a feature-local imported stylesheet.
- [x] 3.2 Calibrate Project Map CSS layout sentry for the graph-first shell.
- [x] 3.3 Update large-file baseline for remaining known hard debt.

## 4. Validation

- [x] 4.1 Run lint and typecheck.
- [x] 4.2 Run targeted orchestration, Task Center, and Project Map tests.
- [x] 4.3 Run large-file sentry.
- [x] 4.4 Run OpenSpec strict validation.
