# Verification

Date: 2026-05-20

## Implementation Evidence

- Advisory policy ceiling is enforced in `src/features/status-panel/utils/policies/bridgeGovernancePolicies.ts` with `AdvisoryBridgeContribution = Exclude<PolicyVerdictContribution, "blocked">`.
- Policy audit rows now carry structured `enforcement` metadata in `src/features/status-panel/utils/policies/policyTypes.ts`, allowing audit rendering to distinguish `blocking`, `advisory`, and `informational` without parsing display text.
- Checkpoint presentation uses `buildCheckpointSectionProjection()` in `src/features/status-panel/utils/checkpointSections.ts` to expose Summary, Advisory Signals, Evidence Trail, Policy Audit, and Suggested Actions.
- `src/features/status-panel/components/CheckpointPanel.tsx` renders advisory signals and suggested commands as guidance. Rendering these actions does not execute commands and does not mutate checkpoint verdicts.
- Review fix: same-source bridge evidence now selects the most severe advisory contribution, so a sorted `pass` row cannot hide a `warn`, `fail`, stale, degraded, or platform-qualified row.
- Review fix: bridge-fed policy decisions now preserve provenance fields for Evidence Trail rendering: observed time, artifact path, artifact hash, and qualifier.
- Review fix: `engine-runtime-contract` evidence now has a bridge-fed optional governance policy and suggested command path.
- `scripts/check-checkpoint-policy-chain.mjs` and `scripts/check-governance-evidence-bridge.mjs` enforce that bridge-fed governance policy contributions cannot introduce `blocked`.

No new blocking gate was introduced in this phase. Existing runtime, fatal, and core hard-failure paths retain their blocking semantics.

## Validation Evidence

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | TypeScript completed without errors. |
| `npx vitest run src/features/status-panel/components/StatusPanel.test.tsx src/features/status-panel/components/audit/PolicyDecisionAuditPanel.test.tsx src/features/status-panel/utils/checkpointSections.test.ts src/features/status-panel/utils/policies/bridgeGovernancePolicies.test.ts src/features/status-panel/utils/audit/policyDecisionFormatter.test.ts` | PASS | 5 files, 89 tests passed after review fixes. |
| `npm run check:checkpoint-policy-chain` | PASS | Conformance check reported `[checkpoint-policy-chain] ok`. |
| `npm run check:governance-evidence-bridge` | PASS | Conformance check reported `[governance-evidence-bridge] ok`. |
| `npm run check:large-files` | PASS | `scope=fail`, `found=0`. |
| `openspec validate soften-harness-governance-to-advisory-mode --strict --no-interactive` | PASS | Change is valid. |
| `openspec validate --all --strict --no-interactive` | PASS | 286 items passed, 0 failed. |
| `npm run check:heavy-test-noise` | ADVISORY RESIDUAL | Fails in unrelated session-management tests: `useWorkspaceSessionCatalog.test.tsx` has three 5000ms timeouts. The command wrote `.artifacts/heavy-test-noise.log` and `.artifacts/heavy-test-noise.json`. This residual is outside the harness advisory policy/checkpoint write set and is not treated as a new blocking gate for this change. |

## Sync / Archive Readiness

- Tasks are complete for advisory-only harness governance semantics, checkpoint section structure, policy audit metadata, conformance checks, and focused frontend validation.
- Main specs and Trellis frontend code-spec have been calibrated to the implementation contract.
- Main spec sync/archive can proceed after the unrelated session-management timeout residual is accepted as external to this change or resolved by the owning change.
- Archive note should preserve the advisory residual above so future readers do not confuse it with a harness governance failure.
