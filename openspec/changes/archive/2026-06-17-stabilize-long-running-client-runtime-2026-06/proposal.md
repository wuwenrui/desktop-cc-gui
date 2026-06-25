# Proposal: Stabilize Long Running Client Runtime 2026-06

## Why

`chat-stream-render-isolation-2026-06` 已经把 chat renderer hot path 的局部问题做成可验证闭环: reducer fast path、streaming virtualization、workspace-scoped transient refs、30min TTL cleanup、`chat-stream/*` diagnostics。它解决的是 **chat stream render isolation**。

但用户现在反馈的下一阶段目标更大: 客户端长时间运行后,多个模块切换要丝滑不卡顿;多模块线程/进程需要隔离;资源要能释放;长任务不能越跑越卡。这个目标不能只继续改 `Messages`。它必须把 runtime residual 拆成三个 P0/P1 可落地闭环:

1. **P0 process bounded**: engine child process 不随 turn/session/workspace 生命周期漂移而泄漏。
2. **P1 DOM/projection bounded**: workspace/session/module list 不随 workspace 数和 session 数线性拖垮切换。
3. **P1 render/worker bounded**: 长输出渲染延续 `chat-stream-render-isolation-2026-06` 的 isolation 原则,但不重复改它已完成的 reducer/ref cleanup;重点补 worker pending/cache/diagnostics 边界。

当前代码事实:

- `ClaudeSession` 已有 `impl Drop` fallback,但 `OpenCodeSession` / `GeminiSession` 同样持有 `active_processes: Mutex<HashMap<String, Child>>`,缺少同等级 Drop 兜底。
- 已有 `get_engine_active_process_diagnostics` command 和 frontend service wrapper,应复用而不是新增平行 diagnostics command。
- `HomeChat` workspace picker 仍直接 `.map`;`ThreadList` / `Sidebar` 已有 status store,但 session list / background projection 仍需要 visible-row bounded contract。
- `fastMarkdownRenderer` worker substrate 已存在,下一步应扩展 pending request / stale result / cache diagnostics,而不是新造 worker pool。
- 当前 active process map 只证明 registry ownership,不等价于 OS child process 已退出;stale 判断也不能假设所有 engine 都已有统一 progress metadata。

## What Changes

- Adds OpenCode and Gemini child-process `Drop` parity with Claude, using non-blocking best-effort process cleanup.
- Extends active engine process diagnostics across Claude, OpenCode, and Gemini while keeping registry ownership separate from OS process liveness evidence.
- Adds diagnostics-only stale child candidate reporting with explicit unsupported markers when progress metadata is unavailable.
- Virtualizes large workspace/session lists and introduces visible-row lazy projection so module switching remains bounded under large histories.
- Extends Markdown worker lifecycle diagnostics for pending, fallback, dispose, and stale-result paths while keeping live streaming fragments lightweight.
- Encodes `S-LR-*` runtime evidence gates with measured/proxy/manual/unsupported qualifiers and defers true 15-30 minute Tauri/WebView long-run traces to release-grade follow-up evidence.

## Goals

1. **G1 child process bounded**: 关闭 workspace/session 后 30s 内 registered active engine child handles 归零;OS process liveness 必须单独采样或明确标记 unsupported/manual-only。
2. **G2 module switch smoothness**: 200 session / 多 workspace 下,Home/Sidebar/ThreadList 切换不因 DOM rows 或全量 projection 线性退化。
3. **G3 long output isolation**: 长 streaming 输出期间,live path 保持 lightweight progressive rendering;final heavy Markdown precompute 使用已有 worker-capable pipeline;worker pending requests 不单调增长。
4. **G4 no duplicated chat-stream work**: 不重复改 `chat-stream-render-isolation-2026-06` 已完成的 reducer fast path、workspace-scoped 6 refs、Messages local timer cleanup。
5. **G5 evidence first**: 所有性能声明进入 evidence gate,明确 `measured` / `proxy` / `manual-only` / `unsupported`。

## Non-Goals

- 不把 React state model 重写为 Zustand / Jotai。
- 不做 AppShell 全量拆分。
- 不修改 engine command public API 或 `useAppServerEvents(handlers, options)` public signature。
- 不新增第二套 Markdown worker pool;必须复用 `fastMarkdownRenderer` worker substrate。
- 不在本 change 处理 P2 全局 timer registry、image viewport release、handler split。它们是 `parallel-conversation-runtime-residuals` 后续项,但本 change 只做 P0/P1 三点。
- 不宣称 release-grade measured closure,除非真实 Tauri/WebView trace 已采集。

## Scope

### P0: Engine Child Process Lifecycle Parity

