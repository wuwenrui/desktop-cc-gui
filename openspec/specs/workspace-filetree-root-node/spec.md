# workspace-filetree-root-node Specification

## Purpose

Defines the workspace-filetree-root-node behavior contract, covering File Tree SHALL Expose A Single Workspace Root Node.

## Requirements
### Requirement: File Tree SHALL Expose A Single Workspace Root Node
The system SHALL render exactly one workspace root node at the top of the right-side file tree and place all current top-level entries under that root.

#### Scenario: initial render shows workspace root
- **WHEN** user opens any workspace session with file tree visible
- **THEN** file tree SHALL render a single root node using current workspace display name
- **AND** existing top-level files and directories SHALL be rendered as direct children of that root node

#### Scenario: root uniqueness is preserved
- **WHEN** file tree data is refreshed or reloaded
- **THEN** system SHALL keep exactly one root node in the rendered tree
- **AND** system MUST NOT duplicate root wrapper nodes

### Requirement: Workspace Root Node SHALL Support Expand Collapse
The system SHALL support expand/collapse interaction on workspace root node with default-expanded behavior.

#### Scenario: root defaults to expanded
- **WHEN** file tree is rendered for a newly opened workspace session
- **THEN** workspace root node SHALL be expanded by default
- **AND** root children SHALL be visible without extra clicks

#### Scenario: collapse and re-expand root
- **WHEN** user collapses the workspace root node and then expands it again
- **THEN** root children SHALL be hidden while collapsed and visible after expand
- **AND** previously loaded descendant expansion state SHALL be restored

### Requirement: Root Context Menu SHALL Reuse Existing Directory Actions
The system SHALL bind root-node context menu to existing directory action pipeline instead of introducing a separate action implementation.

#### Scenario: root context menu contains existing directory actions
- **WHEN** user opens context menu on workspace root node
- **THEN** menu SHALL include the same directory actions already available for regular directories
- **AND** menu SHALL include at least `新建文件`, `创建副本`, `复制路径`, `在访达中显示`, `移到废纸篓`

#### Scenario: root context menu actions follow existing command chain
- **WHEN** user executes an action from root context menu
- **THEN** frontend SHALL dispatch the same command handlers used by existing directory menu actions
- **AND** backend execution path SHALL remain compatible with current file operation contracts

### Requirement: Root Node Path Resolution MUST Be Workspace-Scoped
The system MUST resolve workspace root node path to the active workspace absolute root and enforce workspace boundary safety.

#### Scenario: root-bound actions target workspace root path
- **WHEN** user triggers root context action that requires filesystem path
- **THEN** system SHALL resolve target path to active workspace root directory
- **AND** operation SHALL execute against that resolved path only

#### Scenario: escaped path is rejected for root operations
- **WHEN** root-related operation payload contains traversal or out-of-workspace target
- **THEN** system MUST reject the request with recoverable error
- **AND** file tree SHALL remain interactive

### Requirement: File Search Input SHALL Be Embedded In Top Tool Row
The system SHALL place the file-search input in the same top tool row as workspace root header controls instead of rendering it as a dedicated second row.

#### Scenario: search input is rendered in top row
- **WHEN** file tree top area is rendered
- **THEN** search input SHALL appear in the top tool row
- **AND** system MUST NOT render a standalone second-row search bar

#### Scenario: search input does not overlap right-side controls
- **WHEN** top row contains file count and action buttons
- **THEN** search input SHALL remain visible and editable
- **AND** placeholder text SHALL NOT be clipped or covered by right-side controls

### Requirement: Root Header Area SHALL Stay Sticky During File List Scrolling
The system SHALL keep the root header area fixed at the top of the file tree while only the file list content scrolls vertically.

#### Scenario: root header stays fixed while list scrolls
- **WHEN** user scrolls the file list vertically
- **THEN** root header area SHALL remain visible at the top of the file tree viewport
- **AND** only the list content area SHALL move with scroll

#### Scenario: sticky layer keeps interaction available
- **WHEN** list content passes under the sticky root header area
- **THEN** sticky header z-order SHALL stay above list content
- **AND** root actions and controls SHALL remain clickable during scrolling

### Requirement: Workspace Root Node SHALL Act As A File Management Target
The workspace root node SHALL act as a valid target for file management actions that operate on a directory target.

#### Scenario: Root accepts new file action
- **WHEN** the user opens the workspace root context menu and selects New File
- **THEN** the file tree SHALL create the file relative to the workspace root directory
- **AND** the backend MUST enforce workspace boundary validation before writing the file

#### Scenario: Root accepts new folder action
- **WHEN** the user opens the workspace root context menu and selects New Folder
- **THEN** the file tree SHALL create the folder relative to the workspace root directory
- **AND** the backend MUST enforce workspace boundary validation before creating the folder

#### Scenario: Root accepts paste action
- **WHEN** the user has a valid internal file tree clipboard item and selects Paste on the workspace root node
- **THEN** the file tree SHALL paste the copied item into the workspace root directory
- **AND** the backend SHALL return the created workspace-relative path

#### Scenario: Root rejects dangerous item actions
- **WHEN** the user opens management actions for the workspace root node
- **THEN** Duplicate, Rename, and Move to Trash MUST NOT be offered as root actions
- **AND** those actions MUST NOT be dispatched against the workspace root path

### Requirement: Root Management Actions SHALL Use Shared File Operation Feedback
Root-node file management actions SHALL use the same operation pending, success, and error feedback path as regular file and folder rows.

#### Scenario: Root paste failure is visible
- **WHEN** a Paste action from the workspace root node fails
- **THEN** the file tree SHALL show a recoverable operation error
- **AND** the system MUST NOT silently swallow the failure

#### Scenario: Root create success refreshes tree
- **WHEN** a New File, New Folder, or Paste action from the workspace root node succeeds
- **THEN** the file tree SHALL refresh workspace file data
- **AND** the resulting item SHOULD be selected or made discoverable in the refreshed tree

### Requirement: Hotfix Closeout — File Tree First-Paint Scroll Shell

The file tree panel SHALL own its scroll shell layout (flex column, `flex: 1`, `min-height: 0`, `padding: 8px 8px 0`, `position: relative`) in `src/styles/file-tree.css`, independent of the lazy-loaded `diff.css`. The `diff-panel` class SHALL remain on the root for selector compatibility, and `.diff-panel.file-tree-panel` override SHALL preserve the file-tree-specific spacing when the Git diff stylesheet is loaded.

#### Scenario: First paint shows a stable vertical scrollbar
- **WHEN** the file tree panel mounts for the first time in a session
- **THEN** the vertical scrollbar SHALL be visible without requiring a prior visit to the Git panel
- **AND** the inner `.file-tree-list` SHALL have a stable scroll container height derived from `.file-tree-panel`'s flex column shell

#### Scenario: Git panel loaded afterward keeps file-tree spacing
- **WHEN** the Git diff stylesheet becomes available after the file tree has already mounted
- **THEN** the file tree SHALL NOT lose its `padding` or `gap` to the default `.diff-panel` rules
- **AND** a CSS contract test SHALL lock this behavior

#### Scenario: Large virtualized workspaces still scroll correctly
- **WHEN** the file tree renders a virtualized row set over a large workspace
- **THEN** the inner `.file-tree-list` scroll container SHALL continue to have a stable height
- **AND** virtual row measurement SHALL NOT depend on `diff.css` being loaded
