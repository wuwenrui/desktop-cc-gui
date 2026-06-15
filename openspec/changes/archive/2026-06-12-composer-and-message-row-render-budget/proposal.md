# composer-and-message-row-render-budget

## Why

roadmap `P1-10 Composer 响应性保护` 与 `P1-03 Message Row 稳定渲染` 指向同一条 renderer hot path：用户在 Composer 输入时，active thread 可能同时接收 streaming delta、session activity、radar、scroll key、message projection 等高频更新。当前仓库已经有 `npm run perf:composer:baseline`、`runtime-performance-evidence-gates`、`rendererDiagnostics`、`MessagesRows.tsx` 和 ChatInputBox IME hooks。代码回滚后的事实是：`useComposerEditorState` 当前只管理 composer 高度，不是 draft value source of truth；因此本 change 不应假设需要“大拆 Composer 状态”，而是要以证据先行方式定位真实 rerender path，再做局部稳定化。

## Code Facts / 现状事实

- `src/app-shell.tsx` 同时调用 `useWorkspaceFiles`、`useComposerEditorState` 并承载大量 shell state，Composer 容易被父级刷新牵连。
- `src/features/composer/hooks/useComposerEditorState.ts` 当前只持久化 `textareaHeight`，不是 Composer draft value source；任何实现不得把本文件误判为输入正文状态中心。
- `src/features/composer/components/ChatInputBox/hooks/useIMEComposition.ts`、`useControlledValueSync.ts`、`utils/imeCompatibility.ts` 已存在，IME 保护应复用这些边界，不另起一套输入实现。
- `scripts/perf-composer-baseline.ts` 当前采集 `S-CI-50` 与 `S-CI-100-IME` 的 `keystrokeToCommitP95`、`inputEventLossCount`、`compositionToCommit`，证据类型目前主要是 fixture / jsdom proxy。
- `MessagesRows.tsx` 已是 conversation rendering 核心，不适合一次性大重写；需要先加 render count diagnostics，再对高频 props 和派生集合做定点稳定化。

## Problem / 问题

- streaming 或 session panel 刷新期间，Composer 输入可能被无关 state update 拖慢。
- IME composition 期间如果 controlled value 被外部刷新覆盖，会表现为拼音断、候选消失或最终文本丢失。
- 长会话下 assistant live row 更新可能让历史 rows 跟随 rerender，CPU 成本随 rows 数增长。
- 当前 baseline 有 composer proxy，但缺真实业务 Composer / MessageRows 的 render budget 字段。

## Goals / 目标

- Composer draft value 的 source of truth 保持在 Composer / ChatInputBox-local 边界；先用 diagnostics 证明 value path 是否被 global streaming / radar / activity tick 牵连，再做局部隔离。
- IME composition lifecycle 继续由 ChatInputBox 现有 hooks 负责，并补齐 streaming 干扰回归测试。
- Input history hydration 不阻塞 first paint / first keystroke，thread switch 或 unmount 后 stale result 不落地。
- `MessagesRows` 的历史 row props 在 live delta 期间保持 stable identity；高成本派生 map/set 以 source version 缓存。
- 增加 diagnostics：composer commit latency、input event loss、live/history row render count、row subtype render count。
- 将 composer / message-row budget 接入 `runtime-performance-evidence-gates`，保留 `measured` / `proxy` / `manual-only` / `unsupported` 分类。

## Non-Goals / 非目标

- 不重做 Composer UI、快捷键、`@file reference`、slash command、memory picker 或 provider selector。
- 不替换 React state model 或引入新状态管理库。
- 不改变 Markdown / Tool / Diff / Browser Context / Intent Canvas 等 row subtype 的显示语义。
- 不把 jsdom proxy baseline 包装成 release-grade measured evidence。

## Delivery Boundaries / 交付边界

1. **Evidence first**：先在 dev/test 环境记录 Composer 和 `MessagesRows` render evidence，确认当前热点。
2. **Composer isolation**：以 `ChatInputBoxAdapter` / ChatInputBox value path 为主审计对象；`useComposerEditorState` 仅确认高度状态不参与正文 rerender，input history 改为 background hydration。
3. **Row stability**：在不改变 row 语义的前提下稳定 props、memo derived collections、拆出必要 subtype memo boundary。
4. **Gate integration**：扩展 `runtime-evidence-gates` budget 字段；proxy 证据只能 advisory，真实运行证据可作为 fail-ready。

