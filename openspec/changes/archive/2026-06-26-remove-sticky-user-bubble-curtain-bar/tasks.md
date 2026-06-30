## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal/design/spec delta for removing sticky user bubble curtain bar; output: change artifacts under `openspec/changes/remove-sticky-user-bubble-curtain-bar`; validation: `openspec validate remove-sticky-user-bubble-curtain-bar --strict --no-interactive`.

## 2. Frontend Removal

- [x] 2.1 Remove `curtain.stickyUserBubble` from client UI visibility ids, defaults, registry, settings text, and documentation; output: no settings row or docs entry remains; validation: focused visibility/settings tests.
- [x] 2.2 Remove `showStickyUserBubble` prop flow from layout to `Messages`; output: `Messages` no longer receives sticky user bubble visibility state; validation: layout visibility test.
- [x] 2.3 Remove sticky user header rendering, CSS import/file, and sticky-only helper paths from message components; output: no `.messages-history-sticky-header` UI is rendered; validation: focused message tests.

## 3. Verification

- [x] 3.1 Update focused tests for the removed behavior and retained normal message behavior; output: tests no longer assert sticky header presence; validation: Vitest focused command.
- [x] 3.2 Run type and repository checks; output: no TypeScript or large-file regressions; validation: `npm run typecheck` and `npm run check:large-files`.
