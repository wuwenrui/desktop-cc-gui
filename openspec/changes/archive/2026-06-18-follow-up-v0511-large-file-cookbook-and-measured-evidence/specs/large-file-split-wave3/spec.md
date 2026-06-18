# Spec Delta: large-file-split-wave3

## Purpose

Track the v0.5.11 follow-up split for remaining large frontend files without expanding the already completed thread messaging recovery change.

## ADDED Requirements

### Requirement: tauri.ts MUST remain a facade while domain wrappers move out

`src/services/tauri.ts` SHALL remain the public compatibility facade while session, permission, and app-server wrappers move into domain modules.

#### Scenario: Session APIs are extracted
- **WHEN** a wrapper targets session lifecycle commands
- **THEN** the wrapper SHALL live in `src/services/tauri/session.ts`
- **AND** `src/services/tauri.ts` SHALL re-export the same public API

#### Scenario: Permission APIs are extracted
- **WHEN** a wrapper targets permission or access-mode commands
- **THEN** the wrapper SHALL live in `src/services/tauri/permission.ts`
- **AND** the facade SHALL preserve existing import compatibility

#### Scenario: App-server APIs are extracted
- **WHEN** a wrapper targets app-server runtime commands
- **THEN** the wrapper SHALL live in `src/services/tauri/appServer.ts`
- **AND** command names and payload field names SHALL remain unchanged

### Requirement: FileTreePanel.tsx MUST split view-state and refresh controls

`FileTreePanel.tsx` SHALL move refresh/cache view-state logic into a hook and refresh/error UI into a child component.

#### Scenario: View state extracted
- **WHEN** `FileTreePanel` needs lazy cache clearing or manual refresh orchestration
- **THEN** that logic SHALL live in `useFileTreeViewState.ts`
- **AND** the component SHALL consume a typed hook result

#### Scenario: Refresh controls extracted
- **WHEN** `FileTreePanel` renders refresh button or refresh error display
- **THEN** that JSX SHALL live in `FileTreeRefreshControls.tsx`
- **AND** the parent SHALL pass explicit props instead of hidden module state

### Requirement: large-file check MUST pass

`npm run check:large-files` MUST pass after the split.

#### Scenario: No new threshold debt
- **WHEN** the split is complete
- **THEN** no newly created module SHALL enter near-threshold advisory debt
- **AND** hard-debt count SHALL not increase
