## 1. Specification

- [x] 1.1 Add file-view Markdown math/Mermaid preview delta spec.

## 2. Implementation

- [x] 2.1 Wire `remark-math` and `rehype-katex` into `FileMarkdownPreview`.
- [x] 2.2 Add `.fvp-file-markdown` KaTeX styles without touching message Markdown selectors.
- [x] 2.3 Preserve existing Mermaid Source / Render tab behavior.

## 3. Validation

- [x] 3.1 Add regression coverage for inline/display KaTeX in file preview.
- [x] 3.2 Run targeted file view tests.
- [x] 3.3 Run typecheck if touched types require broader validation.

## 4. Review Hardening

- [x] 4.1 Share KaTeX asset loading and math normalization with the message Markdown renderer.
- [x] 4.2 Preserve source file line numbers after math normalization for preview annotations.
- [x] 4.3 Localize file-preview Mermaid card labels and metadata label.
- [x] 4.4 Re-run targeted file view, message math, typecheck, and OpenSpec validation.
- [x] 4.5 Render fenced math/latex/tex blocks as KaTeX display formulas and avoid Mermaid tab annotation overlap.
