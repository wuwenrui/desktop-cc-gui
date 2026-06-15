# Design / 设计

## 0. 设计原则

延续父 change 的 **evidence first, isolate second, refactor last**。

- 1、2 块（batch consumer）最易实现、leverage 最高，先做。
- 3、4 块（shell 拆分 + row status）是大重构，按域分 PR，每域自带测试。
- 5 块（evidence 真实值）最后做，没有 5 块 refactor 跑出来的数据就不知道有没有真改善。

## 1. Batch-aware useAppServerEvents

### 1.1 提取命名 dispatcher

把 `useAppServerEvents` 中 useEffect 里的 lambda body 提取为 module-level 命名函数：

```ts
export function dispatchAppServerEvent(
  handlers: AppServerEventHandlers,
  payload: AppServerEvent,
): void {
  // 现有 lambda body 全部搬到这里
  // 所有闭包变量（options.useNormalizedRealtimeAdapters 等）通过 handlers 或显式参数传入
}
```

useEffect 改为：

```ts
useEffect(() => {
  const useNormalizedRealtimeAdapters = options.useNormalizedRealtimeAdapters === true;
  const unlisten = useBatchChannel
    ? subscribeAppServerEventBatch((batch) => {
        for (const payload of batch) {
          dispatchAppServerEvent(handlersRef.current, payload);
        }
      })
    : subscribeAppServerEvents((payload) => {
        dispatchAppServerEvent(handlersRef.current, payload);
      });
  return () => unlisten();
}, [useBatchChannel, handlers]);
```

`handlers` 必须用 `useRef` 持有最新值（dispatcher 闭包不能 stale）。

### 1.2 关键约束

- `useNormalizedRealtimeAdapters` 这个开关从 `options` 移到 `handlers`（每次 render 重新构造 handlers 即可反映开关变化）。
- `noteThreadAppServerEventReceived` 调用频率不变（按 method 缓存）。
- Reducer dispatch 走现有 `realtimeEventBatcher` 的 frame budget。

### 1.3 Runtime config

跟随 Rust 端的 `CCGUI_APP_SERVER_EVENT_BATCH` env var（前端从 `window.__APP_PERF_CONFIG__` 之类的注入点读取，default true）。Runtime 不可用时回退 single。

### 1.4 测试

新增 Vitest：
- `dispatchAppServerEvent` 对单条 `codex/connected` 调用 onWorkspaceConnected
- `dispatchAppServerEvent` 对单条 `item/agentMessage/delta` 调用 onAgentMessageDelta
- `dispatchAppServerEvent` 对 `approval/request` 调 onApprovalRequest
- batch channel 转发 N 条事件给 dispatcher，dispatcher 调用次数 = N
- batch channel 与 single channel 不同时订阅（互斥）
- 1000 条 delta burst: dispatcher 内部对 `prepareThreadItems` 的调用次数 = 0

## 2. Batch-aware useFileExternalSync

### 2.1 现状

`useFileExternalSync.ts` (617 行) 通过 `subscribeDetachedExternalFileChange` 监听单事件，转换为 refresh job 推到内部 in-flight queue。已有 generation stale-drop 保护。

### 2.2 改法

新增 `subscribeDetachedExternalFileChangeBatch` 订阅路径：
- batch 事件按 `(workspace_id, path)` 合并到 in-flight queue
- 每个 path 最多保留最新 generation
- in-flight refresh 完成时检查 generation 是否被新事件覆盖，是则丢弃结果

runtime config 同 §1.3。

### 2.3 测试

新增 Vitest：
- 同 path 多次 batch 事件 → 只产生 1 个 refresh
- 跨 path batch 事件 → 各自 refresh
- batch 内第 2 事件覆盖第 1 事件的 generation → 第一个 refresh 完成时丢弃
- 关闭 batch 通道时回退 single 路径

## 3. App shell domain context 拆分

### 3.1 拆分策略

不改 `appShellContext` 的 200+ key 分类（那是设计判断，可能错），改 4 个 section hook 的输入：

