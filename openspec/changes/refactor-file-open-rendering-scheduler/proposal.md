## Why

文件打开后的卡顿不是单点读文件慢，而是读取完成后把 `content` 同步推进到 metrics、syntax highlight、Markdown compile、文件树递归渲染、外部同步刷新和 editor split 下的 engine streaming 同屏提交。当前实现具备功能完整性，但缺少统一的前台渲染编排边界，导致大文件、多文件 tab、外部变更和对话 streaming 同时争抢 React renderer 主线程。

实现验证后还确认了一个编辑态热路径：CodeMirror 光标/选区变化会同步发布 `activeFileLineRange` 到 app-shell，再触发 Composer active-file reference 与 context ledger 重算。这个路径不涉及磁盘读取，但会让鼠标点击不跟手，因此也必须纳入文件打开后渲染编排边界。

这个 change 要把文件打开后的渲染路径从“读取后全量展开 JSX”重构为“稳定 document snapshot + render model + viewport projection + 可调度 commit”，用架构方式解决不流畅，而不是靠局部 debounce 止血。

## 目标与边界

- 重构文件打开后的读取、snapshot、render profile、preview model、viewport rendering、external sync 和多 tab active-file 编排。
- 优先保护 editor split + engine 对话 streaming 场景下的交互流畅度。
- 把 `contentHash`、`byteLength`、`lineCount`、line offset/index 等 content-derived metadata 收敛到 document snapshot 层，避免 virtualized renderer 之外仍重复同步扫描全文。
- 保持现有文件打开、多 tab、AI annotation、Git line marker、Markdown preview、外部同步、detached file explorer 和 open-with-app 行为不回退。
- 编辑态行号/选区反馈必须优先保持本地即时响应；Composer active-file reference 这类跨区域状态同步必须可延迟、可合并，不能阻塞 editor click/cursor 热路径。
- 编辑态 AI annotation 入口必须收敛到底部当前文件上下文栏，不得在 editor body 顶部额外插入 sticky toolbar；当前文件栏应保持低噪声，不再暴露 `路径已关联 / 路径已关闭` 这类 footer 切换按钮。
- Windows 与 macOS 必须作为同级目标平台处理：path normalization、case sensitivity、separator、scroll/event 行为和外部文件监控都需要兼容证据。
- 不改变 Rust/Tauri 文件读取命令的外部 API，除非后续实现发现必须扩展并另行在 design/tasks 中标记。

## 非目标

- 不重写 engine realtime reducer、conversation assembler 或 message streaming contract。
- 不把所有 Markdown 都降级为纯文本。
- 不引入新的虚拟滚动库；继续使用项目已有的 `@tanstack/react-virtual`。
- 不改变文件保存、dirty/conflict 的用户语义。
- 不扩大到通用 app-wide scheduler 或新 EventBus。
- 不在本 change 中处理无关 UI 视觉重设计；footer 收敛只覆盖当前文件上下文栏和 editor annotation affordance，不重做全局按钮系统。
- 不删除 Composer active-file reference 的发送/注入语义；本 change 只移除 FileViewPanel footer 中的路径状态切换 UI。
- 不重做 hover preview、structured preview、PDF/tabular/document preview 的产品交互；但这些 secondary preview surfaces 不得重新引入无边界的全文 split/highlight/parse。

## What Changes

