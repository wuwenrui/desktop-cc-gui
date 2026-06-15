## 1. Planning / Contract

- [x] 1.1 Create OpenSpec change for AppShell/useThreads/type-safety architecture P0.
- [x] 1.2 Define scope as architecture safety-door work, not product UX redesign.
- [x] 1.3 Confirm this follows the completed `unify-client-workflow-runtime-model` P0 and does not reopen HomeChat dashboard decisions.
- [x] 1.4 Link or create a Trellis implementation task before code changes.

## 2. P0.1 AppShell Action Boundary

- [x] 2.1 Inventory action families currently defined or assembled by `app-shell.tsx`.
- [x] 2.2 Extract runtime action boundary while preserving existing behavior.
- [x] 2.3 Extract task/run action boundary for TaskRun, Orchestration, Project Map, and related run navigation actions.
- [x] 2.4 Extract navigation action boundary for view/panel/session surface routing.
- [x] 2.5 Extract context action boundary for file refs, memory refs, evidence refs, and context insertion.
- [x] 2.6 Add focused tests proving action routing is preserved and not cross-wired.

## 3. P0.2 useThreads Runtime Boundary

- [x] 3.1 Inventory responsibilities currently mixed across `useThreads`, `useThreadMessaging`, and `useThreadActionsSessionRuntime`.
- [x] 3.2 Extract `sessionLifecycleController` or equivalent lifecycle boundary.
- [x] 3.3 Extract `messageRuntimeController` or equivalent message transport/realtime boundary.
- [x] 3.4 Keep public `useThreads` / `useThreadMessaging` compatibility during migration.
- [x] 3.5 Add focused tests for lifecycle-only and message-runtime-only behavior.
- [x] 3.6 Rerun existing thread runtime suites touched by the extraction.

## 4. P0.3 Core Type Safety Gate

- [x] 4.1 Type `renderAppShell.tsx` context and remove `@ts-nocheck`.
- [x] 4.2 Type `useAppShellSections.ts` section inputs/outputs and remove `@ts-nocheck`.
- [x] 4.3 Type `app-shell.tsx` assembly boundary and remove `@ts-nocheck`.
- [x] 4.4 Avoid broad `any` replacement for core contracts; document any temporary `unknown` boundary.
- [x] 4.5 Add or update focused tests that protect typed shell contracts.

## 5. Regression / Validation

- [x] 5.1 Run `openspec validate split-app-shell-runtime-boundaries --strict --no-interactive`.
- [x] 5.2 Run focused AppShell section/render tests.
- [x] 5.3 Run focused thread lifecycle and message runtime tests.
- [x] 5.4 Run `npm run typecheck`.
- [x] 5.5 Run `npm run lint`.
