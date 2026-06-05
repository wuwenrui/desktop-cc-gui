## ADDED Requirements

### Requirement: File Tree SHALL Provide Workspace File Management Actions
The system SHALL expose consistent file and folder management actions from the workspace file tree, including Copy, Paste, Rename, Duplicate, Create File, Create Folder, Move to Trash, Copy Path, and Reveal.

#### Scenario: File row management actions are available
- **WHEN** the user opens the context menu for a file row in the workspace file tree
- **THEN** the menu SHALL expose file management actions for Copy, Duplicate, Rename, Copy Path, Reveal, and Move to Trash
- **AND** Paste SHALL target the file parent directory when a valid internal clipboard item is available

#### Scenario: Folder row management actions are available
- **WHEN** the user opens the context menu for a folder row in the workspace file tree
- **THEN** the menu SHALL expose folder management actions for New File, New Folder, Copy, Paste, Duplicate, Rename, Copy Path, Reveal, and Move to Trash
- **AND** Paste SHALL target the selected folder path when a valid internal clipboard item is available

#### Scenario: Actions share one operation feedback path
- **WHEN** a file management action succeeds or fails
- **THEN** the file tree SHALL show a visible operation notice or error
- **AND** the system MUST NOT silently swallow the result of the action

### Requirement: Copy SHALL Store An Internal File Tree Clipboard Item
The system SHALL treat File Tree Copy as an internal application clipboard action that records the selected workspace item without mutating the filesystem or overwriting the operating system clipboard.

#### Scenario: Copy stores selected file
- **WHEN** the user selects Copy on a file row
- **THEN** the file tree SHALL store the copied workspace id, relative path, item kind, and display name in internal clipboard state
- **AND** no workspace file or folder SHALL be created during Copy

#### Scenario: Copy stores selected folder
- **WHEN** the user selects Copy on a folder row
- **THEN** the file tree SHALL store the copied workspace id, relative path, item kind, and display name in internal clipboard state
- **AND** no workspace file or folder SHALL be created during Copy

#### Scenario: Workspace mismatch disables paste
- **WHEN** the internal clipboard item belongs to a different workspace than the visible file tree
- **THEN** Paste MUST NOT execute as a same-workspace paste
- **AND** the UI SHALL either disable Paste or show a recoverable unsupported cross-workspace paste message

### Requirement: Paste SHALL Materialize Copied Workspace Items Into Target Directories
The system SHALL paste an internal workspace clipboard item into the resolved target directory through the backend file operation contract.

#### Scenario: Paste copied file into folder
- **WHEN** the user copies a file and selects Paste on a folder row
- **THEN** the backend SHALL copy the source file into that folder
- **AND** the operation SHALL return the created relative path

#### Scenario: Paste copied folder into folder
- **WHEN** the user copies a folder and selects Paste on a different folder row
- **THEN** the backend SHALL recursively copy the source folder into the target folder
- **AND** the operation SHALL return the created folder relative path

#### Scenario: Paste copied item into root
- **WHEN** the user copies a file or folder and selects Paste on the workspace root target
- **THEN** the backend SHALL copy the source item into the workspace root directory
- **AND** the operation SHALL return the created relative path

#### Scenario: Paste failure keeps clipboard available
- **WHEN** Paste fails because of validation, permissions, or filesystem errors
- **THEN** the file tree SHALL preserve the internal clipboard item
- **AND** the file tree SHALL display a recoverable error message

### Requirement: Duplicate SHALL Be An Atomic Copy-To-Parent Action
The system SHALL implement Duplicate as an atomic file operation equivalent to copying the selected item into its original parent directory without modifying internal clipboard state.

#### Scenario: Duplicate file creates sibling copy
- **WHEN** the user selects Duplicate on a file row
- **THEN** the backend SHALL create a sibling file copy in the same parent directory
- **AND** the operation SHALL return the new relative path

#### Scenario: Duplicate folder creates sibling folder copy
- **WHEN** the user selects Duplicate on a folder row
- **THEN** the backend SHALL recursively create a sibling folder copy in the same parent directory
- **AND** the operation SHALL return the new folder relative path

#### Scenario: Duplicate does not overwrite internal clipboard
- **WHEN** an internal clipboard item already exists and the user selects Duplicate on another item
- **THEN** the Duplicate operation SHALL NOT replace or clear the internal clipboard item
- **AND** a later Paste SHALL still use the originally copied clipboard item

### Requirement: Rename SHALL Update Only The Selected Item Basename
The system SHALL rename files and folders by accepting a new basename for the selected item and deriving the target path from the original parent directory.

#### Scenario: Rename file with valid basename
- **WHEN** the user renames `docs/readme.md` to `guide.md`
- **THEN** the backend SHALL rename the item to `docs/guide.md`
- **AND** the operation SHALL return the new relative path

#### Scenario: Rename folder with valid basename
- **WHEN** the user renames folder `src/components` to `ui`
- **THEN** the backend SHALL rename the item to `src/ui`
- **AND** the operation SHALL return the new relative path

#### Scenario: Rename rejects path-like names
- **WHEN** the user submits a rename value containing `/`, `\\`, `.`, `..`, or an empty basename
- **THEN** the backend MUST reject the rename request
- **AND** the file tree SHALL display a recoverable validation error

