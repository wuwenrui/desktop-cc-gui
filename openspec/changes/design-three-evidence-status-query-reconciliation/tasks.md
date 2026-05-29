## 1. Phase 2a Design Scope

- [x] 1.1 [P0][Input: Phase 1 dry-run implementation and current error-log sample][Output: proposal boundary][Verify: proposal has Goals/Non-Goals and solution comparison] Define Phase 2a as status-query reconciliation only, explicitly excluding cleanup and business-code changes.
- [x] 1.2 [P0][Input: `design-three-evidence-turn-settlement`][Output: design.md][Verify: design explains frontend/backend responsibilities, status enum, scope echo, and conservative mapping] Detail the authoritative status-query reconciliation flow.

## 2. Contract Deltas

- [x] 2.1 [P0][Input: conversation lifecycle contract][Output: lifecycle delta spec][Verify: scenarios forbid timeout/history completed and Phase 2a cleanup] Specify reconciliation-needed behavior and runtime recovery separation.
- [x] 2.2 [P0][Input: engine runtime contract][Output: runtime delta spec][Verify: scenarios require scoped request/response and bounded status enum] Specify future backend/runtime authoritative status query contract.
- [x] 2.3 [P1][Input: realtime diagnostics contract][Output: diagnostics delta spec][Verify: scenarios define bounded labels and persistence boundary] Specify reconciliation diagnostics and global error-log noise control.

## 3. Validation And Handoff

- [x] 3.1 [P0][Input: proposal/design/specs/tasks][Output: validated OpenSpec change][Verify: `openspec validate design-three-evidence-status-query-reconciliation --strict --no-interactive`] Validate the Phase 2a proposal draft.
- [x] 3.2 [P1][Input: Phase 2a design][Output: future implementation handoff boundary][Verify: tasks state that implementation is intentionally deferred] Record that code implementation must be a later implementation change after more Phase 1 evidence or explicit approval.
