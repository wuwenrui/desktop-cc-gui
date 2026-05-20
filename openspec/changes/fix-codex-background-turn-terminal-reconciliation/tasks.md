## 1. Investigation And Test Harness

- [x] 1.1 [P0][depends:none][I: current Codex realtime hook code + screenshots][O: failing event sequence][V: A background / B active ownership path identified] Confirm the exact route where assistant completion can arrive without same-thread terminal settlement.
- [x] 1.2 [P0][depends:1.1][I: existing Vitest hook/reducer tests][O: regression test target][V: test can model background A, active B, A completion evidence] Identify or create the narrowest frontend test seam.

## 2. Terminal Ownership And Reconcile Implementation

- [x] 2.1 [P0][depends:1.1][I: Codex realtime event routing][O: event-owned terminal target resolution][V: terminal-like events no longer use highlighted active thread fallback] Route Codex terminal/reconcile decisions through explicit thread/turn ownership.
- [x] 2.2 [P0][depends:2.1][I: assistant completion diagnostics][O: bounded assistant-complete reconcile scheduling][V: assistant completion schedules at most one reconcile and does not directly clear processing] Add thread-scoped follow-up reconciliation after assistant completion evidence.
- [x] 2.3 [P1][depends:2.2][I: thread activation flow][O: activation-time terminal-drift reconcile][V: switching back to stale processing Codex thread triggers one lightweight reconcile] Add activation recovery without broad refresh of live processing threads.

## 3. Regression Coverage

- [x] 3.1 [P0][depends:2.1][I: event routing test][O: multi-session ownership coverage][V: A completion does not mutate B] Cover background A / highlighted B terminal ownership.
- [x] 3.2 [P0][depends:2.2][I: assistant completion test][O: missing terminal follow-up coverage][V: reconcile scheduled once; processing clears only after authoritative reconcile] Cover assistant-complete without matching `turn/completed`.
- [x] 3.3 [P1][depends:2.3][I: activation flow test][O: stale processing activation coverage][V: activation reconcile is idempotent and live processing without drift remains protected] Cover switch-back recovery boundaries.

## 4. Validation And Governance

- [x] 4.1 [P0][depends:3.1,3.2][I: focused tests][O: test evidence][V: relevant Vitest suites pass] Run focused frontend regression tests.
- [x] 4.2 [P1][depends:4.1][I: frontend typecheck][O: type evidence][V: `npm run typecheck` or project-equivalent typecheck passes] Run type validation for touched TypeScript.
- [x] 4.3 [P0][depends:4.1][I: OpenSpec artifacts][O: strict validation evidence][V: `openspec validate fix-codex-background-turn-terminal-reconciliation --strict --no-interactive` passes] Validate the change contract.

## 5. Review Hardening

- [x] 5.1 [P0][depends:2.3][I: review finding: previous final evidence][O: current-turn-scoped assistant evidence guard][V: activation of a new live turn is not settled by an older final answer] Harden activation/settlement evidence so previous assistant finals cannot end a successor turn.
- [x] 5.2 [P0][depends:2.1][I: review finding: shared/non-Codex boundary][O: shared-safe Codex quarantine][V: shared completed turns are not quarantined as Codex] Preserve shared/non-Codex terminal quarantine boundaries.
- [x] 5.3 [P1][depends:5.1][I: review finding: unknown tool status][O: conservative active-work guard][V: unknown tool status blocks terminal-drift settlement] Treat unknown tool status as active work during terminal-drift settlement.
