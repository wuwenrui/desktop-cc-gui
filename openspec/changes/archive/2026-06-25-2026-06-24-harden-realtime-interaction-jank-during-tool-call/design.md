# Design: harden-realtime-interaction-jank-during-tool-call

## 1. 架构总览

```
   Codex runtime / Claude TUI
            │  JSON-RPC stdout/stderr (高频率)
            ▼
   app_server.rs (Rust)
            │  SnapshotThrottle (新增, §1.2)
            │  (workspaceId, itemId, kind) text snapshot 节流到 >= 32ms
            │  不影响 item/started / item/completed / critical / outputDelta
            ▼
   BatchedTauriEventSink
            │  40ms cadence + critical bypass (不丢)
            ▼
   Tauri emit "app-server-event-batch"  +  "app-server-event-batch-stats"
            │  (1 Vec per workspace per tick, lossless)
            ▼
   src/services/events.ts  appServerBatchHub (T event listener)
            │  batch 进入后 for (event of batch) appServerEventBackpressure.push(event)
            │  新增 createEventBackpressure<AppServerEvent> (per-event, T-1 修复)
            │  maxEventsPerFlush=256, maxBytesPerFlush=512KiB, maxQueueDepth=4000
            │  dropPolicy(snapshot-only), coalesceKey(idempotent status only), classify(critical bypass)
            ▼
   useAppServerEvents  subscribeAppServerEvent (per-event after backpressure)
            │  dispatchAppServerEvent(handlers, event)  (单事件路由, 不再 per-batch)
            │  + useRenderScheduler.scheduleChunk (T-2 新增, 抽 idle-callback)
            │  + MAX_DISPATCH_BUDGET_MS=8 预算让出
            │  + pointerdown/keydown/wheel passive listener
            ▼
   dispatchAppServerEvent  (路由, tryRouteNormalizedRealtimeEvent)
            │
            ▼
   useThreadItemEvents
   ├── onAgentMessageDelta / onReasoningDelta        enqueueRealtimeDeltaOperation  -> 12ms cadence batcher
   ├── onCommandOutputDelta / onFileChangeOutputDelta  ->  enqueueRealtimeDeltaOperation
   │                                                            │
   │                                                            ▼
   │                                              useToolOutputTailGate (新增, §4)
   │                                                            │  throttle 32ms + coalesce
   │                                                            ▼
   │                                              flushRealtimeDeltaOps -> applyRealtimeDeltaOperation
   │                                                            │
   │                                                            ▼  dispatchWithSchedule
   │                                              ┌──────────────┴───────────────┐
   │                                              │ isLiveRow     isHeavy        │
   │                                              │ urgent        startTransition│
   │                                              │ (no transition) + 1 RAF delay │
   │                                              └──────────────┬───────────────┘
   │                                                            ▼
   ├── onItemStarted/Updated/Completed  handleItemUpdate
   │                                          │
   │                                          ▼  dispatchWithSchedule
   │                                    useThreadsReducer  (urgent / transition / idle)
   │
   └── onAgentMessageCompleted
            │  新增 flushAgentCompletedBatch (合并 5 dispatch)
            ▼
      useThreadsReducer
            │
            ▼
      state.itemsByThread / state.threadStatusById
            │
            ▼
      useLayoutNodes  (useDeferredValue 累积到 3 帧, active thread 切换清空)
            │
            ▼
      MessagesRows / MessageRow (memo)
```

**关键变化**（v1 -> v2）：

- 旧 v1：sink 字节截断（**违反** `conversation-realtime-cpu-stability` "no event loss"）。v2：sink 严格 lossless，源头改用 backend snapshot throttle。
- 旧 v1：`coalesceKey` 在 `appServerBatchHub` 的 batch 维度（**错**）。v2：拆出 `appServerEventBackpressure`，per-event 维度（`T=AppServerEvent`），与 `terminalOutputBackpressure` pattern 一致。
- 旧 v1：`dispatchAppServerEventBatch` 处理整批（已无整批概念，改为 per-event dispatch）。v2：抽 `useRenderScheduler` hook 复用 idle-callback 模式（与 `useWorkspaceThreadListHydration` 一致）。

## 2. 模块拆分与文件清单

### 新增文件

| 路径 | 作用 |
|---|---|
| `src/features/threads/hooks/useToolOutputTailGate.ts` | 工具输出 stdout/stderr 的 throttle + append-buffer 闸门；维护 `(workspaceId, itemId, kind)` lastSeenAt Map；60s 滑动窗口触发 backpressure；terminal 来时强制 flush |
| `src/features/threads/utils/renderSchedulingPolicy.ts` | **改名（N-1 修复）**：原 `streamingSchedulePolicy.ts`。`resolveRenderScheduleTier()` + `resolveDispatchSchedule({ tier, isLiveRow, isHeavy, isCritical })` 纯函数；centralized tier 配置（baseline/guarded/aggressive） |
| `src/hooks/useRenderScheduler.ts` | **新增（T-2 复用）**：通用 `requestIdleCallback` + budget 让出 hook；接受 `chunks: () => void[]` 与 `budgetMs` / `idleTimeoutMs`；返回 `flush()` / `__getInstrumentationForTests()`。**`useWorkspaceThreadListHydration` 与本 change 的 idle-yield 路径都走这个 hook** |
| `src-tauri/src/snapshot_throttle.rs` | Rust 端 `SnapshotThrottle` 维护 `(workspaceId, itemId, kind)` lastEmitAtMs Map；emit `item/updated` text snapshot 前 throttle 检查；terminal 来时强制 flush |

