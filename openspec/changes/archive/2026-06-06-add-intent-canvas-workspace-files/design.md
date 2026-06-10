## Overview

Intent Canvas becomes a first-class workspace artifact. The product surface is split into three layers:

1. `Canvas Manager`: list/search/create/open/delete canvas files.
2. `Canvas Editor`: Excalidraw-style full-screen drawing workspace.
3. `Context Bridge`: convert saved canvas documents into AI-readable structured context and send it to the active thread.

The durable source of truth is not component state and not Project Map. It is the app-global, project-partitioned file set under `~/.ccgui/project-canvas/<project-storage-key>/`.

## Architecture

```text
React Layout centerMode=intentCanvas
  -> IntentCanvasManager
  -> useIntentCanvasWorkspace
  -> intentCanvasStorage service
  -> src/services/tauri.ts Project Canvas wrappers
  -> src-tauri/src/project_canvas.rs
  -> ~/.ccgui/project-canvas/<project-storage-key>/index.json + *.intent-canvas.json

ProjectMapPanel actions
  -> onOpenIntentCanvas({ mode, seed, linkedFilePath? })
  -> AppShell opens centerMode=intentCanvas with draft request

IntentCanvasEditor
  -> @excalidraw/excalidraw wrapped by adapter
  -> normalized IntentCanvasDocument
  -> saveIntentCanvasDocument(...)

Send to chat
  -> stage IntentCanvasDocument above Composer
  -> lightweight SVG preview card in Composer
  -> user sends draft
  -> formatIntentCanvasThreadContext(document)
  -> sendUserMessageToThread(...combinedText)
```

## Data Model

```ts
type IntentCanvasDocument = {
  version: 1;
  id: string;
  title: string;
  kind: "intent-canvas";
  createdAt: string;
  updatedAt: string;
  workspace: { id: string; name: string | null };
  mode: "architect" | "spotlight";
  summary: string;
  links: {
    projectMapNodeIds: string[];
    filePaths: string[];
    threadIds: string[];
  };
  scene: {
    elements: unknown[];
    appState: Record<string, unknown>;
    files: Record<string, unknown>;
  };
  aiContext: {
    elementDigest: IntentCanvasElementDigest[];
    relationDigest: IntentCanvasRelationDigest[];
    lastContextSnapshot: string;
  };
};
```

`scene` preserves editor fidelity. `aiContext` is a derived digest for conversation precision. The UI never treats disk JSON as trusted until normalized.

## Storage Contract

- Directory: `~/.ccgui/project-canvas/<project-storage-key>/`
- Index: `~/.ccgui/project-canvas/<project-storage-key>/index.json`
- Document: `~/.ccgui/project-canvas/<project-storage-key>/<canvas-id>.intent-canvas.json`
- Project partition key: reuse Project Map project identity, `<project-name-slug>-<hash(workspace.path#workspace.id)>`.
- Writes are idempotent: create directory if needed, write document, then update index.
- Read fallback: missing index returns an empty collection; malformed document is excluded and surfaced as a readable warning.
- No direct `invoke()` in feature code. All runtime calls go through `src/services/tauri.ts` wrappers.
- Project Canvas storage MUST NOT change generic workspace file commands; it uses dedicated app-global commands and constrained filenames.
- Backend writes use storage lock + atomic write and reject path traversal / absolute paths / nested subdirectories.
- First read performs an idempotent legacy migration from `<workspace>/.mossx/canvases/{index.json,canvas-*.intent-canvas.json}` into the global project partition when legacy files exist.
- If legacy document files exist without `index.json`, migration synthesizes a global index from valid `intent-canvas` documents.
- Remote mode is explicitly unsupported for Project Canvas global storage until product semantics define whether the owning app home is local or remote.

## UI / UX Direction

The editor must not feel like a form. It should feel like a dedicated drawing surface:

- Top floating toolbar: selection, hand, rectangle, diamond, ellipse, arrow, line, text, draw, image/library actions supplied by Excalidraw.
- Left inspector rail: title, summary, style/context hints, linked file/node list.
- Center canvas: infinite whiteboard with grid-like product framing and high contrast.
- Right context rail: AI context preview, linked project resources, session link/send actions.
- Bottom status bar: save state, canvas path, element count, linked thread count.
- Left and right rails are independently collapsible. Collapsed rails keep a narrow restore affordance and must expand the drawing area without unmounting the central canvas.
- The entire Intent Canvas surface uses project theme variables so light/dark/custom appearance remains readable.

Manager view uses a card/grid layout with recent canvases, search, quick actions, and empty state guidance.

Canvas delete uses an app-local inline confirmation popover. It must not use `window.confirm` or platform/global dialogs because those can be blocked and do not match the app interaction model.

## Project Map Integration

Project Map actions no longer submit a one-off modal payload. They pass an `IntentCanvasOpenRequest` to AppShell:

- `architect`: create/open a blank canvas seeded from the selected node or workspace.
- `spotlight`: create/open a canvas seeded with selected Project Map node metadata.
- `file`: create/open a canvas linked to an evidence/source file path.

