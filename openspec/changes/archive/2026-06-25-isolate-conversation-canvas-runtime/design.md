## Overview

本设计将客户端拆成 five-zone runtime model：

- Top lane：topbar、session tabs、new session/create controls。
- Left lane：workspace/sidebar/thread list。
- Right lane：status/spec/git/activity/detail panels。
- Bottom lane：Composer、command controls、input feedback。
- Center lane：conversation canvas，承载高频 stream、Markdown/code/tool rendering、history hydration。

原则：center lane 可以丢弃派生中间态、延迟 heavy rendering、显示 lightweight placeholder；四周 lanes 不允许因为 center lane 的高频更新而失去点击/输入反馈。

> 🛠 **深度推演**：[L2/L3 分析摘要] 现象层的卡顿来自 message rows 和 Markdown 的重渲染；本质层是 renderer main thread 上没有明确的 resource owner 和 priority contract；设计层要把“实时内容吞吐”和“用户控制权”拆成两个不同 lane，前者追求最终一致，后者追求即时响应。

## Current Failure Model

当前架构已经有 batching、virtualization、deferred frame accumulator、lightweight mode 等止损点，但它们仍在同一个 React tree / renderer loop 内竞争：

1. Realtime event ingress 更新 conversation state。
2. Messages/MessagesTimeline 触发 row projection、hydration、Markdown/code/tool rendering。
3. App shell/layout/hooks 仍可能通过 broad state 或 callback dependencies 被牵连重算。
4. Topbar/sidebar/composer 与 canvas 共用 renderer main thread，用户点击和输入反馈排队。
5. 长时间运行后，listeners/timers/RAF/cache 如果未释放，会提高每帧 baseline cost。

## Architecture Decision

### Phase 1: In-Renderer Lane Isolation

Phase 1 不立即拆 WebView/process，而是在 renderer 内建立三条明确 lane：

- `interaction lane`: top/left/right/bottom controls. Must run first and keep stable props.
- `canvas lane`: conversation render, hydration, markdown heavy islands, virtualization.
- `background lane`: diagnostics, history reconciliation, cleanup, precompute, persistence-adjacent derivations.

Phase 1 implementation should introduce or reuse:

- A central render scheduler policy that can classify work as `interaction`, `canvas`, or `background`.
- Narrow pressure signals from canvas to shell, e.g. `canvasPressure: idle | streaming | overloaded`, instead of passing full message/runtime maps.
- Canvas queue backpressure: active stream may coalesce intermediate render snapshots and defer heavy islands.
- Interaction guard tests that simulate stream bursts while typing/clicking topbar/sidebar/composer.
- Cleanup registry/evidence for timers/listeners/RAF/idle callbacks/cache owners.

### Phase 2: Physical Canvas Runtime Candidate

If Phase 1 evidence still shows UI feedback blocked, evaluate physical split:

- Independent Tauri WebView/window for center canvas.
- IPC boundary sends semantic snapshots and user actions.
- Shell lanes remain in primary renderer.

Phase 2 is explicitly not the first implementation step because it risks focus handling, accessibility, copy/paste, scroll anchoring, theme propagation, and cross-platform WebView lifecycle regressions.

## Data Flow

```text
App server / provider events
  -> realtime adapter / reducer
  -> semantic conversation state
  -> lane scheduler
     -> interaction lane: small pressure flags, stable control props
     -> canvas lane: bounded snapshots, row projection, virtualization
     -> background lane: diagnostics, history reconcile, cleanup
```

## Runtime Contracts

- Interaction lane MUST NOT subscribe to full conversation item arrays just to display running state.
- Canvas lane MUST NOT force layout/topbar/sidebar/composer prop identity churn during stream bursts.
- Background diagnostics MUST be sampled and bounded; they MUST NOT synchronously block stream forwarding or input feedback.
- Long-running cleanup MUST have explicit owners. Every listener/timer/RAF/idle callback created by realtime/rendering code needs deterministic teardown.

## Memory and Resource Cleanup

The cleanup work focuses on resource classes that accumulate during long-running clients:

- Tauri/event listeners and app-server subscriptions.
- `setTimeout`, `setInterval`, RAF, idle callback queues.
- Markdown heavy island cache, code block render cache, precomputed render payloads.
- Virtualization measurement maps and hydration state.
- Diagnostics buffers and transient realtime summaries.

Each owner should expose a narrow cleanup path or be covered by existing component unmount cleanup. Tests should prove cleanup cancels late callbacks and prevents post-teardown state writes.

## Visual Layout Guard

The center canvas MUST preserve its intended dimensions:

- Virtualized placeholders must use measured row heights or bounded defaults.
- Lightweight mode must not stretch message groups into oversized blank blocks.
- Streaming placeholders must not change shell layout dimensions.
- Existing `.messages-virtualized-canvas` and conversation shell CSS must keep stable min/max constraints.

## Options Considered

| Option | Decision Detail |
| --- | --- |
| Continue memo-only optimization | Rejected as the main plan because it improves median cost but does not create priority isolation. |
| In-renderer lane scheduler | Chosen for Phase 1 because it can be verified quickly with existing React/Vitest gates and avoids platform-specific WebView risk. |
| Worker for Markdown/render precompute only | Useful as a sub-task, but incomplete because DOM reconciliation and layout still run on the renderer thread. |
| Separate WebView/process for canvas | Kept as Phase 2 candidate after Phase 1 metrics. It is the strongest isolation but requires a separate proposal checkpoint if Phase 1 evidence justifies it. |

## Migration Strategy

1. Add tests and diagnostics first so the target failure is measurable.
2. Narrow AppShell/control props and introduce interaction/canvas/background lane classification.
3. Move canvas heavy derivations behind scheduler boundaries and cleanup ownership.
4. Tighten CSS/virtualization guards for blank/oversized placeholders.
5. Run focused tests and full gates; compare runtime diagnostics before deciding Phase 2.

## Risks

- Over-coalescing canvas snapshots could hide useful live progress. Mitigation: terminal settlement and latest visible text must reconverge.
- Too much scheduling abstraction could add complexity. Mitigation: keep lane API tiny and colocated with existing `useRenderScheduler` / realtime flags.
- Physical WebView split could regress focus and copy/paste. Mitigation: defer to Phase 2 and require separate evidence.

## Verification Plan

- Focused Vitest:
  - messages timeline virtualization/lightweight mode/layout guard tests.
  - Composer responsiveness tests under stream pressure.
  - topbar/session tab render isolation tests.
  - listener/timer/cache cleanup tests.
- Global gates:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run check:runtime-contracts`
  - `npm run check:large-files`
  - `npm run check:heavy-test-noise`
  - `openspec validate isolate-conversation-canvas-runtime --strict --no-interactive`
