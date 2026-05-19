## Why

模型助手（含主 agent 与子 agent）在某些回合会把 Anthropic 工具调用 XML（`<function_calls>` / `<invoke>` / `<parameter>` 及对应的 `antml:` 前缀变体）作为纯文本输出。这些标签经 `Markdown.tsx` 的 `rehype-raw` + `rehype-sanitize` 管线后被剥成裸文本，最终在对话幕布上以无格式碎片显示（截图：子 agent 对话中长串 `<function_calls> find /Users/... </function_calls>` 直接铺在正文里），读者完全无法识别其结构，也无法快速复制底层命令。

该问题对**所有 assistant 消息**（子 agent thread / 主 thread / shared session / history 回放）一致存在；当前 `src/features/messages` 与 `src/utils` 全代码搜索 `function_calls / antml` 零命中，确认尚无任何兜底。

## What Changes

- 新增 fallback 解析器：在 `Markdown.tsx` 渲染前识别裸 `<function_calls>` / `<invoke>` / `<parameter>` 及真实 `antml:` 前缀变体（如 `<antml:function_calls>` / `<antml:invoke>` / `<antml:parameter>`），把这些段落与正文 markdown 拆分为分段序列。
- 新增工具调用卡片组件：折叠态展示「Tool call · {工具名}」+ 单行参数预览；展开态展示参数 key/value 表 + 原始 raw 代码块；右上角支持复制。
- 流式未闭合兜底：当 streaming 仍在进行、闭合标签尚未到达时，最后一段以 `isLive` 卡片渲染，避免 partial XML 文本直接刷屏。
- i18n：按现有 `src/i18n/locales/zh.partN.ts` / `en.partN.ts` 结构追加 `messages.toolCallCard.*` 文案，避免与既有 `messages.toolCall` 计数字符串冲突。
- 不修改 ReactMarkdown plugin 链、不修改 `rehype-sanitize` 白名单、不修改 LiveMarkdown / Mermaid / KaTeX / 文件链接 tooltip / Codex Lead Marker 等既有结构。
- 不构成 BREAKING：原内容不含工具调用 XML 残留的消息渲染路径保持完全一致。

## Capabilities

### New Capabilities

- `message-assistant-tool-call-card-fallback`: 定义 assistant markdown 中残留 Anthropic 工具调用 XML 的识别、卡片化展示、流式兜底与复制契约。

### Modified Capabilities

<!-- 不修改既有 spec。本次新增 capability 行为与 message-markdown-streaming-compatibility / thread-items-assistant-text-normalization-compatibility 解耦，仅在通用 markdown 渲染入口前以非侵入方式插入分段。-->

## Goals & Scope

### Goals

- 所有 assistant 消息（含子 agent、主 thread、shared session、history 回放、Spec Hub、发布说明等复用 `Markdown.tsx` 的消费方）一致受益。
- 单一渲染入口注入，O(n) 解析复杂度，不增加 ReactMarkdown 重渲染成本。
- 解析器为纯函数，独立单测；流式未闭合场景受控。

### Non-Goals

- 不接管真正合法的 Anthropic 工具调用机制（项目已有的工具调用是后端结构化产物，不走 markdown 文本路径）。
- 不重写 message Markdown renderer / 不引入新的 markdown engine。
- 不改变 ConversationItem 形状或 assistant text 归一化逻辑（`threadItems` / `messagesUserPresentation` 不动）。
- 不兜底其他厂商的工具调用文本（OpenAI tool_call json 等）——超出范围。
- 不改 Codex / Gemini 引擎的 tool-call card（`features/codex` 与 status panel 工具卡）。
- 不持久化或上报这些识别结果。

## Options Considered

### Option A · 在 `Markdown.tsx` 顶层前置分段（采用）

- 在最外层 `useMemo` 对 `content` 调用 `parseToolCallBlocks`，得到 `Array<{kind: 'md' | 'tool-call', ...}>`。
- `md` 段复用现有 `ReactMarkdown` 与全部插件链；`tool-call` 段用 `<ToolCallBlock />` 渲染。
- 优点：零侵入，sanitize 白名单与 plugin 数组都不动；解析器纯函数易测；流式时通过段级稳定 key 防抖。
- 缺点：单条消息含多个工具调用块时，会拆出多个 ReactMarkdown 子树（每段一棵）。

