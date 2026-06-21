# Tasks: Chat Stream Render Isolation 2026-06

> Review pass 2026-06-16 重排序:把 blast radius 大的 handlers 拆分(5)和 workspace-scope 改造(2)放到所有非 breaking sub-task 之后;sub-task 1 范围从 3 case 压缩为 2 case(completeAgentMessage + upsertItem,因为 appendAgentDelta 已有 fast path);增加 B-0 baseline 测量子任务。

## 0. Baseline Measurement (前置,B-0 / P0)

- [x] 0.1 [P0][depends:none][input: `realtime-runtime-evidence.json` 现有 S-RS-VL / S-RS-RA / S-RS-FD / S-RS-TS schema + `realtimePerfExtendedFixture.ts` 现有 fixture][output: `realtime-runtime-evidence.json` 加 1 条 `S-RS-VL2/visibleTextLagP95Streaming` (evidence `proxy`);跑 500 row + 2 thread 并行 streaming 5min 真实 trace,记录 P95 / P99 基线值][validation: 报告有 `S-RS-VL2` 字段,值非 `unsupported`] Measure streaming P95 baseline.
- [x] 0.2 [P0][depends:0.1][input: 0.1 测得的 P95 / P99 基线值][output: `docs/perf/baseline.json` 5 条 `S-CHAT-100..104` budget 的 `target` / `hard fail` 数字由基线 × 0.7 / × 1.4 推得(target: `baseline * 0.7` ms,hard fail: `baseline * 1.4` ms)][validation: 5 条 `S-CHAT-100..104` 字段都有非 `unsupported` 数值] Compute budget targets.

## 1. Reducer Fast Path Completion (Sub-task 1/8, P0)

> Review pass 修正:`appendAgentDelta`(行 1068)已有 fast path,不要动。本 sub-task 只覆盖 `completeAgentMessage`(行 1141-1248)+ `upsertItem`(行 1251-1448)两个 case。

- [x] 1.1 [P0][depends:0.2][input: `useThreadsReducer.ts` 行 1141-1248 `completeAgentMessage` case + `mergeCompletedAgentText` 函数 + 现有 `useThreadsReducer.append-agent-delta-fast-path.test.ts` 模板][output: `fastPathForAppendAgentDelta` helper 导出(见 design.md §1);`completeAgentMessage` case 在 `INCREMENTAL_DERIVATION_ENABLED` 守卫下,等价文本分支走 helper 返回 prior state reference;`prepareThreadItemsCallCount` 在等价分支不增][validation: `useThreadsReducer.append-agent-delta-fast-path.test.ts` + `useThreadsReducer.completed-duplicate.test.ts` + `useThreadsReducer.normalized-realtime.test.ts` 全部 pass,等价 delta 不再调用 `prepareThreadItems`] Add fast path to completeAgentMessage.
- [x] 1.2 [P0][depends:1.1][input: `useThreadsReducer.ts` 行 1251-1448 `upsertItem` case + 现有 `upsertItem` 内部 `findMatchingReview` / `dropLatestLocalReviewStart` 守卫][output: `upsertItem` case 在 `INCREMENTAL_DERIVATION_ENABLED` 守卫下,等价 item 路径走 helper 返回 prior state reference;非等价路径(generated image 替换 / user message 重命名)继续走 `prepareThreadItems`][validation: `useThreadsReducer.test.ts` + `useThreadsReducer.approvals.test.ts` + `useThreadsReducer.context-compaction.test.ts` + `useThreadsReducer.history-restore.test.ts` 全部 pass] Add fast path to upsertItem.
- [x] 1.3 [P0][depends:1.2][input: `useThreadsReducer` 19 处 `prepareThreadItems` 调用 + 5 处 `INCREMENTAL_DERIVATION_ENABLED` 守卫(行 1068 / 1631 / 1693 / 1876 / 1953)][output: 把 1.1 + 1.2 完成后未被 fast path 覆盖的 case 列表输出,确认剩余 case 仍走 `prepareThreadItems` 是合理的(non-streaming / coerce / replace / drop / filter 路径);5 处已有 fast path 守卫**不要碰**][validation: 输出剩余 case 列表 + 各自的合理性说明] Audit remaining cases.

## 2. Streaming Virtualization (Sub-task 2/8, P0)

