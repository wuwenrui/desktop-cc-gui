## ADDED Requirements

### Requirement: Workspace File Listing MUST Expose Bounded Initial And Subtree Contracts

Workspace file listing MUST make initial listing, partial state, and directory subtree loading explicit across backend response, frontend state, and diagnostics.

#### Scenario: initial listing returns bounded metadata

- **WHEN** a workspace file tree is opened
- **THEN** the initial listing response MUST include budget metadata for depth, max entries, returned entries, payload estimate, source version, cache state, and scan state
- **AND** if the budget is hit, the response MUST be marked partial rather than pretending the tree is complete.

#### Scenario: visible tree renders before full tree is known

- **WHEN** the initial listing is partial
- **THEN** the file tree MUST render known visible nodes
- **AND** unknown or truncated subtrees MUST be visually distinguishable from empty directories.

#### Scenario: expanding a directory requests only that subtree

- **WHEN** a user expands a directory whose children are not loaded or are stale
- **THEN** the frontend MUST request only that subtree or a documented page of that subtree
- **AND** it MUST NOT trigger a full-tree refresh unless an explicit fallback path is used and recorded in diagnostics.

#### Scenario: stale subtree response is rejected

- **WHEN** a subtree response resolves with an older source version than the active file index
- **THEN** the stale response MUST be ignored or marked stale
- **AND** it MUST NOT replace newer file tree state.

### Requirement: File Listing Metrics MUST Feed Runtime Evidence Gates

Workspace file listing MUST report content-safe budget evidence for listing duration, item count, payload size, partial/full state, and cache hit/miss.

#### Scenario: listing budget evidence is emitted

- **WHEN** a workspace listing or subtree request completes
- **THEN** diagnostics MUST include command/surface id, duration, returned item count, payload estimate, cache state, partial/full state, and evidence class
- **AND** diagnostics MUST NOT include file contents.

#### Scenario: oversized payload remains recoverable

- **WHEN** a listing response exceeds the documented payload budget
- **THEN** the command MAY still succeed for compatibility
- **AND** a budget regression indicator MUST be emitted with enough metadata to identify initial listing versus subtree listing.

### Requirement: File Tree And Search SHALL Use A Guarded Shared File Index Contract

The file tree and search hydration SHALL consume a shared per-workspace file index when it is available, with source-version guards and explicit fallback when unavailable.

#### Scenario: shared index uses same source version

- **WHEN** file tree and search consume file candidates for the same workspace
- **THEN** they MUST use the same path tokens, directory tokens, and source version
- **AND** a consumer MUST reject stale source versions.

#### Scenario: shared index fallback is explicit

- **WHEN** the shared index adapter is disabled, unavailable, or owned by another active change
- **THEN** file tree and search MAY use their legacy paths
- **AND** diagnostics MUST classify the shared-index evidence as `unsupported` or `manual-only` rather than claiming measured reuse.

#### Scenario: changed paths invalidate affected index entries

- **WHEN** file watcher or mtime fallback reports changed paths
- **THEN** the affected subtree and shared index entries MUST be invalidated
- **AND** both file tree and search MUST observe either the new source version or an explicit partial state.
