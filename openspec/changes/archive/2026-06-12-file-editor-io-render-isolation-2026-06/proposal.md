## Why

当前卡顿已经从单纯 realtime 输出问题，暴露为 file editor / file explorer / AppShell runtime 状态共享主线程的问题。用户可感知的热点集中在打开文件慢、多个文件 Tab 切换慢、文件内打字与切换行卡顿；这说明现有拆分还停留在模块目录层，运行时数据所有权、渲染频率和 IO 边界没有严格隔离。

本 change 用于把“文件系统卡顿”收敛为可验证的架构目标：文件打开要分阶段，Tab 切换要复用已打开文件状态，编辑输入要 local-first，realtime 高频状态不得污染文件编辑热路径。

## 目标与边界

- 文件打开：拆清楚 file read、document snapshot、render profile、first useful viewport、heavy preview work 的阶段边界，避免读完文件就同步触发全量 preview / editor / diff marker 重建。
- 多 Tab：让已打开 Tab 至少拥有 per-tab document/editor session identity，Tab 切换不得默认等价于重新打开文件。
- 覆盖面：同一套 session/activation contract 必须覆盖 main editor、detached file explorer、editable diff review 里所有 `FileViewPanel` consumer，不能只修一个入口。
- 文件编辑：CodeMirror 输入必须 local-first，React/AppShell 只能接收低频、coalesced 的 dirty、line range、save、preview refresh 信号。
- 行切换：cursor / selection / line range 更新必须本地即时，跨 Composer / active file reference 发布必须延迟、合并、可取消。
- active reference：active declaration/code anchor 不得在每次输入或行切换时基于 full content 做同步全量派生。
- realtime 边界：继续收敛 `threadStatusById` 这类整张 map 传播，文件视图只接收窄化 render pressure signal，不消费 conversation reducer 或 Sidebar 大对象。
- evidence：新增或复用内容安全的 runtime evidence，区分 measured、proxy、manual-only、unsupported，不把手感改善伪装成 release-grade 测量。

## 非目标

- 不重写整个文件树、编辑器或 AppShell。
- 不引入新的 editor engine 替换 CodeMirror。
- 不改变文件读写权限模型、workspace path policy、external spec policy。
- 不在本 change 里解决所有 realtime terminal settlement 或 provider first-token latency 问题。
- 不以牺牲 dirty buffer、external change conflict、annotation、git marker、Composer active file reference 语义换取性能。

## What Changes

- Modify file editor typing contract so per-keystroke content echo, cursor movement, and line selection stay inside CodeMirror/local editor session first.
- Modify file multi-tab behavior so opened file tabs retain lightweight per-tab session state and do not force full read/render/editor remount on every activation when a valid snapshot is available.
- Modify file open rendering scheduler so file activation produces first useful content before heavy preview work, and stale work is versioned/cancellable.
- Modify file view runtime stability so external change awareness, markdown preview refresh, git diff markers, annotations, and code intelligence cannot reintroduce high-frequency IPC or full-document render churn.
- Modify realtime / app-shell boundary contracts so file surfaces consume only narrow pressure signals and are protected from whole `threadStatusById` map propagation.
- Add validation expectations for file-open, tab-switch, typing, line-change, and concurrent realtime pressure scenarios.

## Implementation Closeout Notes

2026-06-13 最后一轮修复针对用户复测指出的“文件已打开后，编辑模式里点行、切光标、输入仍顿挫”重新校准了根因：普通 cursor movement 不直接触发文件系统读取或 code intelligence 请求，主要剩余压力来自 renderer hot path。

本轮最终实现追加了以下收口点：

- `FileViewBody.handleEditorContentChange` 不再对每次输入调用 `setEditorContent(nextContent)`；CodeMirror 拥有即时输入，React document snapshot 只接收 debounced / explicit publish。
- `FileViewPanel.handleEditorLineRangeChange` 不再每次 selection 变化立即更新 React line range state；line label 与 Composer/global publish 统一走 latest-only debounce。
- `activeDeclarationCodeAnchor` derivation 从 `content` 依赖中拆出，改为基于当前 editor draft 与 line range 的 deferred/epoch-guarded derivation，避免每次输入 publish 都重新扫描 full content。
- CodeMirror extension composition 使用 `useMemo` 保持引用稳定，降低 React render 后的 editor reconfiguration 风险。
- `useFileDocumentState` 增加 lightweight session cache，覆盖 clean snapshot reuse、dirty draft retention、large file fallback 和 test cleanup。
- git marker / markdown preview side channels 使用 file render token 防止 tab switch 后 stale async result 写回。

用户复测反馈“有重大改善”。因此本 change 收口判断为：本轮主要解决 frontend editor/render hot path 污染；暂不开 Rust/Tauri file IO cache follow-up。若后续 measured evidence 指向 raw file read、file tree polling 或 native command backlog，再单独开 backend cache 提案。

## 技术方案选项

### Option A: Patch current hooks in place