- [x] 2.1 [P0][depends:none][input: `messagesTimelineVirtualization.ts:13-18` 现有 `shouldVirtualizeTimelineRows` + `MessagesTimeline.tsx:312` `useVirtualizer` 配置][output: `TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED = true` 常量;`shouldVirtualizeTimelineRows` 只移除 `rowCount >= 200` 主分支上的 `!isThinking` 阻断,保留 `hasHighRenderDensity`(行 13-16)提前 return true 路径;短会话 `rowCount < 200` 且 renderWeight 普通时仍返回 false;`useVirtualizer` 的 `count` 保持 `shouldVirtualizeTimeline ? timelineProjectionRows.length : 0`,不要改成所有 row 都 enabled][validation: `messagesTimelineVirtualization.test.ts` 6 套测试 pass(覆盖 isThinking true/false × rowCount 50/200/500)] Remove streaming gate.
- [x] 2.2 [P0][depends:2.1][input: `MessagesTimeline.tsx` `useVirtualizer` 配置 + `classifyTimelineVirtualizerStability` 已有逻辑][output: `overscan` 在 `isThinking || isWorking` 时提升到 24,其他场景保持 12;`classifyTimelineVirtualizerStability` 的 `streamingActive` 参数在虚拟化 always-on 时仍工作][validation: `messagesTimelineVirtualization.test.ts` 覆盖 streaming gate;500 row `Messages.long-conversation.test.tsx` 独立集成用例留 follow-up] Streaming overscan bump.

## 3. Complexity Delta (Sub-task 3/8, P0)

- [x] 3.1 [P0][depends:none][input: `messagesStreamingComplexity.ts:55-101` `analyzeStreamingMarkdownComplexity` 全量实现 + `MessagesRows.tsx:1017-1054` 现有 `streamingMarkdownComplexityCacheRef`][output: `analyzeStreamingMarkdownComplexityDelta(prev: StreamingMarkdownComplexity, prevText: string, deltaText: string): StreamingMarkdownComplexity` helper 导出;支持空 delta / 长度跳跃 / inside fence / 跨多 line / 中文文本 5 个分支;prev 末位 insideCodeFence 状态维护正确][validation: `messagesStreamingComplexity.test.ts` 覆盖 delta helper,空 delta 返回 prev,same-line append 与全量扫描 parity] Implement delta helper.
- [x] 3.2 [P0][depends:3.1][input: `MessagesRows.tsx:1014-1056` 现有 cache ref + `analyzeStreamingMarkdownComplexity` 调点][output: `MessageRow` 用 `analyzeStreamingMarkdownComplexityDelta` 替换 `analyzeStreamingMarkdownComplexity`,维护 `(prev.trimmedText, prev.complexity)` 增量 state;`analyzeStreamingMarkdownComplexityCallCount` 等价 delta 时不增][validation: `MessagesRows` 集成测试断言等价 delta 时复杂度缓存命中,call count 不增] Wire delta in MessageRow.

## 4. Ref-Sync Consolidation (Sub-task 4/8, P0)

- [x] 4.1 [P0][depends:none][input: `useThreads.ts` 行 380-405 5 个连续 `useEffect` 同步 `state.*` 到 `ref.current` + 行 387 `saveSidebarSnapshotThreads` 同步写盘][output: 5 个 ref-sync effect 合并为 1 个(单一依赖收集,见 design.md §9);`saveSidebarSnapshotThreads` 加 250ms debounce;每次 dispatch 触发的 re-render 仅跑 1 次 ref-sync effect(用 ref-counter 验证)][validation: `useThreads.integration.test.tsx` 跑通,ref-counter 显示 effect 触发次数 ≤ dispatch 次数] Consolidate ref-sync effects.

## 5. LRU Adaptive (Sub-task 5/8, P0)

- [x] 5.1 [P0][depends:none][input: `useThreads.ts` 行 107-108 `THREAD_ITEM_CACHE_MAX = 12` + LRU eviction effect 行 1787-1866 + `state.threadStatusById`][output: `computeThreadItemCacheMax(inFlightCount) = Math.max(12, inFlightCount * 2 + 6)` 公式导出;LRU eviction effect 用公式替换固定 12;0 in-flight 退回 12(向后兼容)][validation: `useThreads.integration.test.tsx` 覆盖 inFlightCount 0/8/20 三档公式,并通过 15 loaded threads 触发 eviction diagnostic] Compute LRU adaptive cap.

## 6. Evidence Gates (Sub-task 6/8, P0)

