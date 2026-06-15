# realtime-input-and-io-isolation

## Why

用户观察到的现象是同一类问题的不同表面：实时会话运行时，新开会话输入、切换会话、切换模块、打开/保存文件都会出现顿挫。基于代码扫描，这不是单点 UI 组件问题，而是 realtime event、local file I/O、React shell prop chain、file watcher refresh 四条高频链路互相争抢主线程和 Tauri runtime budget。

本 change 的目标不是“一次性重写客户端”，而是先把最容易被证据证明、最可能放大卡顿的 root cause 收口：

- realtime delta 热路径中，`appendAgentDelta` 的 fast path 当前只允许 `claude:`，`codex:` / `gemini:` / `opencode:` 在 streaming 期间仍可能反复触发 `prepareThreadItems`。
- `app-server-event` 目前是单事件 emit + 单事件 frontend route；即使 frontend 后续有 backpressure，IPC 和 route 成本仍会随事件数量线性放大。
- local workspace / external spec / external absolute file read-write 仍有多条同步 `std::fs` 路径运行在 Tauri async command 上下文，需要移入 blocking pool。
- `external_changes` 目前没有 batch/debounce；虽然它的 signature metadata 已使用 `tokio::fs::metadata`，但单事件 emit 和前端 refresh 仍会在文件风暴下放大卡顿。
- `appShellContext` / `useLayoutNodes` / Sidebar / ThreadList 存在大范围 prop/state 传播，streaming 状态容易让无关模块被动重渲。

> 🛠 **深度推演**：根因不是“资源不够”，而是隔离边界不清。实时会话、文件 I/O、watcher、导航 UI 现在共享过多调度面：事件源端不 batch，I/O 不隔离，React state 传播不分区。正确修法是先加可观测性，再分别切断 event、I/O、render 三条传播链。


## Implementation Status (本 change 实施范围)

本 change 按 design §6 顺序实施 5 个 step,实际完成度如下:

| Step | 范围 | 完成度 | 备注 |
|---|---|---|---|
| 1 | Telemetry: 5 个 evidence gate summary 字段 | ✅ 完成 | `scripts/generate-runtime-evidence-report.mjs` 新增 5 个 builder + report 挂载 + markdown 章节;初次跑产出字段 `unsupported`(符合 evidence first 语义) |
| 2 | Reducer hot path: 解除 `claude:` 硬编码 + 4 引擎等价性测试 | ✅ 完成 | `threadReducerCoreHelpers.ts:101` 移除 `threadId.startsWith("claude:")`;新增 `useThreadsReducer.append-agent-delta-fast-path.test.ts` (8 tests, all pass),覆盖 codex/gemini/opencode fast path + slow path fallback + 1000-delta burst |
| 3 | Backend file I/O isolation: file command surface 包装 `run_blocking_file_io` | ✅ 完成 | `workspaces_core.rs` 新增 `run_blocking_file_io` helper;core read/write/create/trash/copy/duplicate/paste/rename + `paste_external_workspace_items_core` 走 helper;`commands.rs` external/absolute read-write + preview handle 路径走 helper;`cargo check` 通过 |
| 4 | App server event batching (Rust side) + frontend channel 暴露 | ✅ 完成 | Rust 端 `BatchedTauriEventSink` + `AppServerEventSink` enum + `build_event_sink(app)` 已实现,通过 env var `CCGUI_APP_SERVER_EVENT_BATCH` 切换;3 处 caller (codex session / terminal / settings reconnect) 已切到 `build_event_sink`;Rust flush 现在按 workspace 分批 emit,terminal event 立即 flush 本 workspace;frontend follow-up 已完成互斥 batch consumer + shared dispatcher + `dispatchAppServerEventBatch`，状态快照事件 latest-wins coalesce，append-only delta 保序进入既有 realtime buffer，并按 chunk 切片调度 |
| 5 | File watcher debounce (Rust side) + frontend channel 暴露 | ⚠️ 部分 | Rust 端 `DebouncedExternalChangeEmitter` + 100ms 窗口合并 + VecDeque 保序已实现;3 处 caller 走 `debounced_emitter(app).await.submit(...)`;本轮校准修了一个真实 bug:flush 时 `mem::take` queue 后未清 `by_key`,导致同 key 跨 flush 事件被 `if let Some(slot)` fall-through 静默丢弃;新行为是 flush 同时清 `by_key`,同 key 跨窗口起新 coalesce cycle;新增 4 个 inline `#[cfg(test)]` (same-path coalesce / cross-path delivery / cross-flush regression / no empty emit);frontend follow-up 已完成互斥 batch consumer + batch 入口 latest-wins coalesce |
| 6 | React shell domain split (frontend prop chain stability) | ❌ 转入 A4 follow-up change `frontend-prop-chain-stability-2026-06` | 不在本 change 实施范围;`frontend-prop-chain-stability` spec delta 保留供 follow-up 消费 |

### Follow-up Change

