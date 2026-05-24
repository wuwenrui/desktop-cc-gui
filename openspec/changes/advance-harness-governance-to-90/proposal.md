## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 51/51 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: 治理证据链已在 `StatusPanel` 注入 `createFrozenGovernanceEvidenceSnapshot`，并有 `check:governance-evidence-bridge`、`check:agent-domain-event-adoption`、large-file/heavy-test sentry脚本。
- **Next action**: 归档前补 release-grade verification，区分本地 evidence、external CI qualifier、未观测平台结果。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

The harness governance layer has moved beyond design-only work: evidence bridge, policy chain, audit surface, event schema, runtime batching, virtualization, and bundle chunking all have first-slice implementation evidence. The remaining gap is not another broad architecture essay; it is a coordinated readiness pass that closes the real UI policy path, turns governance gates into consumed evidence, and calibrates substrate work against code facts.

This change originally set a defensible 90% readiness floor. After review, that is not enough for the current foundation goal. The updated target is to move harness governance from roughly 70% foundation readiness to a 95%-99% release-grade governance-layer readiness bar while preserving the current no-code planning boundary for this round.

The change id remains `advance-harness-governance-to-90` for OpenSpec continuity, but "90" is now treated as the minimum acceptable floor. The implementation is not complete until the proposal also closes provenance, replay, cross-platform evidence, recovery, and archive handoff.

## 目标与边界

- Reconcile current OpenSpec proposals with current code facts and identify which completed changes are first-slice complete versus fully closed.
- Define the missing release-grade readiness contracts for snapshot injection, gate evidence ingestion, domain event rollout, browser/runtime performance evidence, large-hub follow-up slicing, provenance/replay, recovery, and cross-platform evidence.
- Produce an executable implementation task plan that can start after this documentation-only round.
- Keep the implementation strategy anchored in existing feature slices; do not create a parallel governance product layer.
- Treat Windows/macOS/Linux portability, large-file governance, heavy-test-noise sentry, evidence provenance, replayability, rollback, and archive handoff as release criteria, not optional follow-ups.

## 非目标

- No production code changes in this documentation round.
- No edits to `src/**`, `src-tauri/**`, `vite.config.ts`, or workflow files in this round.
- No rollback or unchecking of prior completed first-slice OpenSpec tasks unless a future verification pass proves the underlying implementation is absent.
- No new dashboard, telemetry export, EventBus, persistent governance store, or bidirectional OpenSpec/Trellis sync.
- No attempt to solve all remaining mega hubs in one implementation change.
- No claim that the whole harness ecosystem is 95%-99% mature. This change only targets the harness governance layer and its structural base inside the current client.

## What Changes

- Add an umbrella capability, `harness-governance-90-readiness`, that defines the readiness bar for calling the harness governance layer release-grade ready. The capability name keeps the existing OpenSpec path, while the content now targets 95%-99% governance-layer readiness.
- Formalize the next implementation sequence:
  - Wire `GovernanceEvidenceSnapshot` into the live `StatusPanel -> buildCheckpointViewModel -> policy chain` path.
  - Convert configured gate presence into consumed gate evidence where artifacts exist.
  - Promote `AgentDomainEvent` from schema/runtime readiness to one real bounded producer/consumer path.
  - Add browser/runtime evidence gates for long-list scroll and webview startup timing where the current evidence is explicitly unsupported.
  - Continue hub split work as scoped slices, not broad rewrites.
  - Add evidence provenance, replay, recovery, rollback, and operator handoff requirements.
  - Require three-platform evidence or explicit external-CI qualifiers before any 99% claim.
- Calibrate active substrate changes as first-slice complete with known residual risks instead of treating them as total governance closure.
- Add a release-grade readiness task board with explicit validation commands, stop conditions, and percentage gates.

## 技术方案取舍

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. Reopen and rewrite every completed substrate change | Uncheck or rewrite existing tasks for batching, virtualization, chunking, and hub split. | High churn; loses useful first-slice evidence; likely conflicts with ongoing large-file work. | Rejected. |
| B. Add a readiness umbrella change | Keep completed first slices intact, then define the remaining cross-cutting release-grade closure plan in one coordinating change. | Requires discipline so the umbrella does not become vague meta-work. | Selected. |
| D. Rename the change and capability to 95/99 | Make the target visible in the path. | High churn; breaks existing references and does not add engineering value. | Rejected; keep path, upgrade semantics. |
| C. Start implementation immediately without new artifacts | Fastest path to code. | Violates the user’s documentation-only boundary and PlanFirst/OpenSpec discipline. | Rejected. |

## Capabilities

### New Capabilities

- `harness-governance-90-readiness`: defines the cross-cutting readiness contract required to move the harness governance layer from first-slice foundation to 95%-99% release-grade governance-layer readiness.

### Modified Capabilities

- None in this documentation-only planning pass. Existing capability behavior remains unchanged until implementation tasks from this change are executed.

## Impact

- OpenSpec:
  - `openspec/changes/advance-harness-governance-to-90/**`
  - `openspec/project.md`
- Architecture docs:
  - `docs/architecture/harness-governance-strategy.md`
- Future implementation impact, not executed in this round:
  - `src/features/status-panel/components/StatusPanel.tsx`
  - `src/features/status-panel/utils/checkpoint.ts`
  - `src/features/governance/evidence/**`
  - `src/features/status-panel/utils/policies/**`
  - `src/features/threads/domain-events/**`
  - performance scripts and targeted tests for long-list/browser and webview startup evidence

## Acceptance Criteria

- The new OpenSpec change contains proposal, design, delta spec, and task artifacts.
- The task plan identifies the exact implementation sequence needed for 95%-99% governance-layer readiness.
- The design has a single canonical S0-S9 execution plan and contains no stale parallel summary plan that can drift from `tasks.md`.
- Existing active proposals are classified as first-slice complete, partially evidenced, or future implementation input.
- The proposal distinguishes the 90% floor, 95% release-grade target, and 99% evidence-complete target.
- No source code files are modified by this documentation-only pass.
- `openspec validate advance-harness-governance-to-90 --strict --no-interactive` passes.
