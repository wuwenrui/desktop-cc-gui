## Why

`feature/v0.5.13` 已在多 conversation、含 tool call 的真实场景中（截图 2026-06-23）出现"实时会话占用主线程、其他 UI 功能卡顿"的回归：

- `feature/v0.5.11` / `v0.5.12` 已分别收口 `v0511-performance-evidence-and-runtime-jank-hardening`（profiling 闭环）、`reduce-streaming-reducer-commit-lag`（urgent live delta）、`reduce-message-row-render-amplification`（message row memoization），但 **batch sink -> webview -> reducer 链路的"洪流"治理缺最后一环**：
  - `appServerHub` / `appServerBatchHub` **没有接 `createEventBackpressure`**（`src/services/events.ts:166-177`），而 `terminal-output` / `runtime-log-line` / `runtime-log-status` 都已接。
  - `BatchedTauriEventSink` 后台任务每 `BATCH_FLUSH_INTERVAL_MS = 40ms` 一次性 emit 整批 `Vec<AppServerEvent>` 到 `app-server-event-batch`（`src-tauri/src/event_sink.rs:67-80`），webview 一帧可收 100+ events。
  - `coalesceAppServerEventBatch` 只合并 5 类 key（`processing/heartbeat`、`thread/tokenUsage/updated`、`thread/compacting`、`turn/diff/updated`、`account/rateLimits/updated`），**文本/工具流式事件不可合并**（`src/features/app/hooks/useAppServerEvents.ts:350-385`）。
  - `dispatchAppServerEventBatch` 用 `chunkSize = 64` + `setTimeout(processNextChunk, 0)` 串行把整批同步交给 `dispatchAppServerEvent`（`src/features/app/hooks/useAppServerEvents.ts:2793-2840`），**没有 yield / idle / input pending 探测**。
  - 工具调用高发期，每次 `onItemUpdated` / `onItemCompleted` 走 `handleItemUpdate` -> **`flushRealtimeDeltaOps()` 全量排空 + 同步 dispatch**（`upsertItem` / `appendAgentDelta` / `markContinuationEvidence`），不走 `startTransition`（`src/features/threads/hooks/useThreadItemEvents.ts:949-1175`）。
  - `onAgentMessageCompleted` 一次性发 5 个连续 dispatch（`completeAgentMessage` + `setThreadTimestamp` + `setLastAgentMessage` + `markUnread` + `safeMessageActivity`），**没有 batch 也没有 transition**（`src/features/threads/hooks/useThreadItemEvents.ts:1280-1335`）。
  - `useLayoutNodes` 的 `backgroundRenderGating` 只对 `deferredThreadItemsByThread` 做 `useDeferredValue`（`src/features/layout/hooks/useLayoutNodes.tsx:418-432`），**对 reducer dispatch 频率零约束**；`runtimeSessionScheduling` 体系也只服务 runtime 终端输出，不覆盖 main `app-server-event` 路径。
  - 后端 4 个工具调用高发事件（`item/started`、`item/updated`、`item/commandExecution/outputDelta`、`item/completed`）**没有专门的"tool tail"识别**，单次 stdout/stderr 输出按字节切包后每条都触发 webview 整链路。
- 现场复现路径已明确：Codex `先做个当前项目最新代码分析` turn 工具调用 + 14 个并发会话 + 左右双栏浏览 AGENTS.md / CHANGELOG.md，**点击文件树/折叠栏/切会话延迟 200-500ms**。

## 目标与边界

### 目标

