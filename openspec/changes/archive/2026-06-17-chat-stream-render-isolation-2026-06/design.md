# Design: Chat Stream Render Isolation 2026-06

## Architecture Overview

本 change 保留 `useReducer` 单一 store 模型,在 4 个层面做局部稳定化(review pass 2026-06-16 对齐源码):

1. **Reducer fast path 扩展**:`useThreadsReducer.ts` 给 `completeAgentMessage` / `upsertItem` 两条 streaming 高频 case 增加 `INCREMENTAL_DERIVATION_ENABLED` 守卫的 fast path,与现有 5 处守卫(`appendAgentDelta` 行 1068 / `appendReasoningSummary` 行 1631 / `appendReasoningSummaryBoundary` 行 1693 / `appendReasoningContent` 行 1876 / `appendToolOutput` 行 1953)对称。**注意:不要动这 5 处已有 fast path,只动 `completeAgentMessage`(行 1141-1248)和 `upsertItem`(行 1251-1448)两个 case**。
2. **Workspace-scope ref 升级**:`useThreads.ts` 顶部 6 个核心 workspace-scope 候选 ref 改为 `Map<workspaceId, Map<threadId, T>>` 结构,eviction 路径同步清理;**props 透传路径未变**(useThreadEventHandlers.ts 仍通过 props 接收 ref 对象,ref 内部数据结构升级,hooks 间 wiring 不动)。
3. **Streaming virtualize**:`messagesTimelineVirtualization.ts:18` 移除 `!isThinking` 守卫,保留 `hasHighRenderDensity`(行 13-16)提前 return true 路径,新增 `TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED = true` 常量作为逃生口;`overscan` 在 streaming 期间从 12 提升到 24。
4. **Complexity 增量**:`messagesStreamingComplexity.ts` 拆出 `analyzeStreamingMarkdownComplexityDelta(prev, prevText, deltaText)`,`MessageRow` 维护增量 state,跨代码 fence 边界 5 个分支独立测试。
5. **Handlers signature stability**:`useAppServerEvents` 当前已通过 `handlersRef.current` + 空依赖 subscription effect 避免 resubscribe。本 change 不新增 multi-handlers public signature;只补 regression test 证明 handlers object identity churn 不会触发重复订阅。
6. **TTL + LRU 自适应**:`turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` 加 30min TTL,60s 周期 sweep 放到持有这些 refs 的 `useThreadEventHandlers.ts`;`THREAD_ITEM_CACHE_MAX` 改为 `computeThreadItemCacheMax(inFlightCount) = Math.max(12, inFlightCount * 2 + 6)`。
7. **Transient timer cleanup**:`Messages` 内部维护 previous active thread id,在 `activeThreadId` / `threadId` 变化时清理自身 7 个 RAF/timeout。不新增 `useThreads.registerTransientTimer` / `previousActiveThreadIdRef` API,避免 ref 变化无法触发 render 的跨组件通知问题。

## Component Contract

### 1. Reducer Fast Path Helper

**File**: `src/features/threads/hooks/useThreadsReducer.ts`

```typescript
// 新增 helper,作为 export,供 reducer case 与 test 复用
export function fastPathForAppendAgentDelta(params: {
  threadId: string;
  nextItem: ConversationItem;
  prevItems: ConversationItem[];
}): { items: ConversationItem[]; changed: boolean } {
  if (!INCREMENTAL_DERIVATION_ENABLED) {
    return { items: prevItems, changed: false };
  }
  // 等价分支:已存在同 id item 且 mergeSameKindItem 后无变化
  const index = prevItems.findIndex(
    (entry) => entry.id === params.nextItem.id && entry.kind === params.nextItem.kind,
  );
  if (index < 0) {
    return { items: prevItems, changed: false };
  }
  const existing = prevItems[index];
  if (!existing) {
    return { items: prevItems, changed: false };
  }
  const merged = mergeSameKindItem(existing, params.nextItem);
  if (merged === existing) {
    return { items: prevItems, changed: false }; // 等价,无变化
  }
  const next = [...prevItems];
  next[index] = merged;
  return { items: next, changed: true };
}
```

**Reducer 用法**(在 `completeAgentMessage` / `upsertItem` 现有逻辑替换 `prepareThreadItems(list, ...)` 之前):

