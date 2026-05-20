# Fix Workspace Session Catalog Heavy Test Timeout

## Goal

Fix the `useWorkspaceSessionCatalog` timeout exposed by `npm run check:heavy-test-noise` after the `refactor-workspace-session-management` closeout.

## Requirements

- Keep the session catalog query contract unchanged.
- Stop hook effects from reloading only because the caller passed a new but semantically identical `filters` object.
- Preserve stale-response protection when workspace selection is cleared.
- Keep the fix local to the session catalog hook and its focused regression tests.

## Acceptance Criteria

- [x] `npx vitest run src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx` passes.
- [x] `npm run check:heavy-test-noise` no longer fails on this timeout.
- [x] `openspec validate refactor-workspace-session-management --strict --no-interactive` passes.

## Technical Notes

- OpenSpec change: `refactor-workspace-session-management`
- Heavy test report: `.artifacts/heavy-test-noise.json`
- Log: `.artifacts/heavy-test-noise.log`
