## ADDED Requirements

### Requirement: Claude Sidebar Listing SHALL Consume Catalog Membership

Claude sidebar listing SHALL use the shared workspace session catalog projection for default active workspace membership and SHALL treat native Claude history listing as a source of transcript truth, diagnostics, or degraded continuity only.

#### Scenario: catalog admits Claude sidebar row
- **WHEN** the shared active projection includes a Claude session for the current workspace scope
- **THEN** the sidebar MUST render that Claude session according to the current display window and filters
- **AND** it MUST preserve the owner and parent relationship metadata from the projection

#### Scenario: native empty does not override catalog row
- **WHEN** native Claude listing returns empty or times out
- **AND** the shared catalog projection still includes Claude rows or marks Claude source as incomplete
- **THEN** the sidebar MUST NOT remove the catalog-backed Claude rows solely because the native list was empty

#### Scenario: authoritative catalog removal wins
- **WHEN** the shared catalog projection proves a Claude row is archived, hidden, deleted, or out of strict workspace scope
- **THEN** the sidebar MUST remove or suppress that row
- **AND** native last-good continuity MUST NOT resurrect it

#### Scenario: native list does not widen complete catalog membership
- **WHEN** the shared catalog projection is complete for Claude in the current strict workspace scope
- **AND** native Claude listing returns an additional session outside that projection
- **THEN** the sidebar MUST NOT add that native-only session to default workspace membership
- **AND** the native-only session MAY be surfaced only through diagnostic, related, global, or explicit transcript lookup surfaces

### Requirement: Claude Sidebar Continuity SHALL Follow Source Completeness

Claude sidebar continuity SHALL be applied only when the current Claude source evidence is incomplete and SHALL remain visibly degraded until authoritative evidence arrives.

#### Scenario: uncertain empty preserves readable continuity
- **WHEN** the current refresh reports uncertain empty for Claude
- **AND** the sidebar has last-good Claude rows for the same workspace scope
- **THEN** the sidebar MUST preserve those rows as continuity placeholders
- **AND** it MUST expose a degraded or incomplete state rather than presenting the list as fully fresh

#### Scenario: authoritative empty clears continuity
- **WHEN** the backend reports authoritative empty for Claude in the current strict scope
- **THEN** the sidebar MUST clear stale Claude continuity rows for that scope
- **AND** it MUST NOT keep them as if they were active sessions

#### Scenario: continuity is keyed by stable session identity
- **WHEN** the sidebar preserves a Claude row across a degraded refresh
- **THEN** it MUST key that row by canonical session identity and owner scope
- **AND** it MUST NOT create duplicate rows for the same underlying Claude session

#### Scenario: continuity remains visually incomplete
- **WHEN** the sidebar preserves last-good Claude rows because the current source status is partial, degraded, or uncertain empty
- **THEN** the preserved rows MUST be distinguishable from fully fresh catalog rows through projection status, source badge, or equivalent state available to the UI
- **AND** the sidebar MUST NOT present the preserved result as an authoritative complete refresh

### Requirement: Claude Sidebar Titles SHALL Use Shared Title Projection

Claude sidebar titles SHALL come from the shared session title projection so weaker generic fallback names do not overwrite meaningful names from catalog, metadata, or previous projection state.

#### Scenario: custom title wins in sidebar
- **WHEN** a Claude session has a custom title in session metadata
- **THEN** the sidebar MUST display that title
- **AND** native first-message or generic fallback text MUST NOT override it

#### Scenario: weak fallback cannot replace meaningful title
- **WHEN** a Claude sidebar row already has a meaningful title
- **AND** a later incomplete refresh only provides a generic name such as `Claude Session` or `Agent N`
- **THEN** the sidebar MUST keep the meaningful title
- **AND** it MUST NOT replace the row name with the generic fallback

#### Scenario: settings and sidebar agree on title
- **WHEN** the same Claude session appears in Sidebar and Session Management
- **THEN** both surfaces MUST display the same resolved title unless one surface explicitly shows additional debug metadata
- **AND** the resolver priority MUST remain consistent across both surfaces
