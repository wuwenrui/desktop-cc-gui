## 1. OpenSpec Foundation

- [x] 1.1 [P0][depends:none][I: user optimization goals][O: proposal.md][V: proposal artifact marked done] Create the evidence-gate proposal.
- [x] 1.2 [P0][depends:1.1][I: proposal.md][O: design.md][V: design artifact marked done] Define evidence-first implementation design and rollback boundary.
- [x] 1.3 [P0][depends:1.1][I: existing specs][O: spec deltas][V: specs artifact marked done] Add runtime performance, realtime, session catalog, and large-file governance requirements.

## 2. Evidence Report Implementation

- [x] 2.1 [P0][depends:1][I: docs/perf/*.json][O: runtime performance evidence summary][V: generated markdown includes measured/proxy/unsupported/manual-only classifications] Implement performance evidence classification report.
- [x] 2.2 [P0][depends:2.1][I: realtime baseline JSON][O: realtime visible-lag/terminal-pressure summary][V: report includes first-token, jitter, and terminal-pressure notes] Add realtime scenario correlation.
- [x] 2.3 [P0][depends:2.1][I: cold-start baseline JSON][O: unsupported webview timing summary][V: unsupported timing remains explicit with reason] Preserve cold-start unsupported evidence.

## 3. Governance And Cleanup Calibration

- [x] 3.1 [P0][depends:1][I: openspec list --json][O: archive-readiness report][V: completed active and in-progress changes are separated] Generate OpenSpec archive-readiness guidance.
- [x] 3.2 [P1][depends:3.1][I: known session compatibility paths][O: compatibility cleanup matrix][V: paths are classified as retain/remove/defer with reason] Document compatibility versus dead-code cleanup status.
- [x] 3.3 [P1][depends:3.2][I: near-threshold large-file report][O: risk-ordered split candidates][V: hot-path files include headroom and facade note] Add large-file optimization next-step summary.

## 4. Script Wiring And Validation

- [x] 4.1 [P0][depends:2,3][I: package.json][O: evidence gate npm script][V: script runs locally] Add package script for evidence report generation.
- [x] 4.2 [P0][depends:4.1][I: touched files][O: validation evidence][V: OpenSpec strict validate, typecheck, and relevant checks pass] Run validation gate.
- [x] 4.3 [P0][depends:4.2][I: validation result][O: tasks/proposal closeout notes][V: task list accurately reflects completed work and residual qualifiers] Update task status and closeout notes.

## 5. Browser Long-List Evidence

- [x] 5.1 [P0][depends:4][I: S-LL-1000 fixture shape][O: Chrome/Chromium CDP scroll script][V: script writes measured or unsupported JSON] Implement dependency-free browser scroll gate.
- [x] 5.2 [P0][depends:5.1][I: package.json][O: perf:long-list:browser-scroll script][V: npm script runs locally] Wire browser scroll package script.
- [x] 5.3 [P0][depends:5.1][I: browser-scroll JSON][O: runtime evidence report includes browser evidence][V: report source points to browser-scroll JSON] Teach evidence report to consume browser-scroll fragment.
- [x] 5.4 [P0][depends:5.2,5.3][I: validation commands][O: updated verification notes][V: browser scroll script, evidence gate, OpenSpec, typecheck pass] Run validation and update closeout notes.

## 6. Heavy-Test Noise Stabilization

- [x] 6.1 [P0][depends:5][I: heavy-test-noise failure][O: cleanup-safe virtualizer offset observer][V: focused Messages live behavior test passes] Clear pending virtualizer scroll fallback timeout on unmount.
- [x] 6.2 [P0][depends:6.1][I: validation commands][O: heavy-test-noise evidence][V: check:heavy-test-noise no longer reports the virtualizer teardown error] Re-run heavy-test-noise validation.

## 7. Review Calibration

- [x] 7.1 [P0][depends:5][I: browser gate review][O: unsupported fallback exit behavior][V: browser gate writes measured or unsupported JSON without treating unsupported environments as script failures] Review browser gate edge cases.
- [x] 7.2 [P0][depends:2][I: missing or malformed evidence sources][O: explicit unsupported source rows][V: report unit tests cover missing baseline/browser sources and malformed realtime values] Review evidence report boundary handling.
- [x] 7.3 [P0][depends:7.1,7.2][I: CI sentry workflows][O: validation evidence][V: parser tests, large-file sentry, heavy-test-noise sentry, typecheck, OpenSpec, and diff hygiene pass] Validate workflow-equivalent gates.
