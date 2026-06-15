# frontend-prop-chain-stability

> Follow-up change to [`realtime-input-and-io-isolation-2026-06`](../realtime-input-and-io-isolation-2026-06/).
> 后者已落地 Rust 端 telemetry / reducer fast path / backend file I/O isolation / app server event batching / external change debouncer,但**frontend 端消费 batch channel 与 React shell domain context 拆分**留到本 change。

## Why

实时会话期间用户可观察的卡顿（输入顿挫、切换会话/模块卡、打开保存文件卡）的最后一公里在 React 端。`realtime-input-and-io-isolation-2026-06` 切断了 source event 与 Tauri runtime 的传播链（事件已 batch、I/O 已隔离、watcher 已 debounce），但 batched event 抵达 webview 后：

- `useAppServerEvents` 需要把 batch channel 当作 routing unit；否则 IPC 虽减少、JS route 成本仍会被同步 tight loop 放大；
- `useFileExternalSync` 仍按单事件触发 refresh，100ms 窗口的合并没在 frontend 端消费；
- `appShellContext` 是 200+ key 的单一对象字面量，被 spread 到 4 个 section hook + `renderAppShell`，streaming 状态（`threadItemsByThread` / `tokenUsageByThread` / `activeTurnId` 等）变化会带动所有 hook 重新求值；
- `Sidebar` / `ThreadList` 接收全局 `threadStatusById` map 作为每行 prop，map 变化会让整列 rerender。

本 change 不再做"巨型 useMemo 压 lint"——spec 明确禁止 deps 白名单。正确修法是按 domain 拆分 + 收窄 row 状态传播 + 在 batch 通道上做 budgeted flush。

## Capability Specs Affected

- 新增: `frontend-prop-chain-stability`（capability 来自父 change 的 spec delta，本 change 独立 carry）

## Out Of Scope

- **不**改 Rust 端任何代码。
- **不**在 `realtime-input-and-io-isolation-2026-06` 里加新功能，本 change 是纯前端消费 + shell 拆分。
- Sidebar virtualization 不在本 change（spec 明确：virtualization 由 evidence gate 决定，单开 follow-up change）。
- Composer 拆分（2465 行组件）不承接。

## Proposed Solution

按 design §1-§3 顺序，分 4 块独立可交付子任务：

### 1. Batch-aware `useAppServerEvents` route（最高 leverage）

将 `useAppServerEvents` 中 1000+ 行的 `useEffect` 回调提取为命名函数 `dispatchAppServerEvent(handlers, payload)`，并在 useEffect 里互斥订阅 `subscribeAppServerEvents`（single fallback）或 `subscribeAppServerEventBatch`（preferred）。Frontend runtime 决定主路径：默认 batch，`localStorage` flag `appServerEventBatch=0` 时回退 single；Rust backend 的 `CCGUI_APP_SERVER_EVENT_BATCH` 是独立 backend flag。

关键约束：
- 命名函数必须能同时被 batch loop（`for (const p of batch) dispatchAppServerEvent(h, p)`）和 single callback 调用。
- 命名函数对 closure 变量的所有引用必须改成显式参数或 `handlersRef.current`。
- 不在 batch 循环里同步重算 diagnostics（用 existing `noteThreadAppServerEventReceived` 已按 method 缓存，OK）。
- reducer dispatch 通过 `realtimeEventBatcher` 已存在的 frame budget 通道，不退化。

### 2. Batch-aware `useFileExternalSync`（次高 leverage）

订阅 `subscribeDetachedExternalFileChangeBatch`，按 `(workspace_id, normalized_path)` 做 in-flight coalesce + generation stale-drop。保留 single 通道仅作 fallback（env 变量切换）。

### 3. App shell domain context 拆分

`appShellContext` 的 200+ key 按职责划为 6 个 domain object：

| Domain | 包含的 key 类别 | 主要消费者 |
|---|---|---|
| `runtimeThreadContext` | `threadItemsByThread` / `tokenUsageByThread` / `activeTurnId` / `activeItems` / `activeQueue` / `activeRateLimits` 等 streaming state | `useAppShellSections` (核心 routing) + `useAppShellSearchAndComposerSection` |
| `workspaceNavigationContext` | `workspaces` / `workspacesById` / `activeWorkspace` / `activeWorkspaceId` / `workspaceGroups` 等导航 state | `Sidebar` / `useAppShellSections` (workspace-level) |
| `composerContext` | `composerInputRef` / `composerEditorSettings` / `activeDraft` / `setComposerInsert` 等 | `useAppShellSearchAndComposerSection` / `useAppShellKanbanComposerSection` |
| `layoutContext` | `sidebarCollapsed` / `sidebarWidth` / `terminalOpen` / `terminalPanelHeight` / `editorSplitLayout` 等 | `useAppShellLayoutNodesSection` / `renderAppShell` |
| `fileEditorContext` | `activeEditorFilePath` / `activeEditorLineRange` / `files` / `fileTreeSourceVersion` 等 | `useAppShellLayoutNodesSection` (file panel) / file tree components |
| `settingsContext` | `appSettings` / `accessMode` / `effectiveModels` / `collaborationModes` 等 app-level settings | `useAppShellViewStateSection` / `useAppShellWorkspaceFlowsSection` |

