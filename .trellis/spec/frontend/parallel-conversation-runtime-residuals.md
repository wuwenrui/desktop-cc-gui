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

## Startup Restore Reducer Idempotency

启动恢复会并发触发多个 workspace 的 `thread/list` / active thread selection。这里的 reducer 必须满足更严格的幂等契约:

- `setActiveThreadId` 对同一 workspace + 同一 threadId 重复 dispatch 时,若 unread 已清除且 status 无变化,必须返回原 state 引用。
- `setThreads` 对语义相同的 thread summary list 刷新时,即使 incoming array / `nativeThreadIds` / `autoSession` 是新对象,也必须返回原 state 引用。
- `setThreadListLoading` / `setThreadListPaging` / `setThreadListCursor` 对相同值重复写入必须 no-op。
- 任何启动恢复路径的 reducer 修改,必须补 `useThreadsReducer.test.ts` 级别的 referential equality 断言,防止 React #185 / Maximum update depth 类启动崩溃回归。

## Codex Settled-Turn Revival Guard

并行 Codex 会话下,terminal settlement 到达后,旧 turn 的 late event 仍可能滞后进入前端。这里必须把"已完成 turn 不可复活"当作 lifecycle invariant:

- `turn/completed` / `turn/error` / `turn/stalled` 等 terminal path 必须把 Codex `threadId + turnId` 记入 settled-turn quarantine。
- 所有会触发 `markProcessing(true)` 或 `setActiveTurnId(turnId)` 的 processing-start 入口,必须先检查该 `threadId + turnId` 是否已经 quarantined。
- 对已 quarantined 的同一 `turn/started` 重复事件,必须 diagnostic-only,不能再次 `noteRealtimeTurnStarted`,不能恢复旧 active turn。
- verified successor turn 必须允许正常开始;guard 只能拦截 exact quarantined turn,不能用旧 diagnostic 粗暴拒绝新 turn。
- React transition / deferred dispatch 只能包裹 message content reducer 更新,不能包裹 `markProcessing(true)` / `setActiveTurnId` 等 lifecycle mutation。
- 对 normalized realtime event,`markProcessing(true)` 必须在 `scheduleRealtimeDispatch` 之前完成,queued callback 内必须跳过二次 processing mark,并在 dispatch 前重新检查 terminal quarantine。
- ownerless fallback 查询不能只依赖 `useEffect` 后同步的 React state refs;必须有同步更新的 Codex processing owner registry,覆盖同 tick 内 `turn/started -> runtime/ended/progress` 批次。
- `CodexEventRisk` 必须参与 owner 策略:`diagnostic-only` 事件缺 explicit owner 时不能消费 bounded fallback;会触发 settlement 的 `codex/parseError` 必须按 terminal 处理。
- `runtime/ended` / `codex/parseError` / `turn/error` / `turn/stalled` 等 terminal event 如果缺 `turnId`,前端必须在清理 processing 前用当前 active lifecycle turn 或 turn diagnostic 解析出 settlement identity,并把该 identity 写入 realtime terminal tracking + Codex settled-turn quarantine;禁止只 `markProcessing(false)` 而不隔离后续 turnless raw/item 事件。
- no-progress three-evidence reconciliation 必须按被检查的 `workspaceId + threadId + turnId` scope 发起,不能被当前 active tab 限制;后台并行 Codex 会话如果 scoped backend status 返回 terminal,也必须清理自己的 processing residue。
- 后台 reconciliation cleanup 仍必须通过 workspace/thread/turn/engine scope match;active tab 不是 owner proof,也不能作为拒绝后台 residue cleanup 的理由。
- `onAgentMessageCompleted` / normalized `completeAgentMessage` 是 message block completion,不是 Codex turn terminal proof;没有 `turn/completed` / `runtime-ended` / scoped reconciliation terminal status 时,前端禁止仅凭 assistant text completion 清理 processing 或 quarantine turn。
- assistant text completion 只能作为内容/stream evidence;即使 `turn/completed` 已经因 active blockers deferred,assistant completion 也不能越过仍在运行的 blocker 去 flush deferred completion。
- 回归测试必须覆盖 assistant message completion 后 3s 内没有 terminal event 时,同一 Codex turn 仍保持 processing,后续 item/tool activity 不能被旧 final-assistant timer 截断。
- 回归测试必须覆盖 assistant delta/completion 与 `turn/completed` 均已到达,但仍存在 running child/tool blocker 时,同一 Codex turn 仍保持 deferred,直到 blocker terminal 或 scoped reconciliation 给出明确 terminal owner。
- 回归测试必须覆盖:
  - 单 Codex turn 完成后重复 `turn/started` 不复活。
  - 两个 Codex turn 并行时,A 完成后 A 的重复 `turn/started` 不影响 A/B 状态;B 仍按自己的 terminal 结束。
  - raw/normalized late item event 与 duplicate start 都不能把 completed thread 的 sidebar/composer loading 拉回。
  - queued React transition callback 在 terminal settlement 后不能再次把 completed thread 标记为 processing。
  - 同一个 React tick 内新启动的 Codex processing owner 对 fallback 可见。
  - diagnostic-only ownerless event 不得因唯一 processing thread 而产生 lifecycle mutation。
  - terminal event 缺 `turnId` 后,late turnless raw/item event 不能复活已完成 Codex thread。
  - active tab 是 B 时,后台 Codex A 的 no-progress scoped reconciliation 返回 terminal 后,A 必须清理 loading residue。
  - 缺失 `turn/completed` 但 assistant message block 已完成时,同一 Codex `threadId + turnId` 不得仅凭 message completion 清理 processing residue。

