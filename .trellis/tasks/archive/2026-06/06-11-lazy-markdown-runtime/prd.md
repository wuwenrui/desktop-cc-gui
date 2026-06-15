# Lazy Markdown Runtime

## Goal

推进 OpenSpec change `lazy-markdown-runtime`，把消息 Markdown 的 full parser pipeline 从 startup/static path 和 live streaming hot path 中拆出去。

## Requirements

- `Markdown.tsx` 保留 shell 责任：progressive reveal、tool-call segmentation、link/file handlers、fallback 选择。
- `react-markdown`、`remark-*`、`rehype-*` 等 full renderer 依赖进入 lazy full runtime module。
- live simple streaming 默认不加载 full Markdown runtime。
- completed 或复杂 Markdown 必须收敛到 full renderer。
- raw HTML 在 full sanitization renderer 可用前只能显示安全 fallback，不能走 unsafe lightweight HTML。
- 不改变最终态 Markdown 能力：GFM、math、raw HTML sanitization、file links、Mermaid、code block 等语义保持。

## Acceptance Criteria

- [x] `Markdown.tsx` 不再静态 import `react-markdown` / `remark-*` / `rehype-*`。
- [x] 新增 lazy full renderer module，并通过局部 `Suspense` 渲染。
- [x] lightweight fallback 不重复追加、不丢内容。
- [x] 复杂 completed Markdown 测试通过。
- [x] static boundary test 覆盖 full parser 不能回到 shell。
- [x] `npm run typecheck` passes。
- [x] `npm run lint` passes。
- [x] Focused Markdown tests pass。
- [x] `npm run build` passes。
- [x] `npm run check:bundle-chunking` passes and records markdown chunk evidence。
- [x] `openspec validate lazy-markdown-runtime --strict --no-interactive` passes。

## Technical Notes

- 上一轮 naive split 已被测试回归否掉，不能牺牲同步最终态语义。
- 先做小切片：保留 shell 行为，只迁移 full parser imports 到 lazy runtime。
- 测试需要从同步 `getBy*` 逐步改成 `findBy*` / `waitFor`，只改 full renderer 变 async 的断言。
