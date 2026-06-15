## ADDED Requirements

### Requirement: Search Hydration MUST Treat Shared File Index As A Guarded Dependency

Search hydration MUST reuse the shared per-workspace file index when it is fresh and available, but MUST keep stale guards and partial-state UI when the index is incomplete or unavailable.

#### Scenario: fresh shared index avoids duplicate listing

- **WHEN** a user searches and the active workspace has a fresh shared file index
- **THEN** search providers SHOULD read path candidates from that index
- **AND** they SHOULD NOT issue a duplicate full file-listing IPC for the same source version.

#### Scenario: partial index state is visible

- **WHEN** the active workspace is indexed but other workspaces or subtrees remain partial
- **THEN** search UI MUST expose partial state in a way the user can distinguish from zero results
- **AND** runtime evidence MUST record whether the result set was full or partial.

#### Scenario: stale search hydration is dropped

- **WHEN** the query, workspace, or source version changes while hydration is in flight
- **THEN** the stale hydration result MUST be ignored or marked stale
- **AND** it MUST NOT replace newer results.

#### Scenario: independent search change ownership is preserved

- **WHEN** `search-index-and-bounded-hydration` still owns normalized indexing work
- **THEN** this change MUST only add the shared file-index bridge contract and fallback behavior
- **AND** it MUST NOT claim completion of search normalization tasks outside this change.