- 把 batch sink -> webview -> reducer 链路从"开环无限占用"改成"**有界、有优先级、可让出**"的事件系统。
- 端到端建立三层背压 + 让出契约：Tauri 端 batch 背压、webview 端 dispatch 背压、reducer 端分组 commit。
- 对工具调用 / live assistant delta 这两类"必须尽快可见"的事件保留现有 fast path；对 heartbeat、token usage、`item/updated` text snapshot 这类"可延迟可收敛"的派生事件引入 drop / coalesce / idle-yield；对 stdout/stderr `outputDelta` 只允许进入 `useToolOutputTailGate` 的 append-buffer 聚合，禁止在 generic backpressure 中 last-write 替换。
- 提供可观测证据门禁（gate）：`main_thread_long_task_count_during_stream`、`app_server_event_dropped_count`、`app_server_event_idle_yield_count`、`reducer_dispatches_per_active_turn_per_sec` 在 Tauri release 模式必须可测。
- 提供 **rollback 三档位**（`streamingScheduleTier = "baseline" | "guarded" | "aggressive"`）以便出现回退时按层关闭，不破坏现有 `realtime-event-batching-performance` / `conversation-realtime-cpu-stability` capability 的契约。
- 在不修改产物体积、签名、notarization、tier-1 capability（`app-server-event-batching` / `realtime-event-batching-performance` / `streaming-dispatch-decision-table` / `renderer-listener-budget`）契约的前提下，**仅以新 capability 形式**叠加保护层。

### 边界

- 仅修改前端 `src/services/events.ts`、`src/features/app/hooks/useAppServerEvents.ts`、`src/features/threads/hooks/useThreadItemEvents.ts`、新增 `src/features/threads/hooks/useToolOutputTailGate.ts` + `src/features/threads/utils/renderSchedulingPolicy.ts`、调整 `src/features/threads/utils/realtimePerfFlags.ts` 多 1 个 flag（`streamingScheduleTier`），调整 `src/features/layout/hooks/useLayoutNodes.tsx` 的 `useDeferredValue` 链。
- 仅修改后端 `src-tauri/src/event_sink.rs` 的 `BatchedTauriEventSink`（加 `CRITICAL_METHODS` bypass + `BatchStats` emit channel，**保持严格 lossless**）与 `src-tauri/src/backend/app_server.rs` 在 emit `item/updated` text snapshot 前接 `src-tauri/src/snapshot_throttle.rs`（32ms 节流 + terminal flush），同时给 `item/commandExecution/outputDelta` 加 `tool_tail_marker` 字段（不改 schema）。
- 复用 `createEventBackpressure` 给 `appServerEventDeliverHub` 上 per-event 背压（`appServerBatchHub` 拆 batch 后逐个 push 到 `appServerEventDeliverHub`，架构同 `terminalOutputBackpressure`）。
- 不替换 `BatchedTauriEventSink`、不替换 `realtimeEventBatcher`、不替换 `useThreadsReducer`。
- 不动 OpenSpec 主 spec 的现有 capability（`app-server-event-batching` / `realtime-event-batching-performance` / `streaming-dispatch-decision-table` / `message-row-render-stability` / `conversation-realtime-cpu-stability` / `client-renderer-stability-under-pressure` / `realtime-input-render-budget`）的 contract；通过 **新增 capability** 与 **modification 增量**方式叠加。
- 不改 `realtime-input-render-budget` 的 live assistant fast path；不扩大 `reduce-streaming-reducer-commit-lag` 的 urgent dispatch 范围（仍只 `appendAgentMessageDelta`）。
- 不动 `appServerHub` 单一 channel fallback（`CCGUI_APP_SERVER_EVENT_BATCH=0`）；它继续作为 baseline 行为，新保护层只在 batch channel 启用时生效。
- 不引入新依赖；不破坏现有 Vitest / Tauri integration test。

## 非目标

- 不替换 React 渲染层为 Web Worker / OffscreenCanvas（属于后续 perf 重构，需独立 change）。
- 不重做 `realtimeEventBatcher` 的 flush 协议（仍 `cadence` / `first-token` / `terminal` / `manual`）。
- 不重做 `useThreadsReducer` 的 `appendAgentDelta` fast path（属于 `realtime-input-render-budget` 范畴）。
- 不变更 `tauri-plugin-updater` / `tauri-plugin-window-state` 等 host 插件配置。
- 不修改 release pipeline（`2026-06-22-release-pipeline-cache-sccache` 走自己的 change）。
- 不修改 `Markdown` 渲染（属于 `improve-markdown-render-performance` 范畴，本次不动）。
- 不新增 IPC channel；仅复用现有 `app-server-event` / `app-server-event-batch`。
- 不在 macOS / Windows / Linux 跨平台重新测量（仅以现有 `npm run perf:realtime:report` + 一次真实 release run 验证作为证据基线）。

