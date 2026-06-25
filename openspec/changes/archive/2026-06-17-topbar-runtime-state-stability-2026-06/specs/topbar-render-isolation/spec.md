# topbar-render-isolation Specification (Delta)

## Purpose

TBD - extended by topbar-runtime-state-stability-2026-06. Update Purpose after archive.

## ADDED Requirements

### Requirement: Runtime Run State Reference MUST Be Stable Across Reducer Re-runs

`useRuntimeLogSession` MUST return a stable object reference when the underlying session state has not changed. The hook MUST wrap its return value in `useMemo` with explicit per-field dependencies; the previous behaviour of returning a fresh object literal on every hook invocation MUST NOT occur.

> Note (review pass 2026-06-17):the bug surfaces when an ancestor component re-renders and forces the hook to re-run, producing a new `runtimeRunState` reference even though `sessionByWorkspace` is unchanged. The reference churn is the root cause of topbar feedback latency under sustained terminal output.

#### Scenario: stable reference when session state is unchanged

- **WHEN** `useRuntimeLogSession` re-runs because an ancestor component re-renders
- **AND** `sessionByWorkspace[workspaceId]` is referentially equal to the previous render
- **THEN** the returned `runtimeRunState` object MUST be referentially equal to the previous render's return value
- **AND** consumers reading `runtimeRunState.X` MUST observe the same primitive values as before

#### Scenario: new reference when log field changes

- **WHEN** `appendWorkspaceLog` extends `activeSession.log` from `"foo"` to `"foo\nbar"`
- **THEN** the returned `runtimeRunState.runtimeConsoleLog` MUST equal `"foo\nbar"`
- **AND** the returned `runtimeRunState` object reference MUST differ from the previous render
- **AND** consumers reading any other `runtimeRunState.X` field MUST observe the same primitive values as before (no false invalidation)

### Requirement: Shell Domain Context MUST Isolate Runtime Run State From File Editor Context

`appShellDomainContexts.runtimeContext.runtimeRunState` MUST be the sole owner of `runtimeRunState`. `appShellDomainContexts.fileEditorContext` MUST NOT carry `runtimeRunState` as a key. The `reuseStableAppShellDomainContexts` shallow-equal comparison MUST treat `runtimeContext` as an independent dimension from `fileEditorContext`.

> Note (review pass 2026-06-17):moving `runtimeRunState` out of `fileEditorContext` prevents terminal-output-induced invalidations from cascading into file-editor-only memoized layout nodes via `fileEditorContext` shallow-equal failure. The new `runtimeContext` is the dedicated propagation channel.

#### Scenario: terminal output does not invalidate fileEditorContext

- **WHEN** `subscribeTerminalOutput` fires and `appendWorkspaceLog` extends the session log
- **THEN** `reuseStableAppShellDomainContexts(prev, next).fileEditorContext` MUST return `prev.fileEditorContext` (reference-equal)
- **AND** `reuseStableAppShellDomainContexts(prev, next).runtimeContext.runtimeRunState` MUST differ from `prev.runtimeContext.runtimeRunState`
- **AND** layout nodes / memoized values whose dependency set is limited to `fileEditorContext` MUST keep their previous references
- **AND** `useAppShellLayoutNodesSection` MUST read runtime-only state from `runtimeContext`, not from `fileEditorContext`

#### Scenario: file editor changes do not invalidate runtimeContext

- **WHEN** `activeEditorFilePath` changes from `null` to `"/foo.ts"`
- **THEN** `reuseStableAppShellDomainContexts(prev, next).runtimeContext` MUST return `prev.runtimeContext` (reference-equal)
- **AND** `reuseStableAppShellDomainContexts(prev, next).fileEditorContext` MUST differ from `prev.fileEditorContext`

#### Scenario: overlapping key detection catches misplacement

- **WHEN** `findOverlappingAppShellDomainKeys` is called after the `runtimeContext` addition
- **THEN** `runtimeRunState` MUST appear exactly once in the owned-key map (under `runtimeContext`)
- **AND** the function MUST NOT return `runtimeRunState` in its overlap set

### Requirement: Topbar Hot Path Components MUST Be Memoized

`MainHeader` and `PanelTabs` MUST be wrapped in `React.memo` with `displayName` set for debugging. The memoization MUST shallow-compare props; props referentially equal to the previous render MUST short-circuit re-render.

> Note (review pass 2026-06-17):the memo acts as a defense-in-depth layer above the upstream `runtimeRunState` stabilization. Even when an upstream re-render is unavoidable (workspace switch, settings toggle), the memo prevents unnecessary reconciliation in the topbar subtree.

