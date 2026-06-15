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

### Requirement: Workspace Listing Cache State MUST Reflect ScanCache Usage
Workspace file listing and directory-child listing responses MUST report cache state from the backend scan-cache substrate whenever a safe cache key and source signature are available.

#### Scenario: initial listing uses safe scan cache
- **WHEN** the initial workspace file listing is requested with a stable workspace root, listing mode, budget, ignore policy, and source signature
- **THEN** the backend MUST use the shared `ScanCache` or equivalent scan-cache substrate for the listing result
- **AND** the response payload budget metadata MUST report `cacheState` as `hit`, `miss`, or `invalidated`
- **AND** it MUST NOT report `unsupported` for that cache state

#### Scenario: directory-child listing uses path-scoped scan cache
- **WHEN** a workspace directory-child listing is requested for a validated workspace-relative directory path
- **THEN** the backend MUST key the cache by workspace root, requested relative path, listing mode, budget, and source signature
- **AND** the response MUST preserve bounded one-level listing behavior, path boundary validation, partial metadata, and old DTO compatibility

#### Scenario: cache is intentionally unavailable
- **WHEN** a listing path cannot safely derive a stable source signature or must bypass cache for correctness
- **THEN** the response MAY report `cacheState=unsupported`
- **AND** the diagnostics MUST include a bounded reason that does not expose absolute paths, secrets, prompt text, terminal output, or file content

### Requirement: Workspace Listing Cache Invalidation MUST Preserve Freshness
Workspace listing cache entries MUST be invalidated when source signatures change, and stale cached listing responses MUST NOT overwrite fresher frontend state.

#### Scenario: source signature changes
- **WHEN** a workspace listing cache key matches but the source signature differs from the stored entry
- **THEN** the backend MUST treat the cached entry as invalidated
- **AND** the returned payload budget metadata MUST report `cacheState=invalidated` or equivalent

#### Scenario: stale root listing reaches frontend late
- **WHEN** the frontend receives a root listing response for a workspace request that is no longer active
- **THEN** the client MUST drop or ignore that stale response
- **AND** it MUST preserve the newer visible file tree state

#### Scenario: stale subtree listing reaches frontend late
- **WHEN** the frontend receives a subtree response whose request-time `sourceVersion` no longer matches the active file tree source version
- **THEN** the client MUST drop or ignore that stale subtree response
- **AND** it MUST preserve the newer visible file tree state

### Requirement: Workspace Listing Cache Validation MUST Reduce Hot-Path Work
Workspace listing cache validation MUST avoid doing the same expensive recursive file walk that it is supposed to save.

#### Scenario: initial listing cache hit validates from bounded metadata
- **WHEN** the initial workspace file listing cache has an existing response
- **THEN** the backend MUST validate freshness from bounded metadata such as workspace root metadata, known directory metadata, and relevant `.gitignore` metadata
- **AND** it MUST NOT perform a second full file-tree walk merely to decide whether the cached listing can be reused

#### Scenario: daemon listing path uses the same cache evidence contract
- **WHEN** workspace listing runs through `cc_gui_daemon`
- **THEN** daemon responses MUST expose the same `listingBudget`, `sourceVersion`, and `payloadBudget.cacheState` contract as the desktop Tauri path
- **AND** daemon workspace listing MUST NOT remain on a legacy `cacheState=unsupported` branch when the same safe cache validation is available

### Requirement: Workspace Listing Core MUST Be Shared Across Desktop And Daemon
Workspace file-tree listing behavior MUST live in one shared backend core instead of duplicated desktop and daemon scanner branches.

#### Scenario: desktop and daemon call shared listing core
- **WHEN** desktop Tauri commands or `cc_gui_daemon` RPCs request initial workspace listing or directory-child listing
- **THEN** both adapters MUST delegate to the same shared workspace listing core
- **AND** both paths MUST preserve equivalent cache keys, source signatures, budget metadata, skip rules, gitignore markers, partial state, and DTO shape

#### Scenario: adapter-specific file IO remains outside shared listing core
- **WHEN** workspace file read/write, external absolute listing, or external spec tree behavior is adapter-specific
- **THEN** those operations MAY remain in their existing modules
- **AND** they MUST continue using the shared listing DTO/budget helpers where they return workspace file-tree response shapes