- 做法：继续在 `FileViewPanel` / `FileViewBody` 里增加 debounce、`startTransition`、memo 和 cancellation guard。
- 优点：改动小，容易快速验证。
- 缺点：只能缓解，不能彻底拆清数据所有权；`content`、dirty、preview、line range 仍可能互相牵连，Tab 切换仍容易重建 editor。

### Option B: Introduce per-tab file session boundary

- 做法：新增或强化 file session layer，把每个打开文件的 document snapshot、editor draft、render epoch、line range、dirty state、preview snapshot 分配到 per-tab session；活动 Tab 只绑定当前 session，后台 Tab 保留轻量状态。
- 优点：直击打开慢、Tab 切换慢、打字卡顿的共同根因；可以把 CodeMirror 输入、preview refresh、save、external sync 分成不同频率的通道。
- 缺点：迁移成本更高，需要小步切换并保证 external change、annotation、git markers、Composer active file reference 不回退。

### Option C: Move file IO and render scheduling mostly backend-side

- 做法：通过 Rust/Tauri 侧缓存、预读、watcher、metadata diff，把前端只变成消费增量事件。
- 优点：对大 workspace 和文件系统扫描可能收益明显。
- 缺点：不能解决 CodeMirror/React controlled value 和 AppShell render 污染；风险更大，容易把 UI 卡顿误判成 IO 问题。

Decision: 优先采用 Option B，小范围吸收 Option A 的 guard；暂不采用 Option C 作为主线。原因是当前最明显的卡顿同时出现在打开、Tab 切换、输入、行切换，这些都指向前端 session/render 频率混杂，而不是单纯磁盘读取慢。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-editor-typing-latency`: 明确 CodeMirror/editor session 是输入热路径的 local-first owner，React/AppShell 只接收合并后的发布信号。
- `filetree-multitab-open`: 强化多 Tab 的 session 保活与 activation 语义，Tab 切换不得默认重读、重建或提交 stale work。
- `file-open-rendering-scheduler`: 强化 file open staged pipeline、snapshot/version/epoch guard、first useful viewport、heavy work defer/cancel 契约。
- `file-view-rendering-runtime-stability`: 强化 external change、preview refresh、git marker、annotation、code intelligence 在高频交互下的 bounded behavior。
- `conversation-realtime-client-performance`: 明确 realtime 高频状态不得污染文件编辑热路径，文件侧只消费窄化 pressure signal。
- `app-shell-runtime-boundaries`: 明确 AppShell/layout 不得把整张 realtime status map 作为文件视图或 layout recomputation 的常态依赖。

## Impact

- Frontend files:
  - `src/features/files/**`
  - `src/features/shared/components/FileEditorCard.tsx`
  - `src/features/git/components/WorkspaceEditableDiffReviewSurface.tsx`
  - `src/app-shell.tsx`
  - `src/app-shell-parts/**`
  - `src/features/layout/hooks/**`
  - `src/features/app/components/Sidebar.tsx`
  - `src/features/app/components/WorktreeSection.tsx`
- Backend / Tauri:
  - `src/services/tauri.ts`
  - `src-tauri/src/files/**`
  - external change monitor commands, only if evidence proves IO-side churn remains after frontend isolation.
- Specs:
  - `openspec/specs/file-editor-typing-latency/spec.md`
  - `openspec/specs/filetree-multitab-open/spec.md`
  - `openspec/specs/file-open-rendering-scheduler/spec.md`
  - `openspec/specs/file-view-rendering-runtime-stability/spec.md`
  - `openspec/specs/conversation-realtime-client-performance/spec.md`
  - `openspec/specs/app-shell-runtime-boundaries/spec.md`
- Tests / evidence:
  - Focused Vitest suites for file open, Tab switching, editor typing, line range publication, stale render cancellation.
  - Runtime evidence gate for file open / tab activation / typing under concurrent realtime pressure where tooling supports it.

## 验收标准

- 打开文件：已有 text/code/markdown 文件打开时，first useful viewport 不等待全量 preview/highlight/diff marker 完成。
- Tab 切换：在多个已打开文件之间切换时，已缓存 session 可复用；不得显示 stale content、stale markers、stale annotation draft。
- 覆盖面：main editor、detached explorer、editable diff review 的 `FileViewPanel` 行为都必须被检查；若某入口暂不共享 session，必须有明确 adapter/fallback 与测试说明。
- 文件输入：连续打字不触发每 keypress 的 Tauri read/write，不强制 AppShell、Sidebar、Composer、file tree 全量重算。
- 行切换：cursor / selection 变化本地响应，跨 Composer active file reference 发布延迟合并，并且切文件后不会发布旧文件行号。
- realtime 并发：conversation streaming / processing 状态变化不得让文件 editor 输入路径依赖整张 `threadStatusById` map。
- 证据分级：closeout 必须列出 measured/proxy/manual-only/unsupported；若仍有肉眼卡顿，change 不得归档为完全解决。
