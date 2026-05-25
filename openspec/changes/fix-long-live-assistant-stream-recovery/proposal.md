## Why

用户在 `内容分析 / aaa` 会话中触发约 50000 字 Claude Code 输出时，live 幕布在体感约 16000 字后出现段落格式丢失和明显顿挫；关闭客户端后重新打开，历史中该长 assistant 正文也无法恢复。

这不是单纯的折叠问题。现场 Claude JSONL 只保留了用户请求、`thinking` 片段和后续短消息，没有落下 live 期间已经显示过的长 assistant 正文；同时 frontend active `appendAgentDelta` canonical 路径会把合并后的 assistant item 送入通用 `normalizeItem` 或 `prepareThreadItems`，触发 `MAX_ITEM_TEXT = 20000` 截断，后续 delta 再接到被截断文本上，具备导致格式和连续性损坏的源码证据。用户看到的约 16000 字是现象阈值，源码硬阈值是 20000 JS chars。

另一个高频体验问题是单条 live row 的可视渲染成本：当同一条消息持续增长到十几万字符时，DOM 回流和 Markdown parse 会导致明显顿挫。此次回写补一条“可见层折叠 + lightweight Markdown”策略，避免每次增量都对全量长文本做重解析，同时保留 live 阶段的标题、列表、代码块等基础 Markdown 样式。

## Target And Boundary

### Target

- 让 Claude Code 长 assistant live 输出在 active streaming 阶段保留 canonical 全文，不被普通列表/预览截断规则污染。
- 当客户端崩溃、关闭或 provider JSONL 未落 final assistant 正文时，用本地 live shadow transcript 恢复最近未完成的长输出。
- 保留段落、换行、Markdown 基本结构在 live 和恢复历史中的一致性。
- 降低单条巨大 live assistant row 的 render/reducer 放大，避免“字还在出，但 UI 一顿一顿”的长任务体验。
- 给 50k CJK 文本、断流/关闭恢复、超过 20k active text 的路径补上可重复验证。

### Boundary

- P0 仅治理 Claude Code live assistant 文本的本地投影、渲染和恢复；共享接口允许后续 Codex/Gemini/OpenCode 显式 opt in。
- 不改变 Claude CLI 协议、不改变模型 token/output limit、不伪造 provider 已完成状态。
- 不把 shadow transcript 当成 provider source of truth；它只用于“provider history 缺 final body”时的本地恢复证据。
- 不重写整套消息存储；优先在现有 thread item、history restore 和 app data 存储边界内增加最小持久化。

## Non-Goals

- 不要求 Claude Code 一定生成完整 50000 字；本 change 只保证客户端不额外损坏已经收到的 live text。
- 不解决 provider 侧自动截断、模型拒绝继续输出、token limit 或网络中断本身。
- 不把所有历史消息都永久全文缓存到新数据库。
- 不做聊天 UI 大改版，不新增用户配置面板。

## What Changes

- 为 Claude Code live assistant deltas 增加本地 durable shadow transcript：按 workspace/thread/turn/item/session 维度追加或批量落盘，turn settle 后标记完成并允许 GC；存储抽象保留跨 engine 扩展能力。
- 区分 canonical text 与 display preview：active streaming assistant 的 canonical text MUST NOT 经过 `MAX_ITEM_TEXT` 截断；截断只能应用到列表摘要、预览或明确的只读降级 surface。该约束覆盖 fast path `normalizeItem` 和 fallback `prepareThreadItems` 两条 active append 路径。
- Claude history restore 增加恢复规则：当 JSONL 中对应 turn 只有 user/thinking/tool 而没有 final assistant body，且 shadow transcript 有匹配文本时，恢复一条带 `recoveredFromLiveShadow` 元数据的 assistant message。
- 将 live Markdown/lightweight rendering 的换行保护作为 secondary guard：它不是本次 Claude 现场的已证主根因，但长文本 live 阶段的 paragraph-preserving chunked/plain fallback 必须避免把 display 结果反向污染 canonical text，并在完成后收敛到最终 Markdown semantics。
- 增加长内容折叠展示 guard（Claude streaming lightweight Markdown path）：当文本长度超过 20000 字符时，传给 live Markdown surface 的显示值改为 `head + 折叠占位 + tail`（当前 head 4000，tail 2000），通过 `STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD` 控制显示折叠阈值并保留 canonical 全文。
- 为单条巨大 live row 增加 render/reducer 证据和保护：避免每个 delta 都全量 normalize/parse 巨大文本，长输出应维持 bounded flush cadence 和可观察的 visible text growth。
- 增加复现 fixture：包含 `aaa` 类 shape，即 provider JSONL 无长 assistant final body、但 live shadow transcript 有大段文本。

## Technical Options