#### Scenario: MainHeader skips re-render on equal props

- **WHEN** `<MainHeader />` receives the same `workspace` / `branchName` / `branches` / `openTargets` / `launchScript` / `mainHeaderActions` references as the previous render
- **THEN** the component MUST NOT re-run its function body
- **AND** the React DevTools profiler MUST NOT show a render entry for `MainHeader` in that frame

#### Scenario: PanelTabs skips re-render on equal props

- **WHEN** `<PanelTabs />` receives the same `active` / `onSelect` / `liveStates` / `visibleTabs` references as the previous render
- **THEN** the component MUST NOT re-run its function body
- **AND** the React DevTools profiler MUST NOT show a render entry for `PanelTabs` in that frame

#### Scenario: displayName is set for both components

- **WHEN** `MainHeader.displayName` is read
- **THEN** it MUST equal `"MainHeader"` (not the default `"Memo(MainHeaderImpl)"`)
- **WHEN** `PanelTabs.displayName` is read
- **THEN** it MUST equal `"PanelTabs"`

### Requirement: Runtime Log Listener MUST Coalesce Within Animation Frames

`useRuntimeLogSession`'s `subscribeTerminalOutput` listener MUST buffer incoming chunks per workspace and flush at most once per animation frame. The flush MUST concatenate the buffered chunks in arrival order per workspace before invoking `appendWorkspaceLog`. Exit-code detection and status transition logic MUST run during the flush, not per chunk.

> Note (review pass 2026-06-17):this caps the setState frequency at the display refresh rate (60 Hz typical), reducing main-thread contention from "200+ setStates/sec under heavy log output" to "60 setStates/sec". The visual log content remains complete because `appendWorkspaceLog` is invoked with the concatenated payload.

#### Scenario: multiple chunks in same frame collapse to single setState

- **WHEN** `subscribeTerminalOutput` fires 10 times within a single animation frame for the same `workspaceId`
- **THEN** `appendWorkspaceLog` MUST be invoked exactly once for that workspace during the frame
- **AND** the single invocation MUST receive the concatenation of all 10 chunks in arrival order
- **AND** the resulting `activeSession.log` MUST equal the previous log + concatenated 10 chunks (no data loss)

#### Scenario: later chunks schedule another frame

- **WHEN** a flush has completed
- **AND** another `subscribeTerminalOutput` event arrives afterward
- **THEN** a new `requestAnimationFrame` or fallback timer MUST be scheduled
- **AND** the next flush MUST process the later chunk without merging it into the already-flushed payload

#### Scenario: pending buffer cleared on unmount

- **WHEN** the `useEffect` cleanup runs
- **THEN** `pendingChunkByWorkspaceRef.current` MUST be empty after cleanup
- **AND** any scheduled RAF / fallback timer MUST be cancelled when the host API supports cancellation
- **AND** any late callback that still fires MUST be guarded so it cannot call `setState` after cleanup
- **AND** `flushScheduledRef.current` MUST be `false`

### Requirement: Workspace Flows Toggle Callbacks MUST Depend On Specific Runtime Fields

`useAppShellWorkspaceFlowsSection`'s `handleToggleRuntimeConsole` and `handleToggleTerminalPanel` callbacks MUST depend on the specific `runtimeRunState` fields they read, not on the `runtimeRunState` object itself. The dependency arrays MUST list each accessed field / callback explicitly.

> Note (review pass 2026-06-17):`onOpenRuntimeConsole` and `onCloseRuntimeConsole` are `useCallback`-stable while `activeWorkspaceId` is unchanged; workspace switches may correctly replace them. Listing concrete fields narrows the rebuild trigger to actual field changes, breaking the callback-rebuild chain that propagates to `useAppShellLayoutNodesSection` `useMemo` invalidations.

#### Scenario: handleToggleRuntimeConsole deps are field-level

- **WHEN** `runtimeRunState.runtimeConsoleVisible` is unchanged
- **AND** the only change to `runtimeRunState` is `runtimeConsoleLog` extending
- **THEN** `handleToggleRuntimeConsole` MUST be referentially equal to the previous render
- **AND** the callback MUST NOT be re-created

#### Scenario: handleToggleTerminalPanel deps are field-level

- **WHEN** `runtimeRunState.onCloseRuntimeConsole` is unchanged
- **AND** `handleToggleTerminal` is unchanged
- **AND** `terminalOpen` is unchanged
- **THEN** `handleToggleTerminalPanel` MUST be referentially equal to the previous render