- 给 `OpenCodeSession` / `GeminiSession` 增加与 Claude 同级别的 non-blocking `Drop` kill fallback。
- 扩展 existing active process diagnostics 聚合 Claude / OpenCode / Gemini。
- 增加 stale child diagnostics-only 阶段: 首版只基于 registered age / known progress metadata 记录 stale candidate,不默认 kill;如果某 engine 没有 progress metadata,必须标记 `progressEvidence="unsupported"`。
- 将 registry bounded 与 OS process liveness evidence 分开: registry count 是 P0 自动 gate,OS child liveness 是 measured/manual/proxy gate,不能混写。
- Codex runtime 仅 audit;不强行塞入同一 Child map,避免误改独立 session runtime model。

### P1: Module Switch / Long List Bounded Rendering

- `HomeChat` workspace picker 在 100+ workspace 时启用 `@tanstack/react-virtual`。
- `ThreadList` / `Sidebar` session rows 在 100+ session 时启用 virtualization 或等价 bounded render。
- `Sidebar` 必须先定义 flattened virtual item model,覆盖 workspace header、thread row、pinned row、folder row、separator、load-more、empty-state 等混合节点,避免只优化局部 `.map`。
- `backgroundActivityByThread` / status projection 改为 visible-row lazy lookup + bounded LRU,避免切 workspace 时全量 `Object.fromEntries` / 全量 map。
- row identity 必须保持 `thread.id` / `workspace.id`,禁止 index key。

### P1: Streaming Render Isolation Extension

- 明确继承 `chat-stream-render-isolation-2026-06`: reducer fast path、streaming timeline virtualization、workspace-scoped transient refs、Messages timer cleanup 不重复实现。
- 扩展 Markdown worker path:
  - final Markdown serializable precompute 使用 existing `fastMarkdownRenderer` worker。
  - live streaming fragment 不触发 full rich parser per delta。
  - worker pending requests / fallback / dispose reject 有 adapter diagnostics;stale visible-result guard 保持在 hook/caller 层或显式引入 latest-source registry,不能让 adapter 猜 UI 最新状态。
- evidence gate 新增 long-running runtime budgets,包括 active process count、long-list visible rows、module switch p95、worker pending count、streaming visible lag。

## Risks

- **R1 Drop fallback 误阻塞**: `Drop` 不能 await,必须 `try_lock + start_kill`,失败只 log warning。
- **R2 stale reconciler 误杀**: 首版只 diagnostics-only;默认 kill policy 不启用。
- **R3 virtualization 破坏选中/滚动语义**: row identity、active row、scroll restoration 必须有 focused test。
- **R4 projection cache stale**: LRU key 必须包含 source version / status signature,不能只按 threadId 缓存。
- **R5 worker result 覆盖新内容**: worker result 必须带 content hash / options hash / request ordinal;stale result drop。
- **R6 evidence 口径漂移**: proxy evidence 不得写成 measured;archive readiness 必须保留 residual risk。
- **R7 registry 归零掩盖 orphan**: active registry count 为 0 只说明 handle map drained;OS process liveness 必须单独采样或标记 unsupported。

## Acceptance

- **AC-1** `OpenCodeSession` / `GeminiSession` drop 时,remaining child handles 被 best-effort `start_kill()` 并 drain。
- **AC-2** `get_engine_active_process_diagnostics` 返回 Claude / OpenCode / Gemini workspace rows,total count,timestamp,local/remote mode qualifier。
- **AC-3** 关闭所有 local runtime workspace 后 30s,registered active process diagnostics 为 0 或报告仍被 runtime registry 持有的 engine/workspace/turn id。
- **AC-4** 200 session / workspace list 下 rendered row nodes 有界(目标 ≤ 50,或按 overscan 明确说明)。
- **AC-5** thread/session row projection 只对 visible rows 计算,不可在切 workspace 时全量重建所有 background activity。
- **AC-6** live streaming Markdown 不对 partial fragment 执行 full rich parser per delta。
- **AC-7** worker pending requests 在 dispose / error / stale result 下全部 settle;pending count 不单调增长。
- **AC-8** 所有新增 diagnostics content-safe:只记录 ids/counts/timings/status/hash,不记录 prompt、assistant body、tool output、file content。
- **AC-9** `openspec validate stabilize-long-running-client-runtime-2026-06 --strict --no-interactive` pass。
- **AC-10** OS child process liveness evidence 与 registry diagnostics 分开记录;如果无法稳定采样,必须标记 `manual-only` 或 `unsupported`,不得把 registry 归零写成 OS 进程已退出。

## Execution Order / Handoff Plan

