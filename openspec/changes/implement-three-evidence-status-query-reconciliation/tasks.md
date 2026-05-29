## 1. Backend Runtime Status Query

- [x] 1.1 Add bounded request/response DTOs and Tauri command for scoped turn reconciliation status.
- [x] 1.2 Track recent runtime-ended affected thread/turn scope for status query matching.
- [x] 1.3 Add Rust tests for running, scoped runtime-ended, and unknown/stale-scope outcomes.

## 2. Frontend Bridge And Reconciliation

- [x] 2.1 Add service/types mapping for the status query command.
- [x] 2.2 Wire Phase 1 `request-reconciliation` dry-run into a scoped one-shot query.
- [x] 2.3 Emit bounded requested/resolved/rejected/failed diagnostics and persist abnormal outcomes.
- [x] 2.4 Add focused Vitest coverage for status mapping and hook diagnostics.

## 3. Verification

- [x] 3.1 Validate OpenSpec change strictly.
- [x] 3.2 Run focused tests plus typecheck/lint.
