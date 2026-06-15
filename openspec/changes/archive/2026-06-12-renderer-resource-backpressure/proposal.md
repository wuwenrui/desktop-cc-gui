# renderer-resource-backpressure

## Why

roadmap `P1-11 Terminal / Runtime 输出背压`、`P1-12 Listener / Polling / Timer 预算审计`、`P1-09 图片与 Deferred Media 内存管理` 都属于 renderer resource pressure：事件输入、长期订阅、timer/polling 和 media buffers 如果没有 owner 和 budget，会在多 workspace、多 panel、长 session 下持续消耗 CPU/内存。当前仓库已经有 `src/services/events.ts`、`rendererDiagnostics.ts`、terminal/runtime subscriptions、`useWorkspaceRefreshOnFocus`、大量 panel-level effects，以及 existing realtime perf gates。代码回滚后的事实是：`eventBackpressure` 与 listener owner registry 尚未落地；本 change 是 P1 串行链真正的 renderer resource substrate，不是普通面板优化。

## Code Facts / 现状事实

- `src/services/events.ts` 暴露 `subscribeTerminalOutput`、`subscribeRuntimeLogLine`、`subscribeRuntimeLogStatus`、`subscribeRuntimeLogExited` 等高频入口。
- `src/services/events.ts` 当前仍是基于 `Set<Listener<T>>` 的裸 event hub；没有 event kind criticality、flush cap、queue depth 或 owner metadata。
- `src/services/rendererDiagnostics.ts` 已注册 heartbeat、blank-screen watchdog、focus/blur/visibility/page/error listeners，且已有测试覆盖“只安装一次”等行为。
- `src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts` 已有 cooldown / pending refresh guard，但还不是可复用的 `useFocusRefresh` / focus wave 公共契约。
- `rg "addEventListener|setInterval|setTimeout|listen\(" src` 显示 listener/timer 广泛分布在 app shell、git history、settings、session activity、file tree、terminal、kanban 等面板。
- `npm run perf:realtime:boundary-guard` 与 `npm run perf:realtime:extended-baseline` 已存在，可作为 realtime proxy/regression gate。

## Problem / 问题

- Terminal/runtime burst output 可能比 React render 更快，导致 state update 挤压 chat streaming、scroll 和 input。
- Listener/timer/polling 没有统一 lifecycle owner，inactive panel 可能继续订阅或轮询。
- Focus/visibility 恢复时多个 hook 独立 refresh，形成 refresh storm。
- Deferred media/object URL/base64 buffer 缺统一释放证据，内存曲线可能只增不降。
- Diagnostics 自身也可能成为长期 listener/timer 来源，需要明确 budget。

## Goals / 目标

- 为 terminal/runtime output 建立 bounded queue + per-frame flush + critical-event bypass。
- 对重复 runtime status event 做 coalescing，记录 dropped/coalesced/queueDepth/flushDuration。
- 建立 listener/timer/polling owner taxonomy：`bootstrap`、`shell`、`workspace`、`panel`、`modal`。
- 先覆盖 high-risk surfaces 的 owner 注释/registry/test，不要求一轮完成全仓所有临时 timer。
- 统一 focus/visibility refresh wave，避免多个 source 在同一 focus event 独立刷新。
- Deferred media/object URL 通过 owner collection 追踪，unmount/hidden/replaced 后释放。
- 扩展 renderer diagnostics 与 runtime evidence gates：backpressure、listener count、timer count、media count、diagnostics overhead。

## Non-Goals / 非目标

- 不改变 Tauri event protocol 或 terminal visual design。
- 不丢弃 critical runtime status、terminal exit、fatal error、session-ending event。
- 不引入新的图片懒加载库或 CDN/cache layer。
- 不要求所有 one-shot UI timeout 都进入同一抽象；本 change 优先治理长期订阅、高频事件和高风险 panel polling。

## Delivery Boundaries / 交付边界

1. **Backpressure core**：先在 terminal/runtime output path 引入 `eventBackpressure`，保持 raw export 可取回完整输出。
2. **Public substrate first**：先提交 `eventBackpressure` API、listener owner taxonomy、`useFocusRefresh` 契约和 diagnostics 字段命名；下游 Step 3/4 只依赖这些公共抽象。
3. **Diagnostics**：记录 queue depth、flush duration、dropped/coalesced counts，保证 diagnostics aggregate 而非逐事件爆炸。
4. **Lifecycle owner pilot**：对 app shell、rendererDiagnostics、terminal/runtime、workspace focus refresh、1-2 个高风险 panel 先落 owner registry/check。
5. **Focus wave**：统一 focus/visibility refresh scheduling，legacy hooks 逐步迁移。
6. **Media release**：优先治理 object URL / decoded buffer owner，不把普通 `<img src>` 全部强制改写。