本次 change 实际落地 Step 0-4 (Rust 端);frontend 消费 + Step 5 走 **A4 follow-up change** `frontend-prop-chain-stability-2026-06`(planned 2026-06-12 当天或之后另开 change,本 change 不带其产品代码改动)。本 follow-up change 需要做的事:

1. 拆分 `appShellContext` 为 `runtimeThreadContext` / `workspaceNavigationContext` / `composerContext` / `layoutContext` / `fileEditorContext` / `settingsContext` 6 个 domain context(spec § frontend-prop-chain-stability 已经定义完整)
2. `useAppServerEvents` 优先订阅 `subscribeAppServerEventBatch`,当前已完成 shared dispatcher + 互斥 consumer + batch route coalesce / chunked dispatch；Rust sink 已补 per-workspace drain / terminal flush / env fallback tests；后续仍需跑 perf evidence
3. `useFileExternalSync` 优先订阅 `subscribeDetachedExternalFileChangeBatch`,在 batch 入口按 `(workspaceId, normalizedPath)` latest-wins coalesce 后再进入既有 handler + in-flight / stale-drop path
4. `Sidebar` / `ThreadList` 收窄 `threadStatusById` 传播为 row-level status lookup
5. evidence gate 字段从 `unsupported` → 真实值(运行时 Profiler 计数 / fixture 跑数)

预计工作量 1-2 周(单 agent 串行)或 4-5 worktree agent 并行(每个 domain 1 个 + 1 个 batch route 接入)。

### Why Not Domain Split Now

按 design §5.2,本 change 若做"巨型 `useMemo` + deps 白名单"会被 spec 明确禁止(deps 白名单 stale closure 风险高);真正符合 spec 的"6 个 domain context 拆分"已在 A4 follow-up change `frontend-prop-chain-stability-2026-06` 里规划,本 change 不再承接。其余工作:
- 改 `appShellContext` 全部 200+ key 的归属
- 改 `useAppShellSections` / `useAppShellLayoutNodesSection` / `useAppShellSearchAndComposerSection` / `useAppShellComposerModelSection` / `useAppShellKanbanComposerSection` / `useAppShellKanbanExecutionSection` / `useAppShellPromptActionsSection` / `useAppShellSearchRadarSection` / `useAppShellViewStateSection` / `useAppShellWorkspaceFlowsSection` 10+ hook 的入参形态
- 改 `app-shell.tsx` 的整个组装逻辑
- 加 exhaustive-deps 测试覆盖每个 domain context 的引用稳定性

这个工作量在 1 周左右,且会触碰 **P0 风险的 client stability surface**。本 change 的 Step 1-5 已经把"事件源端"、"I/O 隔离"两条主链 root cause 收口,让既有 `renderer-resource-backpressure` / `backend-io-cache-and-bridge-payload-budget` / `workspace-tree-and-large-file-listing-budget` / `composer-and-message-row-render-budget` / `markdown-off-main-thread-pipeline` 等 change 的"消费端背压 + 渲染预算"收益不再被生产端打折扣。**Step 6 domain split 是这层收益落地后的进一步优化**,作为独立 follow-up change 比塞进本次更安全。

### Validation Gate Before Follow-up

`npm run perf:realtime:boundary-guard` / `npm run perf:realtime:extended-baseline` / `npm run check:runtime-evidence-gates` 在 follow-up change 开始前必须先跑一次,记录 Step 1-5 实施后的真实 baseline。follow-up change 完成后用同一命令对比 evidence gate 字段 `unsupported → measured` 的转换,验证"6 个 domain context 拆分"真的减少了无关模块的 React 渲染。


## Code Facts / 现状事实

### 1. `appendAgentDelta` fast path 仍被 `claude:` 前缀限制

`src/features/threads/hooks/threadReducerCoreHelpers.ts` 中 `canUseLiveAssistantDeltaFastPath` 当前包含 `threadId.startsWith("claude:")`。`src/features/threads/hooks/useThreadsReducer.ts` 的 slow path 会调用 `prepareThreadItems(...)`，而 `src/utils/threadItems.ts` 的 `prepareThreadItems` 不是轻量 scan，它包含 coalesce、filter、anchor、history normalize、summary/truncate 等多段处理。

### 2. `app-server-event` 未使用既有 event backpressure

`src/services/events.ts` 中 `appServerHub = createEventHub<AppServerEvent>("app-server-event")`，而 terminal/runtime log channel 已经接入 `createEventBackpressure`。这说明 backpressure substrate 已存在，但 app server event 仍未接入。

### 3. Tauri event sink 当前每个 app server event 一次 `app.emit`

`src-tauri/src/event_sink.rs` 的 `TauriEventSink::emit_app_server_event` 直接 `self.app.emit("app-server-event", event)`。这会让 Tauri IPC、webview listener、JS route、reducer dispatch 以事件数线性增长。

### 4. `external_changes` 缺的是 debounce/batch，不是 metadata 同步 I/O

