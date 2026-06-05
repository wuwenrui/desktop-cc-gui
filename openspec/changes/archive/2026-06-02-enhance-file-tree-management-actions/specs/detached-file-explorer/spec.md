## ADDED Requirements

### Requirement: Detached File Explorer SHALL Preserve Workspace File Management Actions
The detached file explorer SHALL provide the same workspace file management actions as the embedded file tree when the detached window has valid workspace context.

#### Scenario: Detached explorer exposes management actions
- **WHEN** the detached file explorer is opened for a workspace and the user opens a file or folder context menu
- **THEN** the detached file explorer SHALL expose supported Copy, Paste, Rename, Duplicate, Create, Trash, Copy Path, and Reveal actions using the same workspace operation contract as the embedded file tree

#### Scenario: Detached explorer action succeeds
- **WHEN** the user completes a supported file management action in the detached file explorer
- **THEN** the detached explorer SHALL refresh its file tree state
- **AND** the action result SHALL be visible through the same operation feedback model as the embedded file tree

### Requirement: Detached File Explorer SHALL Degrade Gracefully When Clipboard Context Is Unavailable
The detached file explorer SHALL not silently fail when internal file tree clipboard state or workspace context is unavailable.

#### Scenario: Detached paste without internal clipboard is unavailable
- **WHEN** the detached explorer has no valid internal file tree clipboard item for the active workspace
- **THEN** Paste SHALL be disabled or SHALL show a recoverable unavailable message
- **AND** the detached explorer MUST NOT dispatch a backend paste request with missing source context

#### Scenario: Detached external file import is not exposed in this slice
- **WHEN** the detached explorer is rendered in the current implementation
- **THEN** it SHALL NOT expose a new external file import action
- **AND** internal workspace management actions SHALL remain usable

#### Scenario: Detached explorer missing workspace context
- **WHEN** the detached explorer cannot resolve a valid workspace id and workspace root
- **THEN** file management actions that mutate workspace files MUST be unavailable
- **AND** the detached explorer SHALL show a recoverable missing-context state instead of silently failing
