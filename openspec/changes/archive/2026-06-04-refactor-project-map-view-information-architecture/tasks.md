## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal for Project Map view information architecture refactor.
- [x] 1.2 Create design for primary/secondary/tertiary Project Map view layering.
- [x] 1.3 Create delta spec for `project-xray-panel`.
- [x] 1.4 Run strict OpenSpec validation.

## 2. View IA Contract And Component Boundaries

- [x] 2.1 [P0][I: `.project-map-lens-shell`, `ProjectMapNavigationPanel`, `ProjectMapEvidenceFilesPanel`, `ProjectMapRelationLegendPanel`, `DetailPanel`][O: documented section ownership map][V: each existing Project Map feature is assigned primary, secondary, or tertiary ownership] Map current red-frame sections to semantic zones.
- [x] 2.2 [P0][I: `selectedNode`, `selectedEvidenceFileEntry`, `selectedRelation`, `searchQuery`, `activeTourStep`, `pathResult`, `impactAnalysis`, `graphIntegrityIssues`, `activeGraphRepairSummary`][O: deterministic active-context priority model][V: focused tests or state assertions cover priority order] Add active context subject derivation.
- [x] 2.3 [P0][I: existing `ProjectMapPanel.tsx` local state and render tree][O: minimal view composition layer with `primarySummary`, `activeContextSubject`, `secondaryModes`, `attentionState`, `visibleSectionState`][V: no semantic `ProjectMapDataset` mutation] Introduce primary summary, contextual focus, secondary modes, and attention state.
- [x] 2.4 [P1][depends:2.3][I: current inline local components][O: component extraction decision][V: no new component unless it reduces ProjectMapPanel complexity or clarifies semantic ownership] Decide whether to extract `ProjectMapViewModeRail` / `ProjectMapContextSummary`.

## 3. Project Map View Refactor

- [x] 3.1 [P0][depends:2.3][I: default loaded map state][O: compact primary status/focus/header area][V: default view does not render every utility section as equal-weight expanded blocks] Refactor default first-read area.
- [x] 3.2 [P0][depends:2.3][I: `ProjectMapEvidenceFilesPanel`, `isEvidenceFilesPanelExpanded`, `selectedEvidenceFileEntry`, `isEvidenceFileHighlightActive`][O: secondary evidence mode/drawer/section with count affordance][V: file selection still focuses related nodes and opens files] Re-home Evidence Files into supporting investigation surface.
- [x] 3.3 [P0][depends:2.3][I: `ProjectMapRelationLegendPanel`, `ProjectMapRelationInspector`, `isRelationPanelExpanded`, `selectedRelation`, relation filters][O: secondary relation mode/drawer/section with summary affordance][V: selected relation, endpoint navigation, and relation filters still work] Re-home Relations into supporting investigation surface.
- [x] 3.4 [P1][depends:2.3][I: `.project-map-health-chip`, `isGraphHealthExpanded`, `graphIntegrityIssues`, `activeGraphRepairSummary`][O: anomaly-driven repair attention cue][V: healthy state remains compact; issue state escalates visibly] Make Graph Repair prominence state-driven.
- [x] 3.5 [P1][depends:2.3][I: `ProjectMapNavigationPanel`, search, guided tour, path finder, impact overlay controls][O: secondary navigation/action affordances with consistent visual weight][V: each flow remains reachable from the refactored view] Normalize navigation tool entry points.

## 4. Styling And Accessibility

- [x] 4.1 [P0][depends:3][I: `src/styles/project-map.css`, existing `.project-map-lens-shell`, navigation/evidence/relation collapsed classes][O: semantic spacing, hierarchy, and affordance styling][V: narrow and desktop layouts keep primary action and focus area usable] Update feature-scoped styling.
- [x] 4.2 [P0][depends:3][I: section toggles and mode controls][O: accessible labels and keyboard-reachable controls][V: focused render/accessibility assertions cover major affordances] Preserve accessible navigation.
- [x] 4.3 [P1][depends:4.1][I: active large-file cleanup and existing `@import "./project-map.inspector.css"`][O: non-conflicting stylesheet split if needed][V: no duplicated CSS ownership with large-file-pressure change] Coordinate CSS extraction with `reduce-project-map-large-file-and-test-pressure`.
- [x] 4.4 [P1][depends:3][I: i18n keys under `projectMap.navigation`, `projectMap.evidenceFiles`, `projectMap.relations`, `projectMap.repair`][O: intent-oriented labels for mode affordances][V: labels describe user intent rather than raw feature inventory] Update copy where needed.

## 5. Regression Coverage

- [x] 5.1 [P0][depends:3][I: default Project Map view][O: tests for default collapsed/summary states][V: Evidence Files and Relations are reachable but not both large always-expanded blocks by default] Add default view-state tests.
- [x] 5.2 [P0][depends:3][I: selected node/file/relation states in `ProjectMapPanel`][O: tests for contextual focus switching][V: selected subject becomes dominant without mutating dataset] Add contextual focus tests.
- [x] 5.3 [P1][depends:3.4][I: healthy and degraded repair fixtures][O: tests for repair attention escalation][V: healthy compact state and issue prominent state both covered] Add repair visibility tests.
- [x] 5.4 [P1][depends:3][I: legacy/sparse datasets][O: fallback tests][V: no relations/evidence/tour/repair datasets render meaningful fallback states] Add sparse dataset fallback tests.
- [x] 5.5 [P1][depends:3][I: relation/evidence/search/path/tour highlight state][O: priority regression tests][V: explicit selected entity wins over passive highlights] Add visual priority tests.

## 6. Validation

- [x] 6.1 [P0][depends:3-5][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run typecheck.
- [x] 6.2 [P0][depends:5][I: focused Project Map suites][O: focused regression pass][V: targeted Vitest command for touched Project Map tests] Run focused tests.
- [x] 6.3 [P0][depends:1.4][I: OpenSpec change][O: strict OpenSpec pass][V: `openspec validate refactor-project-map-view-information-architecture --strict --no-interactive`] Validate OpenSpec artifact.