Project Map remains the code-derived graph; Canvas remains user-authored intent context.

## Chat Integration

Attaching a canvas from the editor stages the saved `IntentCanvasDocument` above the current Composer. This is not an immediate send. The staged preview must show:

- a lightweight graphical preview of the canvas digest;
- title and summary;
- element/file/node metrics;
- a remove affordance.

When the user sends the Composer draft, the app appends the structured Canvas context to the outgoing user message with:

- clear warning: the canvas is user-authored intent context, not confirmed implementation fact.
- title, summary, mode, linked files, linked Project Map nodes, linked threads.
- element/relation digest.
- fenced JSON snapshot with type `intent_canvas_context`.

If no active thread exists, AppShell creates one for the active workspace before sending.

## Error Handling

- Missing workspace: disable create/send actions and show localized guidance.
- Read failure: manager shows error state, existing chat/project surfaces do not crash.
- Save failure: editor keeps dirty state and shows retryable error.
- Malformed JSON: ignore invalid document in list, keep index warning visible.
- Excalidraw unavailable: editor shows fallback error panel instead of blank screen.

## Dependency Decision

`@excalidraw/excalidraw@0.18.1` is selected because current npm metadata shows peer dependency support for React `^17 || ^18 || ^19`. The package is isolated behind `IntentCanvasEditor`; business services only depend on normalized document contracts.

## Validation Strategy

- `openspec validate add-intent-canvas-workspace-files --strict --no-interactive`
- `npm run typecheck`
- `npm run check:large-files`
- Focused component/service tests if time permits:
  - storage normalize/malformed fallback
  - context formatter
  - Project Map action callback wiring
- Browser smoke test after user approval: create canvas, draw node/arrow/text, save, send to chat.

## Implementation close notes（2026-06-06）

### 中文导读

本阶段设计收口确认：Intent Canvas 的 durable source of truth 已经从 UI state / Project Map payload 转移到 workspace file artifacts。
后续维护重点不应继续扩大绘图能力，而应保护 document normalization、workspace ownership、Composer staging 和 Project Map bridge 的边界。

### Current implementation shape

```text
IntentCanvasManager
  -> useIntentCanvasWorkspace
  -> intentCanvasStorage
  -> ~/.ccgui/project-canvas/<project-storage-key>/index.json
  -> ~/.ccgui/project-canvas/<project-storage-key>/<canvas-id>.intent-canvas.json
  -> legacy migration from <workspace>/.mossx/canvases when needed

IntentCanvasEditor
  -> Excalidraw adapter
  -> normalized IntentCanvasDocument
  -> save / attach actions
  -> collapsible left/right rails

Project Map actions
  -> IntentCanvasOpenRequest
  -> create/open persisted document

Composer bridge
  -> staged canvas attachment preview
  -> user send
  -> structured intent_canvas_context
```

### Design calibration

- Canvas file JSON MUST stay normalized before UI consumption. Raw scene data is editor fidelity, not trusted product fact.
- Project Map integration MUST remain an explicit bridge. It SHOULD NOT auto-promote canvas nodes into Project Map semantic relations.
- Composer staging MUST remain user-controlled. Editor actions SHOULD stage context, not silently send messages.
- Theme and dialog behavior SHOULD use app-local surfaces, not browser/global dialogs.
- New drawing features SHOULD be evaluated as Excalidraw adapter work first. Mossx-owned logic should focus on metadata, links, AI context digest, and workspace persistence.

### Known limits

- `aiContext.elementDigest` is a useful structured summary, not a complete semantic parser for arbitrary diagrams.
- Canvas is not a code-generation proof source. Any AI response consuming it should preserve the warning that the canvas is user-authored intent context.
- Collaboration, cloud sync, permissions, automatic Project Map sync, and image-to-code remain out of scope.

### Closure recommendation

Before archive, run one product smoke:

```text
create canvas -> draw rectangle/text/arrow -> save -> reopen -> link Project Map file/node -> stage in Composer -> send message
```

If that smoke passes, this change is ready for verify / sync / archive from a design perspective.

## Manager UX implementation calibration（2026-06-06）

### 中文导读

本节基于当前代码精确记录 Intent Canvas Manager 的近期实现校准。
设计目标不是增加绘图能力，而是修正入口语义、降低卡片操作噪音、统一确认模型，并保护中文/窄宽布局可用性。

### Entry flow contract

```text
Right toolbar Intent Canvas tab
  -> handleOpenIntentCanvas(undefined)
  -> setCenterMode("intentCanvas")
  -> setIntentCanvasOpenRequest(null)
  -> IntentCanvasManager list / empty state

Project Map contextual action
  -> handleOpenIntentCanvas(request)
  -> setCenterMode("intentCanvas")
  -> setIntentCanvasOpenRequest({ requestId, mode, canvasId, title, summary, source })
  -> IntentCanvasManager consumes request
  -> open existing canvas or create seeded canvas
```

Contract:

- A bare Intent Canvas surface navigation MUST NOT create a new Canvas document.
- Only explicit contextual requests MAY create or open a Canvas.
- Clearing `intentCanvasOpenRequest` on bare navigation is required so stale requests cannot replay.