### 修改文件

| 路径 | 改动 |
|---|---|
| `src-tauri/src/event_sink.rs` | 增 `CRITICAL_METHODS` 集合 + `BatchStats` struct + 1Hz `app-server-event-batch-stats` emit channel；`BatchedTauriEventSink::emit_app_server_event` 改为 critical bypass 直 emit（保留现有 `terminal_batch` 路径）；`stats()` 方法。**不引入字节截断**（保证 lossless） |
| `src-tauri/src/backend/app_server.rs` | emit `item/updated` text snapshot 前先过 `SnapshotThrottle`（在 `app_server.rs` 内或单独 `snapshot_throttle.rs` 模块），节流 32ms；`item/commandExecution/outputDelta` / `item/fileChange/outputDelta` / `item/started` / `item/completed` / critical 事件**不**节流 |
| `src/services/events.ts` | 新增 `appServerEventBackpressure = createEventBackpressure<AppServerEvent>`（per-event，**T-1 修复**）；`createEventHub` 增内部 `publish(payload)` 方法；`appServerBatchHub` 订阅 `app-server-event-batch` 后 `for (event of batch) appServerEventDeliverHub.publish(event)`；event backpressure 统一 deliver 给现有 subscribers |
| `src/services/eventBackpressure.ts` | `defaultSchedule` 叠加 `navigator.scheduling?.isInputPending?.()` 检查：input pending 时 `setTimeout(cb, 32)`；schedule 参数允许外部 override；新增 `dropPolicy(event)`，queue overflow 时只移除 `drop-eligible-snapshot`，禁止移除 protected events |
| `src/features/app/hooks/useAppServerEvents.ts` | `dispatchAppServerEventBatch` 改名为 `dispatchAppServerEvent`（**v2 取消 batch 概念**，单 event 路由）；chunk loop 改用 `useRenderScheduler.scheduleChunk`；input pending listener；instrumentation |
| `src/hooks/useRenderScheduler.ts` 与 `src/app-shell-parts/useWorkspaceThreadListHydration.ts` | **共享 idle-callback 模式**：T-2 重构，让 idle-callback + budget 让出成为可复用 hook |
| `src/features/threads/hooks/useThreadItemEvents.ts` | 拆 `handleItemUpdate` 的 dispatch 链为 `dispatchWithSchedule`；`onAgentMessageCompleted` 改用 `flushAgentCompletedBatch`；snapshot 节流已由 Rust 端保护（不需 webview 端重复） |
| `src/features/threads/hooks/useThreadsReducer.ts` | 增 `flushAgentCompletedBatch` action；保留 `completeAgentMessage` / `setThreadTimestamp` / `setLastAgentMessage` / `markUnread` 4 个独立 action 作 backward-compat |
| `src/features/threads/utils/realtimePerfFlags.ts` | 增 `streamingScheduleTier` + `toolOutputTailGate` 2 个 flag；§C-3 关系图生效 |
| `src/features/layout/hooks/useLayoutNodes.tsx` | 增 3 帧 background items 累积 ref；active thread 切换时清空 |
| `scripts/check-engine-capability-matrix.mjs` | 增 3 capability 矩阵行 |
| `scripts/perf-realtime-runtime-report.mjs` | 增 3 metric producer |
| `scripts/perf-archive-readiness.mjs` | `BUDGET_RESIDUALS` 增 3 capability |

### 新增测试

| 路径 | 验证 |
|---|---|
| `src/features/threads/hooks/useToolOutputTailGate.test.ts` | 同 `(workspaceId, itemId, kind)` 60s 收 1024 条 delta 时 reducer 仅收 32 条；terminal 来时全量 flush；active item 切换不串扰 |
| `src/services/events.appServerBackpressure.test.ts` | per-event 维度：(1) 2000 个 event 进 hub 后 queueDepth <= maxQueueDepth；(2) critical event 绕过 backpressure；(3) 1000 条同 itemId `itemOutputDelta` 不被 generic backpressure last-write 替换；(4) queue overflow 只丢 drop-eligible `item/updated` snapshot；(5) `for (event of batch) publish` 后 batch 拆分正确 |
| `src/features/app/hooks/useAppServerEvents.idle-yield.test.tsx` | chunkSize=N 的 dispatch 处理中触发 `pointerdown` 后立刻 yield；input 处理完再继续；MAX_DISPATCH_BUDGET_MS=8 触发让出 |
| `src/hooks/useRenderScheduler.test.tsx` | requestIdleCallback 模式下 budget 让出；input pending 让出；fallback setTimeout(0) 路径 |
| `src-tauri/src/snapshot_throttle_tests.rs` | 32ms 节流；terminal 强制 flush；不节流 critical / outputDelta / item_started_completed |

