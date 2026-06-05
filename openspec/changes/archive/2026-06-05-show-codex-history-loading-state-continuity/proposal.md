## Why

Trellis task `show-codex-history-loading-state` remains open, but the current frontend already contains a dedicated history-loading presentation path for unloaded Codex history selection. This change closes the continuity gap by tying the existing implementation, tests, and main specs back to an OpenSpec artifact.

The key user-facing issue is basic but important: selecting an unloaded Codex history thread must not show the generic empty-thread placeholder while history restore is still in flight. The UI should show a scoped restoring state and clear it once local/runtime history loading settles.

## What Changes

- Capture the existing Codex history loading presentation behavior as completed OpenSpec continuity work.
- Verify the message surface renders `messages.restoringHistory` instead of `messages.emptyThread` while `isHistoryLoading` is true.
- Verify Codex thread selection tracks and clears `historyLoadingByThreadId` during lazy resume/local history restore.
- Keep the loading placeholder presentation-only; it must not become a durable transcript row.

## Non-Goals

- Do not redesign Codex history loading or session restore.
- Do not modify backend runtime acquisition, Windows behavior, or Claude AskUserQuestion resume handling.
- Do not touch the active `harden-windows-ask-user-question-resume` change.
- Do not introduce a new persistent state field.

## Impact

- Expected production-code impact: none unless focused validation exposes drift.
- Focused validation:
  - `src/features/messages/components/Messages.history-loading.test.tsx`
  - `src/features/threads/hooks/useThreads.sidebar-cache.test.tsx`
  - `npm run typecheck`
  - `openspec validate --all --strict --no-interactive`