| Hook | 当前收 | 改后收 |
|---|---|---|
| `useAppShellSearchAndComposerSection` | `appShellContext` (200+ key) | `{ runtimeThreadContext, composerContext, settingsContext }` |
| `useAppShellSections` | `{ ...appShellContext, ...searchAndComposerSection }` | `{ runtimeThreadContext, workspaceNavigationContext, composerContext, layoutContext, fileEditorContext, settingsContext, searchAndComposerExtras }` |
| `useAppShellLayoutNodesSection` | `{ ...appShellContext, ...searchAndComposerSection, ...sections, isPullRequestComposer, ... }` | `{ runtimeThreadContext, layoutContext, fileEditorContext, layoutExtras }` |
| `renderAppShell` | `{ ...everything }` | `{ runtimeThreadContext, workspaceNavigationContext, composerContext, layoutContext, fileEditorContext, settingsContext, sectionReturns }` |

6 个 domain object 的构建是 plain object spread + 必要的 identity-stable reference（`useRef` / `useMemo` 仅用于确实需要稳定引用的派生值）。

### 3.2 不允许的写法

```ts
// 严禁：
const appShellContext = useMemo(() => ({
  ...200Keys
}), [
  activeWorkspace?.id,  // 白名单漏写
  activeThreadId,        // 白名单漏写
]);
```

exhaustive-deps 必须 pass，deps 缺失必须真修（把对象拆小），不允许手动 disable lint。

### 3.3 拆分顺序

1. 先用 codemod（手动 + 严格 review）把 `appShellContext` 按 6 域分组搬到一个新文件 `appShellDomainContexts.ts`
2. 4 个 section hook 改输入类型（破坏性 type 改动，必须一次到位）
3. `renderAppShell` 改输入
4. `app-shell.tsx` 的 1827 行大对象字面量改为 6 个对象字面量

## 4. Sidebar / ThreadList row-level status

### 4.1 现状

`ThreadList` 把 `threadStatusById` 作为 props 传给每个 `ThreadRowItem`。Map 变化时即使 row 自己的 key 没变，也会被 React 视为 prop 变化（如果 map 引用变了）。

### 4.2 改法

新增 hook `useThreadRowStatus(threadId)`：
- 从全局 `threadStatusById` 选当前 row 的状态
- 用 `useSyncExternalStore` 或 `useMemo + shallow-equal` 保证只有 row 自己的状态变化时才返回新对象

`ThreadList` 改用：
```tsx
{threads.map((thread) => (
  <ThreadRowItem
    key={thread.id}
    thread={thread}
    status={useThreadRowStatus(thread.id)}  // ❌ 不能在 map 里调 hook
  />
))}
```

正确做法是 `ThreadRowItem` 内部自己 `useThreadRowStatus(threadId)`，prop 只传 primitive（`threadId` / `workspaceId` 等）。

### 4.3 测试

新增 Vitest：
- `ThreadRowItem` 渲染时 status 来自 selector
- 1000 次无关 `threadStatusById` 更新后，目标 row 的 render count 保持 1

## 5. Evidence gate 真实值

### 5.1 Profiler 接入

- `useThreadsReducer` 加 `__profile` 计数器 export：每调用 `prepareThreadItems` +1，每完成 dispatch +1
- 关键 component 用 `<React.Profiler id="..." onRender={...}>` 包裹，onRender 累加到 `__profile` 计数器
- Rust 端 `run_blocking_file_io` 加 `Instant::now()` 测 wall time，emit 到 `app-server-event-batch` 同名 channel 的 metric payload

### 5.2 Evidence report 升级

`scripts/generate-runtime-evidence-report.mjs` 改为：
- 读 `docs/perf/realtime-profile.jsonl`（CI 跑出的 profiler artifact）
- 把 5 个 summary 字段从 `unsupported` 升级为 `proxy`（fixture 跑出的数）或 `measured`（真实 session 跑出的数）
- 写 baseline 对比，跟 git HEAD 对比的 delta

### 5.3 测试

新增 Vitest 覆盖 profiler 计数器在 1000-delta burst 下 ≤ 0 次 `prepareThreadItems` 调用。

新增 shell test 覆盖 6 个 domain context 的引用稳定性（同 input 不产生新 reference）。
