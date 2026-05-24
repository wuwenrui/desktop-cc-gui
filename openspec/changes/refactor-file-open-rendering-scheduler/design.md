## Context

当前文件模块已经具备多文件打开、文件树、Markdown preview、document preview、Git marker、AI annotation、外部变更监听和 detached explorer 能力。问题不在功能缺失，而在文件打开后的高成本工作缺少统一编排。

实际代码路径显示：

- `useGitPanelController.handleOpenFile` 只维护 `openFileTabs`、`activeEditorFilePath`、navigation/highlight target，并切到 `centerMode="editor"`。
- `DesktopLayout` 在 editor split 且文件未最大化时，同时让 editor layer 与 chat layer active。
- `FileViewPanel` 在 mount/active file change 后 resolve render profile、read target，然后通过 `useFileDocumentState` 读取文本。
- `useFileDocumentState` 读完后直接 `setContent(nextContent)`，这会同步触发 `measureFilePreviewMetrics`、`resolveFileViewSurface`、code lines split/highlight 或 Markdown compile。
- `measureFilePreviewMetrics` 当前对 `content` 做 `TextEncoder().encode(value).length` 和 `value.split(/\r?\n/)`；即使 DOM 后续虚拟化，这类 render 前全文扫描仍可能在打开瞬间阻塞主线程。
- code preview 当前在 `FileViewPanel` 中 `content.split("\n")`，再 `lines.map(highlightLine)`，并在 `FileViewBody` 中 `lines.map` 全量渲染每一行。
- Markdown preview 已有 `compileFileMarkdownDocument`、block segmentation、progressive rendering 和 heavy block isolation，但 progressive 推进仍按固定 `16ms` tick。
- `FilePreviewPopover` 也会对 hover preview content 做 split/highlight/full row render；`FileStructuredPreview` 会全文 parse shell/dockerfile 并 highlight code sections。
- `FileTreePanel` 已构造 `visibleTreeNodeEntries`，但最终仍递归 `nodes.map(renderNode)` 渲染展开树。
- `useFileExternalSync` 通过 polling/watcher 重新 `readWorkspaceFile`，clean update 会继续 `setContent`，从而触发完整 preview rebuild。

这些路径在普通打开小文件时可接受；但在 editor split + engine streaming 时，messages live Markdown、timeline projection、file preview、file tree 和 external sync 会共同占用 React 主线程，形成明显卡顿。

## 当前代码事实图

```text
FileTree / Diff / Search / Activity
  -> onOpenFile(path, location?)
  -> useGitPanelController.handleOpenFile
       setOpenFileTabs(path)
       setActiveEditorFilePath(path)
       setCenterMode("editor")
  -> DesktopLayout
       editor layer active
       chat layer active when !isEditorFileMaximized
  -> FileViewPanel
       resolveFileRenderProfile(filePath)
       resolveFileReadTarget(workspacePath, filePath, customSpecRoot)
       useFileDocumentState(...)
         readWorkspaceFile / readExternalSpecFile / readExternalAbsoluteFile
         setContent(nextContent)
       measureFilePreviewMetrics(content)  // full content scan today
       resolveFileViewSurface(renderProfile, mode, metrics)
       code: split lines + highlight all lines
       markdown: compile document + progressive blocks
       popover/structured: split/parse/highlight when invoked
       useFileExternalSync(...)
  -> FileViewBody / FileMarkdownPreview / FileTreePanel
       full DOM rows or progressive block render
```

## Problem Decomposition

### 1. Code preview 全量行模型和全量 DOM

当前 code preview 的瓶颈是同步双重全量：

```text
content.split("\n")
  -> lines.map(highlightLine)
  -> lines.map(<div className="fvp-code-line">...)
```

每行还绑定 click、mouse down、mouse enter、mouse up 事件，并对 annotation 做行级筛选。即使 low-cost preview 关闭 syntax highlight，DOM 数量仍然是线性的。

### 2. Markdown progressive 与 engine streaming 抢帧

Markdown preview 的 compile/cache/block 架构已有基础，但 progressive line limit 用 `setTimeout(..., 16)` 推进。engine streaming 期间，message Markdown 也在 throttle + transition 渲染。两个 surface 同时用前台 timer 推进，会产生 frame contention。

### 3. 渲染前全文扫描会在虚拟化后残留