- 不修改 `app-server-event-batching` 现有 critical 处理语义（"MAY be included in the next flush window OR trigger an immediate flush"）；新 `Critical Events MUST Bypass Backpressure` Requirement 是**补充而非替代**，与 `app-server-event-batching` 主 spec 兼容。
- 不修改 `conversation-realtime-cpu-stability` "no event loss under burst traffic" 契约；sink 端严格 lossless，webview 端只允许丢弃明确标记为可重建 / 可收敛的 derived snapshot（主要是 `item/updated` text snapshot），且 `item/started` / `item/completed` / raw `outputDelta` / critical 事件零丢失。
- 不修改 `realtime-event-batching-performance` 现有 first-token / order / terminal flush 契约；新 Requirement "Tool output deltas MUST be append-buffered by `(workspaceId, itemId, kind)` when consecutive deltas are < 32ms apart" 是**增量**，与现有 first-token semantic 兼容（`appendAgentMessageDelta` 不受 tail gate 影响）。
- 不引入 React 19 新 API 依赖（`useTransition` / `startTransition` / `useDeferredValue` 已使用，`useEvent` 提案不引入以避免 React 19 canary 依赖）。
- 不引入 React 19 scheduler 包；`requestIdleCallback` 用浏览器原生 API，不引入 `scheduler` npm 包。

## What Changes

### 1. Tauri 端 batch sink 保持 lossless，新增 snapshot 节流层

- `BatchedTauriEventSink` 严格 **不丢任何事件**（保留 `conversation-realtime-cpu-stability` "no event loss under burst traffic" 契约）。新增的只是 critical 旁路 + 观测：
  - `CRITICAL_METHODS = ["turn/completed", "turn/error", "runtime/ended", "item/tool/requestUserInput", "approval/request", "collaboration/modeBlocked", "collaboration/modeResolved"]`：critical 事件**绕过** `BATCH_FLUSH_INTERVAL_MS` 直接 emit 单独 batch（保留现有 `terminal_batch` 路径），`critical_bypass_count` 计数 +1。
  - 后端**不丢 critical 事件**；非 critical 事件仍按现有 40ms cadence 顺序入队。
  - 新增 `BatchedTauriEventSink::stats()` 暴露 `queued_bytes / flush_count / critical_bypass_count / critical_flush_count / last_flush_duration_ms / last_flush_size_bytes / snapshot_throttle_count`，通过 `app.emit("app-server-event-batch-stats", ...)` 每 1s 送 webview。
- 新增 **backend snapshot 节流层**（在 `app_server.rs` emit `item/updated` text snapshot 之前）：
  - 同一 `(workspaceId, itemId, kind)` 的 `item/updated` text snapshot 节流到 **>= 32ms** 一次（`SnapshotThrottle` 维护 `lastEmitAtMs` Map；emit 前 `if (now - lastEmitAtMs < 32) return Throttled`，并把 latest complete snapshot 写入 `pendingSnapshot`；下一窗口或 terminal 事件来时强制 flush 最新完整快照）。注意：这里是 derived snapshot 收敛，不是 `outputDelta` append-buffer，禁止把多个完整 snapshot 字符串拼接成重复内容。
  - 节流只影响 `item/updated` 的 text snapshot（`text` / `content` / `output_text` 字段），**不影响** `item/started` / `item/completed` / `item/commandExecution/outputDelta` / 任何 critical 事件。
  - 节流层目的：减少 webview 端"重复 text snapshot 灌满 batch"的源压力，从源头降速而非 sink 端丢。
