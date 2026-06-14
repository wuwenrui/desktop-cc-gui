# Proposal: Close Performance Iteration 2026-06

## Why

As of 2026-06-13, `openspec list --json` reports only this change as active:

- `close-performance-iteration-2026-06`
- tasks: `0/35`
- Original closure baseline HEAD: `1a12200d chore(openspec): 归档 10 个已完成 change 至 2026-06-12`

The earlier June performance iteration changes have already been archived. The remaining problem is not "archive those changes"; it is that the evidence layer still carries stale archive-readiness state and malformed performance metadata. If this closure change archives without fixing those facts, the next performance iteration will inherit a false signal: tasks can look complete while evidence still says `unsupported`, unit metadata conflicts, or structural debt has no owner.

Current evidence facts from `docs/perf/baseline.json` and `docs/perf/runtime-evidence-gates.json`:

1. **Stale archive readiness**
   - `archiveReadiness.completed` still lists 8 already archived changes:
     `realtime-input-and-io-isolation-2026-06`, `frontend-prop-chain-stability-2026-06`, `file-editor-io-render-isolation-2026-06`, `workspace-tree-and-large-file-listing-budget`, `markdown-off-main-thread-pipeline`, `backend-io-cache-and-bridge-payload-budget`, `renderer-resource-backpressure`, and `composer-and-message-row-render-budget`.
   - Ground truth is `openspec list --json`, so these entries must move out of "currently completed active changes" and into explicit history / previous-archive context.

2. **Bundle metric unit conflict**
   - `bundleSizeMain` and `bundleSizeVendor` have `unit: "bytes"` while `budget.unit: "bytes-gzip"`.
   - 21 other metrics have no `budget` block. That is not the same defect as unit conflict; the gate must distinguish `budget-missing` from `unit-conflict`.

3. **Current blocking budget breach**
   - `S-CS-COLD/bundleSizeMain = 1121481` exceeds `budget.hardFail = 1100000`.
   - `firstTokenLatency = 5000` and `interTokenJitterP95 = 920` sit exactly on their advisory hard-fail boundary and carry `rollout: advisory-until-runtime-trace`; they must remain visible as residual risk, but the current measured breach is `bundleSizeMain`.

4. **Unsupported evidence remains visible**
   - `runtime-evidence-gates.json` currently contains 9 `evidenceClass=unsupported` records, including cold-start webview timing (`firstPaintMs`, `firstInteractiveMs`) and summary-level evidence gaps for realtime input render budget, backend file I/O isolation, file watcher debounce, app-server batching, and frontend prop-chain stability.
   - The closure must not pretend these are measured. It must keep their next actions explicit.

5. **Large-file debt lacks ownership metadata**
   - `largeFileSummary.candidates` lists 10 P0/P1 files, but none have `owner` / `followUp` fields.
   - These are structural debt records, not completed optimization work. Archive-readiness must require owner and follow-up visibility.

This change is therefore a closure/evidence-governance change. It closes the iteration by making the evidence artifacts honest and machine-checkable, not by doing more runtime optimization.

> 🛠 **深度推演**：[L2/L3 分析摘要] 根因不是某个性能数字本身，而是 closure contract 把 "task-complete" 和 "evidence-ready" 混在了一起。正确抽象是建立 archive-readiness gate：完成状态、证据等级、预算口径、hardFail annotation、结构债 owner 必须各自可判定，不能靠叙述性 Markdown 兜底。

## Goals

- **G1**: Add `scripts/perf-archive-readiness.mjs` and `npm run perf:archive-readiness`.
- **G2**: Make archive-readiness gate check evidence class coverage, unit consistency, hardFail annotation, archiveReadiness staleness, and large-file owner/followUp metadata.
- **G3**: Fix `docs/perf/baseline.json` and `docs/perf/baseline.md` so `bundleSizeMain` / `bundleSizeVendor` use one unit truth (`bytes-gzip`) across observed value and budget.
- **G4**: Regenerate or patch `docs/perf/runtime-evidence-gates.{json,md}` so `archiveReadiness.completed` reflects active OpenSpec ground truth and archived changes are represented as history.
- **G5**: Add owner/followUp metadata for the 10 current P0/P1 large-file candidates.
- **G6**: Update `runtime-performance-evidence-gates` spec delta so future P0/P1 performance changes cannot archive with stale completed changes, mismatched units, naked hardFail thresholds, or ownerless structural debt.

## Non-Goals

- Do not optimize `bundleSizeMain`, `firstTokenLatency`, `interTokenJitterP95`, cold-start timing, renderer batching, or backend I/O in this change.
- Do not convert unsupported evidence to measured evidence; that belongs to follow-up runtime fixture / profiler / Tauri runner work.
- Do not split the 10 large files; this change only records owner/followUp metadata.
- Do not modify frontend or backend runtime behavior.
- Do not re-archive or revert the 10 changes already archived by `1a12200d`.
- Do not add new npm dependencies.
- Do not remove compatibility fallbacks or adapters such as unsupported worker paths, single-channel fallback paths, or backend compatibility surfaces.

