## Context

当前文件卡顿不是单点 IO 慢，而是 file read、document content、CodeMirror controlled value、preview rendering、git markers、annotation、active file reference、external change monitor、realtime render pressure 多条链路共享 React 主线程。

已观察到的代码状态：

- `useFileDocumentState` 在文件切换时读取整份内容并写入 React document snapshot。
- `FileViewBody` 已有 120ms publish buffer，但每次输入仍更新 `editorContent` React state，并触发 dirty 状态与 publish 计时。
- `FileCodeMirrorEditorImpl` 使用 `key={filePath}`，Tab 激活换文件时会重建 CodeMirror instance。
- `useDetachedFileExplorerState` 只保存 `openTabs`、`activeFilePath`、`navigationTarget`，没有 per-tab document/editor session。
- `FileExplorerWorkspace` 只渲染当前 active file 的一个 `FileViewPanel`，Tab 切换语义接近重新装载当前文件视图。
- `FileViewPanel` 不只有 detached explorer 一个入口：main editor 由 `useLayoutNodes` 组装，editable diff review 也直接渲染 `FileViewPanel`。任何 session/activation contract 若只覆盖 detached explorer，都会留下第二条卡顿路径。
- `activeDeclarationCodeAnchor` 当前依赖 `content` 与 line range 派生，容易把输入 publish、行切换和 full-content 扫描绑在一起。
- git marker 加载目前主要靠 `cancelled` guard，缺少 file snapshot/render epoch 校验；`resolveFilePreviewHandle`、external sync 也需要统一到同一套 stale-result contract。
- realtime 侧仍存在 `threadStatusById` map 经过 AppShell/Sidebar/layout 的整张传播，文件视图虽然只需要 pressure signal，但上游大对象变化仍可能放大 render pressure。

约束：

- 不替换 CodeMirror。
- 不改变 workspace path/security policy。
- 不牺牲 dirty buffer、external change conflict、annotation、git markers、Composer active file reference。
- 必须可小步迁移，每步可回滚。

## Goals / Non-Goals

**Goals:**

- 文件打开从单次“大同步”改成 staged pipeline：tab identity -> document snapshot -> first useful viewport -> heavy preview work。
- 多 Tab 引入 per-tab file session boundary，避免已打开文件切换时默认重读、重建、重算。
- CodeMirror 输入热路径 local-first，React/AppShell 只接收合并后的低频状态。
- cursor/selection/line range 本地即时，跨 Composer 发布延迟合并、可取消、带 file epoch guard。
- external change、git markers、preview refresh、code intelligence 进入可取消、按 snapshot/version/epoch 校验的后台工作。
- 文件视图与 realtime 只通过 narrow pressure signal 协调，不消费 `threadStatusById`、conversation reducer 或 Sidebar projection；P0 先保证 file surface props 窄化，Sidebar selector 化作为 P1/follow-up。
- 建立内容安全的 runtime evidence，用来区分 IO 慢、editor render 慢、tab remount 慢、realtime pressure 放大。

**Non-Goals:**

- 不重写文件树或整个 AppShell。
- 不改文件权限、读写策略、external spec root 策略。
- 不把所有文件内容缓存永久化到磁盘或 clientStorage。
- 不处理 provider first-token latency、terminal settlement 等非文件视图问题。
- 不要求首轮就完成 Rust 侧文件缓存；只有 evidence 证明 IO 本身是瓶颈时再进入 backend work。

## Decisions

### Decision 1: Introduce per-tab file session boundary

每个打开文件 Tab 拥有一个 file session record，而不是只在全局保存 path。

Scope MUST include all current `FileViewPanel` consumers:

- main editor surface assembled in `src/features/layout/hooks/useLayoutNodes.tsx`
- detached file explorer state/workspace
- editable diff review surface in `src/features/git/components/WorkspaceEditableDiffReviewSurface.tsx`

如果某个 consumer 暂时不能共享同一个 manager，必须通过 thin adapter 使用同一份 activation/session contract；不能产生“main editor 修好了，diff review 仍按旧路径重建”的双轨语义。

建议 session shape：

```ts
type FileTabSession = {
  path: string;
  normalizedPath: string;
  documentKey: string;
  loadState: "idle" | "loading" | "ready" | "error";
  documentSnapshot: FileDocumentSnapshot | null;
  editorDraftRef: { current: string };
  dirty: boolean;
  editorEpoch: number;
  renderEpoch: number;
  previewSnapshotVersion: number;
  lineRange: { startLine: number; endLine: number } | null;
  pendingNavigationTarget: EditorNavigationTarget | null;
};
```

Session manager 负责：

- open：没有 session 时创建，已有 session 时激活。
- activate：切 active session，不默认清空 document snapshot。
- close：销毁 session，处理 dirty confirm。
- replace snapshot：只更新目标 session。
- publish line range：按 session/file epoch guard 合并发布。

Alternatives considered:

- 继续只用 `openTabs + activeFilePath`：改动小，但无法解释/解决 Tab 切换重读和 editor remount。
- 保活所有 `FileViewPanel` DOM：切换快，但内存和后台 preview work 风险高。

Rationale: per-tab session 是中间路线；保留必要状态，不保留全部 DOM。

### Decision 2: Make CodeMirror the hot-path owner of typed content

输入时，CodeMirror transaction 和 local editor session 是第一真源。React document snapshot 只在以下时机接收内容：

- explicit save
- debounced idle publish
- mode switch to preview
- tab deactivate / unmount guard
- context injection / Composer send 前需要最新 active file reference

Closeout implementation refines this from “bounded React echo” to “no per-keystroke React content state update”:

- `FileViewBody.handleEditorContentChange` only updates `latestEditorContentRef`, draft cache, dirty metadata, and a debounced publish timer.
- `setEditorContent(content)` is limited to document/snapshot synchronization, not the input callback.
- Save and context-sensitive actions flush `editorDraftContentRef` before consuming content, so local-first typing does not risk stale writes.
- dirty 状态只发布 metadata，不把 full content 放进每次输入的 React hot path。
- active file declaration anchor 不在每次输入时从 React `content` 全量重新解析。
- preview snapshot 不在 editing mode 的每次 publish 后自动刷新，除非 live preview 明确开启。

Alternatives considered:

- 完全 uncontrolled CodeMirror，不向 React 同步内容：输入最快，但 save、dirty、external conflict、preview、tests 迁移成本过高。
- 继续 controlled value + debounce：低风险，但仍会让 React 参与输入热路径。

Rationale: local-first with bounded publish 可以兼容现有语义，同时切断每 keypress 的大范围传播。

CodeMirror state retention is staged:

1. P0 only caches document draft, dirty metadata, selection/line range, and scroll metadata where existing APIs allow it. This reduces remount-visible loss without committing to long-lived `EditorState` ownership.
2. P1 adds `EditorState` or `EditorView` retention only if evidence still shows tab activation dominated by CodeMirror reconstruction and memory budget remains acceptable.

Rationale: 直接缓存完整 CodeMirror state 风险更高，容易把 extension lifecycle、theme、language compartment、annotation 和 stale file state 绑死。先缓存可序列化/轻量 session metadata，证据不够时不扩大复杂度。

### Decision 2.1: Bound active declaration/code anchor derivation

`activeDeclarationCodeAnchor`、Composer active file reference、line-range publish 不得在每次 input 或 cursor movement 上同步扫描 full content。

Rules:

- input hot path only updates editor-local draft and pending dirty metadata.
- line range publish carries `filePath + editorEpoch + lineRange` and uses latest-only debounce.
- declaration/code anchor may derive from cached lightweight line metadata, current visible line window, explicit idle refresh, or save/preview switch.
- stale derivation for an older `editorEpoch` MUST be dropped.

Closeout implementation:

- `FileViewPanel.handleEditorLineRangeChange` updates refs immediately but delays React state and Composer/global publish through one latest-only timer.
- `activeDeclarationCodeAnchor` derivation reads `editorDraftContentRef.current` inside a deferred epoch-guarded task and no longer depends directly on React `content` changes.
- File switch clears pending line range and active code anchor work before publishing the next file identity.

Rationale: 用户说“切换行也卡”，这条链路不是磁盘 IO，而是 selection -> React state -> active reference -> content derived work 的主线程放大。

### Decision 3: Separate first useful viewport from heavy work

文件打开/激活分阶段：

1. Tab/session 激活：立即更新 header/tab/empty/loading shell。
2. Document snapshot ready：显示第一屏可读内容或 editor 初始 doc。
3. Heavy preview：Markdown blocks、syntax highlight、structured preview、git line markers、code intelligence、external compare 延后并带 epoch guard。
4. Background completion：只提交仍匹配当前 session/snapshot 的结果。

Heavy work MUST attach:

- `normalizedPath`
- `documentKey`
- `snapshotVersion`
- `renderEpoch`
- optional `abortSignal`

Alternatives considered:

- 一次性完成所有 preview 后再显示：简单，但正是打开慢根因。
- 全量后台 worker 化：收益可能大，但迁移成本高，且不能先解决 Tab/editor state 问题。

Rationale: staged pipeline 能最快改善可感知响应，并为 worker/backend cache 留接口。

### Decision 4: Treat external change and git markers as side channels

External change monitor、git diff marker、code intelligence、preview payload 都不得阻塞输入和第一屏。

Rules:

- clean external update 在 stable preview 下只提示 pending，不自动替换 content。
- dirty buffer 永远优先，外部变化进入 conflict/pending UI。
- self-save watcher event 通过 saved snapshot/content hash 抑制 redundant reload。
- git marker 加载失败或延迟不得影响 editor mount。
- `getGitFileFullDiff` result MUST verify file identity + snapshotVersion/renderEpoch before commit, not only a component-local cancelled boolean.
- `resolveFilePreviewHandle` / `readWorkspaceFilePreview` style work MUST be staged and cancellable; preview handle resolution cannot block editor mount for editable text files.
- `useFileExternalSync` existing `fileVersionRef` guard SHOULD be unified with the render epoch contract instead of duplicated with an unrelated second guard.
- code intelligence 请求不得在 cursor movement 上无界触发；只在 explicit command 或 bounded debounce 后执行。

