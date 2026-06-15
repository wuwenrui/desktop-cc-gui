# Verification

- `npx vitest run src/app-shell-parts/useAppShellLayoutNodesSection.test.ts`
- `npx vitest run src/features/threads/hooks/useThreadActions.codex-rewind.test.tsx`
- `openspec validate fix-message-fork-workspace-mutation --strict --no-interactive`
- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files`
- `git diff --check`

All commands passed.