### Manual Runtime Reproduction Gate

2026-06-20 三并行 Codex/Minimax 手工复测仍可复现“内容看似完成但某会话继续 running/loading”。因此并行 lifecycle change 即使通过 full unit test，也不得直接视为 archive-ready。

#### 1. Scope / Trigger

- Trigger: 用户手工复测仍看到 sidebar/composer loading residue，尤其是 2+ Codex/Minimax parallel sessions。
- 目标: 防止再次用 assistant text、active tab、visible thread 这类非 owner 证据做 frontend guess settlement。

#### 2. Signatures

- Required diagnostics:
  - `deferred-completion-reconciliation-query-requested`
  - `deferred-completion-reconciliation-query-resolved`
  - `deferred-completion-reconciliation-cleanup-skipped`
  - `three-evidence-reconciliation-cleanup-applied`
  - `three-evidence-reconciliation-cleanup-skipped`
  - `turn-completed-deferred`
  - `quarantined-codex-event-skipped`
- Identity tuple:
  - `workspaceId`
  - `threadId`
  - `turnId`
  - `engine`
  - provider label
  - current `activeTurnId`

#### 3. Contracts

- Manual runtime failure MUST be classified before another code change:
  - Class A: terminal authority never reaches frontend.
  - Class B: scoped backend status remains `running` / `unknown` after visible runtime completion.
  - Class C: terminal authority reaches frontend but cleanup guard rejects due to scope / active-turn / diagnostic mismatch.
- Frontend MUST NOT reintroduce assistant-message-completion settlement.
- Frontend MUST NOT use active tab, visible conversation, selected sidebar row, or provider label as lifecycle owner proof.
- If Class A/B is confirmed, the preferred next fix is backend lifecycle owner/terminal payload enrichment, not another frontend inference layer.

#### 4. Validation & Error Matrix

| Case | Required Evidence | Allowed Next Action |
|---|---|---|
| No `turn/completed` / terminal runtime event | missing terminal diagnostics for stuck `threadId + turnId` | backend terminal emission investigation |
| backend status says `running` / `unknown` | `deferred-completion-reconciliation-cleanup-skipped` with status-not-terminal | backend status source audit |
| cleanup guard rejects | skip reason `scope-mismatch`, `active-turn-mismatch`, or `deferred-completion-missing` | frontend guard review with exact payload |
| assistant text complete only | no terminal authority | keep processing; do not settle |

#### 5. Good / Base / Bad Cases

- Good: collect diagnostics, classify A/B/C, then change the responsible layer.
- Base: automated tests pass, proposal remains open until manual runtime evidence is classified.
- Bad: add a timer that settles after final assistant text; this masks loading but can cut off tool/explore chains.

#### 6. Tests Required

- Unit tests must keep assistant completion non-terminal.
- Unit tests must keep scoped backend terminal cleanup strict.
- Manual reproduction notes must include the diagnostic tuple before archive/sync.

#### 7. Wrong vs Correct

Wrong:

```typescript
onAgentMessageCompleted(payload);
setTimeout(() => markProcessing(payload.threadId, false), 3000);
```

Correct:

```typescript
onAgentMessageCompleted(payload);
recordAssistantCompletionEvidence(payload.threadId, payload.itemId);
// Wait for terminal authority or capture diagnostics proving why it never arrives.
```

