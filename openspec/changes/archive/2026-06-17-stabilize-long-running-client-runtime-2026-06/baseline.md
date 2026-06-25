# Baseline / Inventory (Phase 0.1 / 0.2)

> 状态:与 `chat-stream-render-isolation-2026-06` 衔接的残余工作量 baseline。所有 metric 都标注 measured / proxy / manual-only / unsupported。

## 0.1 当前代码事实(基线)

| 维度 | 现状 | 证据 | Evidence class |
|---|---|---|---|
| Engine child process ownership | `ClaudeSession` 有 `impl Drop`(非阻塞 `try_lock` + `start_kill`);`OpenCodeSession` / `GeminiSession` 都有 `active_processes: Mutex<HashMap<String, Child>>`,但**没有同等级 Drop** | `src-tauri/src/engine/claude.rs:70`,`opencode.rs:44,148`,`gemini.rs:68,88` | measured |
| `get_engine_active_process_diagnostics` | Tauri command 已存在,目前**只覆盖 Claude workspace rows**;`build_engine_active_process_diagnostics` 排序 + 计数逻辑齐全;frontend wrapper 在 `src/services/tauri.ts:2231` | `src-tauri/src/engine/commands.rs:1087-1120`,`src/services/tauri.test.ts:2564` | measured |
| `EngineActiveProcessDiagnostics` 响应体 | `measured` / `sampledAtMs` / `totalActiveProcessCount` / `workspaces` / `unsupportedReason`;每行 `workspaceId` + `engine` + `activeProcessIds` | `src-tauri/src/engine/commands.rs:38-60` | measured |
| HomeChat workspace picker | 直接 `filteredWorkspaces.map(...)` 全量渲染,key 用 `workspace.id`;无 virtualizer | `src/features/home/components/HomeChat.tsx:94-99,202-228` | measured |
| ThreadList 渲染 | `displayedPinnedRows.map` + `displayedUnpinnedRows.map` 全量渲染;`ThreadRowItem` 用 `memo`;无 virtualizer;`threadStatusById` 仍通过 `ThreadRowStatusProvider` 注入 | `src/features/app/components/ThreadList.tsx:618-621`,`threadRowStatusStore.tsx` | measured |
| Sidebar 渲染 | 含 workspace header / pinned / unpinned / folder / worktree / separator / load-more 等混合节点;`.map` 全量渲染;无 virtualizer | `src/features/app/components/Sidebar.tsx:1602-1761` | measured |
| `fastMarkdownRenderer` worker | `workerAdapter.ts` 已有 `pendingRequests` map / `disposeFastMarkdownWorker` / `rejectAllPendingRequests`;`useFastMarkdownRender` 用 `requestOrdinalRef` 守护 stale;无显式 diagnostics counter | `src/features/markdown/fastMarkdownRenderer/workerAdapter.ts`,`useFastMarkdownRender.ts:67-72` | measured |
| `chat-stream/*` diagnostics | 已存在;`Messages` reducer fast path / 6 in-flight refs / local timer cleanup 都已闭环 | (proposal 中指明) | measured |
| Engine manager access | `opencode_sessions` / `gemini_sessions` 是 manager 私有字段;无 `list_*_sessions` 公开方法(只有 `get_*_session`) | `src-tauri/src/engine/manager.rs:32,35,265-318` | measured |
| Engine 进度元数据 | Claude 有 `ClaudeStreamTiming`;OpenCode / Gemini 没有类似结构化 progress 字段 | `src-tauri/src/engine/claude.rs:107-130` | measured |
| Codex runtime | `codex_app_server`/`codex_chat_canvas_*` 等已有独立 wrapper,本 change 不强行塞入统一 Child map | `src-tauri/src/engine/codex_adapter.rs`,`codex_prompt_service.rs` | measured |
| 第三方库 | `@tanstack/react-virtual` 已安装并被 `FileTreePanel` / `GitHistoryPanelImpl` / `GitDiffViewer` / `MessagesTimeline` 等使用 | `package.json`,多文件 import | measured |
| 长任务 perf script | `scripts/perf-reproduce-jank.sh`、`npm run perf:long-list:baseline`、`npm run perf:realtime:runtime-report` | proposal reference | measured |
| OS process sampling | 仓库**没有**跨平台 OS 进程采样 helper(无 `ps`/`/proc`/Windows API 调用),OS 进程 liveness 只能走 `unsupported` / `manual-only` | `rg -l "libc::|sysinfo|/proc" src-tauri/src/` (无匹配) | manual-only |

## 0.2 Do-Not-Duplicate Checklist(与 `chat-stream-render-isolation-2026-06` 边界)

下面这些**已闭环**,本 change 不重做:

- [x] `Messages` reducer fast path for streaming completion/upsert
- [x] `MessagesTimeline` streaming virtualization
- [x] workspace-scoped 6 in-flight refs(`workspace-scoped transient refs`)
- [x] `Messages` local transient timer cleanup
- [x] `chat-stream/*` diagnostics for eviction/timer cleanup/complexity cache

下面这些**显式 out of scope**(留作 `task 6.x` follow-up,本 change 不实现):

- [ ] 全局 timer owner registry / idle scheduling(交给 `renderer-resource-backpressure`)
- [ ] image viewport release / `convertFileSrc` proxy 资源释放(交给 `image-resource-release`)
- [ ] `useThreadEventHandlers` 内部拆分(交给 `handler-stability`);`useAppServerEvents(handlers, options)` public signature 不动
- [ ] release-grade measured closure(proxy 数据外,真实 Tauri/WebView trace 留给 `release-grade-evidence`)

## 0.1 Evidence Class 注册

本 change 的 evidence gate 报告需要明确四类:

- `measured` — 来自真实 Tauri/WebView trace 或单元测试断言
- `proxy` — 来自 jsdom 单元测试、静态 fixture 计数、合成 worker 测试
- `manual-only` — 来自手测或半自动脚本
- `unsupported` — 平台/工具链无能力,需在 `proxy-evidence-unsupported.md` 中给出 bounded rationale

## 0.2 平台限定(写在证据报告里)

- 仓库当前 macOS 开发环境(macOS 15)
- `bash scripts/perf-reproduce-jank.sh` 15-30min long-run trace 在 macOS 上跑
- Windows / Linux OS process liveness 当前**unsupported**,因为仓库无跨平台采样 helper
