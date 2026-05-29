## MODIFIED Requirements

### Requirement: Heavy startup data SHALL be loaded on demand
The client SHALL defer heavy startup data sources unless the relevant UI is visible or the user explicitly requests the data, and deferred file tree hydration SHALL remain discoverable through explicit unknown or partial directory state.

#### Scenario: visible file tree first paint uses shallow root data
- **WHEN** a workspace opens with the file tree visible
- **THEN** the client SHALL be allowed to render the file tree from a shallow workspace-root child query
- **AND** the client MUST NOT keep the file tree in an initial loading-only state until complete recursive workspace tree hydration finishes
- **AND** file tree startup MUST NOT automatically call complete recursive workspace tree hydration

#### Scenario: workspace switching does not stack full file scans
- **WHEN** the active workspace changes repeatedly
- **THEN** the client SHALL refresh the visible file tree with bounded directory-child queries
- **AND** the file tree path MUST NOT automatically start `list_workspace_files` for the previous or next workspace during the normal success path

#### Scenario: root child query failure can use compatibility fallback
- **WHEN** the shallow root directory-child query fails
- **AND** the client has no cached or visible root snapshot for the active workspace
- **THEN** the client MAY attempt a single legacy `list_workspace_files` fallback
- **AND** fallback success SHALL clear the visible file-list error state
- **AND** fallback failure SHALL keep the root query error visible for retry
- **AND** any fallback data stored in the root snapshot cache MUST be reduced to root-level files, root-level directories, and root-level directory metadata

#### Scenario: recently loaded workspace root state is restored from cache
- **WHEN** the user switches back to a recently loaded workspace
- **THEN** the client SHOULD restore its cached shallow root snapshot before showing a loading-only state
- **AND** the cache MUST be bounded and MUST NOT store a complete recursive workspace tree

#### Scenario: pending root queries are reused during fast switch-back
- **WHEN** a root directory-child query for a workspace is still in flight
- **AND** the user switches away from that workspace and back before the query resolves
- **THEN** the client SHOULD reuse the existing in-flight query
- **AND** it SHOULD NOT issue a duplicate root directory-child RPC for the same workspace

#### Scenario: late responses after unmount are ignored
- **WHEN** a file tree root request resolves after the hook consumer has unmounted
- **THEN** the client MUST NOT mutate visible hook state from that response
- **AND** it MUST still clear request-local in-flight bookkeeping

#### Scenario: shallow file tree polling avoids recursive scan pressure
- **WHEN** periodic file tree polling refreshes visible workspace file state
- **THEN** the polling path SHOULD refresh shallow root state or otherwise stay bounded
- **AND** it MUST NOT repeatedly require complete recursive workspace tree scans while the user is only browsing visible root/lazy-loaded nodes
