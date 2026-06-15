## ADDED Requirements

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