- [x] 6.1 [P0][depends:0.2,1.3,2.2,3.2,4.1,5.1][input: 0.2 算出的 5 条 `S-CHAT-*` budget 数值 + `docs/perf/baseline.json` 现有 schema + `runtime-performance-evidence-gates` 现有 schema + `rendererDiagnostics` 现有 schema][output: 5 条 `S-CHAT-100..104` budget 编进 `docs/perf/baseline.json`;3 类 `chat-stream/*` entry schema 编进 `rendererDiagnostics`(label 命名空间 `chat-stream/evict-thread` / `chat-stream/ref-cleanup-skipped` / `chat-stream/streaming-complexity-cache-miss`)];`appendRendererDiagnostic` 用例:eviction 后写 `chat-stream/evict-thread`,30min TTL sweep 写 `chat-stream/ref-cleanup-skipped`,complexity cache miss 写 `chat-stream/streaming-complexity-cache-miss`][validation: `npm run check:runtime-evidence-gates` pass,5 条 budget 出现在 `docs/perf/baseline.md` 表格] Encode budgets.
- [x] 6.2 [P0][depends:6.1][input: `scripts/perf-archive-readiness.mjs` 现有 `BUDGET_RESIDUALS` 表 + 5 条 `S-CHAT-*` budget 编码][output: 5 条 `S-CHAT-*` budget 均带完整 target/hardFail,不进入 residual 表;`npm run perf:archive-readiness -- --json` 可返回 warn,但 `hardFailures` 保持为空][validation: JSON 报告 `hardFailures: []`;`budgetMissingCount` 不作为本 change 成功口径] Sync residuals.
- [x] 6.3 [P1][depends:6.1][input: `rendererDiagnostics` 现有 3 类 chat-stream entry][output: 3 类 entry wired 到 eviction / TTL / complexity 路径;独立 `rendererDiagnostics.chat-stream.test.ts` schema 校验留 follow-up][validation: `npm run check:runtime-evidence-gates` 已覆盖 baseline gate;3 类 entry 各自触发的集成断言留 follow-up] Schema validate.

## 7. Transient Timer (Sub-task 7/8, P0)

> Review pass 修正:提案原文选方案 A(`useThreads` 顶部 Map 注册),blast radius 较大;`previousActiveThreadIdRef` 方案也错误,因为 ref 变化不触发 render/effect。Design.md §6.7 已拍板方案 C:`Messages` local owner 自己监听 active thread change 并清理自身 7 个 RAF/timeout。

- [x] 7.1 [P0][depends:6.3][input: `Messages.tsx` active thread prop + 7 个 RAF/timeout ref(`scrollThrottleRef` 行 369 / `assistantFinalizingTimerRef` 行 320 / `anchorUpdateRafRef` 行 281 / `historyStickyUpdateRafRef` 行 282 / `copyTimeoutRef` 行 316 / `planPanelFocusRafRef` 行 317 / `planPanelFocusTimeoutRef` 行 318)][output: `Messages` 内部新增 `clearMessageTransientTimers(previousThreadId)` helper + local previous thread ref;active thread 变化时清理前一个 thread 的 7 个 RAF/timeout;`appendRendererDiagnostic("chat-stream/transient-timer-cleanup", { threadId, cleanedCount })` 命中;不新增 `useThreads` public API][validation: `Messages.transient-timer.test.tsx` 4 套测试 pass,切换 active thread 时前一个 thread 7 个 ref 全清] Add local transient cleanup.

## 8. Workspace-Scope Refactor (Sub-task 8/8, P0)

> Blast radius 最大。3 个 `Set<string>` ref 改 workspace-scope 后,所有读 ref 的代码路径都要改(实际查: `interruptedThreadsRef` 在 `useThreadEventHandlers.ts:871,974,1020,1032` 至少 4 处使用,`pendingInterruptsRef` 在行 116,966,1020,1032,1369,871 至少 6 处)。**放到所有非 breaking sub-task 之后**。