- 字节预算放在 webview `appServerBatchHub` 的 `createEventBackpressure`（§2），sink 端只做 cadence + critical bypass，**不丢**。



### 2. Webview 端 `appServerBatchHub` 接入 `createEventBackpressure`

- `src/services/events.ts` 拆出 `appServerEventBackpressure = createEventBackpressure<AppServerEvent>`（**per-event** 维度，不是 per-batch 维度），由 `appServerBatchHub` 订阅 `app-server-event-batch` 后逐个 `event => appServerEventDeliverHub.publish(event)`，再由 eventBackpressure 统一 deliver 给现有 subscribers。`createEventHub` 需新增内部 `publish(payload)` 方法（或等价命名）复用既有 `backpressure.push` / `deliverEvent` 逻辑；禁止临时发明“订阅式投递”伪 API。
  - `maxEventsPerFlush = 256`（每 RAF 最多 dispatch 256 个 event，超过按 FIFO 推迟到下一 RAF）。
  - `maxBytesPerFlush = 512 KiB`（payload 体积预算，由 `estimateBytes` 用 `JSON.stringify(event).length` 计算）。
  - `maxQueueDepth = 4000`（背压上限，溢出时通过新增 `dropPolicy(event)` 只丢明确可收敛的 `item/updated` text snapshot，保留 `item/started` / `item/completed` / raw `outputDelta` / critical）。
  - `coalesceKey` 仅用于幂等状态类事件（如 `processing/heartbeat`、`thread/tokenUsage/updated`、`thread/compacting`、`turn/diff/updated`、`account/rateLimits/updated`），禁止对 `item/commandExecution/outputDelta` / `item/fileChange/outputDelta` 做 last-write coalesce；工具输出 delta 的降频只在 §4 `useToolOutputTailGate` append-buffer 中完成。
  - `classify` 把 `CRITICAL_METHODS` 标 `critical`（critical **绕过背压**与字节预算，立即 deliver）。
- `defaultSchedule` 保持 `requestAnimationFrame`，但叠加 `navigator.scheduling?.isInputPending?.()` 检测：input pending 时 `setTimeout(cb, 32)` 推迟到下一帧；无 `navigator.scheduling` 时直接 `requestAnimationFrame`。
- `onStats` 把 `appServerEventBackpressureStats` 推给 `appendEventBackpressureDiagnostic`（surfaceId = `app-server-event`），与 `terminal-output` 共用 diagnostic sink。
- **不丢 protected event**：当 `maxQueueDepth` 溢出时，只有 `dropPolicy(event) === "drop-eligible-snapshot"` 的 `item/updated` text snapshot 可进入 `droppedSnapshotCount` 计数；raw `outputDelta`、lifecycle、terminal、critical 事件必须保留。该行为不是全链路 lossless，而是"source / sink lossless + webview derived snapshot bounded drop + final state reconvergence"。
### 3. `dispatchAppServerEventBatch` 引入 idle-yield

- `src/features/app/hooks/useAppServerEvents.ts:2793-2840`：
  - 把 `setTimeout(processNextChunk, 0)` 改为 `requestIdleCallback(processNextChunk, { timeout: 50 })`（fallback `setTimeout(0)`），让出主线程。
  - 在 `chunkSize = 64` 之外增 `MAX_DISPATCH_BUDGET_MS = 8`：每 chunk 调度前先看 `performance.now() - chunkStart` 是否 > 8ms，> 8ms 立即让出，剩余 chunk 推迟到下一帧。
  - 监听 `pointerdown` / `keydown` / `wheel` 事件（capture 阶段，passive）作为 input pending 信号：检测到时，当前 chunk 跑完后**立刻让出**，直到 input 处理完。
- 新增 `flushReason: "interactive-yield"` 标记，让 reducer / diagnostics 可识别。

### 4. 工具调用路径加 `toolOutputTailGate`

