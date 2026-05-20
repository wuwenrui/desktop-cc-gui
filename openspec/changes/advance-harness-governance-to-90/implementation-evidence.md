## S1 Snapshot Injection Closure

Date: 2026-05-20

### Seam Inventory

- `StatusPanel` already collected workspace governance evidence through `useGovernanceEvidence` and rendered it in `GovernanceEvidenceSection`.
- `buildCheckpointViewModel` already accepted `governanceSnapshot?: GovernanceEvidenceSnapshot | null`.
- `bridgeGovernancePolicies` already consumed `CheckpointPolicyEvidence.governanceSnapshot`.
- The missing live seam was the `StatusPanel` call site: checkpoint construction did not pass the collected evidence snapshot into `buildCheckpointViewModel`.

### Implementation

- `StatusPanel` now imports `createFrozenGovernanceEvidenceSnapshot`.
- The governance evidence hook and snapshot memo are evaluated before checkpoint construction.
- `buildCheckpointViewModel` receives `governanceSnapshot` derived from collected governance evidence.
- Compact popover behavior remains unchanged: policy audit stays hidden when `compact` is true.
- `scripts/check-governance-evidence-bridge.mjs` now verifies that `StatusPanel` displays governance evidence and passes `governanceSnapshot` into `buildCheckpointViewModel`.

### Validation

- `npm exec vitest run src/features/status-panel/components/StatusPanel.test.tsx src/features/status-panel/utils/checkpoint.test.ts src/features/status-panel/utils/policies/bridgeGovernancePolicies.test.ts` passed: 92 tests.
- `npm run typecheck` passed.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.

### Residual Risk

- This closes the live snapshot injection path only. Gate artifact ingestion, provenance, replay, recovery, cross-platform evidence, and domain-event adoption remain future slices in this change.

## S2 Gate Result Evidence

Date: 2026-05-20

### Artifact Source Decisions

- Large-file evidence uses structured JSON reports emitted by `scripts/check-large-files.mjs --json-output`.
- The canonical local hard-gate artifact is `.artifacts/large-files-gate.json`.
- The canonical local advisory artifact is `.artifacts/large-files-near-threshold.json`.
- Heavy-test-noise evidence uses `.artifacts/heavy-test-noise.json`, generated from the same analyzer that reads `.artifacts/heavy-test-noise.log`.
- The UI evidence layer consumes artifacts only. It does not run shell commands or parse console output.

### Implementation

- `check-large-files.mjs` now supports `--json-output` with `schemaVersion`, gate identity, status, scope, finding counts, blocking counts, and raw scan results.
- `check-heavy-test-noise.mjs` now writes `.artifacts/heavy-test-noise.json` by default, including breach counts and the log path.
- `package.json` hard-gate and near-threshold large-file scripts now generate the canonical `.artifacts` JSON reports.
- `readGateArtifactEvidence` converts large-file and heavy-test-noise JSON artifacts into `GovernanceEvidence`.
- Missing and malformed artifacts degrade to `unknown` with `governance-artifact-missing` or `governance-artifact-malformed`.
- Heavy-test-noise remains advisory: raw `fail` is normalized to `warn` by the existing gate adapter.

### Validation

- `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs` passed: 17 tests.
- `npm exec vitest run src/features/governance/evidence src/features/status-panel/utils/policies` passed: 36 tests.
- `npm run check:large-files:gate` passed and wrote `.artifacts/large-files-gate.json`.
- `npm run check:large-files:near-threshold` passed and wrote `.artifacts/large-files-near-threshold.json`.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.
- `npm run typecheck` passed.
- `npm run check:heavy-test-noise` passed: 514 test files completed; environment warnings 1; act warnings 0; stdout payload lines 0; stderr payload lines 0; wrote `.artifacts/heavy-test-noise.json`.

### Residual Risk

- S2 provides artifact-backed result evidence, but release-grade provenance fields such as artifact hash and parser identity remain S6 work.

## S3 Domain Event Runtime Adoption

Date: 2026-05-20

### Producer Selection

- Selected producer: low-frequency turn terminal lifecycle.
- Emitted events: `turn.completed` and `turn.failed`.
- Rejected first producer: high-frequency `message.delta.appended`.
- Rationale: turn terminal events are bounded by user/runtime turns and avoid unbounded fan-out risk.

### Implementation

