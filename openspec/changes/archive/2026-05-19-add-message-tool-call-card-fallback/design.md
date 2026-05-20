## Context

`src/features/messages/components/Markdown.tsx`（约 1992 行）是所有 assistant 消息（含子 agent、主 thread、shared session、history 回放等）的统一 markdown 渲染入口。其内部使用 `react-markdown` + `remarkGfm/remarkBreaks/remarkMath/remarkFileLinks` + `rehypeRaw/rehypeSanitize/rehypeKatex` 流水线，并在轻量分支用 `LightweightMarkdown` 处理流式首屏。

Anthropic SDK 在工具调用上下文里使用形如 `<function_calls><invoke name="X"><parameter name="K">V</parameter></invoke></function_calls>` 的 XML 模板（含 `antml:` 前缀变体）。当模型在某些回合把这段模板作为 assistant 正文输出时：

1. `rehype-raw` 把它解析成 HTML element 节点。
2. `rehype-sanitize` 因白名单中无 `function_calls / invoke / parameter`，剥除标签并保留文本子节点。
3. 最终 DOM 只剩 `find /Users/...` 这种裸命令文本，结构与语义全部丢失。

截图直接显示了该问题（子 agent 视图）。但因为入口是通用 `Markdown.tsx`，问题对所有 assistant 消费方一致存在。`src/features/messages` 与 `src/utils` 中 `function_calls / antml` 字面量零命中——本项目从未处理过此 fallback。

约束：
- 必须不影响 `message-markdown-streaming-compatibility`（inline code span / partial backtick）契约。
- 必须不影响 `thread-items-assistant-text-normalization-compatibility`（normalization MUST NOT alter assistant text export surface）。
- 必须保持 LiveMarkdown 轻量首屏、Mermaid Source/Render、KaTeX、文件链接 tooltip、Codex Lead Marker 等既有行为。
- 不增加新依赖；解析复杂度 O(n)。

## Goals / Non-Goals

**Goals**

- 在通用 markdown 渲染入口前以纯函数 + 段级渲染的方式做兜底卡片化。
- 解析器与组件均可独立单测；不与 React Markdown plugin 链耦合。
- 流式未闭合场景受控：partial XML 不刷屏，闭合后稳定收敛。
- 仅在文本中出现工具调用 XML 残留时触发；命中场景占比极低，整体 perf 影响接近零。

**Non-Goals**

- 不处理结构化 tool_use（已经走 ConversationItem `kind: 'tool'` 路径，由 `conversation-tool-card-persistence` 等 spec 覆盖）。
- 不识别 OpenAI / Gemini / 自定义引擎的工具调用文本。
- 不重写 markdown 渲染管线 / 不引入 MDX。
- 不向 sanitize 白名单添加新标签。
- 不持久化、不上报识别结果。

## Decisions

### D1 · 注入点 = `Markdown.tsx` 顶层分段

**决策**：在最外层 `useMemo` 中调用 `parseToolCallBlocks(content)`，结果是 `Block[]`。
- 长度为 1 且类型为 `md` → 走原有渲染路径（零改动）。
- 否则按段渲染：每个 `md` 段一棵 ReactMarkdown 子树，每个 `tool-call` 段一个 `<ToolCallBlock />`。

**理由**：sanitize 白名单与 plugin 数组都不动，爆炸半径最小；解析器纯函数易测；分段路径只在残留命中时触发。

**替代**：rehype 插件 + 白名单（爆炸半径更大、与 partial XML 容错差），上游 normalization（破坏既有 spec 契约）。

### D2 · 解析器协议

```ts
export type ToolCallBlock = {
  kind: 'tool-call';
  raw: string;             // 原始 XML 片段
  tool?: string;           // <invoke name="X"> 中的 X
  params?: ReadonlyArray<{ name: string; value: string }>;
  complete: boolean;       // 闭合标签是否到达
};
export type MarkdownBlock = { kind: 'md'; content: string };
export type Block = MarkdownBlock | ToolCallBlock;

export function parseToolCallBlocks(text: string): Block[];
```

**规则**：
- 识别 `<function_calls>...</function_calls>`、`<antml:function_calls>...</antml:function_calls>`、裸 `<invoke name="X">...</invoke>` 与 `<antml:invoke name="X">...</antml:invoke>` 成对块。
- 在工具调用块内部解析 `<invoke name="X">` / `<antml:invoke name="X">` 与 `<parameter name="K">V</parameter>` / `<antml:parameter name="K">V</antml:parameter>`，失败时保留 raw + 不填 `tool/params`。
- 流式 partial：若文本中出现起始标签但未到达闭合标签且 `text` 已耗尽，则尾段作为 `complete: false` 的 `tool-call` 块。
- 排除误识别：fenced code block 内的 `<function_calls>` 字面量必须忽略（用一个轻量 fence 扫描器先把代码块区段标记为「保护区」，再做匹配）。
- Fast path：若 `text` 不含 `function_calls`、`invoke`、`antml:function_calls`、`antml:invoke` 任一触发字串，直接返回单元素 `[{kind:'md',content:text}]`；避免只检查 `function_calls` 导致裸 `<invoke>` 漏检。

### D3 · 组件 `<ToolCallBlock />`

Props：`{ raw: string; tool?: string; params?: ReadonlyArray<{name,value}>; complete: boolean; isLive?: boolean }`