| Option | Summary | Trade-off | Decision |
|---|---|---|---|
| A | 只调高 `MAX_ITEM_TEXT` 或关闭截断 | 改动小，但 canonical/display 边界仍混乱；50k、100k 仍会复发，也不能恢复崩溃前 live text | 不采用 |
| B | 完全依赖 Claude JSONL/history source | source of truth 清晰，但现场证据显示崩溃/关闭后 JSONL 可能没有 assistant body；无法恢复用户已经看见过的 live 输出 | 不采用 |
| C | 增加 live shadow transcript，并拆分 canonical text 与 preview 截断 | 覆盖历史丢失和 active 截断两类根因；实现成本中等，需要 GC 和匹配规则 | 采用 |
| D | 引入整条消息内部虚拟化/分段渲染 | 长文本体验最好，但改动较大；应建立在 canonical/recovery 修复之后分步推进 | 部分采用，先做 paragraph-preserving chunked fallback 和指标保护 |
| E | 对 Claude long live surface 做 head/tail 折叠，并继续使用 lightweight Markdown 渲染 | 开销低、恢复速度快；能显著降低单行渲染放大，同时保留基础 Markdown 样式，但会丢失可见中段内容，需依赖 canonical 与最终 Markdown 收敛保证 | 采用 |

## Acceptance Criteria

- Claude active assistant text 超过 20000 JS chars 时，reducer 内 canonical `ThreadItem.text` 不被 `MAX_ITEM_TEXT` 截断，后续 delta 不会接到 `...` 后面。
- 50k CJK streaming fixture 在 live 期间保持段落换行，完成后 Markdown 语义与最终文本一致。
- 对超过 `STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD` 的 Claude live 输出，渲染表面可折叠显示中段并继续使用 lightweight Markdown；canonical 文本仍保持完整；完成后必须回到完整 Markdown。
- 模拟客户端关闭/崩溃：provider JSONL 无 final assistant body，但 shadow transcript 存在时，reopen history MUST 恢复可读 assistant body，并明确标记 recovered/interrupted。
- 当 provider JSONL 后续已经包含 final assistant body 时，history restore MUST 优先使用 provider final body，不重复插入 shadow 文本。
- Shadow transcript MUST bounded：完成态可清理；未完成态按时间/大小策略保留；异常大 payload 不阻塞应用启动。
- 长 live 输出 diagnostics 能区分 upstream delay、delta ingress、reducer cost、render cost、visible growth 和 recovery source。
- Focused Vitest 覆盖 reducer 截断边界、history recovery、newline/paragraph preservation；OpenSpec strict validation 通过。

## Implementation Sync Notes

- Claude `agentMessage` live snapshots MUST be written to the shadow transcript through snapshot/upsert semantics, not delta append semantics. A growing snapshot such as `第一段` followed by `第一段\n\n第二段` MUST leave the shadow text as the latter full snapshot, never `第一段第一段\n\n第二段`.
- True text deltas still use append semantics. This keeps runtime delta events cheap while protecting recovery from cumulative snapshot duplication.
- Shadow transcript pruning MUST prioritize recoverable interrupted entries over provider-final or settled entries before applying recency. This keeps the bounded store useful for crash/close recovery instead of letting newer settled entries evict the transcript that is still needed.
- Long-row evidence now includes correlated diagnostics for ingress cadence, reducer/normalization dispatch envelope, live row render cost, visible text growth, and live-shadow recovery source.
- 50k CJK scripted evidence is covered by a Claude history restore fixture that simulates provider history missing the final assistant body while the local live shadow transcript contains the recovered body with paragraph breaks.

## Capabilities

### New Capabilities

- `live-assistant-shadow-transcript`: Claude Code first 的本地 durable live assistant transcript，用于恢复 provider history 未落 final body 的 interrupted long output，并保留后续 engine opt-in 的存储边界。

### Modified Capabilities

- `claude-history-transcript-visibility`: Claude history restore 在 provider transcript 缺 assistant final body 时 MUST 能使用可信 shadow transcript 恢复可读正文 surface。
- `conversation-realtime-client-performance`: realtime 性能预算 MUST 覆盖单条巨大 live assistant row 的 reducer/render 放大与 visible text growth 证据。
- `conversation-render-surface-stability`: live rendering MUST 保留长 assistant 文本段落结构，并在 active streaming 阶段避免 canonical text 被 display 截断污染。
- `claude-code-realtime-stream-visibility`: Claude Code live text progressive visibility MUST include long-output continuation beyond ordinary preview limits.

## Impact

- Frontend reducer/render:
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/features/threads/hooks/threadReducerCoreHelpers.ts`
  - `src/utils/threadItems.ts`
  - `src/features/messages/components/LiveMarkdown.tsx`
  - `src/features/messages/components/Messages.tsx`
- History/session restore:
  - Claude history loader and frontend restore projection paths.
  - Source-fact/session metadata may need recovery source metadata, but provider JSONL remains unchanged.
- Storage:
  - New app-data shadow transcript files or equivalent existing app storage bucket.
  - Requires bounded retention and startup-safe parsing.
- Tests:
  - Reducer large delta fixture.
  - Claude history recovery fixture matching the observed `aaa` shape.
  - Live Markdown paragraph/newline preservation.
  - Performance diagnostics or focused render evidence for long live rows.
