# Parallel Conversation Runtime Residuals

本文件适用于所有「多 session 并行对话」相关代码:`src/features/threads/hooks/useThread*.ts`、`useThreadEventHandlers.ts`、`useThreadsReducer.ts`、`useThreads.ts`、`useAppServerEvents.ts`、`src/features/messages/components/Markdown.tsx`、`LiveMarkdown.tsx`、`Messages.tsx`、`src/features/home/components/Home.tsx` / `HomeChat.tsx`、`src/services/eventBackpressure.ts`、`src/features/threads/utils/realtimePerfFlags.ts`、`src/services/mediaResourceOwners.ts`、`src/components/common/LocalImage.tsx`、`src-tauri/src/engine/claude.rs`、`src-tauri/src/engine/opencode.rs`、`src-tauri/src/engine/gemini.rs`、`src-tauri/src/event_sink.rs`。

## Scope / Trigger

- Trigger:实现或修改并行多 session 实时对话的事件流、reducer、渲染、计时器、子进程管理、媒体资源释放路径。
- 目标:把"客户端并行对话随时间变卡"分解为 7 条独立根因,每条对应可验证的诊断信号、修复方案、回归测试。

## Why This Exists

- 2026-06 用户报告"多 workspace 并行跑 15 分钟后,切 workspace 响应变慢、输入延迟上升、Heap 增长"。当前结论是 7 个 runtime residual 风险需要逐项复现,不能把未量测的假设写成已确认根因。
- 已有 P1 提案(`c27bb18a` / `7cc4a284` / `25d101a0` / `a8bd4b24` / `f7ae0a99`)落地了 realtime batching / no-op guard / incremental derivation / background render gating 等保护,但**这些保护在 default 状态全开,一旦被关掉就放大对应症状**;`ccgui.perf.*` 开关在 `localStorage` 读取且非 test 模式 cache,当前无统一 UI/debug 重置入口。
- `ClaudeSession` 没有 `impl Drop`;虽然正常完成、setup failure、disposed startup、interrupt、session removal 已有显式清理路径,但最后一个 `Arc<ClaudeSession>` drop 时仍缺 child 兜底 kill。OpenCode/Gemini 同类 `active_processes` 也必须纳入后续审计。
- 7 条根因详见 `docs/perf/parallel-conversation-jank-handbook.md` §3 速查表;本 guide 沉淀"写新代码时如何避开这些坑"与"修改相关路径时如何回归验证"。

## Core Invariant

并行多 session 实时对话运行时,**以下 7 项不变量必须始终成立**:

1. **Child 进程有界**:任意时刻 `pgrep -f 'claude|opencode|gemini|codex' | wc -l` 不应随已结束 turn 单调增长;关闭所有 workspace 后 30s 内归零或报告明确的外部进程来源。
2. **优化开关可重置**:`ccgui.perf.*` 8 个开关的 default value 在 `realtimePerfFlags.ts` 顶部有 registry;Settings 面板有"Reset"按钮;`getActiveRealtimePerfFlags()` debug 入口可查。
3. **Progressive reveal 节奏合理**:pending < 140 字符短路直接 flush;长 turn 使用 `resolveAdaptiveProgressiveRevealStepMs`;`findProgressiveRevealBoundary` 8000 字符输入 < 1ms 或有 perf gate 记录例外。
4. **handlers 引用稳定**:`useThreadEventHandlers` 的 `streamingHandlers` / `lifecycleHandlers` / `diagnosticHandlers` 各自 useMemo rebuild 次数 ≤ 5/turn;基础设施 callback(`flushPendingRealtimeEvents` 等)引用恒等。
5. **长列表虚拟化**:Home/recent conversation/thread sidebar 中任何 100+ item surface 用 `useVirtualizer`;200 session 时 DOM 节点数 ≤ 20;`backgroundActivityByThread` 懒计算 + LRU cache(limit 200)。
6. **图片资源释放**:`LocalImage` 滚出视口时释放 decode-heavy `src`;workspace/session 切换时整组释放;`mediaResourceOwners` 或并行 registry 跟踪 `convertFileSrc` / data URL proxy diagnostics。
7. **Timer 有界**:`useThreads` 非紧急 timer 有统一 registry/diagnostics;5 workspace × 3 session 时 active timer proxy size < 20;非紧急 timer 优先走 `requestIdleCallback`;heartbeat/reconnect 加 ±20% jitter。

## Required Structure

任何并行多 session 实时对话相关的代码改动,**必须**包含:

- **诊断入口**:如果是状态相关(reducer / flag / timer),必须有可观测的 metrics / log / DevTools console 入口。
- **释放路径**:如果是资源相关(child process / blob URL / image / timer),必须有显式释放路径 + Drop / unmount 兜底。
- **回归测试**:单测 + 集成测试,断言"有界"或"已释放"或"已重置"。
- **Cross-platform**:Windows / macOS / Linux 三平台的行为差异(`taskkill` vs `killpg`、`URL.createObjectURL` 在 WebView2 行为)必须有对应测试或注释。

## When Adding New Real-Time Source

新增任何"实时事件源"(新的 backend event / 新的 Tauri command / 新的 WS / 新的 IPC)时:

