## Context

Project Map currently has the right primitives for an engineering map: graph nodes, hierarchy, typed relations, evidence records, stale/candidate/confidence markers, impact analysis, evidence-file indexing, graph repair, and an orchestration task bridge.

The product gap is not data availability. The gap is interaction shape: users need to keep the structure graph as the main mental model while quickly answering "what changed", "where is this thing", and "why are these areas related".

Understand-Anything provides useful product references: fuzzy search, file explorer, path finder, diff overlay, guided tour, and layer drill-down. This design borrows those navigation primitives without copying its standalone dashboard model.

Understand-Anything also has useful agent/skill patterns:

- `understand-diff` / `diff-analyzer.ts`: maps changed files to changed nodes, 1-hop affected nodes, affected layers, unmapped files, and risk summary.
- `understand-chat` / `context-builder.ts`: searches the graph, expands one hop, and formats a bounded relevant subgraph.
- `understand-explain` / `explain-builder.ts`: resolves a target file/function, gathers children, neighbors, relations, and layer context.
- `tour-builder`: uses topology signals such as entry points, fan-in/fan-out, BFS traversal, non-code inventory, and clusters to build a guided path.
- `graph-reviewer` / `assemble-reviewer`: separates deterministic graph checks from judgment and repair, surfacing issues explicitly.

Project Map should borrow those logic shapes as local advisor utilities. It should not execute UA skills or require UA's `.understand-anything` graph at runtime.

## Code Reading Calibration

The implementation direction below is calibrated against the current workspace code, not only against the product idea.

Current code facts:

- `ProjectMapDataset` already carries the semantic substrate needed for this MVP: nodes, relations, tours, refresh state, graph repair summary, runs, candidates, evidence records, diagram documents, auto-ingestion settings, and memory cursor.
- `ProjectMapRelation` is already a first-class relation model with type, direction, confidence, stale state, source kind, evidence, and optional generation metadata.
- Persistence is already schema-versioned and storage-aware. The frontend `projectMapPersistence.ts` and Rust `project_map.rs` path/ownership checks mean this change should not introduce a required persisted migration.
- The generation worker already caps context files and prompt content. Query, activity, evidence reverse lookup, and advisor summaries must therefore stay metadata/index based rather than reading full files in the main panel.
- Current UI already has graph layout, drill/focus behavior, mini map, lens strip, detail panel, generation task drawer, candidate review, graph repair state, relation panel, and Project Map -> Orchestration Task bridge.
- Query, activity, advisor, and highlight logic are better placed as pure `utils` projections consumed by components, because Project Map already has large UI components and should avoid burying data logic inside render branches.

Product calibration:

- The main optimization is not "add more panels". The main optimization is "make the graph answer practical questions".
- Navigation map and unified query should feel like one entry. Users should not see two search result systems competing for attention.
- Recent activity should be described as map projection. It can use git status or explicit changed-file input when available, and map-derived state otherwise, but it must not claim to be a complete chronological audit feed.
- Advisor Hints should remain short, local, and reviewable. They are not chat output, not tasks, and not auto-repair.
- Evidence display should prefer file names and deduplicate repeated file evidence in each section. Low-value type labels and duplicate paths should not consume the first visual column.

## Goals / Non-Goals

**Goals:**

- Keep the Project Map graph as the primary surface.
- Add query and recent activity as graph overlays, not replacement views.
- Reuse existing Project Map utilities before introducing new schema or dependencies.
- Make association explanations evidence-aware and confidence-aware.
- Keep UI frugal: collapsible panels, compact chips, minimal persistent chrome.
- Make each interaction clearable so users can return to the plain structure map.

**Non-Goals:**

- No React Flow migration.
- No full activity dashboard.
- No automatic task execution.
- No embedding search in the MVP.
- No schema migration for existing Project Map datasets.
- No AI regeneration requirement for local context explanations.
- No runtime dependency on Understand-Anything skills, agents, graph files, or dashboard.

## Decisions

### Decision 1: Graph-first overlays instead of dashboard panels

Project Map will keep the current graph canvas as the first-class surface. Query results, recent activity, path explanation, and evidence details will be shown as collapsible panels and graph highlight states.

Alternatives considered:

- Full dashboard layout: richer and closer to Understand-Anything, but it would fight the existing workbench model and increase UI weight.
- Side-panel-only list views: cheaper, but users would lose spatial context.