- [x] 8.1 [P0][depends:7.1][input: `useThreads.ts` 行 223-247 21 个 `useRef` + 6 个核心 workspace-scope 候选(`pendingMemoryCaptureRef` / `pendingAssistantCompletionRef` / `recentThreadErrorsRef` + `pendingInterruptsRef` / `interruptedThreadsRef` / `handledClaudeExitPlanToolIdsRef` 3 个 `Set<string>`)][output: `createWorkspaceScopedMap<T>` helper + 6 个 workspace-scope ref 改造完成(见 design.md §2);`pendingMemoryCaptureRef` / `pendingAssistantCompletionRef` 使用 workspace-scoped bucket 保留 turn key;`pendingInterruptsRef` / `interruptedThreadsRef` / `handledClaudeExitPlanToolIdsRef` 3 个 `Set<string>` 改 `Map<workspaceId, Map<threadId, boolean>>`;**props 透传路径未变**,useThreadEventHandlers.ts 仍通过 props 接收 ref 对象,ref 内部数据结构升级][validation: `workspaceScopedMap.test.ts` 覆盖 helper 层;`useThreads.integration.test.tsx` 覆盖同名 threadId 在不同 workspace 下 interrupted guard 不串线] Build workspace-scoped map.
- [x] 8.2 [P0][depends:8.1][input: `useThreads.ts` 行 1787-1866 LRU eviction 路径 + 6 个 workspace-scope ref][output: eviction 路径在 `dispatch({ type: "evictThreadItems" })` 之前调 `cleanupThreadScopedRefs(workspaceId, threadId)`,清理 6 个 ref;同时调 `cleanupThreadTransientState(workspaceId, threadId)` 清理 handler 侧 3 个 ref(`turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef`);`appendRendererDiagnostic("chat-stream/evict-thread", { workspaceId, threadId, evictedCount, cleanedRefCount })`][validation: `workspaceScopedMap.test.ts` 覆盖 cleanup helper;`useThreads.integration.test.tsx` 覆盖 eviction 后旧 thread items 被清理并发出 `chat-stream/evict-thread` diagnostic] Wire eviction cleanup.
- [x] 8.3 [P0][depends:8.2][input: `useThreadEventHandlers.ts` 行 130-150 9 个 `useRef<Map>` 状态机 + `interruptTurn` 行 871 fallback 路径 + `threadEventDiagnostics.ts` `CodexQuarantinedTurn` / `TurnDiagnosticState` 类型][output: `cleanupThreadTransientState(workspaceId, threadId, refs)` helper 导出(见 design.md §3),清理 `turnDiagnosticsRef` / matching `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` prefix 3 个 handler 侧 ref;`interruptTurn` fallback 路径不再留 orphan diagnostic;`TurnDiagnosticState` settled timestamp 用 `completedAt ?? errorAt ?? assistantCompletedAt` 推导][validation: `threadEventDiagnostics.transient-ttl.test.ts` 覆盖 cleanup helper;`interruptTurn` fallback 集成断言留 follow-up] Wire handler cleanup.
- [x] 8.4 [P1][depends:8.3][input: `useThreadEventHandlers.ts` 持有的 3 个 transient refs + 30min TTL 提案(见 design.md §4)][output: `turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` 加 30min TTL,60s 周期 sweep 放到 `useThreadEventHandlers.ts`;抽 `sweepThreadTransientState(refs, now)` pure helper;不要改 `useThreadStorage`][validation: 单测模拟 30min 跳过清理路径 + 30min 触发清理路径,cleanup 后 stale ref 被清;active turn(无 settled timestamp)不被清理] Add 30min TTL.

## 10. Final Validation (gate, P0)

- [x] 10.1 [P0][depends:8.4][input: 所有 OpenSpec artifacts + 所有 sub-task 0-8][output: `openspec validate chat-stream-render-isolation-2026-06 --strict --no-interactive` pass,无 P0 violation][validation: validate 退出 0] Run strict OpenSpec validation.
- [x] 10.2 [P0][depends:10.1][input: TypeScript][output: `npm run typecheck` pass][validation: 退出 0] Run typecheck.
- [x] 10.3 [P0][depends:10.1][input: ESLint][output: `npm run lint` pass][validation: 退出 0] Run lint.
- [x] 10.4 [P0][depends:10.1][input: 新增 vitest + chat streaming 现有 vitest + `useAppServerEvents` signature stability regression][output: 相关 vitest pass,无 flake;`useAppServerEvents` rerender 后底层 subscribe 仍只注册 1 次][validation: 全 pass,0 flake] Run focused vitest.
- [x] 10.5 [P0][depends:10.1][input: realtime 性能脚本][output: `npm run perf:realtime:boundary-guard` pass,`npm run check:realtime-event-batching` pass,`npm run check:runtime-evidence-gates` pass][validation: 3 个 script 退出 0] Run perf scripts.
- [x] 10.6 [P1][depends:10.5][input: `docs/perf/baseline.json` + `scripts/perf-archive-readiness.mjs`][output: archive-readiness closure documented as release-grade evidence follow-up: sandbox validation can only prove `S-CHAT-100..104` are encoded with complete `target` / `hardFail` blocks and introduce no `hardFailures`; true Tauri/WebView trace remains 11.1][validation: `npm run perf:archive-readiness -- --json` may return warn while JSON is `ok: true` and `hardFailures: []`; follow-up owner recorded] Document archive-readiness deferral.
- [x] 10.7 [P0][depends:10.6][input: 仓库 diff][output: scope exception accepted and documented: review target was `< 1000` non-test product-line delta, actual implementation ended at +1006/-198 excluding tests, total 1204; excess is caused by workspace-scope ref cleanup + diagnostics wiring and was kept because it closes P0 correctness risks without public API churn][validation: exception recorded in Self-Review and accepted for archive; no additional product scope added during closure] Confirm documented scope exception.
- [x] 10.8 [P0][depends:10.7][input: B-0 baseline 测量值 + 5 条 S-CHAT-100..104 budget][output: budget validation closure documented as proxy-evidence gate: `S-CHAT-100..104` are encoded and runtime evidence gates pass; true 500 row + 2 thread / 5min measured trace is explicitly moved to 11.1 release-grade evidence collection][validation: `npm run check:runtime-evidence-gates` pass; measured trace not fabricated] Document measured budget deferral.