如果只替换 DOM renderer，`measureFilePreviewMetrics`、line-count 计算、content hash、Markdown compile、structured preview parse 仍可能在 read completion 后同步扫描全文。重构必须把这些 content-derived metadata 收敛成一次性的 snapshot/index 工作，并且让 renderer 通过 snapshot accessor 获取行内容，而不是各组件各自 `split`。

### 4. FileTreePanel 只 flat 了选择模型，没有 flat 渲染

`visibleTreeNodeEntries` 已经存在，但 render 仍走 recursive `renderNode`。这意味着大目录展开或 Git status refresh 后，仍会生成整棵可见树的 DOM 和 handler。

### 5. 外部同步直接推进 content

watcher/polling 发现 clean disk snapshot 后，默认可能直接 `setContent` 并更新 saved content。对于 read-mode preview，这会直接触发高成本 preview rebuild。engine 正在输出时，这类后台刷新不应抢前台帧。

### 6. 多 tab 没有同时读取，但缺少 active-only contract

当前多 tab 只保存 path array，active file 才 mount `FileViewPanel`，这是正确方向。但契约没有写死。后续重构必须防止后台 tab 预读、预编译、预渲染高成本内容。

### 7. Secondary preview surfaces 会重新打开卡顿入口

hover preview、structured preview、document preview payload 是不同入口。它们不一定是本次性能投诉的主场景，但如果继续独立全文 split/highlight/parse，就会绕开主 renderer 的 viewport boundary。设计上必须明确复用 snapshot/index 或降级为 low-cost preview。

### 8. Win/Mac 风险

文件模块触及 path normalization、case-insensitive matching、external watcher/polling、drag/drop、scroll measurement。实现必须避免硬编码 separator、大小写假设、平台专属 scroll/event 行为。

### 9. Editor line range 同步放大点击延迟

编辑态卡顿不只来自文件内容渲染。CodeMirror `selectionSet` 当前会把点击行号同步推到 `activeFileLineRange`，该状态位于 app-shell/layout 边界，并被 Composer active-file reference、context ledger projection 和文件面板 annotation toolbar 共同消费。

这个路径的特征是：

- 不读取磁盘，也不读取全文内容；
- 发生频率高，鼠标点击/拖选/键盘移动光标都会触发；
- 同步跨越 editor -> layout -> composer/context ledger；
- 对用户体感是光标点击“不跟手”，即使大文件 preview virtualization 已经生效。

因此它必须被视为 foreground interaction hot path：文件面板本地反馈应立即更新，跨区域的 Composer reference 发布应延迟、合并、低优先级执行。

## Design Goals

- 首屏显示快：打开文件后先提交 header/tabs/skeleton，再提交 viewport rows/blocks。
- 主线程有边界：任何文件打开后的默认 preview 都不得全量同步 mount 数千行 DOM。
- 同屏对话优先：engine streaming 期间，文件 preview 的非必要后台工作必须进入 passive / deferred mode。
- 编辑点击跟手：editor cursor/selection 变化不得同步触发 Composer/context ledger 级别的重算。
- 语义不丢：tab、dirty、save、conflict、annotation、Git marker、navigation target、open-with-app 均保持可用。
- 可回滚：每个阶段保留 adapter boundary，不做一次性大爆炸式重写。

## Options Considered

### Option A: 局部 debounce 和阈值调低

做法：调低 `PREVIEW_BUDGETS`，给 external sync 和 Markdown progressive 加 debounce。

优点：
- 改动小。
- 短期可缓解部分场景。

缺点：
- code preview DOM 仍是全量。
- FileTreePanel 仍是递归全量渲染。
- engine streaming 与 file preview 仍没有统一优先级。
- 容易变成阈值猜谜，无法形成长期架构。

结论：不采用作为主方案，只允许作为临时保护阈值。

### Option B: 全量接入 Monaco/CodeMirror 作为 preview

做法：code preview 直接用 CodeMirror/Monaco virtualized editor surface，避免自建行 DOM。

优点：
- 编辑器本身解决大文件 viewport。
- 搜索/选区能力成熟。

缺点：
- 当前 preview mode 有 AI annotation、Git marker、line action、readonly selection 等自定义 DOM 交互。
- edit mode 已经有 CodeMirror，preview 直接复用会让 preview/edit 的语义边界变模糊。
- Markdown、FileTree、external sync 的调度问题仍未解决。

结论：不作为本 change 主路径。可在后续评估 preview/edit 统一 editor surface，但当前更稳的是保持现有 UI 契约并虚拟化 row renderer。

