## Context

文件预览 renderer 与消息 renderer 是刻意分离的边界。主线规范 `file-view-markdown-github-preview` 已要求 `.md` 文件预览使用 dedicated renderer，避免把 chat-oriented Markdown normalization、streaming throttle、message controls 等行为泄漏到 file view。

当前实现状态：

- `src/features/messages/components/Markdown.tsx`：支持 `remark-math`、`rehype-katex`、KaTeX CSS 懒加载和 Mermaid block。
- `src/features/files/components/FileMarkdownPreview.tsx`：支持 `remark-gfm`、HTML sanitize、frontmatter、annotation line range、fenced code block highlighting、Mermaid Source/Render tabs。
- `package.json` 已包含所需依赖。

## Decision

在 `FileMarkdownPreview` 内直接接入 `remark-math` 和 `rehype-katex`，而不是复用 message Markdown component。

理由：

- file view 需要保留 source-fidelity，不应继承 message renderer 的正文归一化和 streaming 逻辑。
- 所需能力是 Markdown AST / HAST 插件级能力，依赖已存在，增量小。
- Mermaid 能力已经在 file view 内实现，当前只需保证 math 与 Mermaid 可以共存。

Review hardening 后，KaTeX asset loading、math detection、delimiter normalization、LaTeX render helpers 被下沉到 shared Markdown math utility。文件预览仍不复用 message component，但与幕布共享同一套数学公式兼容核心。

文件预览额外维护 normalization line map：当单行 `$$...$$` 或裸 LaTeX 行被规范化为 display math block 时，renderer 看到的 transformed line 会映射回原始 source line，保证 preview annotation 仍按真实文件行号提交。

## Render Flow

```text
FileMarkdownPreview
  extractFrontmatter(value)
  ReactMarkdown
    remarkPlugins: [remarkGfm, remarkMath]
    rehypePlugins: [rehypeRaw, rehypeSanitize(filePreviewSchema), rehypeKatex when math assets ready]
    components.pre:
      language-mermaid -> FileMarkdownMermaidBlock
      otherwise -> FileMarkdownCodeBlock
```

## Error Handling

- KaTeX parse failures follow `rehype-katex` default readable failure behavior.
- Mermaid render failures stay inside `FileMarkdownMermaidBlock` and show the existing render error message.
- The renderer boundary remains file-preview scoped; no fallback to message Markdown renderer.

## Validation

- Targeted Vitest for file view Markdown preview:
  - inline `$...$` and display `$$...$$` render to `.katex` / `.katex-display`
  - Mermaid Source tab remains lazy and Render tab renders diagram
- Typecheck if implementation changes produce typing uncertainty.