### Card action confirmation contract

The manager now treats card actions as a small state machine:

```text
IntentCanvasManagerAction = "open" | "duplicate" | "delete"

click card / open icon / duplicate icon / delete icon
  -> setActionPrompt({ action, entry })
  -> render app-local confirmation popover
  -> confirmCanvasAction()
     -> openCanvas(entry.id)
     -> handleDuplicateCanvas(entry)
     -> deleteIntentCanvasDocument(...)
```

Contract:

- Card body click and open icon MUST share the same confirmation path.
- Duplicate and delete MUST NOT bypass confirmation.
- Confirmation text MUST come from i18n keys:
  - `intentCanvas.manager.openConfirm`
  - `intentCanvas.manager.openHint`
  - `intentCanvas.manager.duplicateConfirm`
  - `intentCanvas.manager.duplicateHint`
  - existing delete keys
- Confirmation UI MUST stay app-local and MUST NOT use global browser/system dialogs.

### Card density and icon layout contract

The card surface is intentionally compact:

- Summary is one-line clamped.
- Metrics use compact cells.
- Card action buttons are title-row icon actions, not bottom text buttons.
- Buttons keep `aria-label` and `title`; visible text is removed.
- Button visuals are transparent icon controls with hover affordance, not bordered capsule buttons.
- Title width reserves space for the icon cluster to avoid overlap.

This contract matters because Manager is a dense asset browser. Actions should be discoverable but should not dominate card height.

### Responsive compatibility contract

Manager layout now carries explicit narrow-width constraints:

- Hero grid uses shrinkable `minmax(0, ...)` columns.
- Manager identity and title must not force horizontal overflow.
- At medium width, hero layout collapses to one column.
- At narrow width, title may clamp to two lines, grid becomes one column, and the action popover stretches within the viewport.
- Confirmation popover width is bounded by viewport and card constraints to avoid left-edge clipping.

### Manager viewport and empty-state contract

The current Manager implementation stretches its content area after the compact command bar:

- `.intent-canvas-manager` is a flex column container.
- `.intent-canvas-manager > .intent-canvas-grid` uses `flex: 1`, `align-content: start`, and `min-height: 0`.
- `.intent-canvas-manager > .intent-canvas-empty-state` and `.intent-canvas-manager > .intent-canvas-loading` use `flex: 1` and `min-height: 0`.
- `.intent-canvas-empty-state` and `.intent-canvas-loading` use flex column centering so icon, copy, and primary action stay as one centered visual group after the outer content area stretches.

### Current implemented UI contract（code-aligned）

- Manager header:
  - No eyebrow badge.
  - Single-row command bar at desktop width.
  - Title, short subtitle, search, count, refresh, Project Map, and create actions share one row.
  - Top actions are borderless icon + visible-text toolbar actions.
- Editor header:
  - No eyebrow badge.
  - Back, save, and attach-to-thread are borderless icon + visible-text toolbar actions.
  - Save state remains a compact status badge, not a button.
- Manager cards:
  - Card body, open icon, duplicate icon, and delete icon use the same action prompt state machine.
  - Card action buttons are compact icon-only controls with `aria-label` and `title`.
  - The icon-only card actions are intentional for dense asset-browser layout; safety is provided by app-local confirmation before open / duplicate / delete.
- Composer attachment:
  - Staged Canvas appears above Composer, not inside the typed draft.
  - Preview is a lightweight SVG projection of `aiContext.elementDigest`.
  - Remove action is icon + visible text.

### Current implemented data-flow contract（code-aligned）

```text
Editor attach action
  -> buildDraftDocument({ includeActiveThread: true })
  -> saveIntentCanvasDocument(...)
  -> onAttachToThread(savedDocument)
  -> AppShell stages document under target thread id
  -> Composer renders IntentCanvasAttachmentCard
  -> user sends / queues
  -> append formatIntentCanvasThreadContext(document, workspaceName)
  -> delegate to normal Composer send / queue path
  -> clear pending canvas documents for that thread
```

Contracts:

- Attach does not directly call `sendUserMessageToThread`.
- A blank Composer draft is still sendable when staged Canvas context exists because ChatInputBox receives `hasContextAttachment`.
- Browser URL auto-open behavior is skipped when Intent Canvas attachments are staged, because the staged structured context is the deliberate payload.
- If no active thread exists during attach, AppShell creates or activates a workspace thread before staging.

### Scene sanitation contract

`sanitizeIntentCanvasScene()` persists editor scene fidelity but strips Excalidraw runtime-only app state keys:

- `appState.collaborators` MUST NOT be written into persisted Intent Canvas appState.
- This prevents legacy object-shaped collaborator state from being restored into Excalidraw where runtime expects a Map-like collection.
- `appState.selectedElementIds` and `appState.selectedGroupIds` MUST be object maps before being passed back to Excalidraw initial data; nullable or malformed values MUST normalize to `{}`.
- Tests cover Map-shaped collaborator state and legacy object-shaped collaborator state.
