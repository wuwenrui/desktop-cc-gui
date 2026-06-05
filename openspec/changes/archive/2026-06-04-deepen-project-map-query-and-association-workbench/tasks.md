## 1. Data Projections

- [x] 1.1 Define runtime types for Project Map activity items, grouped query results, association explanations, and highlight projections near existing Project Map types or utilities. Input: existing `ProjectMapDataset`; output: typed derived objects; verify with TypeScript.
- [x] 1.2 Define the recent-activity input contract. Input: explicit changed-file or impact input, persisted Project Map runs, stale state, candidates, and evidence records; output: normalized activity source groups with degraded markers when changed-file input is unavailable; verify with type tests or focused unit tests.
- [x] 1.3 Implement changed-file and impact activity projection. Input: changed files/source metadata and `buildProjectMapImpactAnalysis`; output: changed nodes, affected nodes, affected lenses, unmapped files, and risk summary activity items; verify mapped, affected, and unmapped cases.
- [x] 1.4 Implement map-state activity projection. Input: dataset runs, stale nodes/reasons, candidates, pending review candidates, and evidence records; output: recent run, stale, candidate, and degraded evidence activity items; verify missing-field and empty-dataset cases.
- [x] 1.5 Merge recent-activity groups into a stable ordered projection. Input: changed-file activity and map-state activity; output: grouped activity items with source category labels; verify ordering, de-duplication, and degraded source labels.
- [x] 1.6 Add cross-platform path normalization for Project Map matching. Input: Windows, macOS, and Linux style file/source/evidence paths; output: normalized workspace-relative comparison keys plus preserved display paths and one-based line references; verify separators, absolute/degraded paths, and line preservation.
- [x] 1.7 Add large-file and large-list projection guards. Input: evidence records, query groups, activity groups, and file references; output: capped result groups, bounded previews, and degraded large/unavailable content markers; verify caps and no full-content requirement.
- [x] 1.8 Extend Project Map query utility to return grouped node results. Input: dataset and query string; output: node results with matched fields and focusable node ids; verify title, summary, kind, lens, normalized source path, related artifact, and detail matching.
- [x] 1.9 Extend Project Map query utility to return grouped non-node results. Input: dataset, evidence-file index, activity projection, and query string; output: evidence file, relation, artifact-reference, stale reason, and activity result groups; verify matched fields, linked nodes/relations, path normalization, capped previews, and unmapped/degraded results.
- [x] 1.10 Ensure spec/task/governance query matches only use references already present in Project Map data. Input: node sources, related artifacts, relation evidence, evidence records, and run metadata; output: artifact-reference results without hard-coded OpenSpec/Trellis/Codex/Claude path scanning; verify with dataset-only fixtures.
- [x] 1.11 Implement association explanation builder on top of existing shortest-path output. Input: path result and dataset relations; output: explanation steps with confidence/source/evidence metadata; verify relation, hierarchy, no-path, stale, inferred, and degraded-reference cases.

## 2. UA-Inspired Advisor Projections

- [x] 2.1 Define local Project Map advisor hint types for diff-impact, query-neighborhood, node-explain, guide-topology, and graph-health outputs. Input: existing Project Map data; output: typed advisor hints with deterministic/degraded/severity labels; verify with TypeScript.
- [x] 2.2 Implement a UA-inspired diff-impact advisor using existing Project Map impact analysis. Input: changed-file or impact input plus dataset; output: changed nodes, affected nodes, affected lenses, impacted relations, unmapped files, and risk hints; verify with mapped, unmapped, wide-blast-radius, and cross-lens cases.
- [x] 2.3 Implement a UA-inspired query-neighborhood advisor. Input: grouped query results, dataset relations, evidence index, and result caps; output: bounded one-hop context hints explaining nearby nodes, relations, lenses, and artifacts; verify caps, degraded references, and no full-file reads.
- [x] 2.4 Implement a UA-inspired node-explain advisor. Input: selected node, children, incoming/outgoing relations, evidence, recent activity, stale/candidate state, and risk flags; output: short local context summary and hint list; verify deterministic vs inferred/degraded labeling.
- [x] 2.5 Implement a UA-inspired guide-topology advisor. Input: graph topology, hierarchy, relations, lenses, evidence counts, and optional tour steps; output: suggested next nodes or walkthrough hints based on entry candidates, fan-in/fan-out, path traversal, and clusters; verify stable ordering and graph-first focus behavior.
- [x] 2.6 Implement a UA-inspired graph-health advisor. Input: graph integrity repair summary, dangling/degraded references, stale nodes, low-confidence relations, inferred relations, empty evidence, and path normalization issues; output: reviewable health warnings without automatic semantic mutation; verify warning classification and clear copy.
- [x] 2.7 Ensure advisor projections are local Project Map utilities and do not shell out to UA skills, read `.understand-anything`, or require UA graph schema. Input: advisor utility tests; output: no UA runtime dependency; verify import/path boundaries.

## 3. Graph Highlight And Filters

- [x] 3.1 Add a pure highlight projection utility without mutating layout or dataset. Input: selected node/relation, path result, search result, recent activity, advisor hints, quick filters, and base graph state; output: independent node and relation sets; verify utility tests.
- [x] 3.2 Implement deterministic render priority for highlights: selected, path, search, activity/advisor, quick filter, then base graph state. Input: overlapping highlight sets; output: stable class/state precedence; verify overlap cases.
- [x] 3.3 Add recent-activity graph highlights for changed and affected nodes. Input: activity projection and impact analysis; output: visually distinct changed and affected node sets; verify mapped and affected cases.
- [x] 3.4 Add advisor-driven graph highlights for diff-impact, query-neighborhood, guide-topology, and graph-health hints. Input: advisor hints; output: clearable hint highlights without graph layout mutation; verify independent clear behavior.
- [x] 3.5 Add compact quick filter chips for Changed, Affected, Stale, Candidate, Low Confidence, and Inferred Relations. Input: current dataset and overlay state; output: clearable graph highlights; verify UI state transitions.
- [x] 3.6 Ensure search, recent activity, path, relation, advisor, and filter highlights can coexist and clear independently. Input: multiple active states; output: deterministic class/highlight priority without layout reset; verify focused Project Map panel tests.