- `useThreadEventHandlers` now accepts an optional `DomainEventRuntimeController`.
- Turn terminal lifecycle emits via `domainEventController.emitInternal`.
- Application-facing `DomainEventRuntime` remains subscribe-only.
- `useThreads` creates a runtime controller and wires a governance-scoped consumer.
- `createDomainEventGovernanceConsumer` subscribes to terminal turn events and keeps a bounded in-memory snapshot.
- The consumer does not persist, transmit, or expose events through any dashboard.
- `scripts/check-agent-domain-event-adoption.mjs` verifies the real producer/consumer path and rejects high-frequency message-delta first adoption.

### Validation

- `npm exec vitest run src/features/threads/domain-events/*.test.ts src/features/threads/hooks/useThreadEventHandlers.test.ts` passed: 51 tests.
- `npm run check:agent-domain-event-schema` passed.
- `npm run check:agent-domain-event-adoption` passed.
- `npm run typecheck` passed.

### Residual Risk

- S3 proves one bounded runtime adoption path only. Broader event-derived governance evidence and replay remain later slices.

## Readiness Validation Bundle

Date: 2026-05-20

### Validation Commands

- `npm run typecheck` passed.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.
- `npm run check:agent-domain-event-schema` passed.
- `npm run check:agent-domain-event-adoption` passed.
- `npm run check:engine-capability-matrix` passed.
- `npm run check:large-files:gate` passed and wrote `.artifacts/large-files-gate.json`.
- `npm run check:large-files:near-threshold` passed and wrote `.artifacts/large-files-near-threshold.json`.
- `npm run check:heavy-test-noise` passed and wrote `.artifacts/heavy-test-noise.json`.
- `openspec validate advance-harness-governance-to-90 --strict --no-interactive` passed.
- `openspec validate --all --strict --no-interactive` passed: 283 items passed, 0 failed.

### 90% Floor Declaration

The implementation has reached the 90% minimum floor for the harness governance layer:

- Live checkpoint policy path consumes `GovernanceEvidenceSnapshot`.
- Gate result evidence exists for large-file and heavy-test-noise artifacts.
- One bounded runtime domain-event producer/consumer path exists for turn terminal events.
- Structural evidence validation is recorded through existing large-file, heavy-test-noise, engine matrix, and OpenSpec gates.

This is not a 95% or 99% claim. Provenance metadata, replay fixtures, degraded-state recovery expansion, operator handoff, platform evidence, S4 structural browser/runtime evidence, and final archive handoff remain open tasks.

## S6 Evidence Provenance And Replay

Date: 2026-05-20

### Provenance Contract

- `GovernanceEvidence` now carries optional `provenance` metadata with `sourceType`, `sourceId`, and `observedAt`.
- `createGovernanceEvidence` adds minimal workspace provenance when callers do not provide richer metadata.
- Artifact-backed large-file and heavy-test-noise evidence now carries parser id, adapter id, workspace-relative artifact path, observed-at timestamp, and SHA-256 artifact hash when Web Crypto is available.
- Missing and malformed artifact evidence remains degraded `unknown` and records an explicit provenance qualifier such as `artifact-missing` or `artifact-malformed`.
- `GovernanceEvidenceSnapshot` identity now includes provenance metadata, so replay or audit snapshots change when artifact identity changes.

### Replay Fixtures

- Replay fixture: `src/features/governance/evidence/fixtures/governanceEvidenceReplayFixtures.ts`.
- Fixture scope: representative `pass`, `warn`, `fail`, and `unknown` governance evidence.
- Fixture paths are workspace-relative and contain no user-specific absolute path.
- Replay test constructs a frozen `GovernanceEvidenceSnapshot` from the fixture and evaluates `buildCheckpointViewModel` without reading the filesystem, running shell commands, or mutating OpenSpec/Trellis artifacts.
- Replay assertions cover deterministic bridge-fed policy audit decisions for OpenSpec, large-file, heavy-test-noise, and cost-budget evidence.

### Type Surface

- `CheckpointViewModel.policyAudit` now exposes `readonly PolicyDecision[]`, preserving existing policy metadata such as `degradationReason`, `evidenceSnapshotId`, and future gate contribution details.
- This aligns the public view model type with the existing runtime value returned by `evaluatePolicyChain`.

### Validation

- `npm exec vitest run src/features/governance/evidence src/features/status-panel/utils/policies src/features/status-panel/utils/checkpoint.test.ts` passed: 59 tests.
- `npm run typecheck` passed.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.

