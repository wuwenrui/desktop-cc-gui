## Why

实时对话期间，conversation canvas 会同时承担 stream ingestion、Markdown/code/tool rendering、history hydration、virtualization 和 diagnostics，容易在同一个 renderer main thread 内抢占顶部/侧边/底部控制区的交互预算。上一轮优化已经降低了部分渲染成本，但用户仍能感知到按钮点击、创建新会话、Composer 打字和面板切换卡顿，说明问题已经不只是单点渲染放大，而是 surface resource isolation 不足。

本变更把客户端按上、下、左、右、中五个区域重新建模：中间 conversation canvas 是高吞吐可降级 runtime，四周 shell/control surfaces 是高优先级 interaction lane。实时运行时，canvas MUST NOT 独占 renderer 资源，控制区 MUST 保持可点击、可输入、可切换。

## What Changes

- 新增 conversation canvas runtime isolation contract：定义 canvas 与 shell/control surfaces 的资源隔离、优先级、背压和降级行为。
- 修改 AppShell runtime boundary：五区 surface ownership 必须显式拆分，layout/topbar/sidebar/composer 不再依赖 canvas 高频派生状态。
- 修改 realtime input render budget：Composer typing 和 button feedback 在实时 stream 压力下拥有优先预算，不能被 canvas render queue 阻塞。
- 修改 client renderer stability：长时间运行后的 memory/resource cleanup 需要可观测、可验证，避免 stale listener/timer/cache 继续拖慢 renderer。
- 修改 topbar render isolation：topbar/session tabs/new-session controls 必须与 active canvas runtime 的高频更新断开。
- 不改变各供应商创建会话的业务语义；Codex、Claude、Gemini、OpenCode 的 conversation semantics 保持现有兼容。

## 目标与边界

- 目标：让实时对话期间的 shell/control interaction lane 优先于 canvas render lane。
- 目标：降低长时间运行后的 resource retention 风险，补齐 listener/timer/cache cleanup evidence。
- 目标：提供 automated guard，证明 active stream 下 topbar/sidebar/composer 不被 canvas update 放大重渲染。
- 边界：优先解决同一个 renderer 内的调度与 ownership 隔离；是否升级为独立 WebView/window/process 由 design 中的 phased decision 控制。

## 非目标

- 不重写所有 message rendering 组件。
- 不改变 provider protocol、conversation item schema、history persistence schema。
- 不把所有 UI surface 物理拆成独立窗口作为第一步交付。
- 不降低实时内容最终一致性；canvas 可以降级展示，但 terminal settlement 和 history reconciliation MUST remain correct。

## Capabilities

### New Capabilities

- `conversation-canvas-runtime-isolation`: covers five-zone shell/canvas priority separation, canvas backpressure, interaction lane responsiveness, and long-run cleanup evidence.

### Modified Capabilities

- `app-shell-runtime-boundaries`: require AppShell/layout ownership to separate canvas runtime pressure from top/sidebar/bottom/side control surfaces.
- `realtime-input-render-budget`: require Composer typing and immediate command/button feedback to keep an interaction budget under live stream pressure.
- `client-renderer-stability-under-pressure`: require resource retention diagnostics and cleanup gates for long-running clients.
- `topbar-render-isolation`: require topbar/session-tab/new-session controls to remain isolated from active canvas render churn.

## Impact

- Frontend runtime boundaries: `src/features/layout/**`, `src/features/app/**`, `src/features/messages/**`, `src/features/composer/**`, `src/features/threads/**`, `src/hooks/useRenderScheduler.ts`.
- Diagnostics and tests: renderer diagnostics, render scheduling policy, listener/timer cleanup tests, interaction latency guards, heavy-test-noise sentry.
- CSS/layout: conversation canvas container sizing and virtualization placeholders MUST preserve visual dimensions without stretching the canvas.
- No new dependency is planned for phase 1. If phase 2 requires Worker/OffscreenCanvas/WebView split, dependency and platform support will be evaluated separately.

## 技术方案取舍

| Option | Summary | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A. 继续局部 memo/virtualization 优化 | 在现有 component tree 内继续降低 render cost | 低风险、改动小 | 已经证明只能缓解，不能保证控制区优先级 | Reject as primary |
| B. Renderer 内 lanes + ownership split | 建立 interaction lane / canvas lane / background lane，canvas queue 可背压，control props 狭窄化 | 能快速落地，风险可控，不改变 provider semantic | 仍共享一个 renderer main thread，需要严格 budget guard | Phase 1 |
| C. Canvas 独立 WebView/window/process | 把中间幕布作为独立 rendering runtime，四周 shell 在独立 context | 隔离最彻底 | Tauri window/WebView 生命周期、focus、IPC、CSS、accessibility 风险高 | Phase 2 candidate after Phase 1 evidence |

## 验收标准

- 实时 stream 压力下，new session button、session tab switch、sidebar click、Composer typing 的测试 guard MUST 不被 canvas update 放大重渲染。
- 中间 canvas 在 active stream 时可以启用 bounded snapshot/placeholder/backpressure，但 top/sidebar/bottom/side controls MUST preserve immediate visual feedback.
- 长时间运行 cleanup guard MUST 覆盖 listener、timer、RAF、idle callback、heavy markdown/cache entries，且 teardown 后不得继续 setState。
- `openspec validate isolate-conversation-canvas-runtime --strict --no-interactive` MUST pass.
- 受影响 TypeScript tests、`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts`、`npm run check:heavy-test-noise` MUST pass before archive.
