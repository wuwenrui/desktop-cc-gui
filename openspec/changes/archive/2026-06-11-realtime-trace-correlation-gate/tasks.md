# Tasks / 任务

## Planning / 规划

- [x] Inventory current realtime diagnostics, batcher, reducer, timeline render, and perf report artifacts.
- [x] Define turn trace id propagation boundary.
- [x] Define measured/proxy evidence classification for visible render timing.

## Implementation / 实施

- [x] Add correlated trace milestones from ingress to visible render and terminal settlement.
- [x] Store bounded per-turn trace summaries.
- [x] Add realtime visible lag/render amplification budgets to perf report artifacts.
- [x] Preserve batching, virtualization, and scroll anchoring behavior.
- [x] Ensure diagnostics are content-safe and bounded.

## Validation / 验证

- [x] Add focused tests for trace summary and budget classification.
- [x] Add long live assistant text + reasoning + tool blocks regression scenario where feasible.
- [x] Run `npm run perf:realtime:report`.
- [x] Run `npm run perf:realtime:boundary-guard`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `openspec validate realtime-trace-correlation-gate --strict --no-interactive`.
