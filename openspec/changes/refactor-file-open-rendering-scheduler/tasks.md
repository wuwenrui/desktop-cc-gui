## 1. OpenSpec Foundation

- [x] 1.1 [P0][depends:none][I:user performance report + code inventory][O:proposal.md][V:proposal includes target/boundary/non-goals/options/acceptance] Create the change proposal.
- [x] 1.2 [P0][depends:1.1][I:current file rendering code paths][O:design.md][V:design maps current flow and selected architecture] Create the refactor design.
- [x] 1.3 [P0][depends:1.1][I:existing file/rendering/platform specs][O:spec deltas][V:OpenSpec strict validation accepts capability mapping] Add behavior contracts.

## 2. Evidence Baseline

- [x] 2.1 [P0][depends:1][I:current FileViewPanel/FileViewBody/FileMarkdownPreview/FileTreePanel][O:baseline notes or perf markers][V:large code, large Markdown, large tree, external sync, editor split + streaming scenarios are identifiable] Establish before-change evidence.
- [x] 2.2 [P0][depends:2.1][I:runtime evidence scripts][O:evidence classification][V:measured/proxy/unsupported platform qualifiers remain explicit] Connect or document available perf evidence.
- [x] 2.3 [P1][depends:2.1][I:current tests][O:focused regression list][V:required tests are named before implementation] Lock focused regression scope.
- [x] 2.4 [P0][depends:2.1][I:measureFilePreviewMetrics + code/markdown/structured/popover paths][O:hot-path scan inventory][V:content-derived byte/line/hash/split/parse work is identified before implementation] Inventory render-time full-document scans.
- [x] 2.5 [P0][depends:2.2][I:perf scripts + manual smoke harness][O:file-open evidence plan][V:file-specific measured/proxy/manual/unsupported matrix is defined; generic long-list evidence is marked proxy only] Define file-specific performance evidence.

## 3. Code Preview Viewport Pipeline

- [x] 3.1 [P0][depends:2.4][I:FileViewPanel code preview path + measureFilePreviewMetrics][O:document snapshot metadata boundary][V:contentHash, byteLength, lineCount, snapshotVersion, and bounded line access are derived without repeated render-time full split/highlight] Split document snapshot metadata from DOM rendering.
- [x] 3.2 [P0][depends:3.1][I:@tanstack/react-virtual][O:CodePreviewVirtualList][V:large code preview renders viewport rows only] Virtualize code preview rows.
- [x] 3.3 [P0][depends:3.2][I:Git markers + AI annotations + preview selection][O:indexed row lookup][V:annotation, line selection, and Git line markers remain correct] Preserve preview interactions.
- [x] 3.4 [P0][depends:3.3][I:navigation target][O:scroll-to-line behavior][V:opening file at line works with virtual rows] Preserve code navigation.
- [x] 3.5 [P0][depends:3.2][I:active file switch + snapshot replacement][O:renderEpoch / cancellation guards][V:pending highlight or row work for file A cannot commit into file B after switch/unmount] Add scheduled render work cancellation.

## 4. File Tree Virtualization

- [x] 4.1 [P1][depends:2][I:visibleTreeNodeEntries + buildTree][O:VisibleFileTreeRow model][V:row model includes depth/status/selection/lazy metadata] Build flat render model.
- [x] 4.2 [P1][depends:4.1][I:@tanstack/react-virtual][O:virtual file tree list][V:large expanded tree mounts bounded rows] Replace recursive visible tree DOM with virtual list.
- [x] 4.3 [P1][depends:4.2][I:selection/context/drag handlers][O:interaction parity][V:single click, double click, context menu, drag, Cmd/Ctrl multi-select, Shift range-select pass] Preserve file tree behavior.
- [x] 4.4 [P1][depends:4.2][I:root row/root actions/focus/current row geometry][O:virtual tree focus and measurement contract][V:root actions, context menu anchor, roving focus, and scroll position remain stable under row recycling] Preserve virtual tree layout semantics.

## 5. Markdown And External Sync Scheduling

- [x] 5.1 [P1][depends:2.4][I:FileMarkdownPreview progressive path + compileFileMarkdownDocument][O:scheduler-aware progressive cadence][V:progressive render does not use fixed 16ms foreground loop during render pressure; large compile work is guarded by snapshotVersion/evidence] Make Markdown progressive render pressure-aware.
- [x] 5.2 [P1][depends:5.1][I:heavy block renderers][O:idle/viewport heavy block gating][V:Mermaid/KaTeX/table/code heavy blocks remain stable and local] Isolate heavy blocks under scheduler.
- [x] 5.3 [P1][depends:5.1][I:useFileExternalSync + useFileDocumentState][O:preview snapshot gating][V:default read-mode external clean update does not rebuild high-cost preview during render pressure] Gate external sync preview updates.
- [x] 5.4 [P1][depends:5.3][I:dirty/conflict state machine][O:unchanged save/conflict semantics][V:dirty file still promotes external update to conflict] Preserve conflict behavior.
- [x] 5.5 [P1][depends:3.1][I:FilePreviewPopover + FileStructuredPreview][O:bounded secondary preview consumers][V:hover/structured previews reuse snapshot line access or deterministic low-cost fallback and do not full split/highlight/parse large files] Bound secondary preview surfaces.