## 3. 状态机

### `toolOutputTailGate` 状态

```
                       appendToolOutputDelta(itemKey)
            ┌────────────────────────────────────────────┐
            │                                            │
            ▼                                            │
       ┌─────────┐   count(60s) < 256                    │
       │  OPEN   │ ─────────────────────────────────┐    │
       │ (直送)  │                                  │    │
       └─────────┘                                  │    │
            │ count(60s) >= 256 OR                  │    │
            │ delta.length > 4096                   │    │
            ▼                                       │    │
       ┌────────────┐   next delta in 32ms window  │    │
       │BACKPRESSURE│ ──────────────────────────────┘    │
       │ (32ms 节流)│                                    │
       └────────────┘                                    │
            │ terminal 事件 (item/completed,             │
            │   turn/completed, turn/error)              │
            ▼                                            │
       ┌─────────┐   flush 累积 buffer                   │
       │ FLUSHING│ ─────────────────────────────────┐    │
       └─────────┘                                  │    │
            │ flush 完成                            │    │
            ▼                                       ▼    │
       ┌─────────┐                                       │
       │  OPEN   │ <─────────────────────────────────────┘
       └─────────┘
```

- `OPEN`：每条 delta 直送 reducer + 更新 lastSeenAt
- `BACKPRESSURE`：delta 进 ref buffer；每 32ms 释放 append-buffer 累积值到 reducer；每 256ms 推一次累积总值（防止 buffer 无界）。该层保留所有 delta 文本，不做 last-write 替换。
- `FLUSHING`：terminal 事件触发；把 buffer 中所有累积值推完再回 OPEN

### `dispatchAppServerEvent` (v2 单事件路由) 调度循环

```
   useRenderScheduler.scheduleChunk(chunk, { budgetMs: 8, idleTimeoutMs: 50 })
            │
            ▼
   ┌──────────────────┐
   │ processing chunk │   for (event in queue):
   │                  │     dispatchAppServerEvent(event)
   │                  │     if (performance.now() - chunkStart) > 8ms:
   │                  │        yield = true
   │                  │        break
   └──────────────────┘
            │
            ▼
   ┌────────────────────────┐
   │ yield decision         │
   │ - queue empty          │ -> completeOnce(), exit
   │ - yield || inputPending│ -> requestIdleCallback(nextChunk, { timeout: 50 })
   │                        │   input 处理完才继续
   │ - else                 │ -> setTimeout(nextChunk, 0)
   └────────────────────────┘
```

### `SnapshotThrottle` (Rust) 状态

```
   emit_item_updated_snapshot(itemKey)
            │
            ▼
   ┌────────────────────────┐
   │ last_emit_at_ms[Key]   │
   │ ?? None                │
   └────────────────────────┘
            │
            ▼
   ┌────────────────────────────┐
   │ now - last_emit >= 32ms ?  │
   │ - true: emit immediately   │  -> update last_emit_at_ms[Key] = now
   │ - false: replace latest    │  -> pending_snapshot[Key] = latest_snapshot
   │   pending_snapshot[Key]    │  -> snapshot_throttle_count += 1
   │   wait 32ms tick           │
   └────────────────────────────┘
            │
            ▼  terminal event (item/completed, turn/completed, turn/error)
   ┌────────────────────────────┐
   │ flush_all_pending()        │  -> emit pending for all keys immediately
   │ update last_emit_at_ms     │  -> last_emit_at_ms[Key] = now
   │ for all keys               │  -> clear pending_snapshot[Key]
   └────────────────────────────┘
```

- 节流只影响 `item/updated` text snapshot 的 `text` / `content` / `output_text` 字段
- `item/started` / `item/completed` / `item/commandExecution/outputDelta` / `item/fileChange/outputDelta` / critical 事件**不**节流
- `item/updated` 是 derived complete snapshot，pending 策略保留 latest snapshot 以保证 final state reconvergence；只有 raw `outputDelta` 才使用 append-buffer，snapshot 文本禁止 concat 以免重复完整内容。

## 4. 关键契约

### 4.1 `appServerEventBackpressure` (T-1 修复：per-event 维度)

