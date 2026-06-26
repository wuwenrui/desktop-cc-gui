## Context

Issue #721 描述的是 conversation history surface 的结构性压力，而不是单纯 realtime event flood：

- settings / project pages mostly smooth，conversation page/history/long scroll lag。
- 重内容组合包括 long Markdown、tables、tool cards、batch file-read cards、diff/file snippets、popovers、anchors。
- 部分会话打开后进入全局 `Application Error`，错误为 React #185 / maximum update depth 类 update-loop 症状。
- 用户本地观察显示 cache 不大，单个会话文件不一定巨大，问题更像 render strategy heavy。
- #721 follow-up comment 明确要求：对话页轻量模式、长对话 virtual list、tool/read/diff 默认折叠、anchor/popover/measurement loop 排查、复杂 Markdown/table/diff 保护、单条对话按需加载、超大复杂历史提示、ErrorBoundary 组件级诊断。
- 本轮继续把这些建议并入 conversation proposal；startup updater check 仍保持独立 change，以免 conversation renderer 的验收被 startup UX 混淆。

当前代码已有几个可复用基础：

- `MessagesTimeline.tsx` 使用 `@tanstack/react-virtual`。
- `messagesTimelineVirtualization.ts` 已有 row-count / render-weight gate、virtualizer stability diagnostics、active live row guard。
- `Markdown.tsx` 已有 worker-capable Markdown precompute、lazy `FullMarkdownRuntime`、progressive/live lightweight path。
- `message-row-render-stability` 已要求 completed rows 不被 live text-only updates 反复 invalidation。
- `ErrorBoundary` 当前在 bootstrap app shell 外层，conversation 内部缺少 row/local boundary，导致局部 row render failure 仍可能升级为全局错误页。

## Goals / Non-Goals

**Goals:**

- 把 restored heavy conversation 的初始渲染成本限制在 viewport + overscan + active/selected rows。
- 让 render weight 覆盖 #721 的实际重元素：Markdown tables/code blocks、tool-call raw payload、read-file batches、diff/file snippets、images、anchor/outline/popover surfaces。
- heavy Markdown/tool/diff rows 先渲染 bounded summary 或 placeholder，再按 viewport entry / explicit expansion hydrate rich detail。
- 对 conversation row / heavy island 增加局部 error containment，React #185 类错误记录 content-safe diagnostic，不直接炸掉整个 app。
- 增加 explicit lightweight conversation mode：重历史可自动建议进入，用户也可手动切换；mode 只改变 render policy，不改变 canonical conversation data。
- 审计并移除 conversation open path 里旧的 eager all-history / all-heavy-detail 接入，确保只对 selected conversation 做按需 parse/projection/hydration。
- 对 oversized / complex history 提示 degraded open path，让用户先拿到可操作 surface，再按需 hydrate。
- 给 anchor/popover/measurement loop 加 bounded update guard；长时间运行后清理 observers、timers、hydration queue、measurement cache 和 stale async request。
- 给 #721-class fixture 留可执行验证：打开历史、滚动、anchor jump、expanded heavy card、Composer typing/button feedback、local error recovery。

**Non-Goals:**

- 不处理 updater 自动检查频率；它是 startup/update UX，另开 change。
- 不重写 conversation state/reducer 或历史解析事实源。
- 不把 rich Markdown 功能整体降级为 plain text。
- 不新增依赖，优先复用 `@tanstack/react-virtual`、existing diagnostics、existing Markdown cache/worker。
- 不在本 change 里实现 updater frequency/off/manual check；它需要独立 proposal 和 startup gate。

## Decisions

### 1. Render-weight gate first, row-count gate second

Decision: extend `estimateTimelineProjectionRenderWeight()` into a #721-aware classifier. Row count 仍保留，但 heavy Markdown blocks、tool/read/diff cards、large raw payload、table/code density、image/deferred media、anchor affordances 会提高 render weight。达到阈值时强制启用 virtualization，即使 row count 没有到 200。

Alternative considered: only lower `TIMELINE_VIRTUALIZATION_MIN_ROWS`。这会把短但普通的对话也拉进 virtualizer，增加 scroll restoration 风险，却仍不能准确覆盖少量超重 row。

### 2. Heavy row hydration belongs in render layer, not reducer

Decision: introduce render-layer heavy row states: `summary`, `placeholder`, `hydrating`, `hydrated`, `failed`. These states derive from row key + content hash + viewport/expanded state and stay outside canonical conversation item state.

Alternative considered: normalize heavy rows into new conversation item fields。Rejected because it mutates persistence/replay semantics and would couple performance policy to data model.

### 3. Markdown heavy blocks hydrate as islands

Decision: final/restored Markdown keeps canonical text intact, but tables, long code fences, nested Markdown fences, Mermaid/math-rich sections, and tool-call XML blocks may render bounded placeholders until visible. Hydration uses the existing Markdown precompute/cache where available; stale results are dropped by content hash / options hash.

Alternative considered: render all Markdown through the lightweight live path on history open。Rejected because final Markdown semantics would regress and users would see degraded history until switching sessions.

### 4. Tool/read/diff cards default to bounded summaries outside viewport

Decision: heavy cards render stable summaries when collapsed or outside viewport. Details hydrate only when expanded or visible. Copy/export/open-diff actions MUST keep using canonical source payload, not placeholder text.

