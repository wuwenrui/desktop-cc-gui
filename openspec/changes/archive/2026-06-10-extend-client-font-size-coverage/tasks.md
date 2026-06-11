## 1. Planning / Contract

- [x] 1.1 Add OpenSpec proposal, design, tasks, and capability deltas for extending client font-size coverage.
- [x] 1.2 Validate change artifacts with OpenSpec strict validation. (`openspec validate extend-client-font-size-coverage --strict --no-interactive`)

## 2. Typography Token Foundation

- [x] 2.1 Add or refactor a shared helper for generating app typography CSS variables from `AppSettings.codeFontSize`.
- [x] 2.2 Update main-window root injection to expose the full typography token set.
- [x] 2.3 Update detached/client windows to consume the same token set without duplicating formulas.
- [x] 2.4 Add focused tests for token generation and detached-window style injection.

## 3. High-Value Surface Migration

- [x] 3.1 Migrate file/folder tree readable text to shared typography tokens.
- [x] 3.2 Migrate detached file explorer menubar and file-tree readable text to shared typography tokens.
- [x] 3.3 Migrate Git History/HUB worktree filetree typography variables to derive from the shared token contract.
- [x] 3.4 Migrate shared Git diff/filetree typography aliases where they should follow the content font size.
- [x] 3.5 Migrate screenshot-visible sidebar, message canvas, tool block, mobile tabbar, and session activity readable text to shared typography tokens.

## 4. Adjacent Surface Audit

- [x] 4.1 Audit file view and diff metadata font sizes and migrate content text where safe.
- [x] 4.2 Leave icon sizes, hit targets, layout gutters, and intentionally fixed markers unchanged.
- [x] 4.3 Record any intentionally fixed typography classes if they are likely to be questioned later.

## 5. Regression Validation

- [x] 5.1 Run focused settings / typography / detached-window tests. (`npm exec vitest run src/features/app/utils/typographyCssVars.test.ts src/styles/client-typography-font-size.test.ts src/features/files/components/DetachedFileExplorerWindow.test.tsx src/features/spec/components/DetachedSpecHubWindow.test.tsx src/features/client-documentation/components/ClientDocumentationWindow.test.tsx`)
- [x] 5.2 Run focused file tree and Git worktree tests or CSS contract tests. (`src/styles/client-typography-font-size.test.ts`)
- [x] 5.3 Run `npm run typecheck`.
- [x] 5.4 Run `npm run lint` when TS/TSX files are touched.
- [x] 5.5 Manually verify minimum/default/maximum font sizes across main canvas, file tree, Git worktree, diff/file view, and detached file explorer.
- [x] 5.6 Re-run focused tests and quality gates after the second-pass sidebar/message/session-activity coverage.


## Implementation Notes

- The first implementation pass intentionally migrated readable text and typography aliases only. Icon dimensions, row heights, hit targets, gutters, and layout density tokens were left unchanged so content font size does not become a second global zoom control.
- The second implementation pass extended the same token contract to screenshot-visible client chrome/content surfaces: sidebar navigation/workspace/thread/worktree labels, message Markdown/thinking/tool text, session activity tabs/radar/preview rows, and mobile tabbar labels. Decorative icons, row heights, compact status dots, and hit targets remain fixed.
- Focused validation also ran `npm run check:large-files` because CSS files were touched.
- Manual GUI verification for min/default/max font sizes was completed after the second pass and accepted as visually adequate.
