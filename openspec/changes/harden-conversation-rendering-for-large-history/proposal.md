## Why

Issue #721 reports a different class of performance failure than the archived realtime event-ingress work: settings and project pages stay mostly smooth, while conversation history with long Markdown, tables, tool cards, batch file-read cards, diffs, popovers, and anchors causes scroll jank, layout overlap, delayed input feedback, and occasional full-app `Application Error` with React #185 / update-loop symptoms.

The follow-up comment on #721 turns this into a concrete acceptance target: startup update checks should be split from the conversation work, while the conversation surface needs lightweight mode, viewport-bounded rendering, default-collapsed heavy cards, repeated measurement/popover/anchor loop audits, complex Markdown/diff protection, selected-conversation on-demand loading, an oversized-history warning path, and more specific local error diagnostics.

## 目标与边界

- 目标：把 long conversation restore / history browsing / heavy message rows 的 render cost 变成 viewport-bounded、lazy-hydrated、locally recoverable 的路径。
- 目标：让 React #185 类 conversation-row failure 被局部隔离和诊断，不再直接升级成全局 `Application Error`。
- 目标：给大型本地工作区提供 explicit lightweight conversation mode 与 oversized-history degrade prompt，而不是让用户只能等待卡死或重启。
- 目标：审计 conversation open path 是否仍存在老的 eager all-history / all-detail render 接入，并把选中对话的解析、hydration、measurement 约束到按需路径。
- 目标：长时间运行后释放 hydration cache、measurement observers、popover/anchor listeners、pending timers/requests，避免资源累积反噬交互流畅度。
- 边界：优先治理 conversation surface；复用现有 `@tanstack/react-virtual`、Markdown worker/cache、renderer diagnostics、message-row memo boundaries。
- 边界：只在 evidence 显示 hot path 后改具体组件，不做全量 message renderer 重写。

## 非目标

- 不在本 change 内改 updater 自动检查频率。Issue #721 的 updater 诉求应另开小 change（建议 `nonblocking-configurable-update-check`）复用 `updater-check-fallback`；本 change 只把该拆分写入 closure gate，避免把 startup UX 混进 conversation renderer。
- 不把 message renderer 迁移到 OffscreenCanvas / full Web Worker React 替代方案。
- 不改变 conversation reducer state shape、message identity、history ordering、tool-card persistence semantics。
- 不用“默认隐藏所有历史内容”掩盖性能问题；任何折叠、懒加载、虚拟化都必须保留用户可解释的 scroll / anchor / copy 行为。

## What Changes

- Add a heavy-history render budget for restored conversation timelines: row count alone is insufficient; render weight from Markdown tables, code blocks, tool cards, read-file batches, diffs, images, popovers, and anchor rails must trigger bounded rendering.
- Extend timeline virtualization to preserve active/selected rows while lazy-hydrating heavy non-visible rows through stable placeholders and viewport remeasure.
- Add explicit conversation lightweight mode that can be auto-suggested for heavy histories and manually enabled per conversation/session without changing canonical data.
- Add selected-conversation on-demand render/load auditing: opening one conversation must not synchronously render or hydrate all historical conversations or every heavy detail in the selected conversation.
- Add Markdown heavy-block island behavior for conversation messages so large final/restored Markdown tables and code-heavy blocks do not synchronously hydrate every rich node on history open.
- Add tool/read/diff card preview hydration rules: non-visible or collapsed heavy cards render bounded summaries first and hydrate details on viewport entry or explicit expansion.
- Add oversized/complex history degrade prompt so extreme cases open into a recoverable lightweight surface with user-visible options instead of freezing or crashing.
- Add anchor/popover/measurement loop guards and long-running resource cleanup for observers, timers, hydration queues, and bounded caches.
- Add conversation-local error containment for React #185 / update-loop-style row failures with content-safe diagnostics and recovery affordance, preventing full app crash where possible.
- Add focused performance evidence gates for a #721-class fixture: long restored conversation, many tool/read/diff cards, tables, anchors, and scroll interaction.

## 技术方案对比

### 方案 A：全局降低 rich render fidelity

- 优点：diff 小，短期可能减少卡顿。
- 缺点：会牺牲 Markdown/table/diff 可读性；无法解释 anchor、copy、scroll restore；对 React #185 没有根因治理。
- 结论：不选。它是掩盖症状。

### 方案 B：conversation surface 分层预算（推荐）

- 做法：保留 canonical conversation state，render layer 按 viewport + render weight 建 projection；heavy Markdown/tool/diff card 先 summary/placeholder，再按 viewport/expand hydrate；conversation row error boundary 局部兜底。
- 优点：复用现有 virtualization 和 diagnostics，风险可控；直接覆盖 #721 的长历史、重元素、崩溃隔离。
- 缺点：需要精确处理 scroll restoration、anchor jump、copy/export、measurement cache。
- 结论：采用。

### 方案 C：重写为 worker/offscreen renderer

- 优点：理论上主线程压力最低。
- 缺点：工程量大，React-bound rich components、file links、tool actions、sanitization、i18n 都要重接；不适合作为当前 P0 修复。
- 结论：不选，保留为未来架构研究。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-render-surface-stability`: restored heavy conversations must keep a readable surface, avoid overlap/blanking, and isolate row-level render failures.
- `long-list-virtualization-performance`: conversation timeline virtualization must account for render weight from Markdown/tool/diff-heavy rows, not just row count, and must avoid old eager all-history render paths.
- `markdown-parse-pipeline`: conversation Markdown must support heavy-block lazy hydration for final/restored large content while preserving final semantics.
- `client-renderer-stability-under-pressure`: renderer diagnostics and recovery must classify React #185 / update-loop-style conversation failures, anchor/popover/measurement loops, and long-running resource pressure without leaking content.
- `message-row-render-stability`: completed heavy rows must keep stable memo/measurement identity while non-visible heavy details hydrate lazily and stale hydration resources are released.

## Impact

- Frontend surfaces: `src/features/messages/components/MessagesTimeline.tsx`, `MessagesRows.tsx`, `Markdown.tsx`, `ToolCallBlock.tsx`, `toolBlocks/*`, message anchor/outline helpers, and conversation CSS.
- Diagnostics: `src/services/rendererDiagnostics.ts` consumers and renderer error boundary surfaces.
- Tests/evidence: focused Vitest for projection, heavy-row lazy hydration, ErrorBoundary containment; browser/manual evidence for #721-class long history scroll and input latency.
- Dependencies: no new dependency expected; reuse `@tanstack/react-virtual` already present in `package.json`.

## 验收标准

- A synthetic #721-class restored conversation fixture opens without full-app `Application Error`, even if one heavy row throws during render.
- Long restored conversation scroll keeps mounted row count and hydrated heavy block count bounded by viewport + documented overscan.
- A heavy conversation can be opened in lightweight mode, with heavy cards/diffs/Markdown islands summarized by default and canonical actions still reading source payloads.
- Opening a selected history conversation does not synchronously render all historical conversations or hydrate all heavy details before first interaction.
- An oversized or complex history shows a bounded prompt/degraded surface with explicit recovery choices instead of freezing, blanking, or crashing.
- Markdown tables/code-heavy final messages preserve final semantics after hydration; placeholders never become canonical message text.
- Tool/read/diff cards show bounded summaries when outside viewport and hydrate details on viewport entry or explicit expansion.
- Composer typing and button click feedback remain responsive while the heavy conversation is open and after long-running client uptime; performance evidence records long-task / row-hydration / virtualizer recovery / cleanup metrics without content.