Chosen because the user expects Project Map to remain a structure map, with search and activity acting like "lights" on the graph.

### Decision 2: Reuse existing Project Map data first

The MVP will derive behavior from existing `ProjectMapDataset` fields and utilities:

- `relations`
- `refreshState`
- `graphRepair`
- `candidates`
- `evidenceRecords`
- `runs`
- `buildProjectMapImpactAnalysis`
- `buildProjectMapEvidenceFileIndex`
- `buildProjectMapShortestPath`
- `buildProjectMapExplainPack`

New lightweight derived types can be added for recent activity and association explanation, but they should not require persisted dataset migration.

The first implementation should treat these as the only reliable activity sources:

- Explicit changed-file or impact input already available to Project Map.
- Impact analysis derived from those changed files.
- Persisted Project Map runs.
- Stale nodes and stale reasons.
- Candidate and pending-review state.
- Evidence records and dataset-backed artifact references.

If git status or session/task history is not available through the current frontend contract, the UI should degrade honestly: show map-derived activity and an empty/degraded changed-file group rather than presenting a fake live feed.

Alternatives considered:

- Add new persisted top-level `activity` collection immediately.
- Generate activity with AI during map generation.

Chosen because the MVP should be deterministic, reversible, and safe for existing persisted maps.

### Decision 3: Unified query stays deterministic for MVP

The first query implementation will use deterministic matching and grouped scoring across nodes, files, relations, governance links, stale reasons, and activity items. Fuzzy or embedding search can be added later after the result model is stable.

"Governance links" and spec/task matches mean references already stored in `ProjectMapDataset` fields such as node sources, related artifacts, relation evidence, evidence records, and run metadata. The query layer must not hard-code OpenSpec, Trellis, Codex, Claude, or user-local path conventions as required sources.

Alternatives considered:

- Add Fuse.js immediately like Understand-Anything.
- Add embedding search.

Chosen because current Project Map already has deterministic search, and the product risk is interaction shape rather than search algorithm sophistication.

### Decision 4: Recent activity is a projection, not a new truth source

Recent activity will be derived from available inputs such as git status, changed files, stale/candidate state, recent Project Map runs, and existing task/session references when available. Unmapped activity remains visible as unmapped instead of being forced into the graph.

For MVP, "recent" means the freshest available Project Map context, not necessarily a complete chronological audit trail. Each activity group should reveal its source category so users can tell the difference between changed-file input, persisted map runs, stale/candidate state, and degraded/unmapped context.

Alternatives considered:

- Store every activity item in Project Map persistence.
- Hide unmapped activity.

Chosen because activity is workspace context, while Project Map truth still requires evidence and review.

### Decision 5: Association explanation extends path finder

The existing shortest-path behavior will remain, but the UI will add a compact explanation for each path step using relation metadata, hierarchy fallback, evidence count, confidence, stale state, and source kind.

Alternatives considered:

- Add a separate relation-explanation AI flow.
- Show only edge labels.

Chosen because local explanation from existing data is faster, safer, and good enough for MVP.

### Decision 6: UI is collapsible by default

New surfaces should appear through existing Project Map visual patterns:

- Compact toolbar chips.
- Investigation strip buttons.
- Collapsible panels.
- Right detail panel sections.
- Clearable graph highlights.

Alternatives considered:

- Permanent multi-column layout.
- Modal-first interaction.

Chosen because Project Map already has dense information, and new features should not dominate the first screen.

### Decision 7: Highlight priority is explicit

Multiple overlays can be active at the same time. Project Map should calculate semantic highlight sets separately, then render them with this priority:

1. Selected node and selected relation.
2. Active path finder result.
3. Active search result focus.
4. Recent activity changed and affected state.
5. Quick filter matches.
6. Existing base graph state such as stale, candidate, confidence, pinned, and hover.

Each overlay must remain independently clearable. Clearing one overlay must not reset saved graph layout, selected node, or semantic map data.

Alternatives considered:

- Last-interaction-wins styling: simpler, but hard to reason about once path, search, and activity are all active.
- Merge all highlights into one state: cheaper initially, but it makes independent clearing and tests brittle.

Chosen because graph lighting is the core product interaction; it needs predictable rules before UI polish.

### Decision 8: Paths are normalized at workspace boundaries

Project Map query, recent activity, evidence-file lookup, and editor navigation should use normalized workspace-relative paths when comparing files. Display may preserve the user-facing path string, but matching should avoid platform assumptions.

Implementation rules:

- Normalize separators for comparison so Windows `\` and POSIX `/` paths can match the same workspace-relative file.
- Preserve one-based line references when opening files.
- Do not assume absolute paths, drive letters, case sensitivity, symlinks, or user-local directory names are stable semantic facts.
- Prefer existing path utilities or browser-safe normalization helpers instead of ad hoc string splitting.
- Treat unresolvable or outside-workspace paths as degraded evidence rather than silently dropping them.

Alternatives considered:

- Store all paths exactly as generated and compare raw strings: cheapest, but fragile across Windows, macOS, Linux, and generated evidence.
- Convert everything to absolute paths: convenient locally, but leaks user-specific workspace details and breaks portability.

Chosen because Project Map persistence and evidence should remain portable between supported desktop platforms.

### Decision 9: Large files are represented, not fully consumed

Project Map should not turn query, evidence navigation, or explain-context into full-file scanning/rendering. The MVP should operate on Project Map metadata, evidence records, file paths, line references, relation metadata, and bounded previews.

Implementation rules:

- Do not read full large file contents in UI-side query, activity projection, evidence reverse lookup, or local explain-context generation.
- Cap result counts per query group and activity group before rendering.
- Use metadata and existing evidence snippets where available; otherwise show a degraded "large or unavailable content" state.
- Keep long file paths, large evidence lists, and large relation lists collapsed or summarized by default.
- Avoid synchronous main-thread work proportional to full file size; projection work should be proportional to dataset index size and visible result caps.

Alternatives considered:

- Read full files for better matching: richer, but too risky for UI responsiveness and memory usage.
- Hide large files entirely: safe, but loses important evidence context.

Chosen because users need to know that large files matter without Project Map becoming a slow code viewer.

### Decision 10: UA patterns become local Project Map advisors

The useful UA unit is not the plugin runtime. The useful unit is the product logic:

- Diff impact: changed files map to changed nodes, affected nodes, affected lenses, impacted relations, unmapped files, and risk summary.
- Query neighborhood: search matches expand to a bounded one-hop context so results explain surrounding relationships.
- Node explain: a selected node gathers children, incoming/outgoing relations, evidence, activity, stale/candidate state, and risk flags.
- Guide topology: entry candidates, fan-in/fan-out, path traversal, and clusters suggest what to inspect next.
- Graph health review: integrity, dangling references, stale/low-confidence/inferred relations, empty evidence, and degraded paths become visible warnings.

These advisors should be pure derived utilities over `ProjectMapDataset` and existing Project Map indexes. UI surfaces consume their outputs as collapsible hints and summaries.

Alternatives considered:

- Invoke UA skills directly: fast to prototype but fragile, host-specific, and tied to `.understand-anything` persistence.
- Port UA graph schema: too broad and would compete with existing Project Map dataset semantics.
- Ignore UA agents and only borrow UI: misses the higher-value design idea, which is deterministic preprocessing before explanation.

Chosen because Project Map already has a richer evidence-backed map model for this product; it needs local advisor projections, not another graph system.

### Decision 11: Deterministic advisor first, AI only as reviewable candidate later

UA's best pipeline pattern is "deterministic facts first, LLM judgment second." For this MVP:

- Diff, query, explain, guide, and health advisors should first use deterministic Project Map data.
- Any future AI-generated suggestion should become a candidate or degraded/inferred explanation, not direct semantic truth.
- Advisor outputs should include source categories and confidence so the UI can label deterministic, inferred, degraded, and review-needed context.

Chosen because this matches Project Map's existing evidence/candidate/confidence model and avoids making the UI sound smarter than the data.

## Proposed UI Shape

```text
Top bar
  Search input
  Quick chips: Changed / Affected / Stale / Candidate / Low Confidence / Inferred
  Recent Activity toggle

Main graph canvas
  Existing structure graph
  Search highlights
  Recent changed/affected highlights
  Path highlights
  Relation highlights
  Mini map

Right detail panel
  Existing summary
  Associations section (collapsed by default)
  Evidence section (collapsed by default)
  Recent activity section (collapsed by default)
  Explain this node context action

Collapsible panels
  Query results
  Recent activity
  Path explanation
  Evidence file detail