## 6. Multi-Tab And Render Pressure Integration

- [x] 6.1 [P0][depends:3][I:useGitPanelController + useDetachedFileExplorerState][O:active-only high-cost contract][V:background tabs do not read/compile/render high-cost previews] Preserve multi-tab semantics while preventing background work.
- [x] 6.2 [P0][depends:3,5][I:DesktopLayout/useLayoutNodes processing state][O:narrow FileRenderPressure signal][V:file surfaces can enter passive mode without importing conversation internals] Integrate render pressure signal.
- [x] 6.3 [P1][depends:6.2][I:editor split layout][O:engine streaming passive mode][V:editor split + active engine turn keeps file preview stable and bounded] Apply passive mode during streaming.
- [x] 6.4 [P0][depends:6.2][I:activeThreadStatus + centerMode + isEditorFileMaximized][O:prop-driven pressure wiring][V:FileRenderPressure is derived in layout composition and file components do not import message reducers/realtime internals] Keep render pressure boundary narrow.
- [x] 6.5 [P0][depends:6.2][I:CodeMirror selectionSet + activeFileLineRange + Composer active-file reference][O:local-first editor line range with delayed global publish][V:clicking editor lines updates local annotation affordance immediately while composer range publication is delayed/coalesced] Remove synchronous editor click-to-composer render coupling.

## 7. Cross-Platform Compatibility

- [x] 7.1 [P0][depends:3,4,5][I:path helpers and platform tests][O:Win/Mac path compatibility coverage][V:Windows-style separators/case variants and macOS paths normalize to same render behavior] Cover path normalization.
- [x] 7.2 [P1][depends:4][I:file tree keyboard/pointer behavior][O:modifier-key parity][V:macOS Meta and Windows Ctrl multi-select semantics remain intact] Verify input parity.
- [x] 7.3 [P1][depends:5][I:external monitor error handling][O:watcher/polling parity notes][V:Windows missing/sharing errors and macOS watcher behavior keep existing classification] Verify external sync parity.

## 8. Validation And Closeout

- [x] 8.1 [P0][depends:3,4,5,6][I:focused test suites][O:green focused tests][V:FileViewPanel, external-change, FileTreePanel, useGitPanelController tests pass] Run focused frontend regression.
- [x] 8.2 [P0][depends:8.1][I:full type surface][O:typecheck evidence][V:npm run typecheck passes] Run typecheck.
- [x] 8.3 [P0][depends:8.1][I:OpenSpec artifacts][O:strict validation evidence][V:openspec validate refactor-file-open-rendering-scheduler --strict --no-interactive passes] Validate OpenSpec.
- [x] 8.4 [P1][depends:8.1][I:perf scripts/manual smoke][O:before/after evidence][V:large code/Markdown/tree/editor streaming smoke recorded with platform qualifiers] Record performance evidence.
- [x] 8.5 [P1][depends:8.4][I:Windows availability][O:Win/Mac compatibility closeout][V:Windows measured evidence or explicit residual gap is recorded] Record cross-platform closeout.
- [x] 8.6 [P1][depends:8.4][I:file-open evidence plan][O:file-specific closeout artifact][V:large-code-open, large-markdown-under-streaming, large-tree-expand, and external-sync-under-pressure are measured/proxy/manual/unsupported explicitly] Record file-open evidence matrix.
- [x] 8.7 [P0][depends:6.5][I:user edit-mode latency confirmation][O:proposal/design/spec/evidence backwrite][V:editor-line-click-latency hot path is documented as measured unit/jsdom evidence and implementation feedback] Backwrite editor click latency finding.
- [x] 8.8 [P0][depends:6.5][I:FileViewPanel footer + FileViewBody editor surface][O:footer-scoped annotation affordance][V:editor body no longer renders top annotation toolbar; footer shows line label and annotation action] Move edit-mode AI annotation action into the current-file footer.
- [x] 8.9 [P0][depends:8.8][I:FileViewPanel footer visual contract][O:low-noise footer controls][V:path state toggle is removed; footer inner button borders are removed; current-file group remains visible] Remove redundant footer path toggle and nested button chrome.
- [x] 8.10 [P0][depends:8.8][I:CodeMirror annotation marker/draft widgets][O:sorted widget target helper][V:focused test covers same-line marker before draft and later marker after draft to prevent RangeSet ordering crash] Lock CodeMirror annotation widget ordering regression.
- [x] 8.11 [P0][depends:8.8][I:annotation draft actions][O:left-aligned draft actions][V:Cancel/Annotate buttons render from the left edge of the draft action row] Align annotation draft action buttons to the left.