Alternative considered: default-collapse every tool card globally。Rejected because it changes current UX for small conversations and hides useful context even when cost is low.

### 5. Conversation-local error containment

Decision: add local boundaries around row / heavy island rendering. When a row throws or loops into React #185-like containment, render a recoverable row fallback with diagnostic id and retry/hydrate action. Diagnostics record row kind, engine, thread id, workspace id, content length/hash/weight, and component stack class, but not prompt/assistant/tool text.

Alternative considered: rely on top-level `ErrorBoundary`。Rejected because it preserves diagnostics but destroys the whole app shell and matches the reported failure mode.

### 6. Lightweight mode is a render policy, not a data mode

Decision: add an explicit lightweight mode for conversation rendering. It may be auto-suggested when render weight crosses the heavy threshold and can be enabled per conversation/session. In lightweight mode, heavy cards, diffs, and Markdown islands default to summary placeholders, while canonical source payloads remain available for copy/export/open actions.

Alternative considered: make lightweight mode the global default. Rejected because small/normal conversations should keep full fidelity and avoid surprising users.

### 7. Selected conversation loading must be audited at the boundary

Decision: verify the open-history path loads and projects only the selected conversation plus metadata needed for navigation. If older code still parses or renders all workspace histories, move that work behind catalog metadata, selected-thread demand, or lazy hydration boundaries. This is an audit-first change because the correct fix depends on the current loader path, not assumptions.

Alternative considered: rewrite all history loaders into a new pagination layer immediately. Rejected as too broad for this P0; first remove proven eager work and only add pagination where evidence shows it is needed.

### 8. Oversized history gets a degraded prompt before full hydration

Decision: when row count + render weight + payload size cross the documented severe threshold, open a bounded degraded surface with a visible prompt: continue in lightweight mode, hydrate visible details, or retry full detail. The prompt must not block navigation or Composer interaction.

Alternative considered: silently force lightweight mode. Rejected because the user should understand why the view is degraded and how to request more detail.

### 9. Measurement, popover, and anchor code needs loop guards

Decision: wrap repeated measurement/popover/anchor update paths with idempotent state writes, bounded remeasure counts, cleanup on unmount/thread switch, and diagnostics for repeated update-loop prevention. This directly targets React #185 / maximum update depth style symptoms in complex histories.

Alternative considered: only catch React #185 in ErrorBoundary. Rejected because containment without loop prevention still leaves jank and memory pressure.

## Risks / Trade-offs

- [Risk] Placeholder hydration can break scroll height if estimates are poor. -> Mitigation: use stable estimated sizes, `measureElement`, and one bounded remeasure after hydration.
- [Risk] Anchor jump can target a non-hydrated row. -> Mitigation: target row is promoted to hydrate-priority and virtualizer scrolls to its row index before resolving anchor ready.
- [Risk] Copy/export could accidentally copy summary text. -> Mitigation: actions read canonical row/item payload, never placeholder DOM text.
- [Risk] Error containment can hide a real data bug. -> Mitigation: row fallback is visible, diagnostics are content-safe, tests assert error does not get silently swallowed.
- [Risk] Hydration queue itself can become jank. -> Mitigation: budgeted scheduler/idle chunks, max concurrent hydration, cancellation on thread switch.
- [Risk] Long-running sessions can accumulate stale observers, timers, cached hydration results, and pending async callbacks. -> Mitigation: bounded cache, explicit cleanup on thread switch/unmount, stale ordinal checks, and evidence counters for live resource counts.
- [Risk] Lightweight mode can become a permanent degraded UX. -> Mitigation: it is explicit, reversible, and scoped to heavy histories; normal conversations stay eager where budgets allow.
- [Risk] On-demand loading audit may reveal deeper loader coupling. -> Mitigation: land evidence first, then split a follow-up pagination proposal if loader data contracts need wider changes.

## Migration Plan

1. Add measurement helpers and tests for heavy row weight classification.
2. Add render-layer hydration state for timeline rows with bounded cache keyed by row key + content hash + renderer options.
3. Audit selected conversation loading/render path and remove old eager all-history/all-detail work where found.
4. Add lightweight mode policy, oversized-history prompt, cleanup/disposal guards, and loop diagnostics.
5. Add Markdown heavy-block island placeholders and hydration guards.
6. Add heavy tool/read/diff summary hydration rules.
7. Add row/local error boundary and diagnostics.
8. Add #721-class fixtures and focused tests.
9. Run focused Vitest, `npm run typecheck`, `npm run lint`, and manual/browser evidence for heavy history open + scroll + typing.

Rollback strategy:

- Feature-flag heavy hydration policy with a `ccgui.perf.heavyHistoryHydration` style flag.
- Keep existing virtualized timeline path and canonical render path intact.
- If hydration causes regression, switch flag to baseline to render through the old eager row detail path while preserving diagnostics.
- Lightweight mode and oversized prompt can be disabled independently from the underlying diagnostics if a UX regression appears.

## Open Questions

- Exact thresholds for heavy Markdown/table/code and tool-card raw payload should be calibrated with a fixture rather than guessed.
- Need decide whether updater frequency control gets its own immediate proposal or waits behind this P0 conversation performance work. Current recommendation: separate after this proposal is accepted, because it is startup UX, not conversation renderer.
