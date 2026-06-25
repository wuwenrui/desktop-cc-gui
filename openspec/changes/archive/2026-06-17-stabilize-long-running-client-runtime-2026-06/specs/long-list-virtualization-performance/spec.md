# long-list-virtualization-performance Specification (Delta)

## ADDED Requirements

### Requirement: Workspace And Session Lists MUST Use Bounded Rendering At Scale

Home workspace pickers, Sidebar session groups, and ThreadList session rows that can exceed 100 rows MUST use virtualization or an equivalent bounded-render strategy.

#### Scenario: Home workspace picker virtualizes large workspace sets

- **WHEN** the workspace picker contains 100 or more filtered workspaces
- **THEN** it MUST render through a virtualizer or equivalent bounded projection
- **AND** row identity MUST be based on `workspace.id`
- **AND** search/filter behavior MUST preserve the same selected workspace semantics as the non-virtualized path

#### Scenario: session list virtualizes large thread sets

- **WHEN** a workspace contains 100 or more visible thread/session rows
- **THEN** Sidebar or ThreadList session rendering MUST mount only the visible window plus documented overscan
- **AND** row identity MUST be based on `thread.id`
- **AND** selected, pinned, active, and processing rows MUST remain reachable

#### Scenario: Sidebar mixed nodes use an explicit virtual item model

- **WHEN** Sidebar contains grouped workspaces, pinned rows, session folders, worktrees, separators, load-more rows, or empty states
- **THEN** the scrollable repeated content MUST be represented as explicit virtual item kinds before virtualization
- **AND** every item key MUST be derived from stable workspace/thread/folder identity, never from array index
- **AND** bounded chrome outside the virtualizer MUST be documented as intentionally non-virtualized

#### Scenario: virtualized list does not use index keys

- **WHEN** workspace or thread rows are rendered under virtualization
- **THEN** index-based keys MUST NOT be used
- **AND** row state MUST remain attached to stable workspace/thread identity

### Requirement: Session Row Projection MUST Be Lazy And Bounded

Session row derived data such as processing state, unread state, background activity, and lightweight badges MUST be computed for visible rows rather than for every thread on workspace switch.

#### Scenario: visible-row projection limits computation

- **WHEN** a workspace has 200 threads and only a virtualized subset is visible
- **THEN** background activity and row projection helpers MUST be called only for visible rows plus overscan
- **AND** the implementation MUST NOT rebuild a full `backgroundActivityByThread` object solely to render the current viewport

#### Scenario: projection cache is bounded

- **WHEN** row projection results are cached
- **THEN** the cache MUST have a documented maximum size
- **AND** cache keys MUST include thread identity and enough status/source version data to avoid stale row state

#### Scenario: module switch budget captures projection cost

- **WHEN** module or workspace switch performance evidence is collected
- **THEN** the report MUST distinguish selection latency, list mount/commit cost, and row projection cost where available
- **AND** proxy evidence MUST remain labeled as proxy unless collected from real runtime timing
