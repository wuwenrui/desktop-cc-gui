# Design: Close Performance Iteration 2026-06

OpenSpec change: `close-performance-iteration-2026-06`

## Current Fact Baseline

This design is calibrated to the closure baseline recorded on 2026-06-13:

- `openspec list --json` has one active change: `close-performance-iteration-2026-06`.
- Original closure baseline `git log -1` is `1a12200d chore(openspec): 归档 10 个已完成 change 至 2026-06-12`. Later unrelated commits do not change the evidence baseline as long as this change's diff remains scoped to OpenSpec/perf artifacts.
- `docs/perf/baseline.json` has 28 metrics.
- `docs/perf/baseline.json` has two unit conflicts: `bundleSizeMain` and `bundleSizeVendor`.
- `docs/perf/baseline.json` has 21 metrics without a `budget` block.
- `docs/perf/runtime-evidence-gates.json` has 9 `evidenceClass=unsupported` records.
- `docs/perf/runtime-evidence-gates.json` still lists 8 archived changes in `archiveReadiness.completed`.
- `docs/perf/runtime-evidence-gates.json` has 10 P0/P1 `largeFileSummary.candidates` without `owner` / `followUp`.

## Implementation Principles

- This is a closure/evidence-governance change.
- Do not change frontend/backend runtime behavior.
- Do not add npm dependencies.
- Prefer structured JSON checks over markdown scraping.
- Keep unsupported/proxy evidence visible; do not upgrade evidence class without source data.
- Keep `budget-missing` as warn/residual classification, separate from `unit-conflict`.
- Treat stale active-change state, unit conflict, malformed hardFail annotation, and ownerless P0/P1 large-file debt as hard failures.

## Stage 0. Preflight

Record current facts before touching artifacts:

- `git log --oneline -1`
- `git status --short`
- `openspec list --json`
- `node` summary of:
  - baseline metric count
  - unit conflicts
  - budget-missing count
  - hardFail breaches
  - unsupported evidence count
  - large-file candidates and missing owner/followUp

Exit if `openspec list --json` shows performance changes other than this closure change as active; that would mean the proposal baseline is stale again.

## Stage 1. Archive-Readiness Gate

Add `scripts/perf-archive-readiness.mjs`.

### Inputs

- `docs/perf/baseline.json`
- `docs/perf/runtime-evidence-gates.json`
- optional CLI flag: `--json`

### Checks

1. **Evidence class coverage**
   - Count `measured`, `proxy`, `manual-only`, `unsupported`, and missing evidence class.
   - Missing evidence class is hard failure.
   - Unsupported evidence is residual risk, not hard failure by itself.

2. **Unit consistency**
   - If a metric has both observed `unit` and `budget.unit`, they must match.
   - Mismatch is hard failure.
   - Missing `budget` is warn/residual, not unit conflict.

3. **HardFail annotation**
   - Any record with `budget.hardFail` must carry `budget.rollout`, top-level `rollout`, or top-level `status`.
   - Missing annotation is hard failure.
   - Actual value beyond hardFail remains visible as a breach, even if advisory rollout is present.

4. **ArchiveReadiness staleness**
   - `runtime-evidence-gates.json.archiveReadiness.completed` must not list changes that are absent from current `openspec list --json` active changes.
   - Stale completed entries are hard failure.

5. **Large-file debt ownership**
   - Every `largeFileSummary.candidates[]` entry with `priority` P0/P1 must include `owner` and `followUp`.
   - Missing owner/followUp is hard failure.

### Exit Codes

- `0`: pass
- `1`: hard failure
- `2`: no hard failure, but warn/residual items exist

## Stage 2. Baseline Unit Metadata

Update `docs/perf/baseline.json`:

- `S-CS-COLD/bundleSizeMain`: observed unit becomes `bytes-gzip`.
- `S-CS-COLD/bundleSizeVendor`: observed unit becomes `bytes-gzip`.

Update `docs/perf/baseline.md` so markdown reflects the same unit. If the existing generator rewrites these fields incorrectly, patch the markdown directly and leave generator correction as follow-up; this change must not grow into a generator rewrite.

## Stage 3. Runtime Evidence Gate Metadata

Update `docs/perf/runtime-evidence-gates.json` / `.md`:

