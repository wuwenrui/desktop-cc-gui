## Why

近期客户端性能优化只覆盖了 workspace session / settings 列表一部分成本，但用户真实体感卡顿集中在更热的运行时链路：实时对话期间输入框打字卡顿、长 streaming 输出导致整屏响应下降、切换会话不丝滑、sidebar/session catalog hydration 抢占主线程。

这类问题不是单个列表 page size 或单个 Markdown render 慢，而是 live conversation、Composer、thread switch、sidebar projection、session catalog 共同放大 React commit 和 backend hydration 成本。需要建立一个深入性能优化提案，把所有 hot path、验收预算、验证证据与回滚边界一次性梳理清楚，避免继续做局部止血。

## 目标与边界

- 建立客户端运行时交互性能的完整优化范围，覆盖 realtime typing、streaming render、thread switching、sidebar/session projection、session catalog hydration。
- 保证实时对话期间 Composer 输入、IME composition、selection、attachments、send payload 不被 streaming advisory state 拖慢或改写。
- 保证切换会话优先完成可感知的 foreground transition，把非关键 hydration、right panel collapse、catalog prewarm、status projection 放到 transition / idle / staged path。
- 将 session catalog、related attribution、workspace projection、Session Radar prewarm 的数据获取改成 bounded / cached / deduped，不让后台列表刷新压住前台输入和切换。
- 建立可执行证据门禁：React commit duration、input latency、long task、render count、catalog request count、thread switch visible latency、streaming visible cadence。
- 保留现有 conversation correctness：消息顺序、thread identity、terminal settlement、session membership truth、folder assignment、runtime continuity 不因性能优化改变。

## 非目标

- 不重写 AppShell 或整体状态管理框架。
- 不迁移到新的 global state library。
- 不改变 engine runtime、provider streaming protocol、session deletion/archive/folder tree 的业务语义。
- 不把 `workspace-only` session attribution 设为默认，也不改变 `related` 模式的兼容行为。
- 不用纯视觉 skeleton 掩盖真实切换慢；优化必须减少或调度真实主线程/IO成本。
- 不引入新第三方依赖，除非现有 React/TanStack/浏览器 API 无法提供必要能力且另有维护性评估。

## What Changes

- 补齐 realtime conversation performance budget，从“streaming 可见输出”扩展到“streaming + active typing + session switch + sidebar hydration”的端到端交互预算。
- 将 Composer hot path 从高频 live state 中隔离：
  - `ChatInputBox` 的 source-of-truth 继续保持 local/ref driven。
  - context usage、rate limit、stream activity、status panel、thread status 等 advisory props 必须 deferred / structurally stable。
  - `ChatInputBoxAdapter` comparator 需要覆盖会在 streaming 中频繁重建的复杂 props。
- 重构 status panel / subagent projection 的计算边界：
  - active Composer render path 不得每个 delta 扫描全部 `threadItemsByThread` 或全量 `threadStatusById`。
  - 多线程/subagent 聚合应使用 scoped cache、indexed projection 或 deferred summary。
- 优化 `Messages` streaming render：
  - 保留 stable timeline snapshot + live row override contract。
  - 防止 timeline-heavy derivations、scroll work、anchor/sticky/boundary 计算重新进入每 delta 热路径。
  - Stop、copy、fork、rewind、message toolbar、context controls 等交互控件不得等待 live timeline / status / catalog 重算完成。
  - 评估 thinking 状态下 timeline virtualization / content visibility / active row chunking 的可行边界。
- 优化会话切换：
  - foreground selection state 先提交。
  - right panel/layout mutation、engine inference、history restore、workspace thread list hydration、catalog prewarm 分层调度。
  - repeated rapid switching 需要 request token / stale guard，后返回不得覆盖当前 thread。
- 优化 sidebar / topbar session list render：
  - active thread change 或 processing pulse 不应重建整个 workspace folder projection。
  - thread rows、folder projection、move targets、running/recent counts 需要按 workspace / primitive dependency memoize。
- 优化 session catalog / attribution mode 对前台的放大效应：
  - 移除 first-page `SESSION_CATALOG_PAGE_SIZE = 9_999` 这类伪分页。
  - `related` mode 的候选合并必须 cache / dedupe / bounded。
  - settings search keyword 和 filter 更新需要 debounce / transition，不能每个 keystroke 打满 backend。
- 增加性能验证和诊断：
  - streaming + typing fixture，覆盖普通输入和 IME。
  - thread switch fixture，覆盖大 workspace / many sessions / active streaming。
  - sidebar projection fixture，覆盖 folder tree、worktree、running sessions、recent completed。
  - browser-level profiler / long-task evidence，不能只依赖 jsdom proxy。

## 技术方案

### Option A: 局部补丁式优化

只降低 session catalog page size、给 settings search 加 debounce、给几个组件加 `memo`。

- 优点：改动小、短期容易落地。
- 缺点：只能缓解 settings/session list 局部慢；无法解决实时输入和切换会话这两个主症状；容易继续让新的 live props 击穿 memo；缺少证据门禁。

