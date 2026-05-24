## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 12/12 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `FileMarkdownPreview.tsx` 已接入 `remark-math`、KaTeX asset loader/cache、Mermaid source/render tab；`FileViewPanel.test.tsx` 覆盖 inline/display/fenced math。
- **Next action**: 归档前补 verification，确认 file-view Markdown focused tests、message math guard、typecheck 与 OpenSpec validation。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

`.md` 文件预览已经有 dedicated file-preview Markdown renderer，并且现有对话消息 Markdown renderer 已支持 KaTeX 与 Mermaid。但文件预览链路目前只接入了 GFM 与 Mermaid fenced block，数学公式仍以原文显示，导致同一份 Markdown 在幕布/消息区与文件预览中表现不一致。

用户已经以幕布截图作为目标体验：文件预览中应能阅读 `$...$`、`$$...$$` 等 LaTeX 公式，并继续保留 Mermaid Source / Render 切换。

## What Changes

- 为 `FileMarkdownPreview` 接入 `remark-math` 与 `rehype-katex`。
- 复用现有 `katex`、`rehype-katex`、`remark-math`、`mermaid` 依赖，不新增 dependency。
- 继续保持 file-preview dedicated renderer 边界，不迁移到 `messages/components/Markdown`。
- 为文件预览命名空间补充 KaTeX 显示样式。
- 增加 focused regression tests，覆盖 KaTeX inline/display math 与 Mermaid lazy render。

## Scope

### In Scope

- `.md` / Markdown file preview rich render path。
- `$...$` inline math 与 `$$...$$` display math。
- 已有 Mermaid fenced block Source / Render 行为保持。
- 文件预览样式隔离在 `.fvp-file-markdown` 命名空间。

### Out of Scope

- 不重写 message Markdown renderer。
- 不引入新的 Markdown renderer package。
- 不改变 chat message Markdown normalization heuristics。
- 不支持完整 MDX runtime execution。
- 不改变文件编辑模式或持久化逻辑。

## Impact

- Frontend:
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/styles/file-view-panel.css`
- Tests:
  - `src/features/files/components/FileViewPanel.test.tsx`