```typescript
case "completeAgentMessage": {
  // ... existing index / legacy fallback lookup ...
  if (INCREMENTAL_DERIVATION_ENABLED && index >= 0 && isAssistantMessageItem(existingItem)) {
    const fastResult = fastPathForAppendAgentDelta({
      threadId: action.threadId,
      nextItem: list[index] as ConversationItem, // 已有逻辑构造的 updated
      prevItems: list,
    });
    if (fastResult.changed) {
      return {
        ...state,
        itemsByThread: {
          ...state.itemsByThread,
          [action.threadId]: fastResult.items,
        },
      };
    }
    // 等价:不更新 state,引用保持
    return state;
  }
  // 非 fast path 走原有 prepareThreadItems
  const updatedItems = prepareThreadItems(list, { preserveMessageTextIds: new Set([targetItemId]) });
  return { ...state, itemsByThread: { ... } };
}
```

**注意**:`completeAgentMessage` 的 `mergeCompletedAgentText(existing.text, action.text, true)` 与 `appendAgentDelta` 的 `mergeAgentMessageText` 是不同函数,等价判断边界不一致,**需要独立写测试覆盖 `mergeCompletedAgentText` 边界**。

### 2. Workspace-Scoped Ref Map

**File**: `src/features/threads/hooks/useThreads.ts`

```typescript
// 新增二级嵌套 Map 工厂
function createWorkspaceScopedMap<T>(label: string) {
  const outer = new Map<string, Map<string, T>>();
  return {
    label,
    forWorkspace(workspaceId: string): Map<string, T> {
      let inner = outer.get(workspaceId);
      if (!inner) {
        inner = new Map();
        outer.set(workspaceId, inner);
      }
      return inner;
    },
    get(workspaceId: string, threadId: string): T | undefined {
      return outer.get(workspaceId)?.get(threadId);
    },
    set(workspaceId: string, threadId: string, value: T): boolean {
      const inner = this.forWorkspace(workspaceId);
      const isNew = !inner.has(threadId);
      inner.set(threadId, value);
      return isNew;
    },
    has(workspaceId: string, threadId: string): boolean {
      return outer.get(workspaceId)?.has(threadId) ?? false;
    },
    delete(workspaceId: string, threadId: string): boolean {
      const inner = outer.get(workspaceId);
      if (!inner) return false;
      const deleted = inner.delete(threadId);
      if (inner.size === 0) outer.delete(workspaceId);
      return deleted;
    },
    deleteWorkspace(workspaceId: string): void {
      outer.delete(workspaceId);
    },
    size(): number {
      let total = 0;
      for (const inner of outer.values()) total += inner.size;
      return total;
    },
  };
}

type WorkspaceScopedMap<T> = ReturnType<typeof createWorkspaceScopedMap<T>>;
```

**Ref 改造范围**(只 6 个核心,5 个 follow-up 见 proposal.md N7):
- `pendingMemoryCaptureRef`:原 `useRef<Record<string, PendingMemoryCaptureEntry>>({})` 改 `useRef<WorkspaceScopedMap<PendingMemoryCaptureBucket>>(createWorkspaceScopedMap())`,outer key 是 `workspaceId`,inner key 是 `threadId`,bucket 内继续用 `buildMemoryTurnKey(threadId, turnId)` 保存多 turn entry
- `pendingAssistantCompletionRef`:原 `useRef<Record<string, PendingAssistantCompletionEntry>>({})` 改 `useRef<WorkspaceScopedMap<PendingAssistantCompletionBucket>>(createWorkspaceScopedMap())`,结构同上
- `recentThreadErrorsRef`:原 `useRef<Record<string, string[]>>({})` 改 `useRef<WorkspaceScopedMap<string[]>>(createWorkspaceScopedMap())`
- `pendingInterruptsRef` / `interruptedThreadsRef` / `handledClaudeExitPlanToolIdsRef`:原 `useRef<Set<string>>(new Set())` 改 `useRef<WorkspaceScopedMap<boolean>>(createWorkspaceScopedMap())`

**调用点改造**(实际查得需修改的位置):
- `pendingInterruptsRef` 在 `useThreadEventHandlers.ts:116, 871, 966, 1020, 1032, 1369` 至少 6 处使用
- `interruptedThreadsRef` 在 `useThreadEventHandlers.ts:871, 974, 1020, 1032` 至少 4 处使用
- `handledClaudeExitPlanToolIdsRef` 在 `useThreadApprovals` + `useThreadEventHandlers` 中使用