### Option C: Viewport Pipeline + Lightweight Scheduler

做法：分层为 FileSessionStore、FileDocumentController、FileRenderModel、ViewportRenderer 和 render scheduler。对 code/tree 做 virtualization，对 Markdown 做 passive/idle/progressive 调度，对 external sync 做 snapshot gating。

优点：
- 直接解决全量 DOM 与前台抢帧。
- 不改变后端读取 API。
- 可分阶段落地和回滚。
- 与已有 `@tanstack/react-virtual`、Markdown compile cache、messages timeline virtualization 方向一致。

缺点：
- 改动面较广，需要测试覆盖 tab、annotation、external sync、Win/Mac path。
- 需要设计清晰 adapter，避免一次性重写。

结论：采用 Option C。

## Proposed Architecture

```text
FileSessionStore
  - openTabs
  - activeFilePath
  - navigationTarget
  - lightweight per-tab UI state

FileDocumentController
  - read/save state
  - dirty/saved refs
  - external disk snapshot
  - stable preview snapshot
  - pending refresh/conflict
  - snapshotVersion / contentHash / byteLength / lineCount
  - lineOffsetIndex / bounded line access

FileRenderModel
  - renderProfile
  - previewMetrics
  - code line model
  - markdown compiled model
  - annotation placement index
  - git line marker index

ViewportRenderer
  - CodePreviewVirtualList
  - FileTreeVirtualList
  - MarkdownBlockViewport / progressive idle renderer

RenderScheduler
  - urgent: tab activation, active edit typing, save, first visible content
  - normal: visible line highlight, scroll-to-line, annotation placement, local editor line affordance
  - background: offscreen highlight, Markdown heavy blocks, clean external refresh
  - delayed global: Composer active-file line reference publication
  - guard: snapshotVersion + renderEpoch + cancellation on switch/unmount
```

## Component-Level Plan

### File session

Keep the existing controller semantics first:

- `useGitPanelController` remains the owner for main-window `openFileTabs` and active editor file path.
- `useDetachedFileExplorerState` remains the detached explorer owner.
- Extract shared pure helpers for tab insertion, activation, close fallback and path normalization only after focused tests are green.

This avoids turning the first phase into a global store migration.

### Document snapshot controller

Refactor `useFileDocumentState` in small steps:

1. Preserve current public shape for `content`, `setContent`, `isDirty`, `handleSave`.
2. Add internal `loadedSnapshot` and `previewSnapshot`.
3. Add `snapshotVersion`, `contentHash`, `byteLength`, `lineCount`, and a lazy/bounded line accessor derived from a line offset index.
4. Avoid repeated render-time `TextEncoder().encode(content)`, `content.split(...)`, and full line array allocation across FileViewPanel/FileViewBody/Markdown/structured/secondary preview.
5. External sync clean update first records `pendingDiskSnapshot` unless live preview is explicitly enabled.
6. Preview consumes `previewSnapshot`; edit mode consumes mutable `content`.
7. Dirty/conflict semantics stay owned by the same state machine.

The first implementation can keep `content` for compatibility, but high-cost preview paths should consume `previewSnapshot` metadata and accessors. This gives a rollback point while removing duplicate full-document scans from the hot render path.

### Render epoch and cancellation

All deferred work needs a commit guard:

```text
renderWorkKey = {
  fileIdentity,
  snapshotVersion,
  renderEpoch,
  surface,
}
```

Rules:

- Increment `renderEpoch` on active file switch, mode switch that changes surface, snapshot replacement, and unmount.
- Background highlight, Markdown progressive chunks, heavy block renders, and clean external refresh application must check the latest epoch before committing React state.
- Existing `requestIdRef` and `fileVersionRef` patterns remain useful but are not sufficient for renderer work after the read promise resolves.
- Cancellation should prefer local refs/AbortController-style guards over global EventBus-style coordination.

### Code preview virtualization

Introduce a focused renderer:

```text
CodePreviewVirtualList
  props:
    lineCount
    getLineText(index)
    getHighlightedLine(index)
    gitLineMarkerIndex
    annotationIndex
    selectionState
    onLineAction
```

Rules:

- Use `@tanstack/react-virtual`.
- Only render viewport + overscan rows.
- Do not build `highlightedLines` for every line during render.
- Do not require a full `lines` array for large previews; use `lineCount` plus `getLineText(index)` backed by the snapshot line index.
- Cache highlighted visible rows by `contentHash + language + lineNumber + lineText`.
- Move row click/drag selection toward container-level delegation where practical.
- Keep annotation draft row mounted or scroll it into view before editing.
- Preserve navigation by using virtualizer `scrollToIndex` and then verifying the target line after measurement settles.

