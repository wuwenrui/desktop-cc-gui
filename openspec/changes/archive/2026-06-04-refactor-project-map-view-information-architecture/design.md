## Context

Project Map 的当前问题不是单个能力缺失，而是完成后的能力组合失序。Evidence Files、Relations、Impact、Path Finder、Tour、Graph Repair 都各自有合理 proposal，但它们被并列接入后，红框区域缺少信息架构，导致：

- 首屏没有清晰主语义。
- 统计、诊断、筛选、证据、关系被视觉上等权处理。
- Evidence Files 和 Relations 作为已完成能力抢占过多注意力。
- Graph Repair 常驻高权重，容易把健康状态误读成主要任务。
- 用户无法快速判断“现在应该看哪里、下一步该做什么”。

本 change 的设计目标是建立 view composition contract，而不是新增 graph feature。

## Code Calibration

Current code already has the raw material for the refactor:

- `ProjectMapPanel.tsx` has local expansion state:
  - `isNavigationPanelExpanded`
  - `isEvidenceFilesPanelExpanded`
  - `isRelationPanelExpanded`
  - `isGraphHealthExpanded`
  - `isLensStripCollapsed`
  - `isDetailCollapsed`
- `ProjectMapPanel.tsx` already derives the main feature projections:
  - `selectedExplainPack`
  - `evidenceFileIndex`
  - `impactAnalysis`
  - `relationIndex`
  - `filteredRelations`
  - `graphIntegrityIssues`
  - `activeGraphRepairSummary`
  - `guidedTourSteps`
  - `pathResult`
- The red-frame area is primarily the `.project-map-lens-shell` composition:
  - stage toolbar and stats
  - `ProjectMapNavigationPanel`
  - `ProjectMapEvidenceFilesPanel`
  - `ProjectMapRelationLegendPanel`
  - optional domain strip
- `DetailPanel` already carries the richer contextual surface and receives relation, repair, impact, refresh, explain-pack, and orchestration draft data.
- `project-map.css` already defines collapsed shells for navigation/evidence/relation panels, so implementation should first change composition and default priority rather than inventing new raw UI primitives.

Therefore the implementation should be a semantic recomposition over existing projections and panels, not a new Project Map feature track.

## Design Goals

- Project Map first screen should answer: this project map is about what, current focus is what, what needs attention, where can I drill down.
- Primary, secondary, and tertiary controls must be visually and structurally separated.
- Existing feature reachability must be preserved.
- Default state must reduce cognitive load.
- Layout state and semantic data must remain separate.

## Non Goals

- No graph renderer replacement.
- No ProjectMapDataset schema migration.
- No AI prompt or generation pipeline changes.
- No Orchestration Center execution behavior changes.
- No wholesale ProjectMapPanel rewrite unless implementation discovers an unavoidable file-size or testability blocker.

## Information Architecture

### Layer 1: Primary Map Understanding

Primary region owns the first read:

- Project/profile identity.
- Node/lens/evidence/relation health summary, compressed into a single intent-aware status strip.
- Current view mode or current selected focus.
- One primary action group: generate/refresh/focus/back depending on state.

This layer must not show every available filter or raw diagnostic by default.

### Layer 2: Contextual Focus

Contextual focus owns the selected entity:

- selected node
- selected lens
- selected evidence file
- selected relation
- selected path/tour step

Only one contextual subject should dominate at a time. If no subject is selected, the panel should show concise guidance and recommended next actions.

Implementation implication: `DetailPanel` is already closest to this layer. The refactor should either strengthen `DetailPanel` as the contextual focus surface or introduce a thin `ProjectMapContextSummary` above the graph that delegates details to `DetailPanel`. It should not duplicate the same node/relation/evidence facts in both places with equal weight.

### Layer 3: Evidence And Relations

Evidence Files and Relations are supporting investigation surfaces:

- Evidence Files answers: which files support the map and which nodes do they connect to.
- Relations answers: why two nodes are connected and what incoming/outgoing graph evidence exists.

They should be available through tabs, drawers, segmented mode, or collapsible sections, but not both rendered as large always-expanded peer blocks in the default state.

Implementation implication: existing `ProjectMapEvidenceFilesPanel` and `ProjectMapRelationLegendPanel` can stay as panels, but their default collapsed summary should behave like mode affordances. Expanded detail should be user-triggered or context-triggered by selected evidence/relation state.

### Layer 4: Advanced Tools And Diagnostics

Advanced controls include:

- relation filters
- source-kind filters
- direction filters
- raw counts
- graph repair details
- degraded reference diagnostics

These controls should be discoverable but subordinate. They can become prominent when there is an active filter, degraded state, stale evidence, or repair candidate.

Implementation implication: relation type/source/direction filters and evidence source-kind/search filters should not all sit in the first-read band until the corresponding mode is expanded.

