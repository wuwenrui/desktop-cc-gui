# detached-file-explorer Specification

## Purpose

Defines the detached-file-explorer behavior contract, covering User can open a detached file explorer from the embedded file panel.

## Requirements
### Requirement: User can open a detached file explorer from the embedded file panel

The system SHALL keep the existing right-side embedded file panel available and SHALL let the user open a detached file explorer window from the workspace root row inside that panel.

#### Scenario: Open detached explorer from embedded panel

- **WHEN** the user is viewing the embedded file panel for a workspace and clicks the detach control on the workspace root row
- **THEN** the system opens or focuses a detached file explorer window for that workspace
- **AND** the embedded file panel remains available in the main window

#### Scenario: Reuse existing detached explorer window

- **WHEN** a detached file explorer window is already open and the user clicks the detach control again from the embedded file panel
- **THEN** the system MUST focus the existing detached file explorer window instead of creating an additional detached file explorer window

### Requirement: Detached explorer uses a single fixed window identity

The system MUST manage the detached file explorer as a single reusable window identified by a fixed window label instead of spawning unbounded new windows for repeated detach actions.

#### Scenario: Repeated detach reuses the same detached window identity

- **WHEN** the user triggers detach multiple times for the same workspace during the same app session
- **THEN** the system reuses the existing detached file explorer window identity
- **AND** the system does not create a second detached file explorer window for that action sequence

### Requirement: Detached explorer window can be closed without removing the embedded panel

The system SHALL let the user close the detached file explorer window without changing the availability of the embedded file panel in the main window.

#### Scenario: Close detached explorer window

- **WHEN** the user closes the detached file explorer window from its own window controls or close action
- **THEN** the detached file explorer window is dismissed
- **AND** the embedded file panel in the main window remains available for the same workspace

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

### Requirement: Detached File Explorer Shell Styles Load Independently
The detached file explorer SHALL load its own window-shell styles from the detached window root so the first paint does not depend on a file viewer being mounted.

#### Scenario: Detached explorer opens without an active file
- **WHEN** the detached explorer opens for a workspace with no active file selected
- **THEN** the detached explorer SHALL render the detached menubar, left file tree, resizer, and empty viewer state using the detached file explorer layout styles
- **AND** the detached explorer MUST NOT rely on `FileViewPanel` mounting before `detached-file-explorer.css` is loaded
- **AND** the file browsing, session, polling, and file-open behavior SHALL remain unchanged