```ts
// src/services/events.ts
const appServerEventBackpressure = createEventBackpressure<AppServerEvent>({
  surfaceId: "app-server-event",
  eventKind: "app-server-event",
  maxEventsPerFlush: 256,
  maxBytesPerFlush: 512 * 1024,
  maxQueueDepth: 4000,
  coalesceKey: (event) => {
    const method = String(event.message.method ?? "");
    if (method === "processing/heartbeat"
     || method === "thread/tokenUsage/updated"
     || method === "thread/compacting"
     || method === "turn/diff/updated"
     || method === "account/rateLimits/updated") {
      return `${event.workspace_id}\0${method}`;
    }
    // Raw outputDelta MUST NOT be coalesced here. It is append-buffered by useToolOutputTailGate.
    // item/updated text snapshot 不走 coalesceKey（受 Rust SnapshotThrottle + dropPolicy 保护）
    return null;
  },
  dropPolicy: (event) => {
    const method = String(event.message.method ?? "");
    if (method !== "item/updated") {
      return "protected";
    }
    const params = (event.message.params ?? {}) as Record<string, unknown>;
    const item = (params.item ?? {}) as Record<string, unknown>;
    const itemKind = String(item.kind ?? item.type ?? "");
    const hasTextSnapshot =
      typeof item.text === "string"
      || typeof item.content === "string"
      || typeof item.output_text === "string";
    return hasTextSnapshot
      && ["message", "reasoning", "commandExecution", "fileChange"].includes(itemKind)
      ? "drop-eligible-snapshot"
      : "protected";
  },
  classify: (event) => {
    const criticalMethods = new Set([
      "turn/completed",
      "turn/error",
      "runtime/ended",
      "item/tool/requestUserInput",
      "approval/request",
      "collaboration/modeBlocked",
      "collaboration/modeResolved",
    ]);
    return criticalMethods.has(String(event.message.method ?? ""))
      ? "critical"
      : "non-critical";
  },
  estimateBytes: (event) => {
    try {
      return JSON.stringify(event).length;
    } catch {
      return 0;
    }
  },
  schedule: (cb) => {
    if (typeof navigator !== "undefined"
        && (navigator as { scheduling?: { isInputPending?: () => boolean } })
          .scheduling?.isInputPending?.()) {
      setTimeout(cb, 32);
      return;
    }
    if (typeof window !== "undefined"
        && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => cb());
      return;
    }
    setTimeout(cb, 0);
  },
  onStats: appendEventBackpressureDiagnostic,
});

// appServerBatchHub 订阅后做 batch -> per-event 拆分
const appServerBatchHub = createEventHub<readonly AppServerEvent[]>(
  "app-server-event-batch",
  { backpressure: undefined },  // 不在 hub 层加 backpressure
);
const appServerEventDeliverHub = createEventHub<AppServerEvent>(
  "app-server-event-per-event-deliver",
  { backpressure: appServerEventBackpressure },
);

subscribeAppServerEventBatch((batch) => {
  for (const event of batch) {
    appServerEventDeliverHub.publish(event);
  }
});

// 旧 subscribers 从 appServerEventDeliverHub 拿 per-event
subscribeAppServerEvents = (listener) => appServerEventDeliverHub.subscribe(listener);
```

**关键不变量**：
- 旧 `appServerBatchHub` listener 行为保留（旧 `dispatchAppServerEvent(handlers, payload)` 仍按 event 路由，单 event 走 `tryRouteNormalizedRealtimeEvent`，per-event 而非 per-batch）。
- `appServerEventBackpressure.deliveredCount` 在 critical event 时**总是 +1**（critical 不进 backpressure 队列）。
- `maxQueueDepth` 溢出时**只丢 `dropPolicy === "drop-eligible-snapshot"` 的 `item/updated` text snapshot**；raw `outputDelta` / lifecycle / terminal / critical event 是 protected，不能被 queue overflow 移除。

### 4.2 `useRenderScheduler` (T-2 抽出的复用 hook)

```ts
// src/hooks/useRenderScheduler.ts
type UseRenderSchedulerInput = {
  budgetMs: number;            // 单 chunk wall-clock 预算
  idleTimeoutMs: number;       // requestIdleCallback timeout
  onYield?: (reason: "budget" | "input-pending" | "queue-empty") => void;
  onChunk?: (chunkIndex: number, durationMs: number) => void;
};

type UseRenderSchedulerOutput = {
  scheduleChunk: (run: () => boolean) => void;  // run 返回 true 表示还有更多
  flush: () => void;                            // 立即 yield
  __getInstrumentationForTests: () => {
    chunkCount: number;
    yieldCount: number;
    inputPendingYieldCount: number;
    budgetMissCount: number;
  };
};

export function useRenderScheduler(input: UseRenderSchedulerInput): UseRenderSchedulerOutput {
  // 实现: 见 tasks.md 3.3.a
  // 复用: useWorkspaceThreadListHydration 与 useAppServerEvents 都用这个 hook
}
```

### 4.3 `useToolOutputTailGate` API

```ts
type ToolOutputKey = `${string}:${string}:${string}`; // workspaceId:itemId:kind

type UseToolOutputTailGateInput = {
  tier: RenderScheduleTier;     // N-1 修复: 改名
  workspaceId: string;
  threadId: string;
  itemId: string;
  kind: "commandExecution" | "fileChange";
};

type UseToolOutputTailGateOutput = {
  submit: (delta: string) => boolean;
  flush: () => string | null;
  reset: () => void;
  __getDiagnosticsForTests: () => {
    gateSaturationCount: number;
    droppedDeltaCount: number;
    lastFlushDurationMs: number;
    bufferOverflowCount: number;
    activeKeys: number;
  };
};
```

