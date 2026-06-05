## 1. Parser Continuity

- [x] 1.1 Extend tool-call fallback protected-region scanning to cover unclosed inline code delimiters during streaming.
- [x] 1.2 Add parser regression coverage proving XML after an unclosed inline backtick remains Markdown text.

## 2. Renderer Regression

- [x] 2.1 Add Markdown renderer regression coverage proving the same unclosed inline-code XML does not render as a tool-call card.

## 3. Verification

- [x] 3.1 Run focused Vitest coverage for tool-call parser and Markdown renderer.
- [x] 3.2 Run TypeScript typecheck.
- [x] 3.3 Run strict OpenSpec validation for this change and the workspace.
