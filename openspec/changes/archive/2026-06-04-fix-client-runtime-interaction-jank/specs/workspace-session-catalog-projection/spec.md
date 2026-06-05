## ADDED Requirements

### Requirement: Workspace Session Catalog SHALL Avoid Unbounded First-Page Loads

Workspace session catalog projection SHALL avoid treating the first page as an all-history request.

#### Scenario: first page uses bounded request size
- **WHEN** a frontend surface requests the first page of workspace sessions
- **THEN** the request MUST use a bounded page size appropriate for visible UI work
- **AND** it MUST NOT use a large sentinel limit such as `9_999` to force full-history loading before first paint

#### Scenario: incomplete source remains explicit
- **WHEN** an engine source cannot prove completeness within the page limit, native cursor, timeout, or scan cap
- **THEN** the response MUST include next cursor, partial source, degraded source status, or capped scan evidence
- **AND** the UI MUST NOT treat omitted rows as authoritative deletion proof

### Requirement: Related Attribution SHALL Be Cached And Deduplicated By Effective Query

Related workspace session attribution SHALL avoid repeating equivalent expensive catalog scans for the same workspace and query.

#### Scenario: equivalent related query reuses cached projection
- **WHEN** sidebar hydration, Workspace Home, Session Management, or Radar prewarm request the same workspace, attribution mode, filters, source scope, cursor, and page size within a valid cache window
- **THEN** the system SHOULD reuse or deduplicate the in-flight/catalog projection result
- **AND** duplicate requests MUST NOT independently rescan all related engine history sources

#### Scenario: cache key respects attribution mode and filters
- **WHEN** session attribution mode, keyword, status, engine, folder, source, workspace, cursor, or page size changes
- **THEN** the cache key or dedupe scope MUST change accordingly
- **AND** a `related` result MUST NOT be reused as `workspace-only` membership truth, nor vice versa

### Requirement: Session Management Filters SHALL Not Flood Backend Catalog

Session Management filter interactions SHALL be scheduled so they do not issue backend catalog requests for every transient keystroke.

#### Scenario: keyword input is debounced or transitioned
- **WHEN** the user types a session search keyword
- **THEN** the UI MUST debounce, transition, or otherwise coalesce filter changes before issuing catalog requests
- **AND** stale responses for previous keywords MUST NOT replace the current result set

#### Scenario: filter changes preserve loading continuity
- **WHEN** filters change while a catalog request is in flight
- **THEN** the surface MAY keep last-good rows or show a scoped loading state
- **AND** it MUST NOT clear membership truth or folder assignment based on stale or partial responses

### Requirement: Catalog Hydration SHALL Not Block Foreground Thread Switching

Workspace session catalog hydration SHALL be staged behind foreground thread selection.

#### Scenario: switch does not wait for catalog completion
- **WHEN** a user selects a thread from sidebar, topbar, search, or Radar
- **THEN** the foreground active thread transition MUST NOT wait for full workspace session catalog hydration
- **AND** catalog refresh completion MUST reconcile in the background with stale guards

#### Scenario: background catalog result respects current scope
- **WHEN** a background catalog request completes after the user has navigated to another workspace or thread
- **THEN** the result MUST be applied only to its requested workspace/query scope
- **AND** it MUST NOT overwrite the current active thread, draft, or visible conversation state