```

## Data Approach

Derived activity item shape:

```ts
type ProjectMapActivityItem = {
  id: string;
  kind: "git-change" | "project-map-run" | "candidate" | "stale" | "task-run" | "session" | "manual";
  title: string;
  summary: string;
  occurredAt: string;
  nodeIds: string[];
  filePaths: string[];
  relationIds: string[];
  confidence: ProjectMapConfidence;
  sourceRefs: ProjectMapSource[];
  degraded?: boolean;
};
```

Derived association explanation shape:

```ts
type ProjectMapAssociationExplanation = {
  sourceNodeId: string;
  targetNodeId: string;
  steps: ProjectMapPathStep[];
  reasons: Array<{
    label: string;
    relationId?: string;
    sourceKind?: ProjectMapRelationSourceKind;
    confidence: ProjectMapConfidence;
    stale: boolean;
    evidenceCount: number;
  }>;
};
```

These can stay runtime-derived in MVP and only become persisted if later workflow needs durable activity history.

Grouped query result shape should stay explicit enough for UI and tests:

```ts
type ProjectMapQueryGroup =
  | "nodes"
  | "evidence-files"
  | "relations"
  | "artifact-references"
  | "stale-reasons"
  | "activity";

type ProjectMapQueryResult = {
  id: string;
  group: ProjectMapQueryGroup;
  title: string;
  matchedFields: string[];
  nodeIds: string[];
  relationIds: string[];
  filePaths: string[];
  degraded?: boolean;
  preview?: string;
};
```

Highlight projection should also be a derived model, not component-only state:

```ts
type ProjectMapHighlightProjection = {
  selectedNodeIds: Set<string>;
  selectedRelationIds: Set<string>;
  pathNodeIds: Set<string>;
  pathRelationIds: Set<string>;
  searchNodeIds: Set<string>;
  activityChangedNodeIds: Set<string>;
  activityAffectedNodeIds: Set<string>;
  filterNodeIds: Set<string>;
  filterRelationIds: Set<string>;
};
```

UA-inspired advisor output shapes can stay lightweight:

```ts
type ProjectMapAdvisorKind =
  | "diff-impact"
  | "query-neighborhood"
  | "node-explain"
  | "guide-topology"
  | "graph-health";

type ProjectMapAdvisorHint = {
  id: string;
  kind: ProjectMapAdvisorKind;
  title: string;
  summary: string;
  nodeIds: string[];
  relationIds: string[];
  filePaths: string[];
  severity?: "info" | "warning" | "risk";
  deterministic: boolean;
  degraded?: boolean;
};
```

The initial UI should treat these as short, collapsible hints. They are not chat messages, tasks, or automatic actions.

## Risks / Trade-offs

- UI density increases -> Use collapsed sections, compact chips, and clearable highlights.
- Search result noise -> Group results by type and show matched fields.
- Inferred relation confusion -> Always show source kind and confidence; visually mark low-confidence and `llm-inferred` relations.
- Activity becomes a feed -> Keep activity tied to graph nodes/files; unmapped activity is listed but not promoted to graph truth.
- Activity source mismatch -> Mark changed-file input separately from map-derived run/stale/candidate activity.
- Query logic becomes scattered -> Centralize query projection in a utility with focused tests.
- Repository-specific search leakage -> Only search artifact references already present in dataset fields; do not inspect OpenSpec/Trellis folders directly in the query utility.
- Large graphs may highlight too much -> Cap visible result counts and provide filters rather than auto-expanding everything.
- Highlight conflicts -> Use the explicit priority model and test class/state precedence.
- Cross-platform path drift -> Normalize paths for matching while preserving display strings and line references.
- Large files degrade responsiveness -> Use indexes, metadata, capped previews, and collapsed summaries instead of full-content reads or rendering.
- UA migration scope creep -> Port advisor logic and tests only; do not introduce UA runtime, dashboard, graph schema, or multi-agent execution into Project Map.
- Advisor trust confusion -> Label deterministic, inferred, degraded, and review-needed outputs explicitly.

## Migration Plan

- No persisted dataset migration is required.
- New derived utilities should tolerate missing `relations`, `refreshState`, `graphRepair`, `candidates`, `runs`, and `evidenceRecords`.
- Existing Project Map data should render unchanged when new panels are collapsed.
- Rollback is safe by hiding/removing the new UI surfaces and derived utilities without changing stored map data.

## Open Questions

- Should the first query implementation use current deterministic matching only, or add Fuse.js once grouped query UI exists?
- Which task/session source should be included in the first Recent Activity projection beyond git status, runs, candidates, and stale state?
- Should query history be local React state only, or persisted in `viewState` later?
