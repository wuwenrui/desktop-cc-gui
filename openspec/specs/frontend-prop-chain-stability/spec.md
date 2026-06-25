# frontend-prop-chain-stability Specification

## Purpose
TBD - created by archiving change frontend-prop-chain-stability-2026-06. Update Purpose after archive.
## Requirements
### Requirement: App Shell Context MUST Be Split By Domain

The single monolithic `appShellContext` MUST be split into domain-scoped contexts (e.g. `runtimeThreadContext`, `workspaceNavigationContext`, `composerContext`, `layoutContext`, `fileEditorContext`, `settingsContext`) so that streaming state does not propagate to unrelated UI regions.

#### Scenario: streaming state is scoped to runtime/composer

- **WHEN** a codex streaming burst updates `useThreads` state
- **THEN** only `runtimeThreadContext` and `composerContext` consumers MUST re-render
- **AND** `workspaceNavigationContext`, `fileEditorContext`, and `settingsContext` consumers MUST NOT re-render due to that streaming update.

#### Scenario: domain split replaces single-useMemo anti-pattern

- **WHEN** the prop chain is reviewed
- **THEN** the implementation MUST NOT use a single `useMemo` with a manually white-listed dep list to keep a giant object reference stable
- **AND** React exhaustive-deps MUST pass without manual dep suppression.

#### Scenario: each domain context exposes a stable interface

- **WHEN** a domain context value changes
- **THEN** only consumers that depend on the changed domain MUST re-render
- **AND** consumers of other domains MUST keep their previous reference.

### Requirement: Layout Nodes Options MUST Be Reduced And Selectively Memoized

The options object passed to `useLayoutNodes` MUST be reduced in size, and any remaining `useMemo` MUST obey exhaustive-deps.

#### Scenario: options object is reduced

- **WHEN** the options object passed to `useLayoutNodes` is reviewed
- **THEN** the object MUST NOT contain keys that are only relevant to other domains
- **AND** the deps of any `useMemo` covering the options MUST include every key actually read inside `useLayoutNodes`.

#### Scenario: streaming state does not invalidate layout options

- **WHEN** a codex streaming burst updates `useThreads` state
- **THEN** the options object passed to `useLayoutNodes` MUST remain referentially equal across the burst
- **AND** `useLayoutNodes` internal memo hit rate MUST be reported as evidence.

### Requirement: Sidebar And ThreadList MUST Use Scoped Status Lookups

`Sidebar` and `ThreadList` MUST NOT receive the global `threadStatusById` map as a per-row prop. They MUST use a row-level status lookup or a scoped selector.

#### Scenario: row-level status is queried, not broadcast

- **WHEN** `threadStatusById` changes for one thread
- **THEN** only the row for that thread MUST re-render its status badge
- **AND** other rows MUST keep their previous props.

#### Scenario: ThreadRowItem memo boundary is preserved

- **WHEN** a row's data has not changed
- **THEN** the row component MUST NOT re-render
- **AND** the test MUST verify the row's render count remains stable across 1000 unrelated `threadStatusById` updates.

### Requirement: Search And Composer Section Callbacks MUST Follow Exhaustive-Deps

All `handle*` and `on*` callbacks in `useAppShellSearchAndComposerSection` MUST be wrapped in `useCallback` with exhaustive-deps. White-listing deps to silence the linter is forbidden.

#### Scenario: callback reference is stable when deps are stable

- **WHEN** the parent re-renders during a streaming burst
- **THEN** each `useCallback` MUST keep its reference stable
- **AND** the test MUST record the reference via a `useRef` and verify equality.

#### Scenario: callback reference updates when a real dep changes

- **WHEN** a real dep of a callback changes
- **THEN** the callback reference MUST update
- **AND** the test MUST verify the new reference is not equal to the old one.

#### Scenario: exhaustive-deps lint passes

- **WHEN** the project lint runs
- **THEN** the section MUST pass `react-hooks/exhaustive-deps` without manual dep suppression comments.

### Requirement: Prop Chain Stability Evidence MUST Be Reported

Runtime evidence gates MUST report per-region render counts so a prop chain regression is detectable.

#### Scenario: composer and sidebar render counts are reported

- **WHEN** the evidence gate runs against a codex streaming fixture
- **THEN** `composer_render_count_per_streaming_minute` MUST be present
- **AND** `sidebar_render_count_per_streaming_minute` MUST be present.

#### Scenario: row and layout recompute counts are reported

- **WHEN** the evidence gate runs
- **THEN** `thread_row_rerender_count_per_1000_delta` MUST be present
- **AND** `layout_nodes_recompute_count_per_1000_delta` MUST be present.

#### Scenario: virtualization is decided by evidence, not assumed

- **WHEN** this change is implemented
- **THEN** it MUST NOT introduce Sidebar virtualization as part of this change
- **AND** a follow-up change MAY be opened based on the reported `thread_row_rerender_count_per_1000_delta` evidence.

### Requirement: V0511 Frontend Prop Chain Summary MUST Use Render Counters

Frontend prop-chain stability evidence MUST use existing render/profile counters before classifying composer, sidebar, row, or layout recompute metrics as unsupported.

#### Scenario: profiler counters populate frontend summary

- **WHEN** a v0.5.11 frontend profile fixture records composer or sidebar render counts
- **THEN** `frontendPropChainStabilitySummary` MUST expose `composer_render_count_per_streaming_minute` or `sidebar_render_count_per_streaming_minute`
- **AND** the report MUST preserve the producer evidence class

#### Scenario: unavailable row evidence remains explicit

- **WHEN** thread row rerender or layout recompute counts are not available
- **THEN** the matching fields MUST remain unsupported
- **AND** the report MUST identify the missing producer or runtime source