### 4.4 `dispatchWithSchedule` decision table

```ts
// src/features/threads/utils/renderSchedulingPolicy.ts
type ScheduleDecision = "urgent" | "transition" | "idle";

export function resolveDispatchSchedule(input: {
  tier: RenderScheduleTier;
  isLiveRow: boolean;
  isHeavy: boolean;
  isCritical: boolean;
}): ScheduleDecision {
  if (input.isCritical) return "urgent";
  if (input.tier === "baseline") return "urgent";
  if (input.isLiveRow) return "urgent";
  if (input.isHeavy) return "transition";
  return "idle";
}
```

### 4.5 `flushAgentCompletedBatch` reducer action

```ts
// src/features/threads/hooks/useThreadsReducer.ts
type FlushAgentCompletedBatchAction = {
  type: "flushAgentCompletedBatch";
  workspaceId: string;
  threadId: string;
  itemId: string;
  text: string;
  hasCustomName: boolean;
  timestamp: number;
  isActiveThread: boolean;
};

case "flushAgentCompletedBatch": {
  const previous = state.lastAgentMessageByThread[action.threadId];
  if (previous && previous.timestamp >= action.timestamp) {
    return state; // 旧 timestamp 丢弃
  }
  return {
    ...state,
    itemsByThread: {
      ...state.itemsByThread,
      [action.threadId]: applyCompleteAgentMessage(
        state.itemsByThread[action.threadId] ?? [],
        action,
      ),
    },
    threadStatusById: {
      ...state.threadStatusById,
      [action.threadId]: {
        ...withThreadStatusDefaults(state.threadStatusById[action.threadId]),
        ...(action.isActiveThread ? {} : { hasUnread: true }),
        lastAgentMessageUpdatedAt: action.timestamp,
      },
    },
    threadsByWorkspace: updateThreadTimestamp(
      state.threadsByWorkspace,
      action.workspaceId,
      action.threadId,
      action.timestamp,
    ),
    lastAgentMessageByThread: {
      ...state.lastAgentMessageByThread,
      [action.threadId]: { text: action.text, timestamp: action.timestamp },
    },
  };
}
```

## 5. 错误处理

| 场景 | 行为 |
|---|---|
| `requestIdleCallback` 不存在（WebView2 旧版） | fallback `setTimeout(0)`，行为退化到 v0.5.13 batch mode |
| `navigator.scheduling.isInputPending` 不存在 | 跳过 input pending 让出，仅做 idle-yield |
| Rust 端 `SnapshotThrottle` 收到 terminal 事件 | 强制 flush 所有 pending snapshot；不丢 |
| `useToolOutputTailGate` buffer 超过 1MB | 强制 flush 到最近累积值 + 推一条 "truncated" 标记；防止内存泄漏 |
| `flushAgentCompletedBatch` 收到旧 timestamp | reducer 早返回（不写 state），等价 noop |

> **2026-06-24 实施备注（§6.1 + §6.2 已落地）**：
>
> - `threadReducerTypes.ts` 新增 `flushAgentCompletedBatch` action 类型（`isActiveThread: boolean` 字段）。
> - `useThreadsReducer.ts` 文件底部抽出 `applyCompleteAgentMessageToState(state, params)` module-level helper；`completeAgentMessage` case 委托 helper；`flushAgentCompletedBatch` 复用同一 helper 后叠加 `setThreadTimestamp` + `setLastAgentMessage` + 条件 `markUnread` 的内联推导。
> - 4 个旧 action（`completeAgentMessage` / `setThreadTimestamp` / `setLastAgentMessage` / `markUnread`）行为完全保留，作 backward-compat。
> - `useThreadItemEvents.ts` 的 `onAgentMessageCompleted` 把原 4 个连续 dispatch 合并为单 `flushAgentCompletedBatch` dispatch；`ensureThread` 仍先派以保持 reducer 写入顺序。`recordThreadActivity` + `safeMessageActivity` + `onAgentMessageCompletedExternal` 旧 callback 不变。
> - 新增 `useThreadsReducer.flush-agent-completed-batch.test.ts` 5 个 case：等价性、isActiveThread=false 设 hasUnread、isActiveThread=true 保持、stale timestamp 早返回、4 个旧 action backward-compat。`useThreadItemEvents.test.ts` 旧 4 dispatch 顺序断言更新到新 `flushAgentCompletedBatch` 形态。`useThreadItemEvents.test.ts` 那条 `onCommandOutputDelta` "anchors the thread before appending command output deltas" 旧断言改写为 "submits command output deltas through the tool output tail gate"——属于 §5.2 已实施但 test 未跟上,本轮一并修正。
> - 测试：reducer 16 个测试文件 192 个 case 全 pass；`useThreadItemEvents.test.ts` 41 个 case 全 pass。
> - §6.3 / §6.4 也已落地：见下方 `§6.3 / §6.4 实施备注`。
| `streamingScheduleTier = "aggressive"` 下 `requestIdleCallback` timeout=25ms 内 chunk 没跑完 | 在 diagnostics 报 `aggressiveTierTimeoutMissed`，不阻塞下一帧 |

