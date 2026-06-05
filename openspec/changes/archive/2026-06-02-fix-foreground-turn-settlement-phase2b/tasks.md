## 1. Contract And Regression Tests

- [x] 1.1 Add focused tests for matched terminal evidence plus `cleanup-residue + busy-residue` applying cleanup only to the matching foreground turn.
- [x] 1.2 Add focused tests for `running`, `unknown`, `query-failed`, stale scope, and scope mismatch denying cleanup.
- [x] 1.3 Add focused tests for watchdog interrupted race so an interrupted old turn cannot remain pseudo-processing.

## 2. Phase2b Guarded Cleanup

- [x] 2.1 Introduce or consolidate a scoped foreground residue settlement helper.
- [x] 2.2 Wire three-evidence `cleanup-residue` decisions to the helper.
- [x] 2.3 Route watchdog interrupted cleanup through the same helper where scope evidence is available.
- [x] 2.4 Ensure cleanup is idempotent and cannot clear a newer active turn.

## 3. Diagnostics

- [x] 3.1 Emit bounded `cleanup-applied` / `cleanup-skipped` diagnostics if needed for triage.
- [x] 3.2 Keep persisted error-log labels low-volume and free of prompt/output/tool/file-diff content.

## 4. Verification

- [x] 4.1 Run strict OpenSpec validation for this change.
- [x] 4.2 Run focused Vitest suites for touched lifecycle code.
- [x] 4.3 Run `npm run typecheck` and targeted lint/test gates required by touched files.
