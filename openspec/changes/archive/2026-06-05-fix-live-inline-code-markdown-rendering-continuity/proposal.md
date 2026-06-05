## Why

`fix-live-inline-code-markdown-rendering` 已在 2026-04-22 归档，但后续 tool-call fallback 能力引入了新的 shared Markdown segmentation path。该路径已经保护 closed inline code span 和 fenced code block，但 streaming 期间常见的 unclosed inline backtick 仍可能让 literal XML 被误识别成 tool-call card，造成 live inline code markdown 语义回退。

## What Changes

- 将 tool-call fallback detector 的 protected-region 规则扩展到 unclosed inline code delimiter。
- 当 live markdown 片段出现 opening backtick 但 closing backtick 尚未到达时，从 opening backtick 到当前 streaming 片段末尾都视为 protected region。
- 保持正常 residual tool-call XML fallback 不变；只有位于 inline code protected region 内的 XML 被保留为普通 Markdown 文本。
- 增加 parser-level 与 renderer-level regression tests，防止后续 segmentation path 再次绕开 inline code streaming contract。

## Non-Goals

- 不重写 Markdown renderer。
- 不修改 backend event schema、history loader、Tauri command 或 message persistence。
- 不改变 completed normal tool-call XML fallback card 行为。
- 不扩展 file preview Markdown renderer。

## Impact

- Frontend parser:
  - `src/features/messages/utils/toolCallBlocks.ts`
- Tests:
  - `src/features/messages/utils/toolCallBlocks.test.ts`
  - `src/features/messages/components/Markdown.tool-call.test.tsx`
- Specs:
  - `message-markdown-streaming-compatibility`
