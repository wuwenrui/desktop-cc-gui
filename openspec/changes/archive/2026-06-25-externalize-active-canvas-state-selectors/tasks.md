## 1. Spec And Boundary Setup

- [x] 1.1 Add OpenSpec proposal/design/tasks/spec deltas for selector-based active canvas state.
- [x] 1.2 Confirm previous completed performance changes are validated and archived.

## 2. Active Canvas External Store

- [x] 2.1 Add a feature-local active canvas store based on `useSyncExternalStore`.
- [x] 2.2 Add selector hook with default `Object.is` equality and shallow equality helper.
- [x] 2.3 Add tests proving selected-value equality suppresses notifications and thread switch snapshots stay coherent.

## 3. Layout And Canvas Migration

- [x] 3.1 Synchronize active canvas snapshot from `useLayoutNodes` without changing public layout API.
- [x] 3.2 Move Conversation canvas heavy state consumption behind selector-based component boundary.
- [x] 3.3 Keep Shell summary boundary narrow; do not route full active canvas objects through shell-only nodes.
- [x] 3.4 Preserve existing Composer live advisory deferral and message settlement behavior.

## 4. Verification

- [x] 4.1 Run focused Vitest suites for active canvas store and layout/canvas boundary.
- [x] 4.2 Run `npm run typecheck`.
- [x] 4.3 Run `openspec validate externalize-active-canvas-state-selectors --strict --no-interactive`.

## 5. Composer And StatusPanel Live Slice Closure

- [x] 5.1 Move Composer live advisory props to the active canvas selector store.
- [x] 5.2 Move StatusPanel dock live props to the active canvas selector store.
- [x] 5.3 Re-run focused layout/composer/status tests and validation after the live-slice migration.
