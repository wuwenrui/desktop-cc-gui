## Why

Phase 1 three-evidence dry-run can identify `wouldRequestReconciliation`, but it cannot answer the decisive question: whether the scoped backend/runtime turn is actually `running`, `completed`, `failed`, `runtime-ended`, or `unknown`. Phase 2a defines the authoritative status-query reconciliation contract before any cleanup behavior is implemented, so future work can inspect runtime truth without guessing from timeout, visible text, or history.

## 目标与边界

- Define a Phase 2a design for authoritative backend/runtime status query and reconciliation.
- Preserve Phase 1 dry-run safety: no lifecycle cleanup, no automatic completion, no terminal replay execution in this proposal.
- Require strict workspace/engine/thread/turn/runtime lease scope on every query and response.
- Separate three-evidence settlement from the runtime recovery/acquire failures observed in today's error log.
- Keep all reconciliation diagnostics content-safe and bounded.

## 非目标

- 不改 `src/**` 业务代码。
- 不实现 `isProcessing` / `activeTurnId` / blocker residue cleanup。
- 不实现 backend command、Tauri command 或 runtime bridge API。
- 不把 timeout、frontend silence、visible assistant text、history content 当成 completed。
- 不实现 missed terminal replay。
- 不把 `RUNTIME_RECOVERY_QUARANTINED` / concurrent runtime acquire timeout 合并进 settlement cleanup。

## What Changes

- Specify the Phase 2a status-query reconciliation flow that starts from Phase 1 `request-reconciliation` / `wouldRequestReconciliation`.
- Define the required request scope for future authoritative status query: workspace, engine, thread, turn or verified alias, runtime lease when available, foreground ownership.
- Define the bounded response status set: `completed`, `running`, `failed`, `stalled`, `runtime-ended`, `unknown`, `query-failed`, and the required echoed scope.
- Define decision mapping:
  - scoped terminal status becomes Terminal Evidence and must be re-evaluated by the pure helper.
  - `running` keeps the turn active.
  - `unknown` / `query-failed` defers or enters degraded/reconnect diagnostics, never completed.
- Define diagnostics/error-log requirements for query requested, query resolved, query rejected, and query failed states.
- Explicitly reserve Phase 2b guarded cleanup for later evidence, especially `wouldCleanupResidue`.

## 方案对比

| 方案 | 做法 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- | --- |
| A. 直接实现 cleanup | 一旦 Phase 1 认为 residue 就清理 UI busy state | 症状缓解最快 | 当前没有 `wouldCleanupResidue` 样本，容易误伤长任务或 runtime recovery 场景 | 不选 |
| B. 等更多日志再设计 | 继续收 Phase 1 日志，暂不写 Phase 2a contract | 零改动 | 下次复现时仍然缺少明确实现边界，容易临场混入 cleanup | 不选 |
| C. 先写 Phase 2a status-query reconciliation 提案 | 固化“问后端真相”的 scope/status/diagnostic contract，暂不实现 | 低风险、可复用、为后续实现设边界 | 不能立刻修复卡 loading | 采用 |

## Capabilities

### New Capabilities

<!-- None. This proposal refines existing lifecycle/runtime/realtime contracts. -->

### Modified Capabilities

- `conversation-lifecycle-contract`: Define Phase 2a reconciliation behavior before any lifecycle cleanup.
- `engine-runtime-contract`: Define future authoritative scoped status-query request/response contract.
- `conversation-realtime-client-performance`: Define bounded diagnostics for reconciliation query attempts and outcomes.

## Impact

- OpenSpec-only design artifact under `openspec/changes/design-three-evidence-status-query-reconciliation/`.
- Future implementation will likely touch frontend lifecycle coordinator, backend/runtime bridge status APIs, and diagnostics/error-log filtering.
- No dependencies, no runtime behavior changes, no frontend state changes in this proposal.

## 验收标准

- The proposal clearly separates Phase 2a status-query reconciliation from Phase 2b guarded cleanup.
- Specs require scoped status query and echoed scope in responses.
- Specs forbid timeout-completed and history-content-completed inference.
- Specs define `running`, terminal, `unknown`, and `query-failed` mappings.
- Specs keep runtime recovery/acquire quarantine diagnostics separate from settlement cleanup.
- `openspec validate design-three-evidence-status-query-reconciliation --strict --no-interactive` passes.