## What Changes

- Add `scripts/perf-archive-readiness.mjs`.
- Add `package.json` script:
  - `perf:archive-readiness`
- Fix baseline bundle unit metadata:
  - `S-CS-COLD/bundleSizeMain`
  - `S-CS-COLD/bundleSizeVendor`
- Update generated / maintained performance evidence artifacts:
  - `docs/perf/baseline.json`
  - `docs/perf/baseline.md`
  - `docs/perf/runtime-evidence-gates.json`
  - `docs/perf/runtime-evidence-gates.md`
- Update the change-local spec delta for `runtime-performance-evidence-gates`.
- Keep all residual risks explicit:
  - measured bundle hardFail breach
  - advisory realtime boundary metrics
  - unsupported cold-start webview metrics
  - unsupported summary-level runtime evidence
  - large-file debt owner/followUp records

## Capabilities

### Modified Capabilities

- `runtime-performance-evidence-gates`
  - Add archive-readiness unit consistency requirement.
  - Add hardFail annotation requirement.
  - Add stale archiveReadiness reconciliation requirement.
  - Add large-file owner/followUp requirement.
  - Modify archive-readiness guidance so P0/P1 performance changes require `npm run perf:archive-readiness` before archive.

## Acceptance Criteria

- `scripts/perf-archive-readiness.mjs` exists and can be run directly with Node.
- `npm run perf:archive-readiness` exists.
- The readiness gate reports:
  - `unit-conflict` as hard failure.
  - `budget-missing` separately from `unit-conflict`.
  - hardFail records without `status` or `rollout` as malformed.
  - stale `archiveReadiness.completed` entries as failure.
  - P0/P1 large-file candidates without `owner` or `followUp` as failure.
  - unsupported evidence as visible residual risk, not as measured pass.
- `docs/perf/baseline.json` and `docs/perf/baseline.md` show `bundleSizeMain` and `bundleSizeVendor` with consistent `bytes-gzip` unit semantics.
- `docs/perf/runtime-evidence-gates.json` no longer treats the 8 already archived changes as current completed active changes.
- `docs/perf/runtime-evidence-gates.json` large-file candidates include owner/followUp metadata for all 10 current P0/P1 candidates.
- `npm run perf:archive-readiness` may exit `2` at closure time when only warn/residual items remain. For this change, the accepted residual set is the 21 `budget-missing` metrics plus 9 unsupported runtime-evidence records (cold-start timing plus summary-level runtime gaps); this does not authorize converting unsupported/proxy evidence to measured evidence or inventing budget blocks.
- The four realtime correlation proxy records from `docs/perf/realtime-extended-baseline.json` (`S-RS-VL`, `S-RS-RA`, `S-RS-FD`, `S-RS-TS`) may keep their `budget.hardFail` thresholds only when annotated with `budget.rollout: "advisory-until-runtime-trace"`. This preserves review visibility of thresholds without pretending the replay-derived evidence is release-grade runtime proof.
- `openspec validate close-performance-iteration-2026-06 --strict --no-interactive` passes.
- `git diff --stat` shows no frontend/backend runtime source change under `src/**` or `src-tauri/**`.

## Closure Decision Record

The closure target is **metadata correctness with explicit residual risk**, not `exit 0` at any cost.

- `budget-missing` remains a warn/residual class. Adding 21 budget blocks without source budgets would create fake evidence and violate the unsupported/proxy honesty rule.
- `hardFail` thresholds on replay-derived realtime correlation records are retained with advisory rollout annotations instead of being deleted. Deleting thresholds would reduce gate noise but would also hide the review boundary.
- `npm run perf:archive-readiness` exiting `2` is acceptable only when hard failures are zero and the residual warnings are recorded in this change's validation or archive notes.

## Impact

- `openspec/changes/close-performance-iteration-2026-06/**`: recalibrated change artifacts.
- `openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md`: change-local spec delta.
- `docs/perf/baseline.json` / `docs/perf/baseline.md`: bundle unit metadata.
- `docs/perf/runtime-evidence-gates.json` / `docs/perf/runtime-evidence-gates.md`: archive readiness, residual risk, and large-file owner/followUp metadata.
- `scripts/perf-archive-readiness.mjs` and `package.json`: new readiness command.

## Trade-offs

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. Only clear `archiveReadiness.completed` | Patch the stale list and stop. | Fastest. | Leaves unit conflict, ownerless debt, and unsupported evidence invisible to future archive workflows. | Rejected |
| B. Add archive-readiness gate and repair evidence metadata | Make closure machine-checkable without touching runtime code. | Fixes the contract that allowed task-complete to masquerade as evidence-ready. | Requires one new script and more artifact updates. | Accepted |
| C. Optimize the remaining performance numbers now | Reduce bundle size and collect measured runtime traces in this change. | Could improve release numbers. | Mixes closure governance with runtime optimization and expands blast radius. | Rejected for this change |