**关键**:**props 透传路径未变**。`useThreadEventHandlers.ts` 仍通过 props 接收 ref 对象(如 `interruptedThreadsRef: interruptedThreadsRef`),ref 内部数据结构升级为 workspace-scope,但 hooks 间 wiring 不动。`useThreadEventHandlers` 内的使用要从 `ref.current.has(threadId)` 改为 `ref.current.get(workspaceId, threadId) === true` 或类似,workspaceId 透传要从 `useThreads` 调用处加 prop。

**Eviction 清理**(在 `useThreads.ts:1866` 之前):

```typescript
const workspaceScopedRefs: WorkspaceScopedMap<unknown>[] = [
  pendingMemoryCaptureRef.current,
  pendingAssistantCompletionRef.current,
  recentThreadErrorsRef.current,
  pendingInterruptsRef.current,
  interruptedThreadsRef.current,
  handledClaudeExitPlanToolIdsRef.current,
];

// 在 evictThreadIds 循环内
for (const threadId of evictedThreadIds) {
  const workspaceId = threadWorkspaceMap.get(threadId) ?? "";
  if (!workspaceId) continue;
  let cleanedRefCount = 0;
  for (const ref of workspaceScopedRefs) {
    if (ref.delete(workspaceId, threadId)) {
      cleanedRefCount += 1;
    }
  }
  // 调 cleanupThreadTransientState(来自 useThreadEventHandlers,见 §3)
  cleanupThreadTransientStateRef.current?.(workspaceId, threadId);
  appendRendererDiagnostic("chat-stream/evict-thread", {
    workspaceId,
    threadId,
    evictedCount: evictedThreadIds.length,
    cleanedRefCount,
  });
}
```

### 3. Handler-side Cleanup Helper

**File**: `src/features/threads/hooks/useThreadEventHandlers.ts`

```typescript
// 新增 cleanupThreadTransientState helper,作为 export
export function cleanupThreadTransientState(
  workspaceId: string,
  threadId: string,
  refs: {
    turnDiagnosticsRef: MutableRefObject<Map<string, TurnDiagnosticState>>;
    quarantinedCodexTurnsRef: MutableRefObject<Map<string, CodexQuarantinedTurn>>;
    assistantSnapshotIngressLengthRef: MutableRefObject<Map<string, number>>;
  },
): { cleanedCount: number } {
  let cleanedCount = 0;
  if (refs.turnDiagnosticsRef.current.delete(threadId)) cleanedCount += 1;
  if (refs.quarantinedCodexTurnsRef.current.delete(threadId)) cleanedCount += 1;
  if (refs.assistantSnapshotIngressLengthRef.current.delete(threadId)) cleanedCount += 1;
  return { cleanedCount };
}
```

**关键**:`turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` 当前按 `threadId` 索引,不带 workspaceId 维度(只有 `quarantinedCodexTurnsRef` 的 value 是 `CodexQuarantinedTurn` 类型,可能含 workspaceId 字段但 key 是 threadId)。**清理时只按 threadId 清理,workspaceId 用于 diagnostic log 标识**。

### 4. 30-Minute TTL Sweep

**File**: `src/features/threads/hooks/useThreadEventHandlers.ts`(这些 refs 的真实 owner;不要放 `useThreadStorage.ts`,因为它拿不到 handler-side refs)

```typescript
const TRANSIENT_REF_TTL_MS = 30 * 60 * 1000; // 30 min
const TTL_SWEEP_INTERVAL_MS = 60 * 1000; // 60s

export function getTurnDiagnosticSettledAt(entry: TurnDiagnosticState): number | null {
  return entry.completedAt ?? entry.errorAt ?? entry.assistantCompletedAt ?? null;
}

export function sweepThreadTransientState(
  refs: {
    turnDiagnosticsRef: MutableRefObject<Map<string, TurnDiagnosticState>>;
    quarantinedCodexTurnsRef: MutableRefObject<Map<string, CodexQuarantinedTurn>>;
    assistantSnapshotIngressLengthRef: MutableRefObject<Map<string, number>>;
  },
  now = Date.now(),
): { cleanedCount: number } {
  let cleanedCount = 0;
  for (const [threadId, entry] of refs.turnDiagnosticsRef.current.entries()) {
    const settledAt = getTurnDiagnosticSettledAt(entry);
    if (settledAt !== null && now - settledAt > TRANSIENT_REF_TTL_MS) {
      refs.turnDiagnosticsRef.current.delete(threadId);
      refs.assistantSnapshotIngressLengthRef.current.forEach((_value, key) => {
        if (key.startsWith(`${threadId}\u0000`)) {
          refs.assistantSnapshotIngressLengthRef.current.delete(key);
        }
      });
      cleanedCount += 1;
    }
  }
  for (const [key, entry] of refs.quarantinedCodexTurnsRef.current.entries()) {
    if (now - entry.settledAt > TRANSIENT_REF_TTL_MS) {
      refs.quarantinedCodexTurnsRef.current.delete(key);
      cleanedCount += 1;
    }
  }
  return { cleanedCount };
}

useEffect(() => {
  const sweepTimer = setInterval(() => {
    sweepThreadTransientState({
      turnDiagnosticsRef,
      quarantinedCodexTurnsRef,
      assistantSnapshotIngressLengthRef,
    });
  }, TTL_SWEEP_INTERVAL_MS);
  return () => clearInterval(sweepTimer);
}, []);
```

