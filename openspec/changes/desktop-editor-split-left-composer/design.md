## Context

`DesktopLayout` renders three center layers (`diff`, `editor`, `chat`) inside `.content`, then renders `composerNode` as a sibling after the right panel. In editor split mode this creates a mixed model: messages and editor split inside the upper content area, while composer remains a global bottom row.

The desired desktop editor split is simpler: the chat side is a conversation column that owns both messages and composer; the file side is an editor column.

## Goals / Non-Goals

**Goals:**

- Keep composer in the same visual column as messages during desktop editor split.
- Default desktop workspace file opens into the side-by-side editor split with the sidebar collapsed.
- Preserve existing composer behavior in normal chat/diff/home/compact layouts.
- Keep file editor side full-height within the split area.
- Avoid changing session, file tab, diff, or composer send state.

**Non-Goals:**

- No new persisted preference.
- No right panel redesign.
- No change to mobile/tablet layout.
- No change to editor tab lifecycle.

## Decisions

### Decision: Move composer into chat layer only for non-maximized editor split

Alternative A was pure CSS placement of the existing global composer. That keeps fewer TSX changes but leaves composer outside the chat layer, making column ownership fragile.

Alternative B moves composer into `.content-layer--chat` only when `centerMode === "editor"` and the file is not maximized. This makes DOM ownership match the visual contract and avoids duplicate composer mounts.

Use Alternative B.

### Decision: Request side-by-side desktop layout from the editor-open entrypoint

Workspace file opens already funnel through `useGitPanelController.handleOpenFile`. The controller owns the transition into `centerMode === "editor"`, so it exposes an optional layout request callback for desktop callers. `app-shell` handles the actual layout side effects: collapse the sidebar, set `editorSplitLayout` to `horizontal`, and clear editor file maximized state.

This keeps git/file state logic separate from desktop layout mechanics, while ensuring every workspace file open uses the same side-by-side default.

### Decision: Composer submit preserves desktop editor split

`useAppShellSections` wraps composer send/queue so Kanban context can be merged before dispatch. That wrapper must not also decide view lifecycle. Sending or queuing a message is a conversation action, not an editor-close action, so it preserves `centerMode === "editor"` and leaves explicit close/navigation handlers responsible for returning to chat-only mode.

This prevents an open file from disappearing when the user continues the conversation beside it.

### Decision: Preserve maximized editor behavior

When the editor file is maximized, chat layer is hidden. Keeping composer in the outer bottom row preserves the current “file + input” behavior without reintroducing a hidden composer inside an inert chat layer.

### Decision: Keep responsive scope desktop-only

Phone and tablet layouts already render messages and composer together in their own layout components. This change only touches `DesktopLayout`, so compact navigation remains stable.

## Risks / Trade-offs

- Composer CSS assumes grid row placement in desktop. Mitigation: scope new behavior under `.content.is-editor-split-horizontal .content-layer--chat > .composer`.
- Moving composer inside chat layer changes DOM ancestry in one mode. Mitigation: target tests assert single composer mount and correct parent layer.
- File open now triggers desktop layout changes. Mitigation: keep the layout request optional and suppress it in compact mode.
- Vertical editor split currently means editor over chat. Mitigation: this proposal targets horizontal left/right layout, and vertical behavior remains compatible because chat layer can still own composer when visible.

## Migration Plan

1. Add the layout contract and tests.
2. Change `DesktopLayout` conditional composer placement.
3. Adjust desktop split CSS for chat column stacking.
4. Add file-open layout request and regression tests.
5. Validate with focused layout tests and TypeScript/lint checks.

Rollback is deleting the conditional inner composer placement and removing the scoped CSS.

## Open Questions

- None for this scoped change.