- **必须**走 `app-server-event-batch` 通道(40ms 批),不绕过 `BatchedTauriEventSink`。
- **必须**在 `BatchedTauriEventState` 加 workspace 隔离(per-workspace `VecDeque`)。
- **必须**在 `useAppServerEvents` 路由,不在 `useThreads` 内直接 listen。
- 若新增的是可降级性能保护,**必须**加 `realtimePerfFlags` 开关(如 `isXxxEnabled`),默认值 `true` 生产,`false` test,且在文件顶部表格注释。
- **必须**评估是否复用 `eventBackpressure` 包装(`maxQueueDepth` / `rawRetainedLimit` / `coalesceKey` 视情况),不能直接新增无限 listener queue。

## When Adding New Reducer Case

新增 `useThreadsReducer` / `threadReducer*` case 时:

- **必须**保留 no-op guard 路径(unchanged state → 同一引用返回)。
- **必须**走 incremental derivation(只重建变化的 thread / workspace,不全量 map)。
- **必须**在 spec delta 里描述"什么 prop 变化触发 rebuild"。

## When Adding New Sidebar / List Rendering

新增任何侧栏 / 列表 / 表格组件时:

- 任何可能超过 100 items 的列表**必须**用 `@tanstack/react-virtual` 的 `useVirtualizer`。
- **必须**给每个 item 配 `key={item.id}`,不可以用 index。
- **必须**对衍生数据(背景态、token usage、rate limits)走懒计算 + LRU cache。

## When Adding New Timer / Interval

新增任何 `setTimeout` / `setInterval` / `requestAnimationFrame` 时:

- **必须**注册到统一 timer registry 或现有 owner ref,key 唯一,旧 key 先 clear,并提供 diagnostics proxy。
- **非紧急** timer 走 `requestIdleCallback` / `scheduler.postTask`,带 `setTimeout` fallback。
- **heartbeat / reconnect** 必加 ±20% jitter,防 thundering herd。
- **必须**在 useEffect unmount / deps 变化时 clear。

## When Adding New Image / Media Resource

新增任何 `URL.createObjectURL` / `convertFileSrc` / `<img>` / `<video>` 时:

- **必须**注册到 `mediaResourceOwners`(URL.createObjectURL)或扩展的 `trackConvertFileSrcUrl` / data URL proxy registry。
- **必须**配 IntersectionObserver,滚出视口时 `src = ''` 释放。
- **必须**在 workspace / session 切换时主动 release。
- **必须**加 `?cacheBust=<turnId>` 防止 WebView 复用旧资源。

## When Adding New Rust Child Process / Subprocess

新增任何 `tokio::process::Command::spawn` / `std::process::Command::spawn` 时:

- **必须**在父结构上保留 `Child` 句柄(放进 `Mutex<HashMap<key, Child>>`)。
- **必须**有显式 `terminate_*` / `kill` 路径(中断、错误、超时三种触发源)。
- **必须**给父结构加 `impl Drop`,同步 `start_kill` 不 await。
- **必须**配后台 reconciler 扫 stale child,超过 N 分钟无 IO 主动 kill。
- **必须**暴露 `active_process_ids()` 诊断 API,并接入汇总 diagnostics command 让 webview 可调。

## Regression Test Requirements

任何对 7 条根因相关代码的改动,必须新增或更新回归测试,断言:

| 根因 | 验收指标 | 测试位置 |
|---|---|---|
| 1 | Drop session 后 1s 内 child 被 SIGTERM | `src-tauri/src/engine/claude/tests_core.rs` |
| 2 | localStorage 写 '0' 后,`isXxxEnabled() === false`;清掉后回 true | `src/features/threads/utils/realtimePerfFlags.test.ts` |
| 3 | 8000 字符 `findProgressiveRevealBoundary` < 1ms;pending < 140 短路 | `src/features/messages/components/LiveMarkdown.test.tsx` |
| 4 | 30s 长 turn,handlers useMemo rebuild ≤ 5/组 | `src/features/threads/hooks/useThreadEventHandlers.test.ts` |
| 5 | 200 session 侧栏 DOM 节点 ≤ 25;`backgroundActivityByThread` 懒计算 | `src/features/home/components/Home.perf.test.tsx` |
| 6 | 滚出视口时 `img.src === ''` | `src/features/messages/components/LocalImage.test.tsx` |
| 7 | 5 workspace × 3 session timer registry size < 20 | `src/features/threads/hooks/useThreads.test.tsx` |

测试必须 `npm test` 通过,`npm run typecheck` + `npm run lint` 无错。

## Cross-Reference

- **诊断手册**(读者友好,含复现步骤 + 验收基线):`docs/perf/parallel-conversation-jank-handbook.md`
- **OpenSpec 契约**:`openspec/specs/parallel-conversation-runtime-residuals/spec.md`
- **Change delta**:`openspec/changes/investigate-parallel-conversation-jank-2026-06/specs/parallel-conversation-runtime-residuals/spec.md`
- **复现脚本**:`scripts/perf-reproduce-jank.sh`
- **执行进度**:`docs/perf/jank-fix-progress.md`(边修边记)
- **已落地 P1 提案**(参考):`c27bb18a` / `7cc4a284` / `25d101a0` / `a8bd4b24` / `f7ae0a99`
- **相关 spec**:`openspec/specs/conversation-realtime-cpu-stability` / `conversation-realtime-client-performance` / `realtime-event-batching-performance` / `app-server-event-batching`
