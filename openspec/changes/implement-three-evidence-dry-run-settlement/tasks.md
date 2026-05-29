# Tasks

- [x] 1.1 [P0][Input: top-level design-three-evidence-turn-settlement design][Output: Phase 1 implementation proposal/design/specs][Verify: `openspec validate implement-three-evidence-dry-run-settlement --strict --no-interactive`] Create implementation change artifacts scoped to pure helper + dry-run diagnostics only.
- [x] 2.1 [P0][Input: design contract][Output: `turnSettlementDecision` pure helper and exported types][Verify: focused unit tests] Implement `evaluateTurnSettlement(evidence, policy, nowMs)` with scope gate, progress protection, terminal arbitration, and reconciliation-needed decisions.
- [x] 2.2 [P0][Input: helper][Output: unit tests][Verify: Vitest focused suite] Cover matched terminal, busy residue, missing scope, scope mismatch, stale turn, stale runtime lease, fresh progress, missing terminal, reconciliation disabled.
- [x] 2.3 [P1][Input: existing thread turn diagnostics][Output: dry-run diagnostic integration][Verify: focused hook/debug tests] Call helper from existing terminal/residue/suspected-stuck observation path without changing lifecycle state.
- [x] 2.4 [P1][Input: dry-run diagnostics][Output: bounded debug/error-log payload][Verify: tests assert no content fields] Persist only ids/enums/timestamps/counts/bounded reasons.
- [x] 3.1 [P0][Input: implementation][Output: validation results][Verify: `npm run typecheck`, focused Vitest, `openspec validate implement-three-evidence-dry-run-settlement --strict --no-interactive`] Run verification and document any skipped suites.