- Remove already archived changes from current `archiveReadiness.completed`.
- Preserve the 8 archived changes in history / previous archive context if the schema supports it.
- Keep all 9 unsupported evidence records visible with reason / next action.
- Add `owner` and `followUp` to the 10 current P0/P1 large-file candidates.

Owner mapping:

- `src/services/tauri.ts`: `backend-modularization-debt`
- `src-tauri/src/engine/claude_history.rs`: `backend-modularization-debt`
- `src-tauri/src/codex/mod.rs`: `backend-modularization-debt`
- `src-tauri/src/git/mod.rs`: `backend-modularization-debt`
- `src-tauri/src/runtime/mod.rs`: `backend-modularization-debt`
- `src-tauri/src/engine/commands.rs`: `backend-modularization-debt`
- `src-tauri/src/engine/claude.rs`: `backend-modularization-debt`
- `src-tauri/src/session_management.rs`: `backend-modularization-debt`
- `src/features/threads/hooks/useThreadEventHandlers.ts`: `frontend-modularization-debt`
- `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`: `backend-modularization-debt`

## Stage 4. Spec Delta Calibration

Update `openspec/changes/close-performance-iteration-2026-06/specs/runtime-performance-evidence-gates/spec.md` so it describes the current contract:

- Unit consistency.
- HardFail annotation and residual breach visibility.
- ArchiveReadiness current-active reconciliation.
- P0/P1 large-file owner/followUp metadata.
- `npm run perf:archive-readiness` as the pre-archive gate for P0/P1 performance changes.

Do not edit the main spec directly in this stage. The main spec will be updated by OpenSpec sync/archive after this change is verified.

## Stage 5. Validation

Run:

```bash
npm run perf:archive-readiness
openspec validate close-performance-iteration-2026-06 --strict --no-interactive
git diff --stat
git diff -- 'src/**' 'src-tauri/**'
```

Expected:

- `npm run perf:archive-readiness` exits `0` or `2`.
- If it exits `2`, there MUST be zero hard failures and every warning/residual MUST be named in closure notes. The accepted residual set for this change is the known `budget-missing` class plus unsupported cold-start timing and summary-level runtime evidence gaps; do not treat `exit 2` as a generic pass.
- OpenSpec validation passes.
- No frontend/backend runtime source diff appears under `src/**` or `src-tauri/**`.

## Closure Calibration Decisions

### Readiness exit code

This change accepts `npm run perf:archive-readiness` exit `2` as the closure state only when the report has no hard failures. The residual warnings are not implementation failures; they are evidence debt that remains intentionally visible.

The 21 `budget-missing` metrics MUST remain warn/residual instead of being converted into synthetic budgets. A budget block requires a real owner-approved threshold source. Adding budget blocks during closure would create unsupported governance data.

### Realtime correlation hardFail annotations

The replay-derived realtime correlation records `S-RS-VL`, `S-RS-RA`, `S-RS-FD`, and `S-RS-TS` keep `budget.hardFail` thresholds and add `budget.rollout: "advisory-until-runtime-trace"`.

This is stricter than deleting `hardFail`: reviewers still see the threshold and can track the runtime-trace follow-up. The rollout annotation only downgrades archive-readiness enforcement from malformed metadata to residual risk; it does not upgrade proxy evidence to measured evidence.

### Unsupported evidence

Unsupported evidence remains visible with reason / next action. Closure MUST NOT rewrite unsupported records into measured/proxy records unless a source artifact exists.

## Failure Handling

- If readiness exits `1`, fix the listed artifact metadata before archive.
- If readiness exits `2`, record warn/residual items in verification before archive and confirm the report contains zero hard failures.
- If OpenSpec validation fails, fix the change-local spec delta; do not force archive.
- If evidence generator rewrites corrected units back to `bytes`, stop and inspect the generator. Do not silently archive with unit conflict.

## Out of Scope Follow-up

- `release-grade-evidence-collection`: collect measured runtime traces for realtime boundary metrics and Tauri webview cold-start.
- `bundle-size-optimization`: reduce `bundleSizeMain` below target.
- `frontend-modularization-debt`: split frontend hot-path large files.
- `backend-modularization-debt`: split bridge/runtime/backend large files while preserving command facade and payload compatibility.