形态：
- 折叠态（默认）：左侧扳手图标（`lucide-react` 的 `wrench`），标题 `Tool call · {tool ?? "unknown"}`，副标题一行预览（取第一个 param 的 value 截断或 raw 首行）；右侧 `复制` + `展开`。
- 展开态：上半 = 参数表（`name → value`，等宽）；下半 = `raw` 代码块（`pre/code`，无 syntax highlight，保留原格式）。
- 流式态：`isLive=true || complete=false` 时，标题追加 `· streaming…`，右上角圆点呼吸动画；展开按钮可用但默认保持上次状态。
- 复制：复制 `raw`；沿用项目现有 clipboard 方式（直接 `navigator.clipboard.writeText`，已在多处使用）。
- 无障碍：折叠/展开使用 `<button aria-expanded>`；区块外层 `role="group" aria-label={t('messages.toolCall.title')}`。

样式命名空间 `tcb-`，与 `sp- / git- / fvp-` 隔离；新增独立 `src/styles/tool-call-block.css`，在 `main.tsx` 同级 styles 入口引入。

### D4 · 流式稳定性

- 每个 block 的 React key = `tcb-${startOffset}-${tagName}-${stableHash(initialSignature)}`，其中 `startOffset` 是该工具块在原始 message text 中的起始位置，`tagName` 是起始标签类型，`initialSignature` 优先取已解析 tool name，否则取起始标签文本；不得使用持续增长的 raw prefix 作为唯一 key 输入。
- 解析器不得修改 `raw`；partial 的省略提示只能由 UI 基于 `complete=false` 渲染，避免污染复制内容与 key 计算。
- `parseToolCallBlocks` 在 useMemo 中以 `[content]` 为依赖，content 每次 delta 后增量重算 O(n)，对典型工具调用块大小（几百字节）开销可忽略。

### D5 · LiveMarkdown 轻量分支

`Markdown.tsx` 在 `liveRenderMode === 'lightweight'` 时使用 `LightweightMarkdown`（更轻的渲染器，仅满足首屏文本）。本次决策：
- **轻量分支同样做分段**：未命中残留时零开销；命中时把 `tool-call` 段也用 `<ToolCallBlock />` 渲染（卡片是纯 React 组件，与 markdown 渲染器无关）。
- 不在 `LightweightMarkdown` 内部添加 XML 识别逻辑，保持其单一职责。

### D6 · i18n

按现有 `src/i18n/locales/zh.partN.ts` / `en.partN.ts` 结构追加键到 `messages.toolCallCard`，避免覆盖既有 `messages.toolCall` / `messages.toolCalls` 计数字符串：
- `title`
- `expand`
- `collapse`
- `copy`
- `copied`
- `streaming`
- `unknownTool`
- `noParams`

选择具体落在哪个 partN：复用已有 `messages.*` 的同一 part 文件，保持 namespace 紧凑（具体 part 文件在 tasks 阶段定位后注明）。

### D7 · 测试矩阵

| 层 | 文件 | 覆盖 |
|---|---|---|
| 解析器单测 | `toolCallBlocks.test.ts` | 成对/未闭合/嵌套/纯文本/antml:变体/fenced code 保护区/流式增量/空串/多块 |
| 组件单测 | `ToolCallBlock.test.tsx` | 折叠默认/展开/复制成功提示/streaming 标识/unknownTool 兜底/noParams 兜底 |
| Markdown 集成测 | `Markdown.tool-call.test.tsx` | 截图同款输入 → 渲染卡片而非裸文本；正文段仍渲染 ReactMarkdown |
| 回归 | `Markdown.codeblock-rendering` / `file-links` / `math-rendering` / `list-rendering` 既有套件 | 全绿（未触及 plugin 链） |

## Risks / Trade-offs

- **[误识别合法用户输入]** 用户在合法 markdown 中手写 `<function_calls>` 字面量 → 解析器在 fenced code block / inline code span 内自动忽略；不在 protected region 内仍会被卡片化。**缓解**：明确写入 spec scenario 与 README；提供未来 escape 扩展空间（`\<function_calls>`），本次不实现。

- **[多段拆分性能]** 包含 N 个工具调用块时会拆出 N+1 棵 ReactMarkdown 子树。**缓解**：命中即异常场景，实际场景 N ≤ 3；md 段 useMemo 后稳定，不会重复初始化 processor。

- **[流式抖动]** partial 段闭合后若 key 依赖增长中的 raw，会导致卡片重挂载并丢失展开态。**缓解**：key 基于 block 起始 offset、起始标签类型与稳定 signature；测试覆盖 partial→complete 后 expanded state 不丢失。

- **[与 LightweightMarkdown 的对接边界]** 轻量分支引入卡片组件后，首屏渲染包大小略增。**缓解**：卡片组件不依赖额外库（仅 `lucide-react` 单图标按需导入），bundle 增加可忽略；首屏命中残留的概率极低。

- **[i18n 漏键]** 新增 key 若只在 zh 添加不在 en 添加会导致英文 fallback 显示 key。**缓解**：tasks 中显式列出双语对齐步骤 + 由 `npm run lint` 与 vitest 集成测捕获。

## Migration Plan

- 无需数据迁移；无破坏性变更；无 feature flag。
- 上线策略：直接合入。如出现问题，回滚仅需 revert `Markdown.tsx` 的 useMemo + 分段渲染段落（≤ 20 行）。
- 监控：因仅 UI 改动，依赖既有错误上报；新增测试套件即为质量门禁。

## Open Questions

- 是否需要在 Status Panel / Operation Facts 等场景也复用 `<ToolCallBlock />` 展示历史工具调用？→ 本次不做，留作未来扩展。
- 是否支持把识别到的工具调用回灌为结构化 ConversationItem？→ 明确不做（见 Non-Goals D1/D2）。