**关键事实**:`CodexQuarantinedTurn` 已有 `settledAt`;`TurnDiagnosticState` 没有 `settledAt`,必须用 `completedAt` / `errorAt` / `assistantCompletedAt` 推导。`assistantSnapshotIngressLengthRef` 当前 value 只有 number,没有 timestamp,只能按 thread prefix 随 turn diagnostic cleanup 或 explicit thread cleanup 删除。

### 5. LRU Adaptive Cap

**File**: `src/features/threads/hooks/useThreads.ts`

```typescript
export function computeThreadItemCacheMax(inFlightCount: number): number {
  return Math.max(12, inFlightCount * 2 + 6);
}

// LRU eviction effect 改用公式
const newCap = computeThreadItemCacheMax(
  Object.values(state.threadStatusById).filter((s) => s?.isProcessing).length,
);
if (loadedThreadIds.length > newCap + THREAD_ITEM_CACHE_TRIM_WATERMARK) {
  // 现有 eviction 逻辑,keepableSlots = newCap - protectedLoadedCount
}
```

**验证**:`computeThreadItemCacheMax(0) === 12`,`computeThreadItemCacheMax(8) === 22`,`computeThreadItemCacheMax(20) === 46`。

### 6. Streaming Virtualization Gate

**File**: `src/features/messages/components/messagesTimelineVirtualization.ts`

```typescript
export const TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED = true;

export function shouldVirtualizeTimelineRows(input: {
  isThinking: boolean;
  rowCount: number;
  renderWeight?: number;
}) {
  // 保留 hasHighRenderDensity 提前 return true 路径(行 13-16)
  const hasHighRenderDensity =
    typeof input.renderWeight === "number" &&
    input.renderWeight >= TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT &&
    input.renderWeight > input.rowCount * 2;
  if (hasHighRenderDensity) {
    return true;
  }
  if (input.rowCount < TIMELINE_VIRTUALIZATION_MIN_ROWS) {
    return false;
  }
  if (TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED) {
    return true;
  }
  return !input.isThinking;
}
```

**`MessagesTimeline.tsx` overscan 改造**:
```typescript
const shouldUseStreamingOverscan = shouldVirtualizeTimeline && (isThinking || isWorking);
const timelineVirtualizer = useVirtualizer({
  count: shouldVirtualizeTimeline ? timelineProjectionRows.length : 0,
  enabled: shouldVirtualizeTimeline,
  overscan: shouldUseStreamingOverscan ? 24 : 12,
});
```

**DOM 节点数预算**: streaming 期间 `24*2+1 = 49` row nodes,长会话 500 row streaming 期间总 DOM 节点 ≤ 49 + 边界。

### 7. Complexity Delta Helper

**File**: `src/features/messages/components/messagesStreamingComplexity.ts`

```typescript
export function analyzeStreamingMarkdownComplexityDelta(
  prev: StreamingMarkdownComplexity,
  prevText: string,
  deltaText: string,
): StreamingMarkdownComplexity {
  if (!deltaText) {
    return prev; // 空 delta 复用 prev
  }
  // 增量扫描:仅处理 deltaText 部分
  // 关键:维护 insideCodeFence 状态(prev 末位 line 状态),跨 fence 边界正确处理
  // 5 个分支独立测试:空 delta / 长度跳跃 / inside fence / 跨多 line / 中文文本
  // ... (实现细节见 sub-task 4.1)
}
```

**关键**:跨代码 fence 边界要正确处理。如果 prev 的末位 line 在 `insideCodeFence === true` 状态,新 delta 里的反引号要延续 fence 状态;反之亦然。`MessageRow` 维护 `(prev.trimmedText, prev.complexity)` 增量 state。

