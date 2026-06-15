## Design Overview

This change is a safety-door refactor. It should reduce orchestration entropy without changing the product surface.

Current problem shape:

```text
app-shell.tsx
  -> owns many cross-feature values
  -> wires layout
  -> defines runtime/task/navigation/context callbacks
  -> passes broad ctx objects into useAppShellSections/renderAppShell

useThreads / useThreadMessaging
  -> session lifecycle
  -> realtime/history
  -> send/start/fork/recovery
  -> memory capture
  -> shared session compatibility
```

Target shape:

```text
AppShell
  -> assembly only
  -> typed section contexts
  -> feature-local controllers

Action boundaries
  runtimeActions
  taskRunActions
  navigationActions
  contextActions

Thread runtime
  sessionLifecycleController
  messageRuntimeController
  compatibility facade: useThreads / useThreadMessaging
```

## AppShell Boundary

`app-shell.tsx` should converge on:

- creating high-level feature state hooks;
- composing section hooks;
- wiring layout nodes and render shell;
- no long inline business action bodies;
- no cross-feature action branching when a feature-local controller can own it.

Action families:

| Family | Owns | Should not own |
|---|---|---|
| runtime | renderer/runtime process lifecycle, runtime notices, recovery entrypoints | task-specific lifecycle semantics |
| task/run | TaskRun/Orchestration/Project Map run actions | thread message send internals |
| navigation | active view, panel opening, selection routing | runtime state mutation |
| context | file refs, memory/context injection, evidence/context open actions | message transport lifecycle |

Implementation should prefer existing `app-shell-parts/*Section.ts` patterns. Do not introduce a global event bus.

## useThreads Runtime Boundary

The extraction should keep public hook contracts stable while moving internal responsibilities.

`sessionLifecycleController` owns:

- create/select/recover session;
- session binding and stale binding recovery;
- lifecycle diagnostics;
- shared session compatibility;
- first-turn/session-start guardrails.

`messageRuntimeController` owns:

- send message orchestration;
- realtime turn event application;
- history replay coordination;
- optimistic user/assistant message state;
- cancellation/failure propagation to caller.

Compatibility rule:

- `useThreads` and `useThreadMessaging` may remain public facades during P0.
- Existing tests should keep importing the public hooks unless the extraction creates a smaller testable unit.

## Type-Safety Plan

Remove `@ts-nocheck` in this order:

1. `renderAppShell.tsx`: define a `RenderAppShellContext` type because it is mostly prop plumbing.
2. `useAppShellSections.ts`: define section input/output types and split oversized context bags.
3. `app-shell.tsx`: remove after section and render contracts are typed.

Do not silence type debt with broad `any` or large index signatures. Temporary narrow `unknown` parsing is acceptable only at external/input boundaries.

## Testing Strategy

Focused tests:

- AppShell action routing does not dispatch task/run actions through runtime/navigation handlers.
- `renderAppShell` accepts typed context and preserves existing rendered surfaces.
- Session lifecycle controller handles create/select/recover without message send side effects.
- Message runtime controller handles send/realtime/history without session catalog mutation except through explicit lifecycle callbacks.
- Existing thread messaging and session lifecycle regression suites continue to pass.

Validation:

- `openspec validate split-app-shell-runtime-boundaries --strict --no-interactive`
- Focused Vitest for touched AppShell/thread runtime files.
- `npm run typecheck`
- `npm run lint`

## Rollout

### P0.1 AppShell Action Boundary

- Extract typed runtime/task-run/navigation/context action modules or section hooks.
- Keep behavior equivalent.
- Add focused tests for routing and callback preservation.

### P0.2 Thread Runtime Boundary

- Extract lifecycle and message runtime controllers behind compatibility facades.
- Keep existing public hook API stable.
- Add focused controller tests and rerun existing thread runtime suites.

### P0.3 Core Type Safety Gate

- Remove `@ts-nocheck` from render, section, and shell files in that order.
- Replace broad context bags with typed contracts.
- Run typecheck/lint and focused AppShell/thread suites.

Implementation note:

- The first attempt to remove `@ts-nocheck` from `renderAppShell.tsx` exposed a structural blocker: the render context destructured a very large bag with many unused fields.
- The safe fix was to shrink the render context to only consumed fields and generate an explicit key-level `RenderAppShellContext`. `renderAppShell.tsx` can now typecheck without `@ts-nocheck`.
- The same shrink-first pattern also works for `useAppShellSections.ts`; it now uses an explicit key-level context and typechecks without `@ts-nocheck`.
- `app-shell.tsx` now typechecks without `@ts-nocheck`; the prior unused-import and section-contract blockers were resolved by earlier section/render shrinking.
- Action boundaries are explicit typed contracts via `defineAppShellRuntimeActions`, `defineAppShellTaskRunActions`, `defineAppShellNavigationActions`, and `defineAppShellContextActions`. They preserve existing callback identities while preventing runtime/task-run/navigation/context ownership from being inferred from a loose object bag.
- Temporary compatibility context bags remain only as migration seams for legacy section/render plumbing; new P0 action boundaries are typed contracts rather than new broad `any` replacements.

## Risks

- Moving too much at once can create invisible behavior regressions.
- Over-typing before extraction can freeze bad boundaries.
- Extracting controllers without compatibility facades can break many tests at once.
- Creating a new global orchestration layer would just move the same coupling elsewhere.

## Rollback

- Each P0 phase should be a separate commit.
- If a controller extraction regresses behavior, restore the compatibility facade implementation and keep only tests/spec updates.
- If type removal blocks on hidden coupling, keep the boundary extraction and defer the specific `@ts-nocheck` removal with a documented blocker.