> **2026-06-24 实施备注（§6.3 + §6.4 已落地）**：
>
> - `renderSchedulingPolicy.ts` 新增 `resolveDispatchSubmitMode({ tier, isLiveRow, isHeavy, isCritical }): "urgent" | "transition" | "idle"` 纯函数。决策规则：`isCritical` 或 `isLiveRow` 一律 `urgent`；`tier === "baseline"` 一律 `urgent`；`tier === "guarded"` → `transition`；`tier === "aggressive"` → `idle`。同步在 `renderSchedulingPolicy.test.ts` 加 5 个 unit case。
> - `useThreadItemEvents.ts` 新增 `submitScheduleInstrumentationRef` (useRef) + `dispatchWithSchedule` (useCallback) + `__getSubmitScheduleInstrumentationForTests` (useCallback test surface)。`dispatchWithSchedule` 决策：urgent 走 `dispatch(action)` 同步；transition 走 `startTransition(() => dispatch(action))`；idle 走 `requestIdleCallback` (fallback `setTimeout(0)`)。instrumentation 5 字段在 submit-mode 选定后立即累计 counter, `totalDispatchCostMs` + `lastDispatchAtMs` 在 dispatch 完成时累计。
> - `handleItemUpdate` 入口 `dispatch({ type: "ensureThread", ... })` 改走 `dispatchWithSchedule`, 传入 `{ isLiveRow: threadId === activeThreadId, isCritical: false }`。baseline / isLiveRow / isCritical 三类 fast-path 等价旧行为; guarded / aggressive 走 transition / idle 让出。
> - 新增 `useThreadItemEvents.dispatch-with-schedule.test.ts` 5 个 case: baseline urgent / guarded transition / aggressive idle / activeThreadId live row urgent / instrumentation 累计。`return` 暴露 `__getSubmitScheduleInstrumentationForTests` (test surface only)。
> - 测试: useThreadItemEvents 2 个测试文件 43 个 case 全 pass; reducer 16 个测试文件 192 个 case 全 pass; renderSchedulingPolicy 12 个 case 全 pass。typecheck + lint + engine-capability-matrix + perf:realtime:runtime-report + perf:archive-readiness + openspec validate 全部 exit 0。

| 工具调用 active thread 切走，gate 残留 buffer | `useToolOutputTailGate` 在 unmount 时强制 flush |
| `appServerEventBackpressure.maxQueueDepth` 溢出 | 丢 `dropPolicy === "drop-eligible-snapshot"` 的 `item/updated` text snapshot，`droppedSnapshotCount` 计数 +1；不丢 critical / raw outputDelta / started / completed |

## 6. 性能预算 (V-1 修复：v0.5.13 baseline 临时值 = v0.5.11 实数，标注来源)

> **来源说明**：v0.5.13 release run baseline 实数（task 0.1）尚未生成。本表 baseline 列用 v0.5.11 实数（来自 `docs/perf/v0511-runtime-evidence.json`，scenario `S-IO-RR` / `S-IO-AS`）作为**临时基线**；真实 v0.5.13 release run 完成后必须回填。
> v0.5.11 实数在 v0.5.12 收口后 v0.5.13 是 sibling release；除非 v0.5.12 / v0.5.13 期间改了 streaming reducer 路径，否则实数可作为可信近似。
> guard / aggressive 目标用 `baseline * 0.x` 相对形式表达，便于回填时直接换算。

| Metric | v0.5.13 baseline (TBD; 临时=v0.5.11 实数) | guard 目标 | aggressive 目标 | 验证手段 |
|---|---|---|---|---|
| `main_thread_long_task_count_during_stream` (10min 工具调用) | 0 (S-IO-AS, proxy) | <= 0 (= baseline * 0.6 → 实际 floor 0) | <= 0 | Tauri release run + `PerformanceObserver` |
| `app_server_event_dropped_snapshot_count` (10min) | 0 (S-IO-AS, raw=0.28 ev/s * 600s = ~168) | < 200 | < 500 | `app-server-event-batch-stats` emit |
| `app_server_event_idle_yield_count` (10min 含 input) | 0 (idle-yield 0 → 6 路径全关) | >= 5 | >= 20 | `useRenderScheduler` instrumentation |
| `reducer_dispatches_per_active_turn_per_sec` | 1000 (S-IO-RR, per 1000 delta proxy) | <= 700 (= baseline * 0.7) | <= 500 (= baseline * 0.5) | `useThreadsReducer` `__profile` |
| `appendAgentMessageDelta` first token latency (p95) | 24 ms (S-RS-VL from `realtime-extended-baseline.json`) | 退化 < 5% (= <= 25.2 ms) | 退化 < 5% (= <= 25.2 ms) | `realtime_perf_extended_baseline.json` |
| `toolOutputTailGateSaturated` count (10min) | 0 (新能力，baseline 必为 0) | 1-10 | 10-50 | `useToolOutputTailGate` instrumentation |
| `app_server_event_payload_bytes_per_flush` (p95) | 0 (新能力，baseline 必为 0；batch 关闭) | < 512 KiB | < 512 KiB | `app-server-event-batch-stats` emit |
| `snapshot_throttle_count` (10min) | 0 (S-IO-AS, Rust throttle 未引入) | >= 100 | >= 500 | `app-server-event-batch-stats` emit |

