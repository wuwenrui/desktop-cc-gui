# Proposal: Enhance Project Map Graph Experience

## Summary

Reframe Project Map from a feature-dense panel into a mossx-specific evidence-backed engineering knowledge cockpit. The main graph canvas becomes the primary surface; search, guided tour, path finding, relation exploration, evidence files, graph health, and task entrypoints become coherent navigation primitives instead of competing panels.

This change deliberately weakens the current Project Map Work Queue presentation. Work Queue remains available as a secondary affordance, but it must not dominate the Project Map experience while its action loop is still incomplete. Buttons or panels that do not close a reliable user loop should be hidden, disabled with explicit reason, or moved behind a compact drawer.

## Why

The current Project Map has many strong primitives inspired by Understand-Anything: typed relations, guided tour, node search, shortest path, evidence files, graph integrity repair, mini map, layout presets, and orchestration task bridge. The problem is no longer capability absence. The problem is product composition: too many controls compete with the graph, and the user cannot quickly answer:

- What structure am I looking at?
- How is this node related to the rest of the system?
- Why should I trust this node?
- Where should I go next?

Understand-Anything should be used as a reference for graph navigation primitives, not as a dashboard clone. mossx should preserve its own strengths: evidence, confidence, stale markers, session/task/runtime context, and engineering workflow links.

## What Changes

This change turns Project Map into a graph-first knowledge cockpit by grouping graph navigation commands, making the canvas visually primary, restructuring the node inspector around Understand / Evidence / Relations / Actions, and downgrading graph repair and Work Queue affordances to secondary surfaces.

## Scope

### In scope

- Redesign Project Map visible hierarchy so the graph canvas is the dominant surface.
- Replace scattered top controls with a compact Graph Navigator command bar.
- Recompose node details into a mossx-specific inspector model: Understand, Evidence, Relations, Actions.
- Make relation/path/search/tour states visually distinct on graph nodes and edges.
- Turn Graph Repair into a compact Graph Health affordance instead of a dominant card.
- Downgrade Project Map Work Queue from a primary module to a secondary compact task affordance.
- Remove or hide stale/no-op/weakly-closed UI affordances exposed by the old panel composition.
- Keep current Project Map data model compatible; prefer UI composition and state cleanup before schema expansion.

### Out of scope

- Replacing the custom Project Map graph with React Flow.
- Creating a new standalone Understand-Anything dashboard.
- Expanding ProjectMapRelation schema in this pass.
- Implementing autonomous task scheduling from graph nodes.
- Completing the full Work Queue action loop.
- Writing provider artifacts, specs, tasks, or graph data from UI-only navigation actions.

## Product Direction

Project Map should become:

```text
Moss Project Map = evidence-backed engineering knowledge cockpit
```

The cockpit is organized around five mossx concepts:

1. Evidence Lens: explains why a node is trustworthy.
2. Relation Lens: explains engineering relationships and impact direction.
3. Understanding Path: guides architecture/risk/task-planning exploration.
4. Health Layer: surfaces graph integrity issues without stealing focus.
5. Action Dock: exposes only bounded, reliable next actions.

## UX Principles

- Graph first, panels second.
- Navigation commands before configuration forms.
- Evidence is a first-class trust layer, not a footer list.
- Repair and Work Queue are secondary until they close reliable loops.
- Disabled actions must explain why; dead buttons must be removed.
- Existing graph states must become readable: selected, search match, path node, tour node, stale, candidate, evidence-file node.

## Success Criteria

- User opens Project Map and the graph canvas is the obvious primary surface.
- Search, guided tour, and path finder feel like one graph navigation system.
- Selecting a node reveals its evidence, relations, risks, and bounded actions without scanning unrelated global panels.
- Graph Repair is visible as health status but no longer dominates the right side.
- Work Queue is discoverable but visually subordinate.
- No unfinished Work Queue actions are presented as primary controls.
