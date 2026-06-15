## 1. Planning / Contract

- [x] 1.1 Create OpenSpec change artifacts for P0 client workflow runtime integration.
- [x] 1.2 Correct planning baseline from deprecated `WorkspaceHome` to current `New Home / HomeChat`.
- [x] 1.3 Expand P0 from lightweight integration to full productized redesign scope.
- [x] 1.4 Confirm exact P0 UI copy, status labels, and visual direction before implementation.
- [x] 1.5 Link Trellis execution task to this OpenSpec change.
- [x] 1.6 Confirm this change remains an umbrella integration over existing `agent-task-*` and `runtime-orchestrator` specs.
- [x] 1.7 Confirm source routing table before implementation: Kanban, Orchestration, Project Map, Browser Evidence, New Home composer, and Task Center recovery.

## 1A. Delivery Slices

- [x] 1A.1 P0.1: keep HomeChat creation-first and remove noisy run cockpit/dashboard presentation.
- [x] 1A.2 P0.2: move runtime visibility to contextual surfaces users actually revisit: Sidebar session rows and Conversation linked-run indicators.
- [x] 1A.3 P0.3: keep backend/runtime wiring truthful and idempotent while Task Center/task draft entrypoints remain hidden.
- [x] 1A.4 Keep every slice independently reviewable and revertible.

## 2. Visual System / UX Foundation

- [x] 2.1 Define run status labels, severity, priority, icon/color semantics, and empty-state copy; reconcile existing `taskRunSurface.ts` priority with the agreed order.
- [x] 2.2 Extend existing `taskRunSurface.ts` as the canonical shared TaskRun card/detail display projection.
- [x] 2.3 Define New Home creation-first responsive layout for desktop and compact widths.
- [x] 2.4 Define motion/transition behavior for new run, status change, and detail open/close.

## 3. New Home Creation-First Cleanup

- [x] 3.1 Keep `HomeChat` focused on workspace identity, engine identity, composer, and lightweight recent conversations.
- [x] 3.2 Remove active/attention/recent run dashboard sections from HomeChat because the page has low dwell time and incomplete workspace-level run summaries are misleading.
- [x] 3.3 Hide `View all` / Task Center affordance until the task module is redesigned.
- [x] 3.4 Do not show TaskRun artifacts/output on HomeChat; show those only from contextual linked-run/detail surfaces.
- [x] 3.5 Keep responsive styles for the composer-first HomeChat layout.
- [x] 3.6 Update focused HomeChat tests to assert creation-first behavior and absence of runtime dashboard UI.

## 4. Run Detail Surface

- [x] 4.1 Extract or create reusable `RunDetailSurface` for Conversation/contextual detail and Task Center detail pane.
- [x] 4.2 Show status, current step, latest output, diagnostics, source, linked conversation, artifacts, evidence/context refs, and recovery actions.
- [x] 4.3 Add shared run detail open/close state or navigation helper instead of embedding new business logic in AppShell.
- [x] 4.4 Support opening the same run detail from Conversation/contextual links, Task Center internals, and existing `OPEN_TASK_RUN_EVENT` path.
- [x] 4.5 Add focused tests for run detail rendering, empty states, supported actions, and event handling.

## 5. Contextual Runtime Visibility / Run Center Deferral

- [x] 5.1 Keep Task Center status labels, priority order, and severity language aligned with the shared run detail model.
- [x] 5.2 Reuse the shared run detail model where run detail is opened contextually.
- [x] 5.3 Keep Task Center code available but hide Task Center entrypoints until the task module is redesigned.
- [x] 5.4 Add or update focused tests around contextual run detail and entrypoint hiding instead of Home dashboard duplication.

## 6. TaskRun Linking

- [x] 6.1 Ensure task-like dispatch paths create or link a `TaskRun` through the source routing contract before appearing in active work.
- [x] 6.2 Add conversation linked-run projection for active thread id.
- [x] 6.3 Add lightweight linked-run indicator/action in conversation UI.
- [x] 6.4 Add lightweight runtime hints in session rows from existing thread activity status; do not infer unlinked TaskRun state.
- [x] 6.5 Add tests for thread/run linking and missing-link empty states.

## 7. Context / Evidence In Run Detail

- [x] 7.1 Show existing Browser Evidence refs from `TaskRun.browserEvidence` in run detail.
- [x] 7.2 Show existing Orchestration source/evidence refs when a run is linked to an OrchestrationTask.
- [x] 7.3 Show honest empty states when no linked context/evidence exists.
- [x] 7.4 Add tests proving the UI does not infer unsupported evidence.

## 8. AppShell Boundary Guard

- [x] 8.1 Keep `useLayoutNodes.tsx` from owning HomeChat run dashboard derivation; HomeChat no longer receives workspace-level TaskRun summaries.
- [x] 8.2 Keep run detail navigation on existing contextual/event paths instead of embedding new Home dashboard state in AppShell.
- [x] 8.3 Avoid adding new TaskRun lifecycle rules directly into `app-shell.tsx` or `useThreads.ts`.
- [x] 8.4 If implementation touches 3+ layers, run cross-layer verification before closure.
- [x] 8.5 Do not add new primary behavior to deprecated `WorkspaceHome`; current Home entry work targets `HomeChat`.

## 8A. Deferred Architecture Follow-up

These note-card items are not part of the current P0 acceptance scope and should become a separate OpenSpec change if the team wants to continue after P0:

- Split `app-shell.tsx` so it only assembles layout and delegates runtime, task/run, navigation, and context actions.
- Split `useThreads` runtime into `sessionLifecycleController` and `messageRuntimeController`.
- Remove core `@ts-nocheck` from `app-shell.tsx`, `useAppShellSections.ts`, and `renderAppShell.tsx`.

## 9. Validation

- [x] 9.1 Re-run `openspec validate unify-client-workflow-runtime-model --strict --no-interactive` after the HomeChat replanning and artifact recalibration.
- [x] 9.2 Re-run focused unit/component tests for HomeChat creation-first behavior, Run Detail, Task Center entrypoint hiding, and TaskRun linking.
- [x] 9.3 Re-run `npm run typecheck`.
- [x] 9.4 Re-run `npm run lint`.