### File tree virtualization

Use existing `visibleTreeNodeEntries` as the data boundary, but enrich entries with row data:

```text
VisibleFileTreeRow
  path
  type
  name
  depth
  isExpanded
  isLazyLoading
  gitStatus
  isSelected
  isPrimarySelection
```

Rules:

- Replace recursive DOM render with a virtual row list.
- Keep root actions outside the virtual list.
- Decide explicitly whether the root row is a fixed header or the first virtual row; root actions must not distort virtual row measurement.
- Use a stable estimated row height with tolerances and allow measurement updates without scroll jumps.
- Preserve single click selection, double click open/toggle, context menu, drag bridge, Cmd/Ctrl multi-select, Shift range-select.
- Preserve roving focus / active selection after row recycling; context menu anchors must use current row geometry rather than stale DOM nodes.
- Keep Windows drag preview behavior behind existing platform checks.

### Markdown preview scheduling

Keep current Markdown architecture, but change scheduling:

- `compileFileMarkdownDocument` remains pure/cacheable by document key/content hash/profile.
- Large Markdown compile/block segmentation must be guarded by snapshotVersion and must not be required before header/tabs/initial skeleton commit. If compile remains synchronous in a phase, evidence must show it is below the accepted budget or it must be classified as residual risk.
- Fixed `16ms` progressive tick must be replaced by scheduler-aware cadence.
- When engine is processing and editor split chat is visible, Markdown preview enters passive mode:
  - stable snapshot remains visible;
  - pending external updates are surfaced but not auto-rebuilt;
  - heavy block rendering waits for idle/visibility unless user interacts with that block.
- Large Markdown uses deterministic metrics to choose rich/progressive/virtualized/low-cost.

### Foreground coordination with engine streaming

The file module should consume a narrow signal, not import conversation internals:

```ts
type FileRenderPressure = {
  engineProcessing: boolean;
  editorSplitChatVisible: boolean;
  activeSurface: "editor" | "detached-explorer";
};
```

This signal should be derived in layout composition from existing active thread status and editor split state, then passed down by props:

```text
useLayoutNodes
  activeThreadStatus?.isProcessing
  centerMode / editorSplitLayout / isEditorFileMaximized
  -> fileRenderPressure
  -> FileViewPanel
  -> FileViewBody / FileMarkdownPreview / useFileExternalSync
```

It must not mutate message state, import conversation reducers, or subscribe file components directly to realtime internals.

### Editor line range publishing

Editor selection tracking uses a local-first model:

```text
CodeMirror selectionSet
  -> FileViewPanel local line range ref/state
       immediate: annotation toolbar label and "标注给 AI" target
  -> delayed global publish
       coalesce latest range
       publish activeFileLineRange to app-shell / Composer
       low-priority React transition
```

Rules:

- The local file panel line label and editor annotation target must update from local state/ref, without waiting for app-shell state to round-trip.
- `onActiveFileLineRangeChange` must not run synchronously on every cursor click or selection tick.
- Consecutive line changes may be coalesced; Composer only needs the latest active-file reference before send/context projection, not every intermediate cursor position.
- Switching file, leaving preview/edit surface, or unmounting must clear pending range publication and avoid publishing a stale range.
- AI annotation in edit mode must use the latest local range, so delayed Composer synchronization cannot make annotation target stale.

### Editor annotation affordance and footer controls

The file editor must not insert a persistent annotation toolbar above CodeMirror. That toolbar competes with the editor viewport and creates a second control surface for the same active file context. Edit-mode annotation controls belong in the bottom current-file footer, where file name, local line range, and the `标注给 AI` action share one compact context.

Footer control rules:

- The current-file footer may show file name, current local line label, and edit-mode `标注给 AI`.
- The footer must not expose `路径已关联 / 路径已关闭` as a FileViewPanel toggle. Composer may still own active-file reference inclusion, but FileViewPanel should not present a redundant path state button.
- Footer buttons and the current-file group should stay visually low-noise: no nested per-button borders or secondary outlines inside the footer group.
- Annotation draft actions should be left-aligned so the action path starts near the draft content instead of floating at the far right edge of the wide editor surface.