### Residual Risk

- S6 proves provenance and deterministic replay locally. It does not claim 99% platform-complete readiness; Windows/Linux evidence and operator recovery handoff remain S7/S8/S9 work.

## S7 Cross-Platform Release Evidence

Date: 2026-05-20

### Compatibility Coverage

- Path separators: `scripts/check-large-files.test.mjs` covers Windows-style policy and baseline paths resolving to canonical repo paths.
- Path separators: `src/features/governance/evidence/readers.test.ts` covers Windows and POSIX workflow paths.
- Path separators: `src/features/governance/evidence/governanceEvidence.test.ts` covers Windows/macOS source paths plus provenance artifact path normalization.
- Newlines: `src/features/governance/evidence/readers.test.ts` covers LF and CRLF OpenSpec task markdown and CRLF gate artifact JSON.
- Newlines: `scripts/check-heavy-test-noise.test.mjs` covers ANSI-colored log lines and CRLF-tolerant line analysis through the shared `split(/\r?\n/)` parser path.
- Case sensitivity: no new governance parser relies on filesystem case sensitivity for matching runtime files. Required artifact paths remain explicit workspace-relative paths under `.artifacts/`; platform case behavior is therefore documented as qualified rather than claimed as a three-platform proof.
- Shell compatibility: modified governance gates are Node/npm entrypoints (`node scripts/check-large-files.mjs`, `node scripts/check-heavy-test-noise.mjs`, `node scripts/check-governance-evidence-bridge.mjs`, `node scripts/check-checkpoint-policy-chain.mjs`) and do not require POSIX-only inline shell for their own execution.

### Platform Evidence Matrix

| Platform | Command | Run URL Or Artifact Path | Date | Commit | Result | Qualifier |
|---|---|---|---|---|---|---|
| macOS arm64 / Darwin 25.4.0 | `npm run typecheck` | local terminal | 2026-05-20 | `a5e26d5c` | pass | local working tree includes uncommitted change implementation |
| macOS arm64 / Darwin 25.4.0 | `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs` | local terminal | 2026-05-20 | `a5e26d5c` | pass | local working tree includes uncommitted change implementation |
| macOS arm64 / Darwin 25.4.0 | `npm run check:large-files:gate` | `.artifacts/large-files-gate.json` | 2026-05-20 | `a5e26d5c` | pass | local artifact ignored by git |
| macOS arm64 / Darwin 25.4.0 | `npm run check:large-files:near-threshold` | `.artifacts/large-files-near-threshold.json` | 2026-05-20 | `a5e26d5c` | pass | local artifact ignored by git |
| Windows | `npm run typecheck`; `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs`; `npm run check:large-files:gate`; `npm run check:large-files:near-threshold` | external CI required | 2026-05-20 | `a5e26d5c` | not run | qualifier: unresolved external-CI evidence; caps readiness below 99% |
| Linux | `npm run typecheck`; `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs`; `npm run check:large-files:gate`; `npm run check:large-files:near-threshold` | external CI required | 2026-05-20 | `a5e26d5c` | not run | qualifier: unresolved external-CI evidence; caps readiness below 99% |

### Residual Risk

- S7 supports a 95% release-grade claim once S8/S9 close, but it does not support a 99% evidence-complete claim until actual Windows and Linux runs are recorded.

## S8 Recovery And Operator Handoff

Date: 2026-05-20

### Recovery Coverage

- Missing workspace id: `useGovernanceEvidence(null, true)` returns an empty stable state and does not call workspace file APIs.
- Missing artifacts: `readGateArtifactEvidence` emits degraded `unknown` evidence with `governance-artifact-missing`.
- Malformed artifacts: `readGateArtifactEvidence` emits degraded `unknown` evidence with `governance-artifact-malformed`.
- Stale artifacts: artifact evidence records `governance-artifact-stale`, keeps `staleAt`, and bridge policy evaluation contributes `needs_review` even if raw artifact status is `pass`.
- Duplicate policy decisions: `evaluatePolicyChain` deduplicates repeated policy decisions by policy/source/snapshot/degradation/stale identity without dropping distinct source decisions.
- Duplicate domain events: `createDomainEventGovernanceConsumer` dedupes terminal turn events by workspace/session/turn/type and keeps `unsubscribe()` idempotent.