- 新增 `src/features/threads/hooks/useToolOutputTailGate.ts`：
  - 对 `item/commandExecution/outputDelta` / `item/fileChange/outputDelta` 维护 `(workspaceId, itemId)` 维度的 `lastSeenAt` Map。
  - 60s 内同一 `(workspaceId, itemId)` 收到 > 256 条 delta 时进入 `backpressure` 模式：每 >=32ms 才允许一条 `appendToolOutputDelta` 真正落到 reducer；其余合并到 ref buffer，**每 256ms 推一次累积值**。
  - 工具调用 terminal（`item/completed` 或 turn/completed）来时强制 flush 累积 buffer。
- reducer 路径：把 `appendToolOutputDelta` 标记为"batchable tool output"，不进 fast path；保证不破坏 `realtime-input-render-budget` 的 `canUseLiveAssistantDeltaFastPath`。
- 不影响 `onItemUpdated` 的 `text/content/output_text` snapshot 路径（这是另一条 `appendAgentDelta` fast path，受 `streaming-dispatch-decision-table` 保护）。

### 5. `handleItemUpdate` 拆分 live-row / non-live-row 提交

- `src/features/threads/hooks/useThreadItemEvents.ts:949-1175`：
  - 把 `flushRealtimeDeltaOps()` + `dispatch` 链拆成 `dispatchWithSchedule(action, { isLiveRow, isHeavy })`：
    - `isLiveRow`（item 是当前 active thread 的 `appendAgentDelta` / `completeAgentMessage`）走 urgent dispatch（沿用 `reduce-streaming-reducer-commit-lag` 的 `useTransitionForDispatch: false` 路径）。
    - `isHeavy`（`item/started` / `item/updated` 的 commandExecution / fileChange snapshot，且 threadId !== activeThreadId）走 `startTransition` + 1 RAF delay。
    - 其他（reasoning / tool tail）走 `requestIdleCallback`。
  - `onAgentMessageCompleted` 的 5 个连续 dispatch 合并成单一 `flushAgentCompletedBatch` action（reducer 内部一次性 apply），避免连续 5 次 state churn。

### 6. `useLayoutNodes` 背景线程渲染 + 主题 idle 切换

- `src/features/layout/hooks/useLayoutNodes.tsx:418-432`：
  - 把 `deferredThreadItemsByThreadValue` 的更新上限从 1 帧 1 次提升到 **3 帧累积**（用 `useDeferredValue` + 自己的 `useRef<Set<string>>` 维护"已排队 background items"）。
  - active thread id 变化时（用户切会话）**清空 background items 排队**，立刻切到目标 thread 渲染（解决"切会话延迟"）。

### 7. 新增 `streamingScheduleTier` 性能档位 flag

- `src/features/threads/utils/realtimePerfFlags.ts`：
  - 增 `streamingScheduleTier: "baseline" | "guarded" | "aggressive"`，默认 `"guarded"`。
  - `"baseline"`：关闭 §3 idle-yield、§4 toolOutputTailGate、§6 background items 排队（等价 v0.5.13 main 行为）。
  - `"guarded"`：开 §3 + §4 + §6。
  - `"aggressive"`：在 `guarded` 基础上额外加 `MAX_DISPATCH_BUDGET_MS = 4`、toolOutputTailGate 阈值 32ms -> 16ms、`requestIdleCallback` timeout 50ms -> 25ms。
- 现有 8 个 perf flag 继续保留并独立可关；新 flag 是叠加维度，不替代。§3、§4、§6 各有自己的 `ccgui.perf.*` flag 单独控制。**`streamingScheduleTier` 只决定档位组合，不直接 gate 任何模块**。

**Flag 关系图（tier 与现有 8 flag 的交集）**：

