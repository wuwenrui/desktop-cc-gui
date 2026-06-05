## Context

The Project Map relation foundation now exists in types, persistence, context pack, path finder, impact, and governance graph utilities. The missing layer is inspectability. If a relation cannot be seen, filtered, and explained, it cannot support architectural trust.

## Goals / Non-Goals

**Goals:**

- Build deterministic relation indexes for selected-node incoming/outgoing lookup.
- Add relation inspector UI.
- Add graph relation filters and edge legend.
- Show relation metadata in path finder and relation detail.
- Keep relation interactions read-only.

**Non-Goals:**

- No AI relation extraction.
- No relation editing UI.
- No persistence format break.
- No graph renderer replacement.

## Decisions

### 1. Relation UX uses derived indexes

#### 决策

Add a pure helper such as `buildProjectMapRelationIndex(nodes, relations)` that returns:

```ts
type ProjectMapRelationIndex = {
  byNodeId: Record<string, {
    incoming: ProjectMapRelation[];
    outgoing: ProjectMapRelation[];
  }>;
  byType: Record<ProjectMapRelationType, ProjectMapRelation[]>;
  bySourceKind: Record<ProjectMapRelationSourceKind, ProjectMapRelation[]>;
  degraded: ProjectMapRelationIntegrityIssue[];
};
```

The helper should not repair or mutate relations. Repair remains in existing graph integrity flow.

#### 原因

A derived index supports UI lookup without creating another persisted truth source.

### 2. Inspector separates incoming and outgoing relations

#### 决策

For selected node, show two compact groups:

- Outgoing: “this node affects / depends on / validates / changes ...”
- Incoming: “this node is affected by / specified by / generated from ...”

Each row shows type, other endpoint, source kind, confidence/degraded marker, and evidence/source summary.

#### 原因

Direction matters. Merging all related nodes into one list hides cause/effect and spec/code/task lineage.

### 3. Graph filters are read-only view state

#### 决策

Relation filters affect rendered/highlighted edges only:

- relation type
- source kind
- selected-node direction
- degraded-only
- evidence-backed-only

If persisted, filters go into view state only. They must never remove relation records.

#### 原因

Users need graph density control without risking semantic data loss.

### 4. Path Finder includes relation metadata

#### 决策

When path segments are backed by typed relations, path output should show relation type and source kind. Hierarchy fallback segments should be labeled as hierarchy.

#### 原因

“Node A -> Node B” is not enough. Users need to know why a path exists.

### 5. Legend doubles as filter affordance

#### 决策

Add a small edge legend showing active relation types and counts. Legend items can toggle filters where feasible.

#### 原因

A graph with multiple relation types needs a visual key. It also keeps filter controls discoverable.

## Risks / Trade-offs

- [Risk] Too much inspector density.
  - Mitigation: compact rows, collapsible relation groups, counts first.

- [Risk] Relations are sparse in older datasets.
  - Mitigation: clear empty states and hierarchy fallback labels.

- [Risk] Filter state conflicts with search/tour/path/impact highlights.
  - Mitigation: layer highlights with explicit priority and reset controls.

- [Risk] Degraded relations may confuse users.
  - Mitigation: display endpoint missing/source missing as explicit degraded reason.

## Migration Plan

1. Add relation index utility and tests.
2. Add selected-node incoming/outgoing relation panel.
3. Add relation row actions and endpoint focus.
4. Add graph relation filters and edge legend.
5. Add relation metadata to path finder output.
6. Add i18n/styling and focused UI tests.
7. Run typecheck and OpenSpec validation when implementation starts.