### 8. Handlers Signature Stability

**File**: `src/features/app/hooks/useAppServerEvents.ts`

当前 `useAppServerEvents` 的 subscription effect 依赖是 `[]`,事件回调读取 `handlersRef.current`,所以 `handlers` object identity 变化不会导致 subscribe/unsubscribe。实现只需要补 regression test:

```typescript
it("keeps one app-server subscription when handlers object identity changes", () => {
  const firstHandlers = makeHandlers({ onAgentMessageDelta: vi.fn() });
  const secondHandlers = makeHandlers({ onAgentMessageDelta: vi.fn() });
  const { rerender, unmount } = renderHook(
    ({ handlers }) => useAppServerEvents(handlers),
    { initialProps: { handlers: firstHandlers } },
  );
  rerender({ handlers: secondHandlers });
  expect(subscribeAppServerEvents).toHaveBeenCalledTimes(1);
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
```

**不做**:`useAppServerEvents` 不接受 `{ turnLifecycle, itemStream, runtimeEvent, approvalFlow }` 多态签名。本 change 的收益核心在 reducer / virtualizer / complexity / ref cleanup,不是 public handler API。

### 9. Ref-Sync Consolidation

**File**: `src/features/threads/hooks/useThreads.ts`(行 380-405)

5 个 ref-sync effect 合并为 1 个(单一依赖收集):
```typescript
useEffect(() => {
  threadStatusByIdRef.current = state.threadStatusById;
  itemsByThreadRef.current = state.itemsByThread;
  activeTurnIdByThreadRef.current = state.activeTurnIdByThread;
  threadsByWorkspaceRef.current = state.threadsByWorkspace;
  activeThreadIdByWorkspaceRef.current = state.activeThreadIdByWorkspace;
}, [
  state.threadStatusById,
  state.itemsByThread,
  state.activeTurnIdByThread,
  state.threadsByWorkspace,
  state.activeThreadIdByWorkspace,
]);
```