### Operator Recovery Handoff

1. Missing or malformed gate artifact:
   - Inspect `GovernanceEvidence.degradationReason`.
   - Re-run `npm run check:large-files:gate`, `npm run check:large-files:near-threshold`, or `npm run check:heavy-test-noise` depending on the `source` and `artifactPath`.
   - Treat `large-file` hard gate failures as blocking; treat `large-file` near-threshold and `heavy-test-noise` as advisory unless another hard gate fails.
2. Stale artifact:
   - Use `staleAt` and `provenance.observedAt` to identify the stale report.
   - Re-run the producing command and confirm the new JSON artifact has a current `generatedAt`.
   - Do not mark readiness as fresh pass while `degradationReason=governance-artifact-stale` remains visible.
3. Workspace read failure:
   - Confirm workspace id and Tauri workspace file bridge availability.
   - The checkpoint remains stable with degraded workflow evidence; retry after bridge recovery.
4. Duplicate events or policy decisions:
   - Check for repeated terminal turn ids or repeated policy registrations.
   - The runtime consumer and policy chain now dedupe bounded duplicates, so recovery is cleanup-oriented rather than incident-blocking.
5. Rollback:
   - Revert only the affected slice files.
   - S6/S7/S8 code paths are isolated to governance evidence readers, policy evaluation, tests, and OpenSpec evidence; they do not add persistence, transport, or dashboard state.

### Validation

- `npm exec vitest run src/features/governance/evidence src/features/status-panel src/features/threads/domain-events` passed: 168 tests.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.
- `npm run check:agent-domain-event-schema` passed.
- `npm run check:agent-domain-event-adoption` passed.

### Residual Risk

- Recovery is local and deterministic. Broader production telemetry, release-channel monitoring, and actual Windows/Linux CI evidence remain outside this S8 slice.

## S4 Structural Substrate Evidence

Date: 2026-05-20

### Long-List And Webview Timing Evidence

- `npm run perf:long-list:baseline` passed and refreshed `docs/perf/long-list-baseline.json`.
- `S-LL-1000` remains fixture/jsdom evidence. `scrollFrameDropPct` is still explicitly marked with `notes: "jsdom proxy; browser scroll gate is follow-up"`.
- Browser-level scroll evidence is therefore recorded as unsupported in this local slice, not claimed as release-grade browser telemetry.
- `npm run perf:cold-start:baseline -- --skip-build` passed and refreshed `docs/perf/cold-start-baseline.json`.
- `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs` remain `value: null` with the existing unsupported reason: Tauri webview headless cold-start timing is not available in this script.
- `npm run perf:baseline:aggregate` passed and refreshed `docs/perf/baseline.json`, `docs/perf/baseline.md`, and the dated `docs/perf/history/v0.4.18-baseline-2026-05-20T01-00-52-978Z.*` snapshots.

### Hub Split Slice

- Selected hub: `src/features/layout/hooks/useLayoutNodes.tsx`.
- Before line count: 2475.
- After line count: 2446.
- Extracted responsibility: workspace header group expansion and worktree ordering.
- New helper: `src/features/layout/hooks/workspaceHeaderGroups.ts`.
- New targeted test: `src/features/layout/hooks/workspaceHeaderGroups.test.ts`.
- Public API compatibility: `useLayoutNodes` signature and return shape are unchanged; it now delegates the pure group construction to `buildWorkspaceHeaderGroups`.

### Validation

- `npm exec vitest run src/features/layout/hooks/workspaceHeaderGroups.test.ts src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx` passed: 7 tests.
- `npm run perf:long-list:baseline` passed.
- `npm run perf:cold-start:baseline -- --skip-build` passed.
- `npm run perf:baseline:aggregate` passed.
- `npm run check:large-files:gate` passed and wrote `.artifacts/large-files-gate.json`.
- `npm run check:large-files:near-threshold` passed and wrote `.artifacts/large-files-near-threshold.json`.
- `npm run typecheck` passed.

### Residual Risk

- This closes S4 honestly for local release-grade readiness evidence, but it still does not provide browser scroll telemetry or real Tauri webview timing. Those remain follow-up requirements for a future 99%+ claim.

## S9 Release-Grade Completion Review

Date: 2026-05-20

### Readiness Claim