- 新增文件打开渲染调度能力：把 file session、document snapshot、render model、viewport projection、scheduled commit 分层。
- 新增 snapshot metadata boundary：文件读取后生成带版本号的 stable snapshot，集中维护 `contentHash`、`byteLength`、`lineCount`、line offset/index，并为 code/Markdown/structured/secondary preview 提供 bounded line access。
- 对 code preview 做 viewport-bounded rendering，避免 `content.split("\n")` 后全量 `highlightLine` 和全量 DOM row mount。
- 对 FileTreePanel 做 visible-row virtualization，替代展开目录的递归全量 DOM 渲染。
- 对 Markdown preview 做调度化改造：已有 compile/block/heavy-block 架构继续保留，但 progressive rendering 和 heavy blocks 不得在 engine streaming 时按固定 16ms 抢帧。
- 对外部文件同步做 snapshot gating：clean disk update 默认进入 pending/stable refresh 语义，不能在高负载前台场景下直接重建高成本 preview DOM。
- 对多文件 tab 明确 active-only high-cost contract：open tabs 保存路径和轻量状态，非 active tab 不得预读/预渲染高成本内容。
- 对 scheduled render work 引入 `snapshotVersion` / `renderEpoch` / cancellation contract：切 tab、切文件、外部刷新、unmount 后的后台 highlight、Markdown chunk、heavy block、external refresh 不得提交到错误视图。
- 对 editor line-range tracking 引入 local-first / delayed global publish contract：文件面板内部立即更新当前行号和 AI annotation 工具条，Composer/context ledger 只消费合并后的低优先级 range。
- 对 editor annotation affordance 做回归收敛：移除 editor body 顶部 annotation toolbar，把 `标注给 AI` 放入底部当前文件栏；移除 footer 路径状态切换按钮与内部按钮边框，保持文件阅读/编辑区域不被额外 toolbar 挤占。
- 对 CodeMirror editor annotation widgets 明确排序 contract：已有 marker 与 draft 必须按 target line / side / insertion order 加入 RangeSet，避免 draft 位于已有 marker 前方时触发 `Ranges must be added sorted` runtime crash。
- 让 `FilePreviewPopover` 与 structured preview 复用 bounded model 或进入 low-cost fallback，避免 hover / secondary surfaces 成为新的卡顿入口。
- 为文件打开后卡顿建立 file-specific 性能证据：大 code 文件、大 Markdown、大目录、外部同步、editor split + engine streaming 必须有 before/after 或明确 unsupported evidence；通用 long-list evidence 只能作为 proxy，不得替代 file-open evidence。

## Capabilities

### New Capabilities

- `file-open-rendering-scheduler`: 文件打开后的 session、document snapshot、render model、viewport projection 和 foreground/background rendering 调度契约。

### Modified Capabilities

- `file-view-rendering-runtime-stability`: 扩展大型 code/Markdown/structured preview 的 bounded rendering、stable snapshot 和 engine streaming 期间的被动调度要求。
- `filetree-multitab-open`: 扩展多 tab 打开后的 active-only 高成本渲染契约，确保多文件打开不导致后台 tab 预渲染。
- `architecture-cross-platform-compatibility`: 扩展文件渲染调度重构的 Win/Mac path、scroll、event、external monitor 兼容证据要求。

## Impact

- Frontend affected areas:
  - `src/features/app/hooks/useGitPanelController.ts`
  - `src/features/files/hooks/useDetachedFileExplorerState.ts`
  - `src/features/files/hooks/useFileDocumentState.ts`
  - `src/features/files/hooks/useFileExternalSync.ts`
  - `src/features/files/hooks/useFilePreviewPayload.ts`
  - `src/features/files/utils/fileRenderProfile.ts`
  - `src/features/files/utils/fileMarkdownDocument.ts`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/components/FileViewBody.tsx`
  - `src/styles/file-view-panel.css`
  - `src/styles/file-view-panel.footer.css`
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/features/files/components/FilePreviewPopover.tsx`
  - `src/features/files/components/FileStructuredPreview.tsx`
  - `src/features/files/components/FileTreePanel.tsx`
  - `src/features/composer/components/Composer.tsx` contract surface for active-file reference consumption
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
- Specs / validation affected areas:
  - OpenSpec specs for file rendering stability, file tree multi-tab behavior, and cross-platform compatibility.
  - Focused Vitest suites for file view, external change sync, file tree, and multi-tab behavior.
  - Existing perf evidence scripts where available, with explicit proxy/unsupported classification where browser/Tauri evidence is unavailable.
- Dependencies:
  - No new dependency planned.
  - `@tanstack/react-virtual` is already present and should be reused.
- Platform:
  - macOS local validation is expected in the current environment.
  - Windows validation must be recorded as measured evidence when available, or explicitly listed as a residual gap before archive.