| 现有 flag | tier=baseline | tier=guarded | tier=aggressive |
|---|---|---|---|
| `realtimeBatching=off` | 全部 dispatch 同步直送 | 全部 dispatch 同步直送（client 12ms cadence batcher 关闭）| 同 guarded |
| `appServerEventBatch=off` | `useAppServerEvents` 走 single channel；webview batch backpressure / idle-yield 失效；backend snapshot throttle 仍生效 | 同 baseline | 同 guarded |
| `reducerNoopGuard=off` | reducer 每次都建新 ref | guarded | guarded |
| `incrementalDerivation=off` | 全量 derive | guarded | guarded |
| `backgroundRenderGating=off` | `useLayoutNodes` 不 defer background items | guarded | guarded |
| `backgroundBufferedFlush=off` | runtime 终端输出不 buffer | guarded | guarded |
| `stagedHydration=off` | thread hydration 同步 | guarded | guarded |
| `debugLightPath=off` | 全量 debug | guarded | guarded |
| `toolOutputTailGate=off`（新）| §4 旁路 | §4 旁路 | §4 旁路 |

**关键不变量**：
- `streamingScheduleTier` 与 `appServerEventBatch` 是**正交**的：tier 控制"tier 覆盖范围内哪些 tier 启用的优化被开/关"，appServerEventBatch 控制"是否走 batch channel"。当 `appServerEventBatch=off` 时，整个 `useAppServerEvents` 走 single channel `app-server-event`（不调 `dispatchAppServerEventBatch`），§3 idle-yield 失效；但 §1 backend snapshot throttle（Rust 端）、§4 toolOutputTailGate（与 batch channel 独立）仍生效。
- `streamingScheduleTier` 与 `realtimeBatching` 是**正交**的：`realtimeBatching=off` 关闭 `useThreadItemEvents` 的 12ms cadence batcher，事件直接 dispatch；`streamingScheduleTier=baseline/guarded/aggressive` 仍控制 §3/§4/§6 的 on/off。两者组合生效（如 `tier=aggressive + realtimeBatching=off` 意味着 backend snapshot throttle 32ms + §4 仍 16ms + §3 仍 4ms budget，但 `useThreadItemEvents` 不再 12ms batch）。
### 8. 新增 capability

#### New Capabilities

- `app-server-event-stream-pacing`（覆盖 §1-§3 + §7）：Tauri batch sink 与 webview `appServerBatchHub` 之间的有界背压、idle-yield、critical 旁路契约。
- `tool-output-tail-gate`（覆盖 §4）：工具调用 stdout/stderr 洪流在 reducer 之前的 throttle + coalesce 契约。
- `streaming-schedule-tier-rollback`（覆盖 §7）：三档 rollback 档位的可观测性、开关路径、不破坏现有 capability 契约的回归保证。

#### Modified Capabilities

- `app-server-event-batching`：增 Requirement "Critical events MUST bypass backpressure and idle-yield" + Scenario "input pending forces immediate yield between chunks"。
- `realtime-event-batching-performance`：增 Requirement "Tool output deltas MUST be append-buffered by `(workspaceId, itemId, kind)` when consecutive deltas are < 32ms apart" + Scenario "tool tail saturation reports `toolOutputTailGateSaturated` metric"。
- `conversation-realtime-cpu-stability`：增 Requirement "When user input is pending, batch dispatch MUST yield within current chunk" + Scenario "interactive yield between chunks leaves pending input responsive under 50ms"。

## 技术方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 只压 `chunkSize`（从 64 -> 16）+ `setTimeout(0)` | 把每帧处理量压小 | 改动最小，立即可见 | 不解决 40ms 一批的 burst 压力；不让出主线程；不解决 tool output 洪流 | 部分采用 |
| B. 给 `appServerBatchHub` 接 `createEventBackpressure` + 工具输出 tailGate + idle-yield | 完整三层背压 | 解决 webview 端"洪流 -> reducer -> render"全链路；可观测；可回退 | 改动面较大，需新 capability spec | **Adopt** |
| C. 把 reducer / render 整体搬到 Web Worker | 隔离主线程 | 物理上不卡 | React 19 + Redux 风格 reducer 不能直接搬；store 双向同步成本高；本季度无法验证 | 暂不采用，留作后续 |
| D. 替换 `BatchedTauriEventSink` 为 channel-based backpressure | 工业级 | 改动可控 | 需要重写 `src-tauri/src/event_sink.rs` 大半文件；现有 8 个 spec 都依赖 sink 行为 | 暂不采用 |
| E. 在 useThreadsReducer 上加 dedup-pulse 抑制 | 减少 reducer 调用 | 简单 | 仍跑在主线程；不解决"用户点了不响应" | 暂不采用 |