### Option B · 自定义 rehype 插件 + sanitize 白名单放行

- 写 rehype 插件把 `function_calls` 节点转成 `<div data-mossx-toolcall>` 自定义元素，扩白名单后用 `components` map 渲染。
- 优点：保留单棵 ReactMarkdown 树，节点级精准识别。
- 缺点：需要扩 sanitize 白名单（增加安全审计面）；rehype-raw 解析未闭合 XML 时容错较差，流式态可能产生残缺节点抖动；与 `remarkFileLinks` 等既有 plugin 的相互作用需要额外回归。

### Option C · 在更上游的文本归一化层（`messagesUserPresentation` / `threadItems`）抽离

- 在 assistant 文本进入 ConversationItem 前替换为占位符。
- 优点：只解析一次。
- 缺点：破坏既有 `thread-items-assistant-text-normalization-compatibility` 契约（"normalization MUST NOT alter assistant message export surface"），且与 streaming partial XML 兼容性差；触及多个 reducer/loader 边界，影响远超本次目标。

### 决策

采用 **Option A**：成本最低、爆炸半径最小、与 streaming 兼容性最好；多段拆分的性能代价（n 棵 ReactMarkdown 子树）在工具调用块极少且短的情况下可忽略，且只对包含残留 XML 的消息触发。

## Acceptance Criteria

1. 当 assistant 消息文本包含成对的 `<function_calls>...</function_calls>`、`<antml:function_calls>...</antml:function_calls>`、裸 `<invoke name="X">...</invoke>` 或 `<antml:invoke name="X">...</antml:invoke>` 时，该段落以工具调用卡片渲染；折叠态显示工具名与一行预览；展开态显示参数 key/value 表 + 原始 raw 块；提供复制按钮。
2. 同一条消息中正文 markdown 段（标题、列表、代码块、KaTeX、Mermaid、文件链接 tooltip）渲染结构、语义与关键视觉表现保持一致，由现有 `Markdown.*.test.tsx` 套件与新增 targeted assertions 共同保障。
3. 当 streaming 输出仍在进行、闭合标签尚未到达时，未闭合工具调用段以 `isLive` 卡片渲染（标题含 streaming 标识），且后续 delta 闭合后无重复渲染或 React key 抖动。
4. 文本中不含上述 XML 残留时，渲染走原逻辑零变更（解析器 fast-path 立即返回）。
5. i18n key `messages.toolCallCard.title / expand / collapse / copy / streaming` 在 `zh` 与 `en` 两组 locale part 中都存在，所有用户可见文案均走 i18n。
6. 新增解析器纯函数单测 ≥ 8 个 case（成对、未闭合、嵌套、纯文本不误伤、`antml:` 变体、含 `<` 字面量代码块不误识别、流式增量、空字符串）；组件单测覆盖折叠/展开/复制/streaming 态；集成测验证 `Markdown.tsx` 对截图同款输入输出工具调用卡片而非裸文本。
7. 通过 `npm run typecheck`、`npm run lint`、`npx vitest run src/features/messages/`、`openspec validate --strict`。

## Impact

- Frontend
  - `src/features/messages/utils/toolCallBlocks.ts`（新增）
  - `src/features/messages/utils/toolCallBlocks.test.ts`（新增）
  - `src/features/messages/components/ToolCallBlock.tsx`（新增）
  - `src/features/messages/components/ToolCallBlock.test.tsx`（新增）
  - `src/features/messages/components/Markdown.tsx`（最外层分段注入点，一处 `useMemo` + 一段渲染条件）
  - `src/features/messages/components/Markdown.tool-call.test.tsx`（新增集成测）
  - `src/styles/tool-call-block.css`（新增样式，前缀 `tcb-`，与 `sp-` / `git-` / `fvp-` 命名空间隔离）
  - `src/i18n/locales/zh.partN.ts` / `en.partN.ts`（在合适的 part 文件中追加 `messages.toolCall.*`）
- 不影响后端、Rust、IPC、Storage。
- 不引入新依赖。
- 不影响 `LiveMarkdown` 轻量模式（注入点同时覆盖 lightweight 与 ReactMarkdown 分支，但 lightweight 仅作纯文本展示，可选择仍直接打印或同样调用分段；详见 design.md）。
