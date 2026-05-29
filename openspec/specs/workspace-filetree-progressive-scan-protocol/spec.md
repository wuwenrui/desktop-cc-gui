# workspace-filetree-progressive-scan-protocol Specification

## Purpose
TBD - created by archiving change improve-progressive-file-tree-loading. Update Purpose after archive.
## Requirements
### Requirement: Workspace File Tree Responses Shall Expose Scan Metadata
The system SHALL expose explicit scan metadata for workspace file tree responses so clients can distinguish complete, partial, unknown, and empty directory states without inferring them only from returned child paths.

#### Scenario: initial workspace listing reports partial scan state
- **WHEN** the initial workspace file listing stops because file count, entry count, or time budget is reached
- **THEN** the response SHALL indicate a partial scan state
- **AND** the response SHALL preserve existing `files`, `directories`, `gitignored_files`, and `gitignored_directories` fields for compatibility
- **AND** the response SHALL include directory metadata for returned directories when available

#### Scenario: directory metadata distinguishes unknown from empty
- **WHEN** a directory is included in a workspace file tree response but its direct children were not confirmed by the current scan
- **THEN** the directory metadata SHALL mark its child state as unknown or partial
- **AND** the client MUST NOT treat that directory as permanently empty

#### Scenario: confirmed empty directory is explicit
- **WHEN** a direct directory-child query completes and returns no files or directories
- **THEN** the response SHALL mark that directory as empty or complete with no children
- **AND** the client MAY render that directory without an expand affordance until a refresh changes the state

#### Scenario: root-first response remains progressive
- **WHEN** the visible file tree receives a root direct-children response
- **THEN** returned directories SHALL include directory metadata that lets the client treat their children as unknown, partial, loaded, or empty
- **AND** the client MUST allow unknown or partial root children to be expanded on demand

### Requirement: Unknown And Partial Directories Shall Be Expandable
The file tree client SHALL render directories with unknown or partial child state as expandable or otherwise probeable, even when the current tree snapshot contains no child nodes for that directory.

#### Scenario: ordinary unknown directory expands on demand
- **WHEN** a non-special directory has unknown child state
- **AND** the user expands that directory
- **THEN** the client SHALL call the workspace directory-child query for that directory path
- **AND** the returned direct files and directories SHALL be merged into the visible file tree

#### Scenario: partial directory remains recoverable
- **WHEN** a directory-child query returns only part of a large directory
- **THEN** the client SHALL preserve a partial or has-more state for that directory
- **AND** the client MUST NOT silently present the returned children as the complete directory contents

#### Scenario: loading and error state remain node-scoped
- **WHEN** one directory expansion is loading or fails
- **THEN** the loading or error state SHALL be scoped to that directory node
- **AND** the rest of the file tree SHALL remain interactive

### Requirement: Directory Child Queries Shall Be Bounded And One-Level
The backend SHALL resolve workspace directory-child queries as bounded one-level listings that return direct children only, plus completion metadata. Filesystem traversal and directory read work for these queries MUST run outside the async command runtime's cooperative task path.

#### Scenario: direct children only
- **WHEN** the client requests children for a workspace directory path
- **THEN** the backend SHALL return only direct child files and direct child directories for that path
- **AND** the backend MUST NOT recursively return the full subtree in that response

#### Scenario: root direct children query
- **WHEN** the client requests workspace directory children with an empty path
- **THEN** the backend SHALL interpret the path as the workspace root
- **AND** the response SHALL return only direct root files and direct root directories
- **AND** the backend MUST NOT recursively return the full workspace subtree in that response
- **AND** the response SHOULD avoid synchronous root-level gitignore marker computation to keep first paint bounded

#### Scenario: oversized directory reports has more
- **WHEN** a directory contains more direct child entries than the directory-child query budget can return
- **THEN** the backend SHALL return a bounded sorted subset
- **AND** the response SHALL indicate partial or has-more state

#### Scenario: existing nested directory query behavior is preserved
- **WHEN** the client requests children for a non-empty workspace directory path
- **THEN** the backend SHALL keep the existing one-level child listing behavior
- **AND** the backend SHALL keep gitignore marker behavior for the requested non-empty directory
- **AND** invalid traversal, absolute, prefix, or `.git` paths MUST still be rejected

#### Scenario: whitespace-only directory paths are not root sentinels
- **WHEN** the client requests workspace directory children with a whitespace-only path
- **THEN** the backend MUST reject the path as invalid or empty
- **AND** the backend MUST NOT interpret it as the workspace root sentinel

#### Scenario: path boundary is enforced
- **WHEN** a directory-child query contains path traversal or resolves outside the active workspace root
- **THEN** the backend MUST reject the request with a recoverable error
- **AND** the file tree SHALL remain interactive

#### Scenario: blocking filesystem scan does not occupy async command task
- **WHEN** the initial workspace file listing or a directory-child listing performs filesystem traversal, canonicalization, root reading, or git-ignore classification
- **THEN** the command layer SHALL execute that blocking work through a blocking-task boundary or equivalent non-cooperative-runtime isolation
- **AND** the response SHALL preserve the existing progressive scan metadata contract

### Requirement: Progressive File Tree State Shall Be Workspace-Scoped
The client SHALL scope progressive file tree state to the active workspace and current file tree generation.

#### Scenario: workspace switch clears stale lazy state
- **WHEN** the active workspace changes
- **THEN** lazy-loaded files, lazy-loaded directories, directory metadata, loading state, and error state from the previous workspace SHALL NOT appear in the new workspace tree

#### Scenario: refresh reconciles loaded directory state
- **WHEN** the user refreshes the workspace file tree
- **THEN** the client SHALL reconcile or clear previously loaded directory state against the latest workspace snapshot
- **AND** stale nodes that no longer belong to the active workspace SHALL NOT remain visible
