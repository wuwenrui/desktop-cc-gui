# Tasks / 任务

> 本 change 是 `realtime-input-and-io-isolation-2026-06` 的 follow-up,聚焦 frontend batch consumer + shell domain 拆分 + evidence 真实值。
> 状态:本 session 优先做 §1 (batch consumer + batch route for `useAppServerEvents`) 和 §2 (batch consumer for `useFileExternalSync`);§3/§4/§5 留作后续 session。

## Inventory / 盘点

- [x] Audit `useAppServerEvents.ts` 1184-2370 行的 useEffect 闭包结构,确认所有 closure 变量(handlers/options.useNormalizedRealtimeAdapters)
- [x] Audit `useFileExternalSync.ts` 617 行的 in-flight queue 与 generation stale-drop
- [x] Audit `appShellContext` 200+ key 实际属于哪个 domain(6 域划分)
- [x] Audit `Sidebar` / `ThreadList` 的 row-level status 传播路径
- [x] Audit `subscribeAppServerEventBatch` / `subscribeDetachedExternalFileChangeBatch` 在 `services/events.ts` 的暴露形态

## Contract / 契约修正

- [x] 父 change 的 `frontend-prop-chain-stability` spec delta 整份搬到本 change 的 specs/ 目录
- [x] spec 顶部 Implementation Status 标注清掉(本 change 自身就是 follow-up)
- [x] design §1 dispatcher 提取方案明确 handlers 用 `useRef` 持最新值,避免 stale closure
- [x] design §3 严禁 useMemo deps 白名单压 lint;exhaustive-deps 必须 pass

## Implementation / 实施

### §1 Batch-aware useAppServerEvents

- [x] 提取 `useAppServerEvents` useEffect 内的 lambda body 为 module-level 命名函数 `dispatchAppServerEvent(handlers, payload, options)`
- [x] `handlers` 改用 `useRef` 持最新值,dispatcher 通过 `handlersRef.current` 访问
- [x] `options.useNormalizedRealtimeAdapters` 折入 dispatcher options(用 dispatcherOptionsRef 持)
- [x] useEffect 互斥订阅: `isAppServerEventBatchConsumerEnabled()===true` 时挂 batch,fallback 挂 single
- [x] runtime config 走 `isAppServerEventBatchConsumerEnabled()`(localStorage `appServerEventBatch`, default true),与 Rust 端 `CCGUI_APP_SERVER_EVENT_BATCH` env 独立
- [x] 新增 Vitest:dispatcher 单元路由(codex/connected / agentMessage/delta / approval/request)/ batch route delta 不合并 / 状态快照 coalesce / 控制事件按序 FIFO chunk dispatch / 互斥订阅
  - `useAppServerEvents.batch-consumer.test.tsx`: 11 tests, all pass
  - `useThreadsReducer.append-agent-delta-fast-path.test.ts`(已存在): 8 tests, all pass, 覆盖 1000-delta burst 0 次 prepareThreadItems
  - `dispatchAppServerEventBatch`: 连续状态快照事件 latest-wins coalesce;append-only delta 保序透传到既有 realtime buffer;大 batch 按 FIFO chunk 切片调度,避免 full tight loop 和连续 batch interleaving
- [x] 跑 targeted Vitest / typecheck / lint / cargo check / full `npm run test` 通过

### §2 Batch-aware useFileExternalSync

- [x] useEffect 互斥订阅: `isAppServerEventBatchConsumerEnabled()===true` 时挂 batch channel,fallback 挂 single
- [x] batch 入口按 `(workspaceId, normalizedPath)` latest-wins coalesce 后,再透传到既有 handleEvent / in-flight queue
- [x] generation stale-drop 保护沿用既有 useFileExternalSync in-flight/generation 机制
- [x] Vitest: `coalesceDetachedExternalFileChangeBatch` 覆盖 same-path latest-wins / cross-path preserved / case-insensitive coalesce;既有 `useFileExternalSync.test.tsx` 覆盖 stale polling / clean update / dirty conflict / in-flight late refresh 不覆盖 dirty local content 路径(9 tests);Rust 端 debouncer 4 个 inline tests 覆盖 same-path coalesce / cross-path preserved / cross-flush regression / no-empty-batch
- [x] 跑 targeted Vitest / typecheck / lint / full `npm run test` 通过

### §3 App shell domain context 拆分(后续 session)

- [x] 把 `appShellContext` 的 200+ key 按 6 域分组,移到 `appShellDomainContexts.ts`
  - 已完成生产侧第一步：`app-shell.tsx` 拆为 6 个 `rawAppShellDomainContexts` domain object，并通过 `reuseStableAppShellDomainContexts()` 稳定引用；后续仍需把 section hook 输入类型迁移到 domain 类型。
  - 已完成收尾：`useAppShellLayoutNodesSection` 传给 `useLayoutNodes` 的入口改为 `workspace` / `runtime` / `chrome` / `editor` / `git` / `composer` / `panels` grouped options，`useLayoutNodes` 内部用临时 flat adapter 兼容旧渲染体。