#### Scenario: Rename conflict rejects overwrite
- **WHEN** the user renames an item to a basename that already exists in the same parent directory
- **THEN** the backend MUST reject the rename request
- **AND** the backend MUST NOT overwrite the existing file or folder
- **AND** the file tree SHALL display a recoverable conflict error

### Requirement: File Operations MUST Enforce Workspace Path Safety
The system MUST validate all file operation sources and targets against workspace boundaries before mutating the filesystem.

#### Scenario: Traversal path is rejected
- **WHEN** a file operation payload contains `../outside` or another parent traversal path
- **THEN** the backend MUST reject the request before filesystem mutation
- **AND** the file tree SHALL remain interactive

#### Scenario: Absolute or prefixed path is rejected as workspace-relative input
- **WHEN** a workspace-relative file operation payload contains an absolute path, Windows drive prefix, or platform root prefix
- **THEN** the backend MUST reject the request before filesystem mutation
- **AND** the error message SHALL identify the path as invalid

#### Scenario: Git directory access is rejected
- **WHEN** a file operation attempts to read, write, copy, paste, rename, or target `.git` or a `.git` descendant path
- **THEN** the backend MUST reject the request
- **AND** no `.git` content SHALL be copied, renamed, or overwritten by the operation

#### Scenario: Symlink escape is rejected
- **WHEN** canonicalizing a source or target path shows that it escapes the canonical workspace root
- **THEN** the backend MUST reject the operation
- **AND** the operation MUST NOT mutate files outside the workspace root

### Requirement: Copy And Paste MUST Use Deterministic Collision Naming
The system SHALL avoid overwriting existing files or folders by generating deterministic destination names for Duplicate and Paste operations.

#### Scenario: File collision preserves extension
- **WHEN** the user duplicates or pastes `index.ts` into a directory that already contains `index.ts`
- **THEN** the backend SHALL create `index copy.ts` or the next available `index copy N.ts`
- **AND** the backend MUST NOT overwrite the existing `index.ts`

#### Scenario: Folder collision uses folder suffix
- **WHEN** the user duplicates or pastes folder `components` into a directory that already contains `components`
- **THEN** the backend SHALL create `components copy` or the next available `components copy N`
- **AND** the backend MUST NOT overwrite the existing `components` folder

#### Scenario: Collision suffix exhaustion fails visibly
- **WHEN** the backend cannot find an available collision-safe destination within the configured suffix limit
- **THEN** the operation MUST fail with a visible error
- **AND** the backend MUST NOT overwrite any existing item

### Requirement: Directory Copy MUST Reject Self Or Descendant Targets
The system MUST prevent a directory from being copied into itself or one of its descendants.

#### Scenario: Copy folder into itself is rejected
- **WHEN** the user copies folder `src` and attempts to paste it into `src`
- **THEN** the backend MUST reject the operation
- **AND** no nested copy of `src` SHALL be created

#### Scenario: Copy folder into descendant is rejected
- **WHEN** the user copies folder `src` and attempts to paste it into `src/components`
- **THEN** the backend MUST reject the operation
- **AND** no recursive descendant copy SHALL be created

### Requirement: External File Source Import SHALL Remain Deferred In This Slice
The system SHALL keep external file source import out of the file tree UI for this change while preserving an explicit unsupported backend/service contract if the command is called directly.

#### Scenario: File tree has no external import drop target
- **WHEN** the user drags an external file over the workspace file tree
- **THEN** this change SHALL NOT register a new external file-tree import handler
- **AND** this change MUST NOT intercept composer external file drop behavior

#### Scenario: External import command is explicitly unsupported
- **WHEN** `paste_external_workspace_items` is called in the current build
- **THEN** the backend SHALL return a clear unsupported error
- **AND** the backend MUST NOT mutate workspace files through an external source import path
- **AND** internal Copy, Paste, Duplicate, and Rename SHALL remain available

#### Scenario: OS clipboard file paste is out of scope
- **WHEN** operating system clipboard file paths are unavailable or unreliable on Windows, macOS, or Linux
- **THEN** the file tree SHALL NOT silently attempt an external file paste
- **AND** future external import support MUST be specified in a separate change with platform compatibility evidence

### Requirement: File Operations SHALL Preserve Cross-Platform Path Semantics
The system SHALL use a platform-neutral IPC path contract and platform-aware backend filesystem operations for Windows, macOS, and Linux.

#### Scenario: Windows separators are normalized
- **WHEN** a workspace file operation receives a relative path containing `\\` separators
- **THEN** the backend SHALL normalize it to the workspace relative `/` contract before validation
- **AND** the operation SHALL still reject drive prefixes, UNC prefixes, and traversal paths

#### Scenario: macOS Unicode filename is preserved
- **WHEN** a file operation copies, pastes, duplicates, or renames an item with a Unicode filename on macOS
- **THEN** the resulting workspace item SHALL preserve the intended user-visible filename
- **AND** collision checks SHALL use filesystem existence checks rather than hard-coded case assumptions

#### Scenario: Linux external import remains deferred
- **WHEN** Linux desktop clipboard integration cannot provide external file source paths
- **THEN** this change SHALL leave file-tree external import deferred
- **AND** internal Copy, Paste, Duplicate, and Rename SHALL remain available