**约束**：
- 5 个 critical method（`turn/completed` / `turn/error` / `runtime/ended` / `item/tool/requestUserInput` / `approval/request`）的 `appServerEventBackpressure.criticalBypassCount` 必须等于对应方法在 10min 内的 `receivedCount`（零丢失硬契约，task 11.2 验）。
- `realtime_reducer_dispatches_per_1000_delta` = 1000（v0.5.11 实数）意味着 v0.5.13 未优化的 baseline 比率 1:1；guard 目标 = 0.7:1（节省 30%），aggressive = 0.5:1（节省 50%）。

## 7. 回滚矩阵

| LocalStorage key / env | 取值 | 行为 |
|---|---|---|
| `ccgui.perf.streamingScheduleTier` | `baseline` | §3 idle-yield + §4 toolOutputTailGate + §6 background items 排队全部关闭；等价 v0.5.13 |
| `ccgui.perf.streamingScheduleTier` | `guarded` (default) | §3 + §4 + §6 全开；MAX_DISPATCH_BUDGET_MS=8, tailGate 32ms |
| `ccgui.perf.streamingScheduleTier` | `aggressive` | 在 guarded 基础上 + 收紧阈值（MAX_DISPATCH_BUDGET_MS=4, tailGate 16ms, idle timeout 25ms）|
| `ccgui.perf.appServerEventBatch` | `off` | batch channel 关闭；webview per-event backpressure / idle-yield 失效（前端走 single channel）；**backend snapshot throttle（Rust 端）仍生效**（硬契约，flag 不能关）；§4 toolOutputTailGate 与 batch channel 独立，仍生效 |
| `ccgui.perf.toolOutputTailGate` | `off` | §4 旁路，工具输出回到实时逐条 dispatch（`useToolOutputTailGate.submit` 直接返回 true，gate 不进入 BACKPRESSURE）|
| `CCGUI_APP_SERVER_EVENT_BATCH` env | `0` / `false` | 后端 sink 切回 `TauriEventSink`（单事件 emit）；等同 batch channel 关闭；§1 backend snapshot throttle 仍生效（不依赖 batch channel）|

## 8. 可观测性

### 8.1 Tauri -> webview 新 channel

```rust
// src-tauri/src/event_sink.rs
pub(crate) const APP_SERVER_EVENT_BATCH_STATS: &str = "app-server-event-batch-stats";

#[derive(Serialize, Clone)]
pub(crate) struct BatchStats {
    queued_bytes: u64,
    dropped_count: u64,
    dropped_by_method: HashMap<String, u64>,
    flush_count: u64,
    critical_bypass_count: u64,
    critical_flush_count: u64,
    snapshot_throttle_count: u64,
    last_flush_duration_ms: f64,
    last_flush_size_bytes: u64,
}
```

每 1s emit 一次；webview `appServerEventBackpressure` 收后写到 `rendererDiagnostics`。

### 8.2 Webview 端 diagnostics

```ts
// src/services/rendererDiagnostics.ts
function appendEventBackpressureDiagnostic(stats: EventBackpressureStats) {
  if (stats.surfaceId !== "app-server-event") return;
  appendRendererDiagnostic("app-server-event/backpressure", {
    queueDepth: stats.queueDepth,
    droppedCount: stats.droppedCount,
    coalescedCount: stats.coalescedCount,
    flushCount: stats.flushCount,
    criticalBypassCount: stats.criticalBypassCount,
    lastFlushDurationMs: stats.lastFlushDurationMs,
    rawRetainedCount: stats.rawRetainedCount,
  });
}
```

### 8.3 `useToolOutputTailGate` instrumentation

`__getToolOutputTailGateDiagnosticsForTests()` 暴露：
- `gateSaturationCount` (进入 backpressure 模式次数)
- `droppedDeltaCount` (合并丢失的 delta 条数)
- `lastFlushDurationMs` (最近一次 flush 耗时)
- `bufferOverflowCount` (buffer 超过 1MB 强制 flush 次数)
- `activeKeys` (当前活跃的 (workspaceId, itemId, kind) key 数)

### 8.4 `useRenderScheduler` instrumentation

`__getInstrumentationForTests()` 暴露：
- `chunkCount` (累计跑过的 chunk 数)
- `yieldCount` (累计 yield 次数)
- `inputPendingYieldCount` (input pending 触发的 yield)
- `budgetMissCount` (8ms / 4ms budget 触发的 yield)

## 9. 风险与缓解

### 9.1 第二轮 residual hardening（2026-06-25）

用户复测反馈：实时对话期间按钮点击与 composer typing 仍有卡顿，长时间运行后流畅度继续下降。复查后确认还有三类残留：

