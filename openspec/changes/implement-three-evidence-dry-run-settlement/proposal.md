## Why

The top-level `design-three-evidence-turn-settlement` contract defines how to keep turn settlement safe, but no implementation exists yet to evaluate settlement decisions consistently. Phase 1 should add a pure, testable dry-run decision layer so we can observe settlement mismatches without changing normal conversation completion behavior.

## 目标与边界

- Implement only Phase 1 dry-run settlement arbitration.
- Add a pure decision helper for terminal/state/progress evidence and scope matching.
- Emit bounded diagnostics for rejected, deferred, progress-protected, reconciliation-needed, and busy-residue decisions.
- Keep existing normal completion and streaming paths behaviorally unchanged.
- Do not enable guarded cleanup, backend status query, or missed terminal replay in this change.

## 非目标

- 不替换现有正常 completion 主链路。
- 不清理 `isProcessing`、`activeTurnId` 或 blocker residue。
- 不实现 backend/runtime authoritative status query。
- 不实现 missed terminal replay。
- 不新增 timeout completed settlement。
- 不记录完整 prompt、assistant output、tool output、stdout/stderr、file diff 或 secrets。

## What Changes

- Add a frontend pure helper such as `evaluateTurnSettlement(evidence, policy, nowMs)`.
- Add focused unit tests covering scope gate, matched terminal, stale turn/lease, fresh progress protection, missing terminal, and busy residue dry-run decisions.
- Wire existing foreground turn diagnostics to call the helper in dry-run mode where settlement attempts or suspected stuck states are already observed.
- Persist only bounded debug/error-log data through the existing debug log pipeline.
- Add implementation notes that Phase 2 cleanup/status-query behavior remains disabled.

## 方案对比

| 方案 | 做法 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- | --- |
| A. 直接启用 cleanup | helper 判断后立即清 busy residue | 症状改善快 | 影响正常结束和长任务，风险过高 | 不选 |
| B. 仅补日志不建 helper | 在现有 hook 里继续写分散诊断 | 改动小 | 规则继续分裂，无法复用测试矩阵 | 不选 |
| C. Pure helper + dry-run diagnostics | 先统一判定模型，只记录不改状态 | 可测试、可回放、低风险 | 暂时不直接修复 residue | 采用 |

## Capabilities

### New Capabilities

<!-- None. This is a Phase 1 implementation of existing lifecycle/realtime contracts. -->

### Modified Capabilities

- `conversation-lifecycle-contract`: Implement Phase 1 pure decision helper and dry-run arbitration behavior without state cleanup.
- `conversation-realtime-client-performance`: Record bounded dry-run settlement decisions and keep them distinct from normal provider/render delays.

## Impact

- Frontend lifecycle/debug modules for thread turn diagnostics.
- Unit tests for the pure decision helper and dry-run integration.
- No new dependencies.
- No Rust/backend behavior changes in Phase 1.

## 验收标准

- `evaluateTurnSettlement` is pure and covered by focused unit tests.
- Existing normal completion path remains unchanged.
- Dry-run diagnostics can express `wouldSettle`, `wouldReject`, `wouldDefer`, `wouldKeepRunning`, `wouldRequestReconciliation`, and `wouldCleanupResidue`.
- Fresh progress prevents stuck/completed classification.
- Missing terminal evidence requests reconciliation in decision output but does not mark completed.
- Scope mismatch, stale turn, and stale runtime lease never produce a cleanup-capable decision.
- `openspec validate implement-three-evidence-dry-run-settlement --strict --no-interactive` passes.