**saveSidebarSnapshotThreads 加 250ms debounce**:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    Object.entries(state.threadsByWorkspace).forEach(([workspaceId, threads]) => {
      saveSidebarSnapshotThreads(workspaceId, threads);
    });
  }, 250);
  return () => clearTimeout(timer);
}, [state.threadsByWorkspace]);
```

### 6.7 Transient Timer 3 方案对比

**3 方案对比**:

| 方案 | 描述 | Pros | Cons |
|---|---|---|---|
| A. `useThreads` 顶部 Map 注册 | `useThreads` 暴露 `registerTransientTimer(threadId, cleanupFn)`,`Messages` mount 时注册 | 集中管理,跨组件 cleanup 统一 | useThreads 顶部复杂度 +30%,Messages unmount 时也得走 API |
| B. `previousActiveThreadIdRef` 通知 | `useThreads` 暴露 ref,Messages 监听 ref 变化 | 看似低侵入 | `ref.current` 变化不触发 render/effect,不能作为可靠通知 |
| C. Messages 内部主动 clear | `Messages` 用 local previous thread ref 监听 `activeThreadId` / `threadId` prop 变化,自己 clear 7 个 ref | blast radius 最小,所有 timer ref owner 不变 | 只覆盖 mounted `Messages` surface,不承诺 inactive thread eviction cleanup |

**Decision: C**。A 是过度设计,B 是 React 机制错误,C 与 ownership 一致。

`Messages` 内部实现:

```typescript
const previousRenderedThreadIdRef = useRef<string | null>(activeThreadId);
useEffect(() => {
  const previousThreadId = previousRenderedThreadIdRef.current;
  if (previousThreadId && previousThreadId !== activeThreadId) {
    if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    scrollThrottleRef.current = null;
    if (assistantFinalizingTimerRef.current !== null) clearTimeout(assistantFinalizingTimerRef.current);
    assistantFinalizingTimerRef.current = null;
    if (anchorUpdateRafRef.current !== null) cancelAnimationFrame(anchorUpdateRafRef.current);
    anchorUpdateRafRef.current = null;
    if (historyStickyUpdateRafRef.current !== null) cancelAnimationFrame(historyStickyUpdateRafRef.current);
    historyStickyUpdateRafRef.current = null;
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = null;
    if (planPanelFocusRafRef.current !== null) cancelAnimationFrame(planPanelFocusRafRef.current);
    planPanelFocusRafRef.current = null;
    if (planPanelFocusTimeoutRef.current) clearTimeout(planPanelFocusTimeoutRef.current);
    planPanelFocusTimeoutRef.current = null;
    appendRendererDiagnostic("chat-stream/transient-timer-cleanup", {
      threadId: previousThreadId,
      cleanedCount: 7,
    });
  }
  previousRenderedThreadIdRef.current = activeThreadId;
}, [activeThreadId]);
```

## Data Flow

### Streaming 主路径(用户感知改善的核心)

1. AppServer event(`item/agentMessage/delta`)进入 `useAppServerEvents` 订阅
2. 路由到当前 legacy `AppServerEventHandlers` object;`useAppServerEvents` 通过 `handlersRef.current` 读取最新 callback,不会因 handlers object identity 变化重订阅
3. 调 `appendAgentDelta` dispatch → reducer 行 1068 fast path 守卫(已存在,不动)
4. **新**:`completeAgentMessage` dispatch → reducer 行 1141-1248 走 `fastPathForAppendAgentDelta` fast path
5. `state.itemsByThread[threadId]` 更新 → `useThreadSelectors` 通知订阅者
6. `MessageRow` 重新渲染 → `analyzeStreamingMarkdownComplexityDelta` 增量扫描(prev trim 状态 + delta)
7. 复杂度信息用于 `resolveAssistantMessageStreamingThrottleMs` 决定 throttle 间隔
8. `MessagesTimeline` 用 `shouldVirtualizeTimelineRows` 决定是否虚拟化(streaming 期间 always-on,行数 < 200 + renderWeight < 96 时不开)
9. 可见 row 渲染到 DOM(总节点数 ≤ 49 + 边界)

### Eviction 路径(LRU 触发)

1. `useThreads.ts:1787` 检测 `loadedThreadIds.length > newCap + watermark`
2. 算 `evictableCandidates` + `keepableSlots`(`newCap` 由 `computeThreadItemCacheMax(inFlightCount)` 算得)
3. 决定 `evictedThreadIds`
4. **新**:对每个 evicted threadId:
   - 对 6 个 workspace-scope ref 调 `ref.delete(workspaceId, threadId)`,统计 `cleanedRefCount`
   - 调 `cleanupThreadTransientState(workspaceId, threadId)` 清理 handler 侧 3 个 ref
   - `appendRendererDiagnostic("chat-stream/evict-thread", { workspaceId, threadId, evictedCount, cleanedRefCount })`
5. `loadedThreadsRef[threadId] = false`
6. `dispatch({ type: "evictThreadItems", threadIds })` → reducer 删 `state.itemsByThread[threadId]`
7. Sub-hook 通过 `threadRefSnapshot` 拿到新 state(单一对象引用变化)

### 30-Minute TTL 周期

1. `useThreadEventHandlers.ts` 启动 `setInterval(60_000)` TTL sweep
2. 对 `turnDiagnosticsRef` / `quarantinedCodexTurnsRef` 遍历 entries
3. `quarantinedCodexTurnsRef` 用 `settledAt`;`turnDiagnosticsRef` 用 `completedAt ?? errorAt ?? assistantCompletedAt` 推导 settled timestamp
4. active turn(无 settled timestamp)不动
5. diagnostic 过期时调用 `cleanupThreadTransientState(workspaceId, threadId)`,同步清 `turnDiagnosticsRef` / matching `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` prefix
6. 单独的 quarantine 过期 sweep 只删除对应 quarantine key,避免没有 diagnostic 的 settled quarantine 残留

## Testing Strategy

### Unit Tests (新增,11 套)

1. `useThreadsReducer.completeAgentMessage` fast path 等价 / 不等价分支(`mergeCompletedAgentText` 边界独立)
2. `useThreadsReducer.upsertItem` fast path 等价分支
3. `workspaceScopedMap.test.ts` 覆盖二级 Map helper、deleteWorkspace、cross-workspace 不串线、read path 不创建 bucket
4. `threadEventDiagnostics.transient-ttl.test.ts` 覆盖 `cleanupThreadTransientState` 和 30min TTL helper
5. `useThreadEventHandlers.test.ts` / `useThreadItemEvents.test.ts` / `useThreadMessaging.test.tsx` / `useThreadTurnEvents.test.tsx` 覆盖 workspace-scoped sub-hook read/write 路径
6. `messagesStreamingComplexity.test.ts` 覆盖 delta helper(空 delta / 长度跳跃 / inside fence / 跨多 line / same-line append parity)
7. `messagesTimelineVirtualization.test.ts` 6 套测试(覆盖 isThinking true/false × rowCount 50/200/500)
8. `useAppServerEvents.realtime-contract.test.tsx` 复用现有 subscribe contract;独立 `useThreads` handler churn 集成断言留 follow-up
9. `Messages.transient-timer-cleanup.test.tsx` 覆盖 active thread 切换 timer cleanup
10. `useThreads.integration.test.tsx` 覆盖 LRU 公式 0/8/20、15 loaded threads eviction diagnostic、同名 threadId 跨 workspace interrupted guard isolation
11. follow-up: `Messages.long-conversation.test.tsx` / `rendererDiagnostics.chat-stream.test.ts` 尚未作为独立集成测试落地

### Integration Tests (follow-up)

以下集成测试是原 design 期望。LRU eviction 与 workspace-scope isolation 已补到 `useThreads.integration.test.tsx`;剩余大型 end-to-end / long-conversation / renderer schema 独立文件保持 follow-up:

1. `useThreads.end-to-end.test.tsx` 模拟 5 thread 并行 streaming,断言:
   - 5 个 thread 都有 active diagnostic
   - 切换 active thread 后,前一个 thread 的 RAF/timeout 全清(方案 C)
   - 强制 eviction 后,workspace-scope ref 无 orphan
2. `useThreads.codex-claude.test.tsx` 模拟 codex + claude 并行 streaming,断言:
   - 两条 engine 的 delta 各自落到正确 thread(不串线)
   - `claude-pending-` / `gemini-pending-` / `opencode-pending-` 前缀路径与 `isClaudeSessionBootstrapThreadId` 路径各自独立;代码库不存在 `codex-pending-` 前缀
3. `Messages.long-conversation.test.tsx` 模拟 500 row + streaming,断言:
   - `data-timeline-virtualized="true"` 在 `isThinking === true` 时出现
   - 虚拟化 row 集合非空,DOM 节点数 ≤ 49

### Baseline Measurement (前置,V-0)

- 在 `realtime-runtime-evidence.json` 加 1 条 `S-RS-VL2/visibleTextLagP95Streaming`(evidence `proxy`)
- 跑 500 row + 2 thread 并行 streaming 5min 真实 trace
- 记录 P95 / P99 基线值
- **`S-CHAT-100` 的 `target` / `hard fail` 数字由基线 × 0.7 / × 1.4 推得,不允许直接拍脑袋**

### Evidence Gates (更新 `docs/perf/baseline.json`)

- `S-CHAT-100/longConversationFrameP95`: target `<= baseline × 0.7`, hard fail `> baseline × 1.4`, evidence `proxy`
- `S-CHAT-101/reducerFastPathHitRate`: target `>= 0.85`, hard fail `< 0.6`, evidence `proxy`
- `S-CHAT-102/virtualizerActiveDuringStreaming`: target `true`, hard fail `false`, evidence `proxy`
- `S-CHAT-103/workspaceScopedRefEvictions`: target `0`, hard fail `> 0`, evidence `proxy`
- `S-CHAT-104/transientTimerCleanups`: target `100%`, hard fail `< 100%`, evidence `proxy`

## Migration / Compatibility

- `INCREMENTAL_DERIVATION_ENABLED` 已是默认 true(行 102 初始化),fast path 扩展不破坏现有契约。
- `useAppServerEvents` public signature MUST NOT change in this change。当前 `handlersRef` 已解决 resubscribe 问题;multi-handlers 只能作为独立 follow-up。
- `shouldVirtualizeTimelineRows` 移除 `!isThinking` 守卫是行为变更,但加了 `TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED` 常量作为逃生口(默认 true,可 localStorage 关闭)。
- `useThreads` LRU 自适应公式 `Math.max(12, inFlightCount * 2 + 6)` 在 0 in-flight 时退回到 12,与原值一致(向后兼容)。
- **props 透传路径未变**:useThreadEventHandlers.ts 仍通过 props 接收 ref 对象,ref 内部数据结构升级为 workspace-scope,hooks 间 wiring 不动。

## Rollback Plan

每个 sub-task 独立 commit + 独立 test。回滚单 sub-task 只需 revert commit:
- Reducer fast path → 删 `INCREMENTAL_DERIVATION_ENABLED` 守卫即可退化。
- Workspace-scope ref → 回滚到 `useRef<Record<string, T>>` / `useRef<Set<string>>` 单层结构。
- Streaming virtualize → 改回 `!isThinking` 守卫 + `count: shouldVirtualizeTimeline ? N : 0`。
- Complexity delta → 退回到 `analyzeStreamingMarkdownComplexity` 全量扫描。
- Handlers signature test → 删除新增 regression test,不影响 runtime code。
- LRU 自适应 → 改回固定 `THREAD_ITEM_CACHE_MAX = 12`。
- 30min TTL → 移除 `setInterval(60_000)` sweep,ref 不主动清理。
- Transient timer → 移除 `Messages` local cleanup effect,7 个 ref 不主动 clear。

## Open Questions

1. **transient timer scope**:只保证 mounted `Messages` surface 的 active thread switch cleanup;inactive thread eviction cleanup 需要单独 runtime ownership 设计,本 change 不承诺。
2. **handler grouping 是否值得做**:当前 subscription 已稳定;只有 profiler 证明 handler object churn 成本显著时,才独立评估内部 grouping。
3. **assistantSnapshotIngressLengthRef TTL**:该 ref value 没有 timestamp,只能随 thread/turn cleanup prefix 删除;若需要独立 TTL,必须先改变 value shape。
4. **`useThreads` 顶部 5 个 ref-sync effect 合并为 1 个后,`saveSidebarSnapshotThreads` debounce 250ms 是否影响 sidebar 实时性**:需要实测,若 250ms 过长可调 100ms。
5. **B-0 baseline 测量的 fixture 稳定性**:500 row + 2 thread 并行 streaming 5min 真实 trace 怎么写,可能需要用 `realtimePerfExtendedFixture.ts` 现有 fixture 扩展。

## Implementation Notes (2026-06-16)

落地期对原 design 补充以下 4 点(均不影响外部 contract):

1. **`sweepThreadTransientState` 抽到 `threadEventDiagnostics.ts`** 作为 pure helper,与 `resolveTransientSettledAt(diagnostic)` 共置;TTL sweep 效果通过 60s `setInterval` 落在 `useThreadEventHandlers.ts` 顶部,不影响 `useThreadStorage`。`assistantSnapshotIngressLengthRef` 没有自身 settled timestamp,但 diagnostic 过期时会通过 `cleanupThreadTransientState(workspaceId, threadId)` 按 `${threadId}\0` prefix 一并清理;explicit eviction cleanup 也走同一个 helper。
2. **`workspaceScopedMap.ts` 在 `workspaceId` 为 `null` / `undefined` 时回退到 `"__no_workspace__"` 桶**;`cleanupThreadScopedRefs` 接受 `workspaceId: string | null | undefined`,这样 callback 内部 `workspaceId` 缺失(例如 `useThreadMessaging` 部分 fallback 路径)时不会误清整个 store。
3. **`appendRendererDiagnostic("chat-stream/evict-thread", ...)` 写入 JSON-safe 数值 payload**,内部不直接携带 `WorkspaceScopedMap` 引用,避免序列化器依赖 `Map` prototype;诊断的语义在 `rendererDiagnostics` schema 中按 `evictedCount` 收敛。
4. **`Messages` transient timer cleanup 的实现细节**:在 active `threadId` 变化的 `useEffect([threadId])` 内同步清掉 7 个 RAF / timeout,而不是把 timer 注册到一个全局 registry,符合 design §6.7 方案 C(本地 owner,跨 surface 通知不引入 `useThreads` 公共 API)。

## Self-Review (2026-06-16 review pass)

落地后 review pass 发现的 3 处需要回写,见 `proposal.md` §Self-Review (R1 / R2 / R3)。其中 R1 (`workspaceScopedHas` / `workspaceScopedGet` side-effect 修复) 影响了 `workspaceScopedMap.ts` 内部实现:

```typescript
// 修复后: 拆出 side-effect-free existingBucketFor
function existingBucketFor<T>(store, workspaceId) {
  return store.get(bucketKey(workspaceId));
}
export function workspaceScopedHas<T>(store, workspaceId, threadId) {
  return existingBucketFor(store, workspaceId)?.has(threadId) ?? false;
}
export function workspaceScopedGet<T>(store, workspaceId, threadId) {
  return existingBucketFor(store, workspaceId)?.get(threadId);
}
```

`set` / `delete` 仍走带创建副作用的 `bucketFor`。这保证 read path 不会静默创建 bucket 推高 LRU accounting,与 proposal §Implementation Deviations #1 的 eviction diagnostic `cleanedRefCount` 语义对齐。