### Option B: Hot-path 分层优化

按用户体感 hot path 切层：Composer input source-of-truth、Messages live row、StatusPanel projection、thread switch transition、sidebar projection、session catalog hydration 各自定义预算、依赖边界、缓存和回滚开关。

- 优点：直接对准打字卡顿、切换卡顿、长 streaming 卡顿；能用 profiler 证明每层收益；不会把全部风险压到一次大重写。
- 缺点：需要跨多个 frontend slice 梳理依赖，并补充针对性能的 focused tests / profiler evidence。

### Option C: 大规模 AppShell 状态架构重构

把 `app-shell.tsx` 和 layout nodes orchestration 大规模拆分为新的状态域或引入全局 store。

- 优点：长期可能降低 AppShell orchestration 熵。
- 缺点：风险大、回归面极广，短期不一定解决 hot path；容易把性能任务变成架构迁移。

### 决策

采用 Option B。先围绕用户可感知交互定义预算和调度边界，再按层落地优化。AppShell 结构问题可以作为后续重构输入，但本 change 不以大迁移为交付前提。

## Capabilities

### New Capabilities

- 无。该 change 深化既有 realtime / performance / session projection 能力，不新增平行 capability。

### Modified Capabilities

- `conversation-realtime-client-performance`: 扩展 realtime 性能预算，明确 streaming + active typing、Composer advisory props、status projection、thread switch visible latency 的行为要求。
- `long-list-virtualization-performance`: 扩展长会话和 active streaming row 的 render boundary，要求长列表/长行优化不能只依赖非 streaming virtualization。
- `runtime-performance-evidence-gates`: 增加客户端交互性能证据门禁，区分 measured / proxy / manual-only，并要求记录 input latency、commit duration、long task、switch latency。
- `workspace-session-catalog-projection`: 要求 session catalog first page、related attribution、projection summary 使用 bounded pagination / capped scan / cache，不得用伪分页阻塞 foreground。
- `workspace-session-radar-overview`: 要求 Radar / prewarm 不得用后台 hydration 抢占前台输入与会话切换，且全局聚合更新应保持 bounded、deduped、staged。

## 验收标准

- Streaming 期间连续输入 50 个普通字符和 100 个 IME composition 步骤时，Composer draft text、selection、composition、attachments、send payload 保持正确，输入不等待 Messages timeline 重算完成。
- 在长 assistant streaming 输出期间，`ChatInputBoxAdapter` 不因 structurally equal context usage / rate limit / stream activity / status props 反复 rerender。
- `useStatusPanelData` 或其替代 projection 在 active typing + streaming 时不得每个 delta 全量扫描所有 thread items。
- 切换会话时，foreground active thread selection 和可见 header/message shell 先完成；history restore、catalog hydration、sidebar prewarm 的后续结果必须有 stale guard。
- 大 workspace 下 thread switch 不触发整个 sidebar folder projection 的无必要重建；active row 高亮变化应限制在相关 workspace/row。
- Session catalog first page 不再以 `9_999` 条作为默认请求量；filter keyword 输入有 debounce / transition；related mode 有 bounded scan 或 partial/degraded evidence。
- Messages streaming contract 继续满足 stable timeline snapshot + latest live row override；优化不得导致 live row 延迟到 history replay 才可见。
- 长 streaming 输出期间，Stop 按钮、message toolbar、copy/fork/rewind、context controls、scroll interaction 的点击响应不得被 timeline grouping、status projection、catalog hydration 或 sidebar projection 阻塞。
- 性能证据必须至少包含一组 browser-level 或 Tauri/WebView profiler 记录；jsdom fixture 只能作为 proxy evidence，不得单独标记 release-grade measured。
- 所有优化层必须 rollback-safe；禁用某一层优化时，runtime continuity、terminal settlement、session membership 不被破坏。

## Impact

- Frontend:
  - `src/features/composer/components/Composer.tsx`
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
  - `src/features/composer/components/ChatInputBox/**`
  - `src/features/status-panel/hooks/useStatusPanelData.ts`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/messagesTimelineVirtualization.ts`
  - `src/app-shell.tsx`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts`
  - `src/app-shell-parts/useWorkspaceThreadListHydration.ts`
  - `src/features/app/components/Sidebar.tsx`
  - `src/features/app/components/ThreadList.tsx`
  - `src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.ts`
- Backend / service boundary:
  - `src/services/tauri/sessionManagement.ts`
  - `src-tauri/src/session_management*.rs`
  - workspace session catalog pagination / source status / attribution mode query.
- Tests / evidence:
  - focused Vitest tests for Composer comparator, streaming typing, thread switch stale guard, sidebar projection stability.
  - Rust tests for bounded session catalog behavior where backend contract changes.
  - performance fixtures / profiler scripts for input latency, thread switch latency, long streaming render.
- Dependencies:
  - No new dependency expected.
