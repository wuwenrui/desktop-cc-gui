# Tasks

## 1. Specification

- [x] 1.1 Create OpenSpec change scaffold.
- [x] 1.2 Write proposal and design for unified workspace session management.
- [x] 1.3 Add spec deltas for session management, catalog projection, and folder tree.

## 2. Backend Index And Delete Consistency

- [x] 2.1 Extend workspace session catalog entry and batch mutation result with disk existence / inconsistency / delete-mode fields.
- [x] 2.2 Add metadata orphan detection so archived/folder metadata that points to missing disk sessions can be shown or cleaned explicitly.
- [x] 2.3 Normalize delete results: physical delete success, already-missing cleanup success, unsupported, and real failure.
- [x] 2.4 Ensure delete cleanup removes archive and folder assignment metadata for all success-like outcomes.
- [x] 2.5 Add Rust tests for orphan cleanup and already-missing delete metadata cleanup.

## 3. Frontend Service And State

- [x] 3.1 Map additive Tauri fields in `sessionManagement.ts`.
- [x] 3.2 Update `useWorkspaceSessionCatalog` mutation result mapping and notices for cleanup success.
- [x] 3.3 Preserve failed rows selected while removing delete successes and cleanup successes.

## 4. Project Tree UI

- [x] 4.1 Add a left project/worktree tree to `SessionManagementSection`.
- [x] 4.2 Render session folder tree under the selected project/worktree and keep folder selection organization-only.
- [x] 4.3 Render parent/child session rows using `parentSessionId`.
- [x] 4.4 Surface degraded / partial / missing-on-disk badges and explanatory notices.

## 5. Validation

- [x] 5.1 `openspec validate refactor-workspace-session-management --strict --no-interactive`
- [x] 5.2 Targeted Rust tests for `session_management`.
- [x] 5.3 Targeted Vitest for service mapping and SessionManagementSection.
- [x] 5.4 `npx tsc --noEmit --pretty false`

## 6. Follow-up UI Correction

- [x] 6.1 Merge workspace and session folder navigation into one left composite tree.
- [x] 6.2 Remove the redundant workspace dropdown from the session management toolbar.
- [x] 6.3 Fix workspace switching so `initialWorkspaceId` does not override user selection after mount.
- [x] 6.4 Add regression tests for tree-only switching and folder filtering.

## 7. Follow-up Loading And Folder Creation

- [x] 7.1 Add a root session-folder creation path to the session management tree.
- [x] 7.2 Make default active session catalog reads bounded instead of exhaustive.
- [x] 7.3 Keep projection summary bounded for default active views so statistics do not block first visible sessions.

## 8. Disk-first CRUD Follow-up

- [x] 8.1 Add folder-aware catalog query filtering before pagination so folder counts and right-side rows share the same disk-first contract.
- [x] 8.2 Add a batch session-folder assignment command for moving selected sessions without per-row exhaustive scans.
- [x] 8.3 Add Session Management toolbar controls for moving selected sessions into a folder or back to unfiled.
- [x] 8.4 Keep selection, notices, folder counts, and sidebar mutation callbacks consistent after move operations.
- [x] 8.5 Run lightweight validation without heavy test governance.

## 9. Session Management UI Density

- [x] 9.1 Merge title, mode switch, and refresh into a compact header row.
- [x] 9.2 Replace the heavy settings card with a collapsible advanced density control.
- [x] 9.3 Compress breadcrumb, filters, counts, and batch CRUD actions into a tighter management surface.
- [x] 9.4 Run lightweight validation for the UI-only refinement.

## 10. Session Management Click Affordance

- [x] 10.1 Add icons to clickable text actions in the header, tree, toolbar, empty-state CTA, and pagination.
- [x] 10.2 Promote clickable text actions from muted text to blue action pills while keeping destructive actions red.
- [x] 10.3 Reflow session row title, badges, and metadata to avoid horizontal text squeezing.
- [x] 10.4 Run lightweight validation for the UI affordance refinement.

## 11. Session Management Theme And Row Density

- [x] 11.1 Replace hardcoded session-management action colors with theme-derived variables.
- [x] 11.2 Compress session rows into a left-aligned grid layout instead of stacked/centered text.
- [x] 11.3 Add responsive row fallback so title, badges, and metadata wrap only on narrow screens.
- [x] 11.4 Run lightweight validation for the theme and density refinement.

## 12. Session Row Progressive Details

- [x] 12.1 Keep the default session row focused on title and updated date.
- [x] 12.2 Move engine text, workspace, source, attribution, parent, and secondary badges into an expandable details panel.
- [x] 12.3 Add localized labels and an accessible details icon button.
- [x] 12.4 Run lightweight validation for the row details refinement.

## 13. Session Row Curtain Follow-up

- [x] 13.1 Convert row detail affordance into clear icon-only controls with accessible labels.
- [x] 13.2 Add a neighboring session curtain icon that opens an independent dialog over the settings surface.
- [x] 13.3 Support loading visible session history through existing runtime contracts.
- [x] 13.4 Keep the curtain read-only for this version by hiding composer and send controls.

## 14. Session Curtain Display Polish

- [x] 14.1 Remove the visible button skin from row action icons while keeping accessible click targets.
- [x] 14.2 Increase row detail and curtain icons so the actions are legible in dense lists.
- [x] 14.3 Load Codex curtain history through the existing Codex history loader and prefer local session history for display.
- [x] 14.4 Start Codex local-history and resume-history loads in parallel so either source can populate the curtain first.
- [x] 14.5 Add a 10s hard timeout that releases stuck loading while allowing late history to merge into the open curtain.

## 15. Closeout

- [x] 15.1 Calibrate proposal/design/spec/tasks to the final read-only curtain behavior.
- [x] 15.2 Run focused validation for TypeScript, lint, Vitest, OpenSpec, large-file check, and diff whitespace.
- [x] 15.3 Commit the session-management change set without unrelated governance/status-panel worktree changes.

## 16. Heavy Test Timeout Follow-up

- [x] 16.1 Stabilize `useWorkspaceSessionCatalog` effect dependencies so semantically identical filters do not trigger reload loops.
- [x] 16.2 Preserve stale response handling when workspace selection is cleared.
- [x] 16.3 Run focused Vitest, heavy-test-noise, and OpenSpec validation.