## Initial Budgets / 初始预算

- Terminal/runtime non-critical event flush target: max `200` events/frame or max `128 KiB`/flush, whichever comes first; exact values may be tuned by evidence.
- Critical events MUST bypass queue or be delivered within `1` animation frame.
- Backpressure queue SHOULD keep recent non-critical output via ring buffer; raw log/export remains complete when backend retains source.
- Diagnostics heartbeat/watchdog frequency MUST be documented and reported; diagnostics entries must remain capped by existing rendererDiagnostics caps.
- Inactive panel long-lived listener/polling target: `0` for migrated pilot surfaces.

## Risks / 风险

- Backpressure over-aggressive coalescing may hide important status transitions; event kind classification must be explicit.
- Listener owner audit across the whole app is large; claiming 100% too early would be misleading, so pilot coverage and unsupported gaps must be visible.
- Object URL revoke too early can blank images; release timing must be after load/unmount/replacement and covered by tests.
- Focus wave coalescing must not delay user-visible freshness after returning to the app.

## Acceptance Criteria / 验收口径

- Terminal/runtime burst fixture no longer causes unbounded React update scheduling; backpressure diagnostics show bounded queue/flush behavior.
- Critical exit/fatal/session-ending events are never dropped and have explicit bypass tests.
- Migrated listener/polling surfaces declare owner and cleanup when inactive/unmounted; non-migrated surfaces are listed as residual risk, not silently claimed complete.
- Focus/visibility regain triggers one coalesced refresh wave for migrated sources.
- Deferred media/object URL owner releases resources on unmount/replacement, and diagnostics report active/revoked counts.
- `runtime-performance-evidence-gates` outputs backpressure/listener/media fields with accurate evidence class.

## Validation / 验证

- Unit tests for backpressure batching, byte/event caps, critical bypass, status coalescing, ring buffer eviction.
- Listener owner registry/check tests for migrated pilot surfaces.
- Focus wave coalescing tests.
- Deferred media object URL release tests.
- Diagnostics cap/content-safety tests.
- `npm run perf:realtime:boundary-guard`
- `npm run perf:realtime:extended-baseline`
- `npm run check:runtime-evidence-gates`
- `npm run typecheck`
- `npm run lint`
- `openspec validate renderer-resource-backpressure --strict --no-interactive`

## Execution Order / 执行顺序

- **Position**: Step 2 of 5
- **Predecessors**:
  - Step 1 `composer-and-message-row-render-budget` 必须已落地 —— Composer 状态已与 shell 解耦，本 change 才能安全拆 `app-shell.tsx` 的 listener owner 边界，否则会撞改 `useComposerEditorState` 的同一段。
- **Successors**:
  - Step 3 `backend-io-cache-and-bridge-payload-budget` 改 `services/tauri.ts` 周边时，listener owner 协议已就绪。
  - Step 4 `workspace-tree-and-large-file-listing-budget` 改 `useWorkspaceFiles` / `FileTreePanel` listener 时，复用本 change 的 owner registry。
- **Required Public Artifacts / 本 change 必须对外暴露**:
  1. `app-shell.tsx` listener owner registry 协议（`@owner bootstrap|shell|workspace|panel|modal` 注释 + lint 规则）。
  2. `rendererDiagnostics` 暴露 backpressure / listener / media 字段命名（与 Step 1/3/4 约定前缀，例：`events.backpressure.queueDepth` / `media.retained.count`）。
  3. `eventBackpressure` 抽象公共 API（`{ subscribe, push, flush, queueDepth, droppedCount }`）—— Step 3 / 4 复用。
  4. `useFocusRefresh` hook 公共契约 —— 后续 change 改 focus 触发的刷新统一走这条路径。
- **Cross-Change Constraint**: `services/rendererDiagnostics.ts` 与 `services/events.ts` 字段命名必须与 Step 1 / 3 预先对齐（建议在 Step 1 落地时同步在本仓 issue 或 `.trellis/spec/` 留 schema 占位）。
- **Blocking Rule**: `eventBackpressure` API、listener owner registry 协议、`useFocusRefresh` 契约和 diagnostics 字段命名未就绪前，Step 3 / 4 不应启动任何复用这些抽象的实现；允许 Step 3 做 backend inventory，但不得写 frontend bridge integration。
