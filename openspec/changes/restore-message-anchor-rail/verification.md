# Verification

## Passed

- `npx vitest run src/features/messages/`
  - 68 test files passed.
  - 572 tests passed, 7 skipped.
  - Includes restored test "renders user-only anchors and scrolls on click".
- `npm run typecheck`
  - TypeScript passed.
- `npx eslint` on Messages.tsx / MessagesAnchorRail.tsx / MessagesTimeline.tsx / MessagesRows.tsx
  - 0 errors, 0 warnings.
- `git diff HEAD` audit
  - MessagesRows.tsx and messages.part1.css restored byte-identical to HEAD (revert 捆绑的 explore-inline 旧样式已剔除).

## Not Run

- `openspec validate restore-message-anchor-rail --strict --no-interactive`
  - Blocked because `openspec` is not installed or available on PATH.