Adopt 组合方案：

1. 主体走 B（§1-§4 + §7）。
2. §5 拆分 live / heavy 提交继承 A 的 chunk size 收敛思想，但**不降 chunkSize**（仍 64），改用 budget 替代。
3. §6 背景线程渲染 3 帧累积是 B 的 webview 端补充。
4. C / D / E 各自独立留作后续评估，本 change 不混合。

## Impact

- **Frontend**：
  - `src/hooks/useRenderScheduler.ts` (new, T-2 抽出可复用 idle-callback hook)
  - `src/app-shell-parts/useWorkspaceThreadListHydration.ts` 重构内部 idle-callback 路径走 `useRenderScheduler`
  - `src/services/events.ts`
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/threads/hooks/useThreadItemEvents.ts`
  - `src/features/threads/hooks/useToolOutputTailGate.ts` (new)
  - `src/features/threads/utils/renderSchedulingPolicy.ts` (new)
  - `src/features/threads/hooks/useThreadsReducer.ts` 增 `flushAgentCompletedBatch` action
  - `src/features/threads/utils/realtimePerfFlags.ts` 增 1 个 flag
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/messages/components/Messages.tsx` / `MessagesRows.tsx` 仅在 `streamingScheduleTier === "aggressive"` 时读 background items 排队
- **Backend (Rust)**：
  - `src-tauri/src/snapshot_throttle.rs` (new, 32ms 节流 + terminal flush)
  - `src-tauri/src/event_sink.rs` 增 `CRITICAL_METHODS` 集合 + `BatchStats` struct + 1Hz `app-server-event-batch-stats` emit channel；`BatchedTauriEventSink::emit_app_server_event` 改为 critical bypass 直 emit（保留现有 `terminal_batch` 路径），**不引入字节截断**（保持 lossless）
  - `src-tauri/src/backend/app_server.rs` emit `item/updated` text snapshot 前接 `SnapshotThrottle`；同时给 `item/commandExecution/outputDelta` / `item/fileChange/outputDelta` payload 上加 `tool_tail_marker` 字段（不破坏 schema，缺省 `false`）
- **Scripts / Tests**：
  - `scripts/check-engine-capability-matrix.mjs` 增 3 个新 capability 矩阵行
  - `scripts/perf-realtime-runtime-report.mjs` 增 3 个新 metric
  - `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` 增 `appServerEventStreamPacing` / `toolOutputTailGate` / `streamingScheduleTierRollback`
  - 现有 `perf:realtime:report` / `perf:realtime:extended-baseline` 不变；新 metric 通过 `npm run perf:realtime:runtime-report -- --include-stream-pacing` 拉取
  - 新增 focused Vitest：`src/features/threads/hooks/useToolOutputTailGate.test.ts`、`src/services/events.appServerBackpressure.test.ts`、`src/features/app/hooks/useAppServerEvents.idle-yield.test.tsx`
- **OpenSpec**：
  - 新增 3 个 capability 详见 §8
  - 修改 3 个 capability 详见 §8
  - Trellis task 容器：`.trellis/tasks/06-24-harden-realtime-interaction-jank/`（具体见 tasks.md）
- **Bundle / Release**：
  - 不改产物体积、签名、notarization、tier-1 capability
  - 不动 `src-tauri/Cargo.toml` 依赖
  - 不动 `package.json` 依赖

## 验收标准

### Gate-level（必须全部通过才允许 archive）