## Initial Budgets / 初始预算

- `S-CI-50/keystrokeToCommitP95`: target `16ms`, hard fail `32ms`，沿用现有 perf aggregate budget。
- `S-CI-100-IME/inputEventLossCount`: target `0`, hard fail `1`。
- Streaming fixture 中 non-live history rows render count：target `0`，hard fail `<= 1`，证据先标 `proxy`，真实 browser/runloop evidence 到位后升为 `measured`。
- Runtime diagnostics 单次 payload 不得包含 prompt text、assistant body、tool output 或 file content，只允许 ids/counts/timings/booleans。

## Risks / 风险

- 过度 memo 可能掩盖必要更新，必须用 source version 和 row subtype tests 覆盖。
- Composer isolation 若切错 source of truth，会造成 stale draft 或 undo/redo 回归。
- IME 测试在 jsdom 中只能覆盖事件顺序，不代表所有 WebView 输入法行为；需要保留 manual-only 平台记录。
- Render diagnostics 自身不能在每个 token 上追加 unbounded entries，必须 aggregate / sample。

## Acceptance Criteria / 验收口径

- streaming 期间 Composer value path 不被无关 shell 高频 state 强制刷新，`S-CI-50` 和 `S-CI-100-IME` 不退化。
- IME composition 在 streaming 干扰下 `inputEventLossCount = 0`，最终 committed text 保持完整。
- 固定 streaming fixture 中，历史 rows 不因 live delta 反复 rerender；必要 sticky / scroll anchor 更新有明确上限。
- Input history hydration 不阻塞 Composer first paint / first keystroke，stale hydration 被丢弃。
- `runtime-performance-evidence-gates` 输出 composer / message-row budget 字段，且 evidence class 不夸大。

## Validation / 验证

- `vitest` 覆盖 IME composition + controlled value sync + stale history hydration。
- `MessagesRows` render-count fixture 覆盖 live row vs history rows。
- `npm run perf:composer:baseline`
- `npm run perf:realtime:boundary-guard`
- `npm run check:runtime-evidence-gates`
- `npm run typecheck`
- `npm run lint`
- `openspec validate composer-and-message-row-render-budget --strict --no-interactive`

## Execution Order / 执行顺序

- **Position**: Step 1 of 5 (串行链最前)
- **Predecessors**: 无前置 change（本 change 是 P1 串行链起点）
- **Successors**:
  - Step 2 `renderer-resource-backpressure` 会拆 `app-shell.tsx` listener owner；本 change 必须先确定 Composer / ChatInputBox value path 的真实依赖边界，并完成必要局部隔离，避免 Step 2 在同一渲染链上盲改。
  - Step 4 `workspace-tree-and-large-file-listing-budget` 会复用本 change 暴露的 `rendererDiagnostics` schema。
  - Step 5 `markdown-off-main-thread-pipeline` 会复用本 change 的 `runtime-performance-evidence-gates` 字段。
- **Required Public Artifacts / 本 change 必须对外暴露**:
  1. `rendererDiagnostics` 暴露的 composer / message row 字段命名（与 Step 2/4/5 约定前缀，如 `composer.input.p95` / `messages.row.renderCount`）。
  2. `runtime-performance-evidence-gates` 新增 `composer.*` / `messages.*` 字段占位（值可空，下游 change 补完）。
  3. `ChatInputBox IME` hook 稳定契约（`useIMEComposition` / `useControlledValueSync` / `imeCompatibility`）—— Step 2 改 `app-shell.tsx` 时不会破坏 IME 路径。
- **Blocking Rule**: 本 change 不通过 `openspec validate`、Composer / message row diagnostics schema 未落地、`useComposerEditorState` 非正文状态事实未记录前，Step 2 不应启动涉及 `app-shell.tsx` / Composer 渲染链的改动。