这个 change 必须按 P0 -> P1 list -> P1 render -> evidence closure 的顺序执行。不要把 P2 timer/image/handler split 插入本 change。

### Phase 0: Baseline And Guardrails

- 先完成 `tasks.md` 0.1/0.2。
- 明确当前 baseline: workspace count、session count、OS、run duration、registered active child count、module switch p95、visible row count、worker pending count。
- 把 `chat-stream-render-isolation-2026-06` 已完成项列成 do-not-duplicate checklist。
- Gate: baseline 必须标明 `measured` / `proxy` / `manual-only` / `unsupported`。

### Phase 1: P0 Engine Process Lifecycle

- 按顺序做 `tasks.md` 1.1 -> 1.6。
- 先补 `OpenCodeSession` / `GeminiSession` Drop parity,再扩展 registered active process diagnostics。
- stale child 首版只做 diagnostics-only;没有 progress metadata 的 engine 必须报 `progressEvidence=unsupported`。
- registry count 和 OS child liveness 必须分开记录,不得用 registry 归零推断 OS process 已退出。
- Gate: Rust focused tests + diagnostics command/service tests 通过;`S-LR-100` / `S-LR-101` 有 evidence 或 explicit unsupported marker。

### Phase 2: P1 Home And Sidebar Long Lists

- 先做 `tasks.md` 2.1/2.2,再做 3.1 -> 3.5。
- HomeChat workspace picker 是低耦合入口,先验证 `@tanstack/react-virtual` 接入方式。
- Sidebar 必须先定义 `SidebarVirtualItem`,再虚拟化 ThreadList/Sidebar;禁止只优化一个局部 `.map` 后声称完成。
- visible-row projection 和 bounded LRU 必须在 virtualization 后接入,避免切 workspace 时全量 projection。
- Gate: 200 workspace/thread fixture 下 DOM row count 有界,active/selected/pinned/processing rows 仍可达,`npm run perf:long-list:baseline` 不退化或记录 residual blocker。

### Phase 3: P1 Markdown Worker Lifecycle

- 按顺序做 `tasks.md` 4.1 -> 4.4。
- worker adapter 只负责 pending/dispose/fallback/unknown-response lifecycle diagnostics。
- stale visible-result guard 归 hook/caller 层,除非显式新增 latest-source registry。
- live streaming partial fragment 不跑 full rich parser per delta;final large Markdown 复用 existing worker-capable path。
- Gate: worker pending 在 dispose/error 后归零;stale result 不覆盖新内容;`S-LR-300` / `S-LR-310` 有 evidence 或 explicit marker。

### Phase 4: Evidence Closure

- 最后做 `tasks.md` 5.1 -> 5.4。
- 每个 `S-LR-*` metric 必须有 source path 和 evidence class,或者明确 unsupported/manual-only rationale。
- Gate: OpenSpec strict validation、typecheck、lint、focused tests、perf reports、15-30min local trace。

### Parallelization Rules

- Phase 1 必须先落地,它是 P0 safety baseline。
- Phase 2 的 HomeChat 与 Sidebar item model 可以并行,但 Sidebar virtualization 必须等 `SidebarVirtualItem` model 确认后再做。
- Phase 3 可以与 Phase 2 并行,但最终 evidence closure 必须等 Phase 1/2/3 全部完成。
- P2 follow-up 只记录,不在本 change 内实现。

## Validation

- `openspec validate stabilize-long-running-client-runtime-2026-06 --strict --no-interactive`
- Rust focused tests for OpenCode/Gemini drop fallback and active process diagnostics.
- Vitest focused tests:
  - HomeChat virtualized workspace picker.
  - ThreadList/Sidebar bounded rows and visible projection.
  - Markdown worker pending request diagnostics and stale-drop.
- `npm run typecheck`
- `npm run lint`
- `npm run perf:long-list:baseline`
- `npm run perf:realtime:runtime-report`
- `bash scripts/perf-reproduce-jank.sh` 15-30min local trace,with platform qualifier.
- Optional/manual OS child liveness sample after workspace close,with platform qualifier and unsupported marker when unavailable.

## Relationship To Existing Changes

- Builds on `chat-stream-render-isolation-2026-06`;does not reopen its completed reducer/ref/timer work.
- Extends `parallel-conversation-runtime-residuals` from Claude-only P0 closure to multi-engine process parity.
- Extends `long-list-virtualization-performance` from message timeline into Home/Sidebar/session list surfaces.
- Extends `markdown-parse-pipeline` with worker pending/request lifecycle diagnostics.
- Extends `runtime-performance-evidence-gates` with long-running client runtime evidence fields.