- Current claim: **95% release-grade harness governance-layer readiness**.
- Not claimed: **99% evidence-complete readiness**.
- Scope boundary: this claim applies to the harness governance layer, not whole-harness ecosystem maturity, production telemetry, release-channel telemetry, or all historical hub debt.

### Why 95% Is Supported

- Live checkpoint policy path consumes `GovernanceEvidenceSnapshot`.
- Gate result artifacts are produced and consumed for large-file and heavy-test-noise checks.
- Consumed evidence now carries provenance metadata with source id and observed-at; artifact-backed evidence adds parser id, adapter id, artifact path, and artifact hash where Web Crypto is available.
- Replay fixture coverage reproduces deterministic checkpoint policy audit decisions without live filesystem or shell access.
- Recovery coverage handles missing workspace id, missing/malformed/stale artifacts, duplicate policy decisions, duplicate domain events, and idempotent unsubscribe.
- Operator recovery handoff documents how to identify degraded evidence, rerun gates, classify advisory versus blocking warnings, and rollback isolated slices.
- macOS local validation evidence is recorded, with Windows/Linux external-CI qualifiers explicitly capping the claim below 99%.
- Structural substrate evidence is honest: long-list browser scroll and Tauri webview timing are not fabricated.

### Why 99% Is Not Supported

- Windows and Linux evidence is not actually recorded in this local session.
- `S-LL-1000` browser-level scroll evidence remains unsupported; current data is fixture/jsdom proxy evidence.
- `firstPaintMs` and `firstInteractiveMs` remain unsupported because no trustworthy Tauri/webview timing source exists in this slice.
- The requested repository-local consistency script `.claude/skills/osp-openspec-sync/scripts/validate-consistency.py` is absent.
- The global fallback script `/Users/chenxiangning/.codex/skills/osp-openspec-sync/scripts/validate-consistency.py` currently fails with `SyntaxError` because the installed Python file contains an HTML comment marker.

### Final Validation Commands

- `npm run typecheck` passed.
- `npm exec vitest run src/features/governance/evidence src/features/status-panel src/features/threads/domain-events` passed: 168 tests.
- `npm exec vitest run src/features/layout/hooks/workspaceHeaderGroups.test.ts src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx` passed: 7 tests.
- `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs` passed: 17 tests.
- `npm run check:governance-evidence-bridge` passed.
- `npm run check:checkpoint-policy-chain` passed.
- `npm run check:agent-domain-event-schema` passed.
- `npm run check:agent-domain-event-adoption` passed.
- `npm run check:engine-capability-matrix` passed in the earlier readiness bundle.
- `npm run check:large-files:gate` passed and wrote `.artifacts/large-files-gate.json`.
- `npm run check:large-files:near-threshold` passed and wrote `.artifacts/large-files-near-threshold.json`.
- `npm run check:heavy-test-noise` passed in the earlier readiness bundle and wrote `.artifacts/heavy-test-noise.json`.
- `npm run perf:long-list:baseline` passed and refreshed `docs/perf/long-list-baseline.json`.
- `npm run perf:cold-start:baseline -- --skip-build` passed and refreshed `docs/perf/cold-start-baseline.json`.
- `npm run perf:baseline:aggregate` passed and refreshed aggregated perf baselines/history.
- `openspec validate advance-harness-governance-to-90 --strict --no-interactive` passed.
- `openspec validate --all --strict --no-interactive` passed: 283 items passed, 0 failed.
- `git diff --check` passed.

### Consistency Script Blocker

- Required command in task 9.4: `python3 .claude/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full`.
- Result: not runnable because `.claude/skills/osp-openspec-sync/scripts/validate-consistency.py` does not exist in this repository.
- Fallback attempted: `python3 /Users/chenxiangning/.codex/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full`.
- Fallback result: failed with `SyntaxError` at `<!-- Installed by AI REACH v0.2.0 -->`.
- Impact: archive handoff can be prepared, but final release-grade closure validation task 9.4 must remain open until this script path or installed script is fixed.

### Sync/Archive Handoff

- Do not archive until task 9.4 can run or the OpenSpec task is explicitly amended to use a working equivalent consistency checker.
- Before archive, run:
  - `openspec validate advance-harness-governance-to-90 --strict --no-interactive`
  - `openspec validate --all --strict --no-interactive`
  - a working OpenSpec/Trellis consistency checker
- If the consistency checker remains unavailable, archive should be blocked or explicitly approved with a documented waiver.
