## ADDED Requirements

### Requirement: Realtime Performance Budget MUST Include Shell Invalidation Evidence
Realtime client performance diagnostics SHALL distinguish Canvas render pressure from Shell control invalidation.

#### Scenario: Diagnostics classify shell invalidation separately
- **WHEN** a realtime streaming turn causes visible interaction lag
- **THEN** diagnostics SHOULD be able to distinguish canvas projection/render work, app-server event queue pressure, hidden-surface compute, and Shell control invalidation
- **AND** the report MUST remain content-safe and bounded

#### Scenario: Control responsiveness remains canonical
- **WHEN** a user clicks new session, switches a topbar tab, selects a sidebar row, or types in Composer during active streaming
- **THEN** those interaction paths MUST remain immediate relative to local state updates
- **AND** Canvas rendering MAY lag or hydrate later without delaying the local control feedback

### Requirement: Realtime Canvas Work MUST Not Hydrate Hidden Surfaces
Realtime conversation updates SHALL not force inactive heavy surfaces to hydrate or recompute.

#### Scenario: Background canvas burst does not wake hidden panels
- **WHEN** a high-frequency realtime burst updates active conversation canvas data
- **THEN** hidden heavy surfaces MUST stay paused
- **AND** their heavy computations MUST NOT run until their activation state changes

#### Scenario: Surface activation reads latest canonical state
- **WHEN** a paused heavy surface becomes active after realtime updates occurred
- **THEN** it MUST read the latest canonical state or snapshot
- **AND** it MUST NOT rely on having processed every hidden intermediate realtime update
