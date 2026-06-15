# lazy-markdown-runtime

## Summary / 摘要

把 full Markdown parser pipeline 从 live streaming hot path 和 startup static path 中拆出：默认 live row 使用 lightweight renderer，只有 completed message、复杂 Markdown 或用户展开 rich block 时才加载 full renderer。

## Problem / 问题

`P0-07` 指出 `Markdown.tsx` 静态导入 `react-markdown`、`remark-breaks`、`remark-gfm`、`remark-math`、`rehype-raw`、`rehype-sanitize`。虽然已有 `LiveMarkdown` lightweight path 和 Mermaid lazy boundary，但 full Markdown parser chain 仍容易进入消息模块加载路径。

这会让 streaming visible text 过早支付复杂 Markdown 成本，尤其是长 live assistant text、reasoning/tool block 混合输出时，用户感知的是首段文字出现慢或 progressive reveal 被 parser/render cost 拖住。

## Goals / 目标

- `Markdown.tsx` 拆为 lightweight shell 与 lazy `FullMarkdownRenderer`。
- Streaming live rows 默认不加载 full markdown pipeline。
- Completed/final message 或复杂内容再加载 full renderer。
- 保持 GFM、math、raw HTML sanitization、file links、Mermaid block 等最终态兼容性。
- 增加 live lightweight -> final full renderer transition regression tests。

## Non-Goals / 非目标

- 不删除现有 Markdown 能力。
- 不改变最终 completed message 的安全 sanitization contract。
- 不把 Mermaid、KaTeX、PDF/doc preview 等其他 heavy runtime 合并到本 change。
- 不牺牲 streaming progressive reveal 来换取 chunk split。

## Approach / 方案

1. Audit `Markdown.tsx`、`LiveMarkdown.tsx`、`MessagesRows.tsx` 的 import graph。
2. 提取 `FullMarkdownRenderer` lazy module，集中持有 `react-markdown` / remark / rehype dependencies。
3. 定义 complexity detector：tables、math、raw HTML、complex fenced blocks、links requiring rich transform、final completed state。
4. Live streaming path 使用 lightweight renderer 或 bounded readable fallback。
5. Completed message 立即收敛到 full renderer；full renderer loading 期间展示 stable readable fallback。
6. 确保 `onRenderedValueChange`、progressive reveal、history reload 与 live completed convergence 不分叉。

## Risks / 风险

- live 与 completed renderer 切换可能造成内容跳动，需要保持 fallback readable and stable。
- complexity detector 过保守会减少收益；过激进会漏掉复杂 Markdown。
- sanitization 必须只在 full renderer 中延迟加载，不能在 raw HTML 场景缺失安全处理。

## Acceptance Criteria / 验收口径

- Streaming first visible text 不依赖 full Markdown parser chunk。
- Final complex messages 仍正确渲染 GFM tables、math、raw HTML sanitization、file links。
- Live lightweight -> completed full renderer transition 不重复追加、不丢内容、不破坏 scroll anchoring。
- `vendor-markdown` 不进入 startup path；chunking evidence 明确记录。

## Validation / 验证

- Focused Markdown / LiveMarkdown / MessagesRows tests。
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check:bundle-chunking`
- `openspec validate lazy-markdown-runtime --strict --no-interactive`
