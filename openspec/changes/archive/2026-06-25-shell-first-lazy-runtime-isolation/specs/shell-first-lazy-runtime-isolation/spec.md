## ADDED Requirements

### Requirement: Shell Control Plane MUST Not Subscribe To Canvas Heavy Objects
The client SHALL keep topbar, sidebar, right-panel controls, and Composer input controls on a Shell control plane that receives narrow summaries rather than full active canvas content objects.

#### Scenario: Canvas-only object churn does not invalidate shell controls
- **WHEN** a realtime conversation appends, coalesces, or reprojects active canvas items
- **THEN** unchanged Shell controls MUST keep stable props and render identity
- **AND** Shell controls MUST NOT receive full `activeItems`, timeline projection rows, render-weight summaries, full task-run arrays, or hidden-surface datasets solely to display control state

#### Scenario: Shell receives explicit pressure summaries
- **WHEN** Shell controls need to display running, unread, active, provider, rate-limit, or busy affordances
- **THEN** those controls MUST receive a narrow typed summary or selector output
- **AND** the summary MUST be derived without requiring hidden canvas/render projections to run

### Requirement: Conversation Canvas MUST Own Heavy Realtime Rendering Inputs
The client SHALL route active conversation items, timeline projection, hydration, render-weight analysis, and active task-run conversation surfaces through a Canvas content plane.

#### Scenario: Active canvas can update without recomputing shell nodes
- **WHEN** the active conversation receives high-frequency deltas
- **THEN** Canvas rendering MAY update through its lane and local projections
- **AND** AppShell/layout Shell node construction MUST NOT recompute unrelated sidebar, topbar, or right-panel control props because of canvas-only data

#### Scenario: Terminal settlement remains authoritative
- **WHEN** Canvas rendering is deferred, throttled, or lazily hydrated
- **THEN** terminal lifecycle, final assistant text, approval state, and user-input state MUST remain semantically equivalent to the canonical thread runtime
- **AND** deferred rendering MUST NOT re-open completed turns or hide terminal failure diagnostics

### Requirement: Inactive Heavy Surfaces MUST Pause Heavy Compute
The client SHALL distinguish lazy importing from lazy computation. Hidden or inactive heavy surfaces MUST not execute heavy dataset, projection, hydration, or render-weight work until they become active or split-visible.

#### Scenario: Hidden surface keeps only lightweight state
- **WHEN** Project Map, Intent Canvas, Browser Dock, Git detail, File detail, SpecHub, Task Center, or similar heavy surfaces are hidden
- **THEN** the app MAY retain lightweight snapshot state
- **AND** the app MUST NOT run heavy projection or panel dataset work for that surface on every realtime canvas update

#### Scenario: Activated surface hydrates on demand
- **WHEN** a user activates a previously hidden heavy surface
- **THEN** that surface MUST hydrate from canonical state or cached snapshot
- **AND** activation MUST NOT require reconnecting or restarting the active realtime conversation

### Requirement: Shell-First Isolation MUST Be Regression-Tested
The client SHALL provide regression coverage that guards the Shell/Canvas subscription boundary.

#### Scenario: Tests detect shell invalidation by canvas-only data
- **WHEN** tests simulate active streaming canvas-only data changes
- **THEN** unchanged topbar, sidebar row, right-panel toolbar, and Composer input control paths MUST remain stable
- **AND** the tests MUST fail if full canvas objects are reintroduced into those control paths

#### Scenario: Tests detect hidden-surface compute leakage
- **WHEN** tests render the app with a heavy surface inactive
- **THEN** mocked heavy dataset or projection functions for that surface MUST not be called by unrelated realtime canvas updates
- **AND** the same surface MUST compute after explicit activation