### Codex Terminal Authority Matrix

#### 1. Scope / Trigger

任何修改 Codex realtime lifecycle 的代码,只要会调用以下任一 mutation,都必须先通过 terminal authority 判断:

- `markProcessing(threadId, false)`
- `setActiveTurnId(threadId, null)`
- `markRealtimeTurnTerminal(threadId, turnId)`
- `markTerminalSettlement` / settled-turn quarantine
- deferred `turn/completed` flush

#### 2. Signatures

- `onAgentMessageCompleted(payload: { workspaceId; threadId; itemId; text; turnId? })`
- normalized `completeAgentMessage`
- `onTurnCompleted(workspaceId, threadId, turnId)`
- `onTurnError` / `onTurnStalled` / owner-gated `runtime/ended`
- `flushDeferredTurnCompletion(threadId, source)`

#### 3. Contracts

| Signal | Terminal Authority | Allowed Mutation |
|---|---:|---|
| `onAgentMessageCompleted` / `completeAgentMessage` | No | content/stream evidence only |
| assistant delta / text ingress | No | liveness evidence only |
| `turn/completed` with no active blockers | Yes | complete settlement |
| `turn/completed` with running child/tool blockers | Deferred | store deferred completion; do not clear processing |
| child/tool terminal update after deferred completion | Yes | flush deferred completion |
| scoped reconciliation terminal for same deferred `workspaceId + threadId + turnId` | Yes | flush deferred completion with `scoped-reconciliation-terminal` |
| scoped reconciliation returns terminal for same `workspaceId + threadId + turnId` | Yes | clear matching residue |
| ownerless/ambiguous terminal-like event | No | diagnostic-only |

#### 4. Validation & Error Matrix

| Case | Expected |
|---|---|
| assistant completion, no terminal event | keep processing; no quarantine |
| assistant completion after deferred `turn/completed`, blocker running | keep deferred; no flush |
| scoped backend says deferred turn is terminal | flush deferred completion even if local blocker is stale |
| child/tool updates to terminal after deferred `turn/completed` | flush deferred completion |
| scoped backend says inspected turn is terminal | clear matching residue even if background tab |
| scoped backend says running/unknown or turn mismatch | reject cleanup |

#### 5. Wrong vs Correct

Wrong:

```typescript
onAgentMessageCompleted(payload);
setTimeout(() => settleTurn(payload.threadId), 2500);
```

Correct:

```typescript
onAgentMessageCompleted(payload);
recordAssistantCompletionEvidence(payload.threadId, payload.itemId);
// Do not settle. Wait for terminal event, blocker terminal update, or scoped reconciliation.
```

#### 6. Tests Required

- `useThreadEventHandlers.test.ts`: assistant completion without terminal event must not settle after timer advance.
- `useThreadEventHandlers.test.ts`: assistant delta/completion plus deferred `turn/completed` with running blocker must remain deferred.
- `useThreadEventHandlers.test.ts`: scoped backend terminal response for deferred `turn/completed` must flush only the matching thread.
- `useThreadEventHandlers.test.ts`: scoped running/unknown/mismatched response must keep deferred completion blocked.
- `useThreadEventHandlers.test.ts`: terminal child/tool update may flush deferred completion.
- `useThreadEventHandlers.test.ts`: scoped background reconciliation may clear matching stuck residue.

## Conversation Curtain Deferred Snapshot Scope

并行 session 下,幕布渲染层的性能优化也必须保持会话隔离:

- `Messages` 中任何 `useDeferredValue` 包裹的 message snapshot 都必须携带 `workspaceId + threadId` scope。
- 当 active tab/session 切换导致当前 scope 与 deferred snapshot scope 不一致时,必须立即丢弃 deferred snapshot,改用当前 conversation items。
- `resolveStreamingPresentationItems` 只能在同 scope 内把 current live ids append 到 deferred stable snapshot;不同 scope 时必须返回 current items。
- 这条规则只切断跨会话串帧,不得关闭同一会话内的 stable parent snapshot + live row override 双轨性能优化。
- 回归测试必须覆盖:
  - A/B 两个 Codex 会话并行时,切到 B 后 `MessagesTimeline` 不接收 A 的 grouped entries。
  - 同一 `workspaceId + threadId` streaming 时,同 id live assistant 仍可即时覆盖,父层 boundary 可延后收敛。

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
