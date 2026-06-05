## ADDED Requirements

### Requirement: Session Radar Hydration SHALL Be Bounded And Staged

Session Radar aggregation and prewarm SHALL not monopolize foreground interaction work.

#### Scenario: radar prewarm yields to active interaction
- **WHEN** the user is typing in Composer, switching threads, or a foreground streaming turn is under render pressure
- **THEN** Radar prewarm and non-active workspace hydration SHOULD be delayed, staged, or run with a bounded budget
- **AND** it MUST NOT block foreground input handling or active thread selection

#### Scenario: radar preserves global view without widening membership
- **WHEN** Radar shows running or recently completed sessions across workspaces
- **THEN** it MAY keep a global aggregate view
- **AND** any workspace thread-list hydration it triggers MUST apply membership and attribution rules for the target workspace scope
- **AND** Radar prewarm MUST NOT write another workspace's session into the current workspace membership

### Requirement: Session Radar Updates SHALL Avoid Full Sidebar Reprojection

Radar running/recent updates SHALL be projected in a way that does not force unrelated sidebar workspace trees to rebuild.

#### Scenario: running count update is workspace-scoped
- **WHEN** a running session count changes for one workspace
- **THEN** sidebar or Radar consumers SHOULD update the affected workspace projection only
- **AND** unrelated workspace folder trees, thread rows, and move targets MUST NOT be recomputed solely because that count changed

#### Scenario: deterministic aggregate avoids list jitter
- **WHEN** many session activity updates arrive concurrently
- **THEN** Radar rows MUST remain deduped by workspace-thread identity and stably ordered by freshness plus deterministic tie-breakers
- **AND** performance staging MUST NOT introduce duplicate rows or jumpy ordering

### Requirement: Radar Navigation SHALL Use Foreground-First Thread Switch

Navigation from Radar SHALL follow the same foreground-first switching contract as sidebar and topbar navigation.

#### Scenario: jump to running session does not wait for prewarm
- **WHEN** the user clicks a running Radar session
- **THEN** the app MUST activate the target workspace/thread foreground state first
- **AND** additional Radar refresh, workspace thread hydration, or session catalog reconciliation MUST run after or alongside the visible navigation with stale guards

#### Scenario: stale radar navigation work is scoped
- **WHEN** a Radar navigation triggers hydration and the user navigates elsewhere before it completes
- **THEN** late Radar-triggered work MUST remain scoped to its requested workspace/thread
- **AND** it MUST NOT restore the old Radar target as the current active thread
