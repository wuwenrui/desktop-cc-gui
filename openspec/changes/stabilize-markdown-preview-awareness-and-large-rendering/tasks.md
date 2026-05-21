## 1. External Change Awareness

- [x] 1.1 P0: Extend `useFileExternalSync` with manual/auto apply policy, pending clean external-change state, explicit refresh action, and debounce for auto apply.
- [x] 1.2 P0: Wire main window file view to enable awareness while using manual apply by default and auto apply only when live edit preview is enabled.
- [x] 1.3 P0: Add file view UI for pending external changes with refresh action while preserving dirty-buffer conflict behavior.
- [x] 1.4 P0: Route main and detached file awareness through native event/metadata monitoring by default, avoiding repeated full-content reads while editing.

## 2. Markdown Large Rendering

- [x] 2.1 P1: Add Markdown block segmentation to `fileMarkdownDocument` with stable block keys and source line ranges.
- [x] 2.2 P1: Render large Markdown previews by block projection while preserving frontmatter, GFM, code, KaTeX, Mermaid, and annotation line mapping.
- [x] 2.3 P1: Avoid full-file code-preview highlighting work when the active surface is Markdown preview.
- [x] 2.4 P1: Stabilize Mermaid source/render tab switching so the card body does not collapse, flicker, or become a scroll anchor.
- [x] 2.5 P1: Keep already revealed table/card heavy blocks visible across annotation and progressive rerenders.

## 3. Validation

- [x] 3.1 P0: Add regression tests for manual awareness, explicit refresh, live debounce, and dirty conflict behavior.
- [x] 3.2 P1: Add regression tests for block-level large Markdown rendering and structure preservation.
- [x] 3.3 P0: Run focused Vitest suites, OpenSpec validation, and TypeScript typecheck.
- [x] 3.4 P0: Add regression tests that event-mode monitor startup and fallback notices do not reread whole file content.
- [x] 3.5 P1: Add regression coverage for Mermaid source/render tab switching within a stable body container.
- [x] 3.6 P1: Add regression coverage that a revealed table does not flash back to a lazy placeholder during annotation rerenders.
