## Context

Project Map relationship scan writes deterministic file relationship artifacts under `project-map-relations`. The scan is triggered from the relationship section and currently exposes `relationshipScanState.status` to the frontend. When the status is `running`, the top toolbar indicates scan activity, but the main relationship workspace can still appear empty or unchanged.

The requested UX improvement is a global loading progress indicator in the relationship main area. The scan backend does not currently emit granular progress events, so this design treats loading as an indeterminate frontend state rather than a real percentage.

## Goals / Non-Goals

**Goals:**

- Show a clear relationship scan loading overlay while `relationshipScanState.status === "running"`.
- Keep the indicator scoped to the Project Map relationship workspace.
- Provide accessible status semantics for screen readers.
- Preserve existing success and failure rendering paths after scan completion.

**Non-Goals:**

- No Rust command contract changes.
- No event stream or true progress percentage.
- No scan cancellation or queue management.
- No relationship data model changes.

## Decisions

### Decision 1: Use frontend scan state as the source of truth

The loading overlay will be driven by the existing `relationshipScanState.status === "running"` branch.

Alternative considered: add backend progress events from the Rust scanner. This would allow phase-level progress, but it would introduce a new cross-layer contract and require event cleanup, stale scan token handling, and partial failure semantics. The current requirement only needs visible loading feedback, so backend events are not justified.

### Decision 2: Render an indeterminate progress bar

The progress indicator will animate continuously without numeric progress.

Alternative considered: estimate progress from file counts or elapsed time. This risks lying to users because scan cost depends on parsing, ignore policy, evidence extraction, and filesystem behavior. An indeterminate bar is more honest and easier to keep correct.

### Decision 3: Keep the overlay inside the relationship section

The loading UI belongs inside `ProjectMapRelationshipSection`, not the global app shell.

Alternative considered: use a global app-level progress affordance. That would overstate the scope of the operation and could conflict with unrelated Project Map generation or ingestion tasks. The scan only affects the relationship workspace.

### Decision 4: Treat parent relationship scan requests as edge-triggered events

The parent toolbar uses `relationshipScanRequestId` as an explicit scan event. `ProjectMapRelationshipSection` must initialize its handled request marker from the current prop value so remounting, collapsing, or expanding chrome does not replay an old request.

Chrome collapse/expand is a visibility action only. It must not clear relationship data, mutate scan state, or trigger `scanProjectMapRelationships`. When the Project Map header chrome is collapsed, the currently selected workspace must keep owning the main canvas. If file relations are selected, the file relationship workspace remains visible instead of falling back to the base node graph.

## Risks / Trade-offs

- **Risk:** Users may expect a real percentage from a progress bar.  
  **Mitigation:** Use indeterminate animation and copy that says scanning/analyzing rather than a numeric percentage.

- **Risk:** Overlay could hide useful previous scan results during refresh.  
  **Mitigation:** The overlay is only active while scan is running and disappears immediately after success or failure. The previous top-level state remains available outside the overlay.

- **Risk:** Duplicate loading affordances in toolbar and workspace.  
  **Mitigation:** Toolbar remains compact command status; workspace overlay solves main-area emptiness and waiting feedback.

- **Risk:** A historical parent scan request could be replayed after remount.  
  **Mitigation:** Treat request ids as edge-triggered while the component is mounted; initialize the handled marker from the current request id.

## Migration Plan

1. Add relationship scan loading copy to locale files.
2. Add scoped relationship loading overlay markup.
3. Add scoped CSS and indeterminate animation.
4. Rollback by removing the overlay branch and CSS additions; scan behavior remains unchanged.

## Open Questions

- None for this iteration.