1. `ccgui.perf.appServerEventBatch=off` 时，`useAppServerEvents` 的 legacy raw subscription 仍从 Tauri callback 同步直派到 reducer。这保留了旧接入口的 synchronous dispatch flood。
2. `appServerEventBackpressure` 的 per-flush budget 仍是 `256 events / 512 KiB`，适合吞吐但会在高频流里占用过长帧；同时 `rawRecent` 沿用默认 `5000` 条完整 event，长时间运行会保留大量 payload。
3. `SnapshotThrottle.last_emit_at` 与 `useToolOutputTailGate.entries` 缺少 TTL / cap。正常 completed 会清一部分，但异常终止、缺失 terminal、长会话多 item 会让 pacing metadata 累积。

本轮补强采用“少写代码、守住边界”的策略：

- raw fallback 保留 rollback channel，但进入本地 FIFO queue，并复用 `useRenderScheduler` 分块 drain。
- app-server webview backpressure 收紧到 `64 events / 128 KiB`，并显式设置 `rawRetainedLimit = 128`。
- Rust `SnapshotThrottle` 增 stale TTL、tracked-key cap、terminal item/thread/workspace scope cleanup。
- `useToolOutputTailGate` 增 idle TTL、active key cap、eviction callback；`useThreadItemEvents` 通过 callback 删除 `toolOutputMetadataRef`。

这些改动不会改变 protected event delivery：critical / raw outputDelta 仍不 drop；有 buffer 的 gate entry 被 eviction 前必须先 flush。

| 风险 | 缓解 |
|---|---|
| `requestIdleCallback` 在 WebView2 表现不稳 | fallback `setTimeout(0)`；Windows runner 单独跑 extended-baseline |
| 工具输出 gate 把 `pnpm install` / `npm install` 完整 stdout 切成 32ms 节流后丢失细节 | `useToolOutputTailGate` 使用 append-buffer 而非 last-write；1MB 阈值 + terminal 强制 flush 保证最终内容完整；§1 backend snapshot throttle 不影响 outputDelta（只影响 item/updated text snapshot），所以工具输出原始字节流保留 |
| `flushAgentCompletedBatch` 与现有 4 个独立 action 行为不一致 | 保留 backward-compat action 4 个；新 batch action 与旧 action 等价；`message-row-render-stability` / `Messages.live-behavior` 现有测试不需要改 |
| 背景 3 帧累积导致 active thread 切换时旧 thread 残留渲染 | active thread 变化时 `useLayoutNodes` 显式清空 `pendingBackgroundItemsRef` |
| `streamingScheduleTier` 默认 `"guarded"` 在某些环境 panic | `resolveRenderScheduleTier` 对非法字符串 fallback `"guarded"`；不抛（N-1 改名同步） |
| Rust `SnapshotThrottle` 误节流 item/started/completed | 代码 review + unit test 强约束：`SnapshotThrottle::should_throttle(method, item_kind)` 白名单只放 `item/updated` text snapshot，且 kind 仅允许 `message` / `reasoning` / `commandExecution` / `fileChange`；其他 method 永 true（不节流） |
| T-1 per-event backpressure 让 `dispatchAppServerEvent` 在 batch 内被多次调用（每 event 一次） | `useAppServerEvents` 内 `dispatchAppServerEvent(handlers, event)` 原本就是 per-event 路由（`tryRouteNormalizedRealtimeEvent` / `coalesceAppServerEventBatch` 都按 event 处理），调用次数增加 N 倍（N = batch 内 event 数），但每次都是单 event O(1) 路由，**总工作量与旧 v0.5.13 持平**；新增开销仅是 `appServerEventBackpressure.push` 的 Map 维护（O(1)） |
| `useRenderScheduler` hook 重构影响 `useWorkspaceThreadListHydration` 行为 | T-2 重构保留原 `useWorkspaceThreadListHydration` 的所有现有 test；新 hook 内部包 `requestIdleCallback` + budget 逻辑，外部 API 不变 |

## 10. 实施顺序

按 tasks.md 中 task 的依赖顺序：

1. **基础设施（P0 1.x）**：`renderSchedulingPolicy` + `useRenderScheduler` hook + perf flag + UI toggle
2. **后端层（P0 2.x）**：`SnapshotThrottle`（Rust）+ `BatchedTauriEventSink` critical bypass + stats emit
3. **Webview 背压层（P0 3.x）**：`appServerEventBackpressure` per-event 接入 + `useRenderScheduler` 替换 `dispatchAppServerEvent` chunk loop
4. **Reducer 层（P0 4.x-5.x）**：`useToolOutputTailGate` + `flushAgentCompletedBatch` + `dispatchWithSchedule` + 3 帧 background 累积
5. **Tier 接入（P1 6.x-7.x）**：把所有 `tier ===` 判断接入 + `useRenderScheduler` 在 `useWorkspaceThreadListHydration` 复用
6. **验证 + 收口（P0 8.x-10.x）**：测试 + 跑通 release run + archive

具体 task 顺序与依赖详见 `tasks.md` 锚点链接。