`src-tauri/src/workspaces/external_changes.rs` 的 signature metadata 使用的是 `tokio::fs::metadata(path).await`，不能把它描述成 `std::fs::metadata/read_dir` 同步阻塞路径。真实问题是 `emit_external_change_event` 单事件 emit，三处 caller 直接发送，没有 debounce/batch；前端 `useFileExternalSync` 虽有 in-flight/queued refresh 保护，但仍按单事件触发 refresh 调度。

### 5. 本地 file command 仍有同步 `std::fs` 路径

`src-tauri/src/shared/workspaces_core.rs` 的 `read_workspace_file_core` / `write_workspace_file_core` / `create_workspace_directory_core` / `trash_workspace_item_core` 在 resolve root 后直接执行调用方传入的同步闭包，没有 `spawn_blocking`。

`src-tauri/src/workspaces/commands.rs` 还存在不经过这些 core helper 的 external spec / external absolute read-write 路径，以及 copy/duplicate/preview handle 等路径。I/O 隔离必须覆盖 command surface，而不是只改 4 个 core helper。

### 6. `cc_gui_daemon` 不是本 change 的直接解法

`src-tauri/src/web_service/daemon_bootstrap.rs` 只在 configured remote host 是 loopback 时启动 local daemon。默认本地模式仍由主 Tauri 进程处理 file command。本 change 不改变 daemon 启动策略，只修主进程 local path 的 I/O 隔离。

### 7. React shell 存在大对象传播和列表重渲风险

`src/app-shell.tsx` 构造了巨大的 `appShellContext`，并将其传给多个 section hook。`src/app-shell-parts/useAppShellLayoutNodesSection.tsx` 传给 `useLayoutNodes` 的 options 也是大对象。`Sidebar` / `ThreadList` 没有 virtualization，且 `threadStatusById` 等全局 map 变化可能让整列重渲。这里不能靠一个巨型 `useMemo` 解决，必须按 domain 拆分 context 和 selector。

## Problem / 问题

- realtime streaming 时打字卡：event route + reducer flush + React shell 传播一起挤占 main thread。
- 切换会话/模块卡：顶层 active state 变化后，大 context 和 layout options 重建，Sidebar/Composer/Editor 等无关区域容易被带着 reconcile。
- 打开/保存文件卡：local file command 中同步 `std::fs` 没有完整隔离到 blocking pool，遇到大文件或慢磁盘时会占用 async runtime worker。
- watcher 事件风暴卡：external file change 单事件 emit 和前端 refresh 调度缺少源端合并。
- 原提案风险：把若干事实写错或写得过粗，会导致实现时改错地方，例如改 `external_changes` metadata I/O、写不存在的 Rust `.test.rs` 文件、backend batch 后 frontend 仍逐个同步 dispatch。

## Proposed Solution / 提案方案

本 change 保留 5 个 capability，但重新定义实施顺序和验收口径：

1. **`realtime-input-render-budget`**：先加 evidence，再解除 `appendAgentDelta` 的 `claude:` fast path 限制；用等价性测试证明 codex/gemini/opencode 不破坏 final metadata、canonicalize、reasoning/tool/image anchor 场景。
2. **`backend-file-io-isolation`**：覆盖 local workspace、external spec、external absolute、preview handle、trash/copy/duplicate 等 file command surface；同步 `std::fs` 闭包必须进入 `spawn_blocking` 或统一 blocking helper。不要把 `external_changes` 的 `tokio::fs::metadata` 当作 blocking I/O 修。
3. **`file-change-event-debounce`**：在 Rust watcher emit 端按 `(workspace_id, normalized_path)` debounce/batch，并在前端 refresh 层做 stale-drop / in-flight coalesce；保留单事件兼容但避免双订阅重复处理。
4. **`app-server-event-batching`**：Rust 端 batch 只是第一步；前端必须有 batch-aware route、coalesce、budgeted reducer flush，不能简单 `forEach` 同步打回原 handler。
5. **`frontend-prop-chain-stability`**：避免“巨型 `useMemo` + deps 白名单”这种 stale closure 高风险做法；改为 domain context 拆分、selector/local subscription、Sidebar/ThreadList 状态作用域收窄，virtualization 作为后续独立优化。

## Capability Specs Affected

- 新增: `realtime-input-render-budget`
- 新增: `backend-file-io-isolation`
- 新增: `file-change-event-debounce`
- 新增: `app-server-event-batching`
- 新增: `frontend-prop-chain-stability`

## Out Of Scope / 非本 change 范围

- 不把 `cc_gui_daemon` 改成本地默认。
- 不重写 Composer 2465 行组件。
- 不在本 change 内完成 Sidebar virtualization，但需要为其保留后续接口空间。
- 不改变 OpenSpec/main spec 归档策略。

## Serial Position

- **Step**: P1 root-cause isolation proposal。
- **Predecessor**: 无硬依赖，但实施时应先落 telemetry/evidence，避免无证据重构。
- **Successor**: Composer 拆分、Sidebar virtualization、daemon local default、workspace tree/listing budget 等独立 change。
