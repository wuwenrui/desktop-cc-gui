## 1. Specification and dependency setup

- [x] 1.1 Create OpenSpec proposal/design/spec/tasks for workspace Intent Canvas.
- [x] 1.2 Add `@excalidraw/excalidraw` dependency and lockfile update.

## 2. Domain model and storage

- [x] 2.1 Add `src/features/intent-canvas/types.ts` with normalized document/index/request contracts.
- [x] 2.2 Add storage service for `.mossx/canvases/index.json` and `*.intent-canvas.json` using existing workspace file APIs.
- [x] 2.3 Add AI context formatter/digest helpers.

## 3. UI module

- [x] 3.1 Add standalone Canvas Manager surface with create/search/open/delete actions.
- [x] 3.2 Add full-screen Excalidraw-backed Canvas Editor with metadata rails and save/send actions.
- [x] 3.3 Add scoped `intent-canvas` styles and localized copy.

## 4. App integration

- [x] 4.1 Add `intentCanvas` center mode and route the manager/editor through `useLayoutNodes`.
- [x] 4.2 Add AppShell callbacks for creating/opening canvas requests and sending canvas context to chat.
- [x] 4.3 Add Project Map node actions that open persisted canvas documents instead of the temporary modal.
- [x] 4.4 Add Project Map file/evidence entry for canvas creation.
- [x] 4.5 Remove or detach old temporary `ProjectMapIntentCanvas` modal path from production entry.

## 5. Validation

- [x] 5.1 Run `openspec validate add-intent-canvas-workspace-files --strict --no-interactive`.
- [x] 5.2 Run `npm run typecheck`.
- [x] 5.3 Run `npm run check:large-files`.

## 6. UX hardening

- [x] 6.1 Make Intent Canvas manager/editor/composer attachment styles compatible with light and dark themes.
- [x] 6.2 Change attach-to-session flow from immediate send to Composer staging with graphical preview.
- [x] 6.3 Add collapsible left/right rails to Canvas Editor.
- [x] 6.4 Replace Canvas delete `window.confirm` with an app-local confirmation popover.

## 7. Compact density pass

- [x] 7.1 Merge Intent Canvas Manager hero/search/count/actions into one compact command bar.
- [x] 7.2 Compress Canvas Editor topbar, rail widths, canvas cards, and status spacing.
- [x] 7.3 Change manager card actions and rail toggles from icon-only controls to icon + visible text.
- [x] 7.4 Replace pill-style Intent Canvas buttons with compact toolbar buttons and add visible text to the attachment remove action.
- [x] 7.5 Compress Canvas Manager header into a single-row command bar and remove top action borders.
- [x] 7.6 Remove the Manager header eyebrow badge so title and subtitle occupy one clean row.
- [x] 7.7 Remove the Editor header eyebrow badge and make Editor top actions borderless icon-plus-text toolbar actions.
- [x] 7.8 Make the Canvas Manager content area stretch to the remaining viewport height.
- [x] 7.9 Center the empty-state icon, copy, and action as one vertical group after content stretch.

## 8. Storage boundary correction

- [x] 8.1 Move Intent Canvas persistence from workspace-local `.mossx/canvases` to app-global `~/.ccgui/project-canvas/<project-storage-key>`.
- [x] 8.2 Add dedicated Project Canvas Tauri storage commands with constrained filenames, path traversal rejection, storage locks, atomic writes, and Trash deletion.
- [x] 8.3 Reuse Project Map project identity for project partition keys.
- [x] 8.4 Add idempotent legacy migration from workspace-local `.mossx/canvases` into global project-canvas storage.
- [x] 8.5 Synthesize global index from legacy canvas documents when old workspace-local index is missing.
- [x] 8.6 Fail closed with a readable unsupported error in remote mode until Project Canvas global storage ownership is defined.
- [x] 8.7 Normalize nullable Excalidraw selection maps before scene initial data reaches the editor.
- [x] 8.8 Update frontend storage service, i18n copy, and OpenSpec artifacts to the global project-canvas contract.

## 9. Import idempotency and bulk management hardening

- [x] 9.1 Make Project Map -> Intent Canvas open requests one-shot and idempotent by request id.
- [x] 9.2 Replace timestamp request ids with a monotonic in-session request sequence.
- [x] 9.3 Add Canvas Manager selection, select-all, and app-local batch delete confirmation.
- [x] 9.4 Add batch canvas deletion service that trashes selected documents and writes the index once.
- [x] 9.5 Add focused tests for request idempotency and batch index write behavior.
- [x] 9.6 Add Project Canvas compaction to physically remove index-unreachable orphan documents and stale atomic index temp files.

## 10. Semantic context packet

- [x] 10.1 Append proposal/spec tasks for semantic Canvas context compression.
- [x] 10.2 Add `intent_canvas_context` version 2 transmission payload with completeness manifest.
- [x] 10.3 Update chat formatter to prioritize semantic nodes, edges, evidence clues, links, and user-authored text over visual coordinates/styles.
- [x] 10.4 Update Composer attachment card to show complete/compressed context counts.
- [x] 10.5 Update Canvas Editor context preview to show the same transmission payload that will be sent to AI.