## Interaction Model

### Default State

Default Project Map view should:

- show compact health/status metrics
- show current map/lens/focus summary
- expose mode entry points for Evidence, Relations, Tour, Path, Impact
- keep empty/sparse supporting surfaces collapsed or summarized
- keep repair as a health cue unless attention is required

Code-level default target:

- `isNavigationPanelExpanded`: false unless search/path/tour state is active.
- `isEvidenceFilesPanelExpanded`: false unless an evidence file is selected or evidence highlight is active.
- `isRelationPanelExpanded`: false unless a relation is selected, relation filter is active, or selected node relation review is explicitly requested.
- `isGraphHealthExpanded`: false unless graph integrity issues or repair actions exist.
- `isLensStripCollapsed`: true remains acceptable if a compact mode rail/status strip replaces the current equal-weight panel stack.

### Selected Node State

When a node is selected:

- the selected node becomes the contextual focus
- Explain Pack and local evidence summary become primary within the focus card
- Relations summary becomes one-click expandable
- Evidence Files can highlight related files without taking over the screen

### Selected Evidence File State

When an evidence file is selected:

- the file becomes contextual focus
- related nodes and evidence refs are shown in the focus area
- graph highlights related nodes
- Relations remains secondary unless the file has relation-backed evidence

### Selected Relation State

When a relation is selected:

- the relation becomes contextual focus
- source/target nodes, type, source kind, confidence, stale/degraded markers, and evidence refs are shown
- endpoint navigation is prominent
- Evidence Files is available as supporting context

### Repair Attention State

Graph Repair should escalate only when:

- dangling relation endpoints exist
- invalid graph records exist
- repair candidates exist
- stale or missing evidence crosses a configured visible warning threshold

Healthy state should remain a compact indicator, not a large warning-like block.

Current code anchor: the stage stats already render `.project-map-health-chip` with `graphIntegrityIssues.length` and `activeGraphRepairSummary?.actions.length`; this can become the escalation gate instead of showing repair content as a normal peer section.

## State Priority

Visual highlight priority should be deterministic:

1. explicit selected entity
2. active path finder result
3. active impact overlay
4. active search result
5. active tour step
6. active evidence/relation filter
7. stale/degraded health cues

This priority is view state only and must not mutate persisted Project Map data.

## Implementation Shape

Recommended implementation:

- Add a small view composition model inside Project Map UI code:
  - `primarySummary`
  - `activeContextSubject`
  - `secondaryModes`
  - `attentionState`
  - `visibleSectionState`
- Derive that model from existing local state and projections first; avoid writing a new persisted semantic object.
- Keep `ProjectMapNavigationPanel`, `ProjectMapEvidenceFilesPanel`, and `ProjectMapRelationLegendPanel` as reusable leaves unless splitting them out reduces `ProjectMapPanel.tsx` pressure.
- Prefer a small `ProjectMapViewModeRail` or `ProjectMapInvestigationStrip` over more always-expanded vertical panels.
- Move large blocks into named semantic sections or small local components only where this reduces complexity.
- Preserve existing utility functions for evidence index, relation index, navigation, impact, and graph integrity.
- Keep CSS feature-scoped and avoid introducing global layout assumptions.

## Alternatives

### Alternative A: CSS-only polish

Rejected. CSS can improve density, but it cannot decide ownership between Evidence Files, Relations, and Repair. The failure is semantic before visual.

### Alternative B: Full dashboard rewrite

Rejected. It risks regressing completed Project Map capabilities and recreates the Understand-Anything dashboard mistake that previous research explicitly avoided.

### Alternative C: View IA composition layer

Accepted. It changes the presentation contract while preserving data contracts and completed utilities.

## Risks And Mitigations

- Risk: Existing completed capability becomes harder to find.
  - Mitigation: each secondary mode must keep a visible affordance with count or state label.
- Risk: Section collapse hides important degraded state.
  - Mitigation: degraded/repair/stale states escalate into attention cues.
- Risk: More UI state increases component complexity.
  - Mitigation: view composition state must stay derived/local and not become semantic storage.
- Risk: Refactor collides with large-file cleanup.
  - Mitigation: align stylesheet extraction with `reduce-project-map-large-file-and-test-pressure` when both touch Project Map CSS; do not mix behavior changes into the hygiene change.
- Risk: UI labels keep implying feature inventory instead of user intent.
  - Mitigation: update copy around mode affordances to emphasize intent, e.g. navigate, inspect evidence, inspect relations, review health.

## Rollback

- Remove the view composition layer and restore previous section rendering order.
- Keep existing Evidence Files, Relations, Tour, Path, Impact, and Repair utilities unchanged.
- Since no semantic storage migration is expected, rollback should not require data cleanup.