## 4. Collapsible UI Surfaces

- [x] 4.1 Add a collapsible unified query results panel shell that preserves the graph as the primary surface. Input: grouped query results; output: compact grouped panel with empty and collapsed states; verify default collapsed/compact behavior.
- [x] 4.2 Wire node query results to graph focus. Input: node result rows; output: focus/select node behavior and search highlights; verify node focus without graph layout mutation.
- [x] 4.3 Wire non-node query results to degraded context display. Input: evidence file, relation, artifact-reference, stale reason, and activity result rows; output: linked nodes/relations when available and unmapped context when unavailable; verify degraded result behavior.
- [x] 4.4 Add a collapsible recent activity panel shell. Input: activity projection groups; output: compact groups for changed files, affected nodes, map runs, stale/candidate state, and unmapped/degraded items; verify empty/degraded states.
- [x] 4.5 Wire recent activity rows to graph focus and highlights. Input: activity rows with node ids and relation ids; output: focus/highlight behavior for mapped activity and file-only display for unmapped activity; verify changed/affected focus behavior.
- [x] 4.6 Add a compact Advisor Hints section or strip that can show diff-impact, query-neighborhood, guide-topology, and graph-health hints. Input: advisor hints; output: short collapsed hints with focus/highlight actions; verify labels for deterministic, degraded, inferred, and warning states.
- [x] 4.7 Extend selected-node detail with a collapsed Associations section. Input: selected explain pack and relation bucket; output: relation type, direction, source kind, confidence, stale state, evidence count, and related-node focus; verify inferred/low-confidence labels.
- [x] 4.8 Extend selected-node detail with collapsed Evidence and Recent Activity sections. Input: evidence-file index and activity projection; output: file references, evidence counts, changed markers, and selected-node activity; verify mapped and degraded contexts.
- [x] 4.9 Add the local Explain Context section/action backed by the node-explain advisor. Input: selected node, relation highlights, evidence sources, activity, stale/candidate state, and risk flags; output: local summary that distinguishes deterministic evidence from inferred/degraded context; verify no AI run is required.
- [x] 4.10 Extend the path finder panel with association explanation text and relation metadata. Input: source/target nodes and path result; output: ordered explanation and graph path highlight; verify found, inferred, low-confidence, and no-path states.
- [x] 4.11 Extend evidence-file navigation UI with changed/unmapped markers and related node/relation links. Input: evidence file index and activity/impact projection; output: file reverse lookup UI; verify editor open, node focus callbacks, cross-platform path display, one-based line preservation, and degraded outside-workspace paths.
- [x] 4.12 Keep large evidence/file detail content collapsed and bounded by default. Input: files with many related nodes/relations/evidence records or large/unavailable content markers; output: summarized counts, capped previews, and expand controls where appropriate; verify first-screen responsiveness and no full-content rendering.

## 5. Lightweight History And UX Polish

- [x] 5.1 Add local query history chips with a small cap and clear action. Input: submitted queries; output: recent query chips; verify restore and clear behavior.
- [x] 5.2 Add local navigation history chips with a small cap and clear action. Input: focused result nodes and path endpoints; output: recent navigation chips; verify node/path restore and clear behavior.
- [x] 5.3 Keep new panels collapsed or compact by default and align class names/styles with existing Project Map visual language. Input: default Project Map view; output: graph-first first screen; verify snapshot or DOM assertions.
- [x] 5.4 Add localization keys for new labels in Chinese and English. Input: new UI strings; output: locale entries; verify no raw i18n keys render in focused tests.
- [x] 5.5 Add concise empty/degraded copy for unavailable changed-file input, unmapped activity, no query results, no path results, outside-workspace paths, large/unavailable file content, and advisor warnings. Input: empty/degraded states; output: honest user-facing copy; verify DOM assertions.

## 6. Validation

- [x] 6.1 Add or update focused Vitest coverage for recent activity input normalization, changed-file activity projection, map-state activity projection, and activity merge ordering.
- [x] 6.2 Add or update focused Vitest coverage for UA-inspired advisor projections: diff-impact, query-neighborhood, node-explain, guide-topology, graph-health, and no UA runtime dependency.
- [x] 6.3 Add or update focused Vitest coverage for cross-platform path normalization, one-based line preservation, degraded outside-workspace paths, and display path preservation.
- [x] 6.4 Add or update focused Vitest coverage for large-file safeguards, capped query/activity/advisor groups, bounded previews, and no full-content requirement.
- [x] 6.5 Add or update focused Vitest coverage for grouped query projection, dataset-backed artifact-reference matching, non-node degraded results, and matched-field context.
- [x] 6.6 Add or update focused Vitest coverage for association explanation, path metadata, no-path behavior, and degraded references.
- [x] 6.7 Add or update focused Vitest coverage for evidence-file navigation, changed/unmapped file markers, editor open callbacks, and node focus callbacks.
- [x] 6.8 Add or update Project Map panel tests for collapsible surfaces, graph highlight priority, independent clear behavior, node focus from grouped results, advisor hint display, and large-content collapsed rendering.
- [x] 6.9 Run focused Project Map tests.
- [x] 6.10 Run `npm run typecheck`.
- [x] 6.11 Run `openspec validate deepen-project-map-query-and-association-workbench --strict --no-interactive`.