CodeMirror annotation widget ordering is part of the same regression boundary. Existing annotation markers and the active draft are both block widgets at line end positions. They must be resolved into a single sorted list before calling `RangeSetBuilder.add`:

```text
annotation markers + active draft
  -> clamp target line to document bounds
  -> sort by target line, widget side, original order
  -> add to CodeMirror RangeSetBuilder
```

This prevents the runtime error `Ranges must be added sorted by from position and startSide` when a new draft targets a line before an existing marker, or shares a line with an existing marker.

### External sync gating

External watcher/polling remains functionally equivalent:

- Dirty file: preserve conflict behavior.
- Clean file + live preview enabled: may advance after debounce/hash guard.
- Clean file + default preview + render pressure: keep current preview snapshot, show pending refresh state.
- Binary/non-inline file: keep existing skip behavior.
- Pending clean refresh must carry snapshot metadata and only apply if `snapshotVersion` / dirty state / active file identity still match.

### Secondary preview surfaces

`FilePreviewPopover` and `FileStructuredPreview` are in scope as bounded consumers:

- Hover popover should reuse the same line model/highlight cache when previewing text/code, or cap itself to a low-cost bounded line count.
- Structured preview may keep shell/dockerfile parsing, but large structured files must use deterministic budget checks and fallback to bounded code/text preview instead of parsing/highlighting the full file.
- PDF/tabular/document preview payload fetching should not gain new high-frequency IPC calls from scroll/hover rendering changes.
- These changes should not redesign the UI; they only prevent secondary surfaces from bypassing the new rendering contract.

## Cross-Platform Compatibility

Windows/macOS compatibility requirements:

- Path comparisons must continue using normalized workspace-relative paths and case-insensitive comparison where applicable.
- No new logic may assume `/` only, `\` only, LF-only, or case-sensitive file identity.
- Virtual row height and scroll restoration must not rely on platform-specific font metrics without tolerance.
- Pointer/mouse/keyboard behavior must preserve macOS `Meta` and Windows `Ctrl` multi-select.
- External monitor behavior must preserve watcher and polling modes; Windows missing-path / sharing-violation errors must remain classified as transient or missing where current code already handles them.

Validation should record:

- macOS local focused test evidence.
- Windows smoke evidence if available.
- If Windows cannot be run in this environment, the change must record the missing evidence and residual risk before archive.

## Validation Strategy

Focused regression:

```bash
npm run test -- src/features/files/components/FileViewPanel.test.tsx
npm run test -- src/features/files/components/FileViewPanel.external-change.test.tsx
npm run test -- src/features/files/components/FileTreePanel.test.tsx
npm run test -- src/features/app/hooks/useGitPanelController.test.tsx
```

Type and governance:

```bash
npm run typecheck
openspec validate refactor-file-open-rendering-scheduler --strict --no-interactive
```

Performance evidence:

```bash
npm run perf:long-list:browser-scroll
npm run check:runtime-evidence-gates
```

`perf:long-list:browser-scroll` is proxy evidence only. The implementation must add or record file-specific evidence for:

- `large-code-open`: first useful file view, mounted row count, and frame/drop signal while opening an 8000+ line file.
- `large-markdown-under-streaming`: progressive chunk cadence while active engine streaming is visible.
- `large-tree-expand`: mounted row count and interaction continuity after expanding a large visible tree.
- `external-sync-under-pressure`: clean disk refresh remains pending/stable while engine render pressure is active.
- `editor-line-click-latency`: editor row/cursor click updates local line affordance immediately while Composer active-file range publication is delayed and coalesced.

Manual smoke:

- Open an 8000-line code file while an engine response is streaming in editor split.
- Open a large Markdown with tables/Mermaid/math during streaming.
- Expand a large directory and verify selection/drag/context menu behavior.
- Trigger external file change during streaming and verify preview does not jank or silently replace stable content.
- Repeat path-open smoke with Windows-style path fixtures in tests; collect real Windows evidence when available.

## Rollback Strategy

- Phase 1 rollback: route code preview back to current non-virtualized `FileViewBody` branch.
- Phase 2 rollback: keep recursive `renderNode` adapter behind a feature-local boundary until virtual tree tests pass.
- Phase 3 rollback: restore Markdown progressive/full render path while keeping compile cache unchanged.
- Phase 4 rollback: keep `useFileDocumentState` public return shape compatible and disable preview snapshot gating.

No backend storage migration is planned, so rollback should remain frontend-local unless later implementation explicitly expands scope.
