## 1. UI Implementation

- [x] 1.1 Add a relationship scan loading overlay in `ProjectMapRelationshipSection.tsx`, driven by `relationshipScanState.status === "running"` and scoped to the relationship main workspace.
- [x] 1.2 Ensure the overlay exposes `role="status"` and `aria-live="polite"` and disappears for `success`, `failed`, and idle states.
- [x] 1.3 Prevent chrome collapse/expand or component remount from replaying a historical parent relationship scan request.

## 2. Copy and Styling

- [x] 2.1 Add zh/en i18n keys for the loading title and body copy.
- [x] 2.2 Add scoped CSS for the loading card and indeterminate progress bar in `project-map.relationship.css`.
- [x] 2.3 Render loading as a minimal theme-compatible overlay that blocks the underlying relationship workspace instead of stacking above existing content.
- [x] 2.4 Label chrome controls as header visibility actions.
- [x] 2.5 Ensure collapsing the Project Map header while file relations are selected keeps the file relationship workspace visible instead of falling back to the base node graph.

## 3. Validation

- [x] 3.1 Manually verify that clicking `扫描关系` shows the loading overlay during scan and removes it after completion.
- [x] 3.2 Confirm no backend/Rust command contract or relationship artifact format changed.