- [x] 4 个 section hook 改输入类型,只收相关 domain
  - `useAppShellSearchAndComposerSection` 改为接收相关 domain subset；`useAppShellSections` / `useAppShellLayoutNodesSection` 改为 structured input，不再从 `app-shell.tsx` 接收 flat context spread；`useAppShellKanbanComposerSection` / `useAppShellKanbanExecutionSection` 输入从裸 `any` 收为 `UseAppShellSectionsContext`。
- [x] `renderAppShell` 改输入,只收 6 域 + section 返回
  - `renderAppShell()` 外部调用已收窄为 `{ appShellDomainContexts, searchAndComposerSection, sections, layoutNodes }`；内部临时 flatten 兼容旧渲染体。
- [x] `app-shell.tsx` 的大对象字面量拆为 6 个独立对象
- [x] 严禁 useMemo deps 白名单
- [x] exhaustive-deps 跑过
- [x] 新增 Vitest:6 域引用稳定性 + section hook 输入域不重叠
  - `appShellDomainContexts.test.ts` 覆盖 6 域命名、代表性 key ownership disjoint、selected-domain flatten、domain reference passthrough、production wiring、section hook structured input 与 render boundary 收窄。

### §4 Sidebar / ThreadList row-level status(后续 session)

- [x] 新增 `useThreadRowStatus(threadId)` hook,selector 形式
- [x] `ThreadRowItem` 内部调 hook,prop 只传 primitive
- [x] `ThreadList` 改用 selector 模式
- [x] 新增 Vitest:1000 次无关 status 更新后目标 row render count 保持 1
  - `ThreadList.test.tsx`: 21 tests, all pass;新增 target row 在 1000 次 unrelated `threadStatusById` 更新后 commit count 仍为 1。

### §5 Evidence gate 真实值(后续 session)

- [x] `useThreadsReducer` 加 `__profile` 计数器 export
  - `__profile.snapshot()` 暴露 `prepareThreadItemsCallCount` 与 `reducerDispatchCount`；`__profile.reset()` 重置 evidence fixture 计数。
- [x] 关键 component 用 `<React.Profiler>` 包裹,onRender 累加
  - `useLayoutNodes.tsx` 对 `Sidebar` 与 `Composer` 节点包裹 `React.Profiler`；`__profile.recordComponentRender()` 累加 `composer` / `sidebar` render count。
- [x] Rust 端 `run_blocking_file_io` 加 wall time 测量
  - `run_blocking_file_io` 内部用 `Instant::now()` 记录 wall time sample；成功、业务 `Err`、`JoinError` 路径均记录 `BlockingFileIoMetricSample`。当前保持 shared helper 低耦合，不在 helper 内直接依赖 Tauri `AppHandle` emit。
- [x] `scripts/generate-runtime-evidence-report.mjs` 读 profiler artifact 升级 evidence 字段
  - 新增 `docs/perf/realtime-profile.jsonl` 读取入口；artifact 不存在时保持 unsupported，存在时把 `S-IO-FP` / `S-IO-*` metric 作为 proxy/measured evidence 合入 runtime report。
- [x] 1000-delta burst fixture 跑出 0 次 prepareThreadItems
  - `useThreadsReducer.append-agent-delta-fast-path.test.ts`: 1000-delta codex burst 断言 `prepareThreadItemsCallCount: 0` 与 `reducerDispatchCount: 1000`。
- [x] 6 域引用稳定性测试通过
  - `appShellDomainContexts.test.ts`: 6 tests, all pass;新增 `reuseStableAppShellDomainContexts()` 覆盖同值 6 域复用旧引用、单域变化只替换目标 domain。

## Validation / 验证

- [x] `openspec validate frontend-prop-chain-stability-2026-06 --strict --no-interactive`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run check:runtime-evidence-gates`
- [x] §1/§2 新增 Vitest 全绿
- [x] 手动 QA calibration：开 2 个 codex session 观察 5 分钟，并记录 residual jank status
  - 2026-06-12 收口观察：卡顿有减轻但仍存在；本 change 为 task-complete / not archive-ready，作为 follow-up `calibrate-performance-iteration-debt` 的输入证据。

## Rollback / 回滚

- §1: 把 useEffect 改回只订阅 single channel,dispatcher 函数保留但仅 single 路径用
- §2: useFileExternalSync 改回只订阅 single channel
- §3: 域对象合并回 200+ key 大对象(此变更只影响输入类型,实现可逆)
- §4: ThreadList prop 传回 `threadStatusById` map(性能回退)
- §5: profiler 计数器 export 改为 no-op,evidence 字段回到 `unsupported`