### Decision 5: Narrow realtime pressure boundary

文件视图只消费类似下面的窄信号：

```ts
type FileRenderPressure = {
  engineProcessing: boolean;
  editorSplitChatVisible: boolean;
  activeSurface: "editor" | "detached-explorer" | "diff-review" | "other";
};
```

文件组件不得接收：

- `threadStatusById`
- conversation items
- thread reducer state
- Sidebar workspace/thread projection

AppShell/layout 侧需要把 `threadStatusById` 的整张传播继续收敛为 selector/store 或 workspace-level aggregate，避免 realtime 更新触发文件模块无关重算。

Alternatives considered:

- 在文件组件内部直接读取 realtime store：耦合反向扩大。
- 完全不感知 engine processing：无法在 split editor + active streaming 下延后非关键 preview work。

Rationale: narrow pressure signal 只表达调度压力，不泄漏 conversation 语义。

### Decision 6: Evidence first, backend cache second

先测清楚卡顿分类，再决定是否动 Rust 文件缓存。

Evidence dimensions:

- file open: request start/end、snapshot ready、first useful viewport、heavy preview complete
- tab activate: cached session hit/miss、editor remount count、snapshot reuse、first paint
- typing: per input handler duration、React publish count、Tauri read/write count、long task count
- line change: local selection update、global publish delay、stale publish drop count
- realtime pressure: active engine processing 与 file interaction 是否同时发生

Implementation note: 优先新增或扩展一个明确模块，例如 `fileInteractionDiagnostics` / `fileEditorTypingDiagnostics`。不要把 evidence 分散在组件 console 或 ad-hoc timing 里；closeout 需要能复述同一套字段。

内容安全：

- 不记录文件内容、diff、prompt、assistant output。
- 只记录 path hash、size bucket、line count bucket、timing、counts、classification。

## Risks / Trade-offs

- [Risk] per-tab session 增加内存占用。  
  Mitigation: P0 就定义 lightweight budget：后台 session 只保留 snapshot/draft/metadata，不保留完整 preview DOM；large file 或超预算时降级为 snapshot metadata + reload-on-activate。

- [Risk] local-first 输入导致 preview / Composer active file reference 短暂滞后。  
  Mitigation: send/context injection 前 flush active editor draft；line range 发布保留 latest-only guarantee。

- [Risk] stale background work 仍可能提交到新 Tab。  
  Mitigation: 所有 async result 都带 path + snapshotVersion + renderEpoch guard，测试覆盖 tab switch race。

- [Risk] external change 与 dirty buffer 语义回退。  
  Mitigation: 保留现有 conflict state machine，先加 characterization tests 再改 session boundary。

- [Risk] realtime map 残余仍让 AppShell/layout 重算。  
  Mitigation: 文件 change 中只禁止文件 surface 消费大对象；AppShell/Sidebar selector 化作为独立任务阶段推进。

- [Risk] evidence 仍无法覆盖真实 Tauri WebView。  
  Mitigation: 明确 classified evidence；没有 measured 证据时不允许归档为完全解决。

## Migration Plan

1. Characterization tests：冻结当前文件打开、Tab 切换、dirty buffer、external conflict、annotation、git marker、line range 行为。
2. 引入 file tab session manager，不改变 UI；先让 `openTabs/activeFilePath` 从 session manager 派生，并为 main editor / detached explorer / diff review 接入同一 contract 或 adapter。
3. 把 document snapshot 移入 per-tab session；Tab activation 优先复用 snapshot。
4. 把 editor draft / dirty / line range 移入 session-local channel；父级只接收 coalesced metadata。
5. 为 preview handle resolution、git markers、external sync、code intelligence 添加 path/snapshot/render epoch guard。
6. 收窄 file render pressure 输入，移除文件路径上的 realtime 大对象依赖。
7. 增加 runtime evidence gate 或 profiler harness，输出 classified evidence。

Rollback strategy:

- 保留旧 `openTabs + activeFilePath` 行为作为迁移 fallback。
- 新 session manager 可用 feature flag 或 internal switch 回退到旧 active-only FileViewPanel。
- 各 heavy work guard 是 additive protection，单独回退不应破坏文件读取与保存。

## Open Questions

- session cache 的默认 size budget 应按 tab 数、文件大小还是 workspace 总量控制？
- measured evidence 是否能在现有 `perfBaseline` / runtime evidence gates 上扩展，还是需要新的 Tauri WebView harness？
- `threadStatusById` Sidebar selector 化是否需要独立 follow-up，还是在本 change 的 P1 阶段顺手完成？
