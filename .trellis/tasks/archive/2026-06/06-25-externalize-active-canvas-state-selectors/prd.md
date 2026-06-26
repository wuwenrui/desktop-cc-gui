# Externalize Active Canvas State Selectors

## Goal

Reduce active conversation streaming invalidation by moving high-frequency active canvas state behind a feature-local external-store selector boundary.

## Requirements

- Link to OpenSpec change: `externalize-active-canvas-state-selectors`.
- Do not introduce Redux/Zustand/Jotai or any new dependency.
- Keep provider/runtime/backend contracts unchanged.
- Preserve current `useLayoutNodes` public API while migrating canvas-heavy state consumption.
- Keep Shell summary boundary narrow and avoid routing full active canvas objects through shell-only nodes.

## Acceptance Criteria

- [x] Active canvas store uses `useSyncExternalStore`.
- [x] Selector equality suppresses unchanged slice updates.
- [x] Conversation canvas can consume heavy active state via selectors.
- [x] Focused tests cover selector equality and snapshot/thread coherence.
- [x] `npm run typecheck` passes.
- [x] `openspec validate externalize-active-canvas-state-selectors --strict --no-interactive` passes.

## Technical Notes

Initial scope is frontend-only. The store should remain feature-local and must not become a generic AppShell service locator.