- `npm run typecheck` exit 0
- `npm run lint` exit 0
- `npm run test` exit 0（包含新 3 个 focused Vitest + 现有 `realtimeBoundaryGuard` / `realtimeEventBatcher` / `message-row-render-stability` / `conversation-realtime-cpu-stability` 套件）
- `npm run check:engine-capability-matrix` exit 0
- `npm run perf:realtime:runtime-report -- --include-stream-pacing --json` 报出 `appServerEventStreamPacing` / `toolOutputTailGate` / `streamingScheduleTierRollback` 三个 capability 的 `evidenceClass: measured`
- `npm run perf:archive-readiness -- --release --json` 对新增 3 capability 不输出 `release-evidence-proxy` / `release-evidence-unsupported`
- `openspec validate 2026-06-24-harden-realtime-interaction-jank-during-tool-call --strict --no-interactive` exit 0
- Tauri release 一次真实 `workflow_dispatch` run：
  - `main_thread_long_task_count_during_stream` 相对 v0.5.13 baseline **下降 >= 40%**
  - `app_server_event_dropped_count` 在 10min 工具调用密集 turn 中 **< 200**（即非 critical 事件被合并/丢弃但保留结构）
  - `app_server_event_idle_yield_count` 在 10min 含 `pointerdown` / `keydown` turn 中 **>= 5**（让出生效）
  - `reducer_dispatches_per_active_turn_per_sec` **下降 >= 30%**（reducer 不被洪流灌满）

### Behavior-level

- 用户在工具调用 active turn 中点击文件树 / 折叠栏 / 切会话：**端到端响应 < 100ms**（dev 模式可接受 < 250ms）。
- `appendAgentMessageDelta` first token 延迟相对 v0.5.13 baseline **不退化 > 5%**（保留 `reduce-streaming-reducer-commit-lag` 的 urgent dispatch 语义）。
- `turn/completed` / `turn/error` / `runtime/ended` / `item/tool/requestUserInput` / `approval/request` 5 类 critical 事件在 batch 截断 / 丢包场景下 **不丢**。
- 工具调用 active turn 中同一 `(workspaceId, itemId)` 的 `item/commandExecution/outputDelta` 在 60s 内连续 1000+ 条时，UI 显示更新频率 <= 32Hz（不被洪流灌满），最终完整内容收敛。

### Rollback

- `localStorage.setItem("ccgui.perf.streamingScheduleTier", "baseline")` 后 30s 内行为回到 v0.5.13 main baseline。
- `localStorage.setItem("ccgui.perf.appServerEventBatch", "off")` 后 webview batch channel / per-event backpressure / idle-yield 失效，但 Tauri 端 `CRITICAL_METHODS` 仍生效（`MAX_BYTES_PER_FLUSH` 在 v2 已删除，sink 严格 lossless）；`SnapshotThrottle`（Rust 端 32ms 节流）也仍生效（不依赖 batch channel，独立硬契约）。
- `localStorage.setItem("ccgui.perf.toolOutputTailGate", "off")` 后 `useToolOutputTailGate` 旁路，工具输出回到实时逐条 dispatch。

## Open Questions

- webview 端 `maxEventsPerFlush = 256` / `maxBytesPerFlush = 512 KiB` / `maxQueueDepth = 4000` 与 backend `SnapshotThrottle` 32ms 是否最优需 Tauri release run 验证；如 v0.5.14 出现 backpressure 持续 saturation，备选 1024 KiB / 8000 / 节流改 16ms。
- `requestIdleCallback` 在 Tauri WebView2（Windows）下 `timeout` 行为差异；需在 Windows runner 单独跑一次 `perf:realtime:extended-baseline` 验证。
- §5 中 `flushAgentCompletedBatch` 合并 5 dispatch 是否会破坏 `onAgentMessageCompletedExternal` 的多消费者契约，需在 `useThreadItemEvents.test.tsx` + `Messages.live-behavior.test.tsx` 中补专项测试。
