# Design: Moss Project Map Graph Experience

## Design Thesis

The correct direction is not to add more Project Map widgets. The correct direction is to give Project Map a clear product grammar:

```text
Command Bar -> Knowledge Canvas -> Context Rail -> Inspector
```

Understand-Anything contributes the navigation primitives: search, guided tour, file explorer, path finder, node info, layer drill-down. mossx contributes the engineering trust model: evidence refs, confidence, stale/candidate markers, graph repair, orchestration/task/session links.

## Current Problems

1. The graph canvas is visually important but structurally surrounded by competing controls.
2. Search, tour, path finder, evidence files, relation legend, graph repair, and Work Queue are presented as separate modules instead of one navigation system.
3. Graph Repair is too loud for a secondary health concern.
4. Project Map Work Queue appears primary even though many actions still do not form a complete user loop.
5. Node detail mixes explanation, evidence, governance, diagrams, and actions without a strong hierarchy.

## Target Information Architecture

### 1. Project Map Command Bar

A compact top command surface. It should contain:

- Current lens / layout selection.
- Search entrypoint.
- Guided path control.
- Path finder entrypoint.
- Graph health badge.
- Compact task badge.

It replaces large always-open panels for search/tour/path/repair/task status.

### 2. Knowledge Canvas

The main canvas owns the visual story:

- Nodes use differentiated visual states for selected, search-match, tour-node, path-node, stale, candidate, evidence-file-node.
- Edges show focused/path semantics more clearly.
- Canvas controls stay compact and do not compete with node cards.
- Mini map remains a navigation aid, not a decorative panel.

### 3. Context Rail

The left or upper context rail should be collapsible and should hold secondary navigation assets:

- Evidence files.
- Relation legend.
- Optional lens summaries.

It is not a form stack. Its purpose is cross-navigation: file -> node, relation type -> graph filter, evidence -> trace.

### 4. Node Inspector

The inspector should be organized into four sections:

- Understand: summary, key facts, key logic, risk signals.
- Evidence: source refs, confidence, stale reasons, generated-by metadata, diagrams.
- Relations: incoming/outgoing relations with type, confidence, stale marker, and click-to-focus.
- Actions: bounded actions only, such as open trace, create task draft, open related artifact, archive local projection.

### 5. Health and Repair

Graph repair becomes a compact health badge:

```text
Graph Health: 2 issues · 1 repaired
```

The expanded repair detail is available on demand. Repair actions remain explicit and deterministic. Repair must not imply hidden writes beyond the existing graph repair semantics.

### 6. Work Queue Downgrade

Work Queue is moved to a compact secondary affordance:

- It may show count/status summary.
- It can open a drawer when needed.
- It must not appear as a main panel in the Project Map first screen.
- Buttons that are not reliable end-to-end must be hidden or disabled with reason.

## Implementation Approach

### Phase 1: Composition Pass

Modify ProjectMapPanel composition and CSS only. Reuse existing state and utilities.

- Introduce a command-bar visual grouping using existing search/tour/path/lens state.
- Collapse repair summary by default into a health badge.
- Reduce Work Queue / orchestration bridge visual weight.
- Keep all existing data derivations intact.

### Phase 2: Inspector Pass

Reorder selected node details into Understand / Evidence / Relations / Actions.

- Avoid new domain types.
- Reuse relation bucket, evidence file index, and existing action callbacks.
- Remove stale duplicated list presentation if it becomes unreachable.

### Phase 3: Visual Pass

Improve graph visual hierarchy in CSS.

- More intentional node surfaces.
- Stronger selected/path/tour/search contrast.
- Softer global panels.
- Compact controls with consistent affordance.

### Phase 4: Cleanup Pass

Remove code that only supported the old over-expanded presentation if it is no longer referenced.

Cleanup candidates:

- always-open repair card presentation code;
- primary Work Queue presentation affordances in Project Map;
- dead/no-op buttons surfaced only for future behavior;
- redundant text blocks that repeat counts already shown in command bar.

## Constraints

- Do not change ProjectMapDataset schema in this pass.
- Do not introduce a new graph rendering dependency.
- Do not remove persistence or generation capabilities.
- Do not delete orchestration bridge functionality; only downgrade its visual prominence.
- Keep i18n for all visible copy.
- Preserve keyboard-accessible buttons and labels.

## Risks

- ProjectMapPanel is large. Changes must be surgical and avoid broad behavior rewrites.
- CSS file is large. Selector changes must preserve existing class contracts where possible.
- Some Work Queue actions may appear less discoverable. This is acceptable because the current priority is graph understanding, not queue execution.