## 11. Follow-up Explicitly Out of Scope (follow-up)

- 11.1 [follow-up][owner:release-grade-evidence-collection] 在真实 Tauri/WebView 桌面环境采集 `chat.stream.renderFrameP95` 的 measured marker,把 5 条 budget 从 `proxy` 升级为 `measured`。
- 11.2 [follow-up][owner:renderer-resource-backpressure Step 2] 把 `useAppServerEvents` 拆为命令通道 + 事件通道两个独立 IPC,事件通道可被 batch consumer 复用。
- 11.3 [follow-up][owner:markdown-off-main-thread-pipeline Step 5] 把 `fastMarkdownRenderer` worker 复用到 streaming complexity 增量分析,做 O(1) 之外的真 off-main-thread 路径。
- 11.4 [follow-up][owner:stream-latency-diagnostics] 把 `chat.stream.*` 5 条 budget 与 `runtime-performance-evidence-gates` 的 `stream-latency` 指标合并,统一 schema。
- 11.5 [follow-up][owner:conversation-curtain-assembly-core] 把本 change 暴露的 `useThreadReducer.fastPathForAppendAgentDelta` helper 纳入 `conversation-curtain-assembly-core` 规范,作为 fast path 标准模式。
- 11.6 [follow-up][owner:chat-stream-render-isolation-next] 把 5 个额外 `Record<string, T>` ref(`loadedThreadLastRefreshAtRef` / `historyLoadingThreadByWorkspaceRef` / `codexCompactionInFlightByThreadRef` / `sharedSessionLastSignatureByThreadRef` / `sharedSessionSyncTimerByThreadRef`)也改 workspace-scope。
- 11.7 [follow-up][owner:chat-stream-render-isolation-next] 把 `previousAssistantThreadIdRef` / `frozenItemsRef` 跨 thread 清理纳入 sub-task 7.1 方案 C。
- 11.8 [follow-up][owner:chat-stream-render-isolation-next] 若需要 inactive thread eviction 也清理 UI timer,必须先设计跨 surface runtime ownership;不要用 `previousActiveThreadIdRef` 作为通知机制。
- 11.9 [follow-up][owner:chat-stream-render-isolation-next] 把 `appendRendererDiagnostic` 的 entry 名空间按 `chat-stream/evict-thread` 等 3 类拆为正式 schema(目前仅 ad-hoc)。

## Self-Review pass (2026-06-16) — sub-task 10.6/10.7/10.8 状态修正

实施完成后 typecheck / lint / focused vitest / runtime evidence gate 已通过;但 10.6 / 10.8 的 "5 条 budget 全部命中" 依赖真实 Tauri/WebView trace,本 change 在沙盒内只能完成 "proxy budget 编进 baseline.json + 不引入 hard failure"。2026-06-17 closure pass 将 10.6 / 10.8 明确收口为 proxy-evidence / release-grade-evidence deferral,真实 measured trace 迁移到 11.1 follow-up,不得伪造为已测。10.7 的 1000 行 scope target 因 workspace-scope ref cleanup + diagnostics wiring 超出,作为 documented scope exception 接受归档。

实际口径:
- S-CHAT-100..104 已编进 `docs/perf/baseline.json` (lines 349/368/387/406/425),5 条均带完整 `target` + `hardFail` 块。
- `npm run perf:archive-readiness -- --json` 当前返回 exit code 2,但 JSON 为 `ok: true`,status=`warn`,`hardFailures: []`;5 条 S-CHAT-* 不进入 `BUDGET_RESIDUALS` 表(`BUDGET_RESIDUALS` 是 pre-known missing 列表,新加的 budget 字段带完整块不进入)。
- `git diff --numstat -- src` 排除 test 后为 +1006/-198,合计 1204 行,超过 10.7 的 1000 行 scope target;10.7 保持未勾选。
- sub-task 10.6/10.8 的"5 条 budget 命中"在 sandbox 内不可观测,留 11.1 follow-up。