拆完后：
- `useAppShellLayoutNodesSection` 收到的 options 只含 `runtimeThreadContext`（必要时）+ `layoutContext` + `fileEditorContext` 三个 domain，不再传完整 200+ key。
- `useAppShellSearchAndComposerSection` 只收 `runtimeThreadContext` + `composerContext` + `settingsContext`。
- `useAppShellSections` 收所有 6 个 domain（它是 dispatcher），但 6 个域对象各自独立稳定。
- `renderAppShell` 收所有 6 个 domain + 各 section 的返回值。

严禁 `useMemo(() => ({...}), [whiteList])` 这种 deps 漏写压 lint 的写法。每个 domain 对象的引用稳定性靠"上游 hook 的输入就是稳定 reference"（如 `threadItemsByThread` 是 reducer state 引用，change 时才换；`activeWorkspace` 是 derived value 但只在 activeWorkspaceId 变时变）—— 而非靠 useMemo 压。

### 4. Sidebar / ThreadList row-level status lookup

`ThreadRowItem` 已经 memo 包裹。把 `threadStatusById` 从 props 列表里抽掉，row 自己通过 `useThreadRowStatus(threadId)` 这类 hook / selector 拿自己的状态。Global map 变化时，row 自己判断"我的 key 是否变了"，没变就不 rerender。

### 5. Evidence gate 真实值

把父 change 留下的 5 个 `unsupported` summary 字段（`prepareThreadItems_calls_per_1000_delta` / `file_io_command_wall_ms_p95` / `app_server_event_raw_per_sec` / `fs_event_raw_per_sec` / `composer_render_count_per_streaming_minute` 等）从 Profiler API / runtime instrumentation 收集真实值。

具体路径：
- reducer 计数：在 `useThreadsReducer` 里加 `__profile` 计数器，Vitest fixture 跑 1000-delta 流，导出为 perf artifact。
- React 渲染计数：用 `react/profiler` 包关键 component（Composer、Sidebar、Layout），从 Profiler onRender callback 累加。
- Tauri command wall time：Rust 端 `Instant::now()` 测 command duration，写入 `app_server_event_route_ms_p95` 同类 channel。
- file I/O wall time：Rust 端 `run_blocking_file_io` 内加 `Instant::now()`，写入专用 metric。

## Validation / 验收

- `openspec validate frontend-prop-chain-stability-2026-06 --strict --no-interactive`
- 父 change 的 5 个 evidence gate 字段从 `unsupported` → 真实 `proxy` / `measured`
- **本轮校准落地的 §1 / §2 互斥订阅与 batch route 修正**：working tree 校准时发现 useAppServerEvents / useFileExternalSync 原本实现是"同时订阅 single + batch"（与 design §1.1 / §2.2 不符），已改为 `isAppServerEventBatchConsumerEnabled()` 决定主路径、互斥分支，single 仅作 fallback。`useFileExternalSync` batch 入口已按 `(workspaceId, normalizedPath)` latest-wins coalesce 后再进入既有 in-flight / stale-drop path。`useAppServerEvents` 已完成 shared dispatcher + 互斥 batch channel consumer + `dispatchAppServerEventBatch`：连续状态快照事件 latest-wins coalesce，append-only delta 不合并并进入既有 realtime buffer，batch route 按 FIFO chunk 切片调度，避免大 batch synchronous tight loop 和连续 batch interleaving。
- `composer_render_count_per_streaming_minute` < 600（实测 baseline 1800）
- `sidebar_render_count_per_streaming_minute` < 60
- `thread_row_rerender_count_per_1000_delta` < 200
- `layout_nodes_recompute_count_per_1000_delta` < 50
- 1000-delta burst fixture: `prepareThreadItems_calls_per_1000_delta` 严格 0（fast path 完整覆盖）
- `npm run typecheck` / `lint` / `test` / `cargo check` / `cargo test --lib` 全部通过
- 手动 QA calibration：开 2 个 codex session 观察 5 分钟；当前结论为 jank 减轻但仍存在，因此本 change 只可标记 task-complete，不可直接标记 archive-ready；后续由 `calibrate-performance-iteration-debt` 收口证据与残余技术债。

## Serial Position

- **Predecessor**: `realtime-input-and-io-isolation-2026-06` (merged)
- **Successor**: Sidebar virtualization（独立 change, evidence-gated）；Composer 2465 行拆分（独立 change, design-only）
