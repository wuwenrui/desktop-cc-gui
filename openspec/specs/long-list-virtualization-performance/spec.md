# long-list-virtualization-performance Specification

## Purpose

Defines the performance contract for long lists in chat, workspace, and session surfaces. Long-list rendering MUST use viewport-bounded projection or virtualization while preserving row identity, scroll semantics, active selection, pinned/session grouping behavior, and lazy visible-row projection under large workspace or conversation counts.
## Requirements
### Requirement: Long Message Lists MUST Use A Viewport Projection Boundary

Long-list optimization MUST be implemented as a render-layer viewport projection and MUST NOT change reducer state shape, message identity, or conversation ordering.

#### Scenario: virtualization preserves message identity and order

- **WHEN** a 1000-row conversation is rendered through virtualization
- **THEN** visible rows MUST preserve the same message ids and ordering as the underlying conversation state
- **AND** reducer state MUST remain unchanged by viewport calculations

### Requirement: Streaming Row MUST Remain Stable During Virtualization

Virtualization MUST preserve live streaming semantics for the active assistant row.

#### Scenario: active streaming row receives deltas without visual reset

- **WHEN** assistant text deltas append to the active row
- **THEN** virtualization MUST NOT lose the row's live content, scroll intent, or selection state

### Requirement: Scroll Restoration MUST Preserve Existing User Semantics

The system MUST preserve existing scroll position restoration and initial visible row semantics after virtualization.

#### Scenario: restored session opens at the expected scroll position

- **WHEN** a long restored session is opened
- **THEN** the visible position MUST match the pre-change behavior or be explicitly documented as an intentional improvement

### Requirement: S-LL-1000 MUST Have Browser-Level Scroll Verification

The `S-LL-1000` scenario MUST move beyond jsdom-only proxy confidence by adding a browser-level scroll verification gate or a documented environment limitation.

#### Scenario: browser scroll gate records long-list behavior

- **WHEN** long-list perf validation runs
- **THEN** `S-LL-1000` MUST include browser-level scroll evidence or an explicit unsupported marker with rationale

### Requirement: Long-List Metrics MUST Not Regress Against v0.4.18 Baseline

The system MUST compare long-list metrics against the v0.4.18 baseline and prevent unbounded regressions.

#### Scenario: commit and scroll metrics are compared

- **WHEN** `npm run perf:long-list:baseline` runs
- **THEN** `S-LL-1000` commit / scroll metrics MUST not be worse than baseline without a documented reason
- **AND** `openspec validate optimize-long-list-virtualization --strict --no-interactive` MUST pass

### Requirement: Long Streaming Timelines SHALL Keep Heavy Derivations Off The Delta Path

Long conversation timelines SHALL preserve a stable parent presentation snapshot during live output growth so per-delta work remains bounded.

#### Scenario: live row grows without full timeline recomputation
- **WHEN** a single assistant or reasoning row receives repeated realtime deltas
- **THEN** the latest live row MUST remain visible through an override or equivalent active-row path
- **AND** grouping, anchors, sticky candidates, final boundary sets, suppressed context sets, and collapsed middle-step projections MUST NOT be recomputed from the full latest timeline on every text delta

#### Scenario: stable snapshot converges after completion
- **WHEN** the streaming turn completes
- **THEN** the stable presentation snapshot MUST converge to canonical latest timeline items
- **AND** final boundaries, anchors, sticky candidates, and collapsed rows MUST reflect the completed conversation without requiring history replay as the only source of truth

### Requirement: Streaming Virtualization SHALL Preserve Active Row Semantics

Any virtualization, content visibility, chunking, or row windowing used during streaming SHALL preserve active row visibility, scroll intent, selection, and copy semantics.

#### Scenario: active streaming row is not recycled away
- **WHEN** timeline virtualization or content visibility is enabled while a row is actively streaming
- **THEN** the active live row MUST remain mounted or otherwise preserve live text, selection, auto-follow intent, and message actions
- **AND** the user MUST NOT see the active response reset, disappear, or wait for history restore

#### Scenario: non-live rows may be bounded
- **WHEN** a long timeline contains many historical rows during an active streaming turn
- **THEN** non-live historical rows MAY be virtualized, hidden with content visibility, or collapsed by a documented projection
- **AND** message order, message identity, anchor navigation, and scroll restoration MUST remain explainable from canonical conversation state

### Requirement: Scroll Work SHALL Be Throttled Without Blocking Input

Auto-follow, scroll restoration, and message jump work SHALL be scheduled so it does not monopolize the main thread during typing or high-frequency streaming.

#### Scenario: auto-follow does not flood smooth scroll work
- **WHEN** a live conversation receives frequent deltas
- **THEN** auto-follow scroll work MUST be throttled, coalesced, or switched to instant behavior during active streaming
- **AND** pending scroll work MUST NOT block Composer input event handling

#### Scenario: manual scroll intent is preserved
- **WHEN** the user scrolls away from the bottom during streaming
- **THEN** throttled auto-follow MUST respect the user's manual scroll intent
- **AND** performance optimization MUST NOT force the viewport back to the live row unless the user re-enables follow behavior

### Requirement: Timeline Virtualization SHALL Account For Render Weight

Timeline virtualization SHALL consider render weight in addition to row count so image-heavy or long-content conversations can bound renderer memory and layout work before reaching the large-row threshold.

#### Scenario: image-heavy timeline virtualizes before row-count threshold
- **WHEN** a conversation contains message images, deferred image placeholders, generated image cards, or other image-heavy rows
- **AND** the row count is below the normal long-list threshold
- **THEN** the timeline MAY enable virtualization based on accumulated render weight
- **AND** message order, identity, actions, anchor navigation, and scroll restoration MUST remain based on canonical conversation state

#### Scenario: active streaming row remains reachable under weighted virtualization
- **WHEN** weighted virtualization is enabled while a turn is active
- **THEN** the active live row MUST remain visible or reachable through the existing live-row override semantics
- **AND** virtualization MUST NOT reset live text, copy/fork/rewind controls, or user scroll intent

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
