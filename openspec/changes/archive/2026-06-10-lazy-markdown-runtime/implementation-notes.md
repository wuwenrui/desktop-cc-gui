# Implementation Notes / 实施记录

## Audit Result / 审计结论

`src/features/messages/components/Markdown.tsx` currently owns both shell behavior and full renderer behavior:

- Static full parser imports: `react-markdown`, `remark-breaks`, `remark-gfm`, `remark-math`, `rehype-raw`, `rehype-sanitize`.
- Live lightweight renderer import: `LightweightMarkdown` from `LiveMarkdown.tsx`.
- Runtime-sensitive behavior in the same file: tool-call XML fallback, progressive reveal, file links, nested markdown fences, Mermaid, LaTeX, local image handling, Codex lead enhancement, syntax highlighting.
- Existing tests are largely synchronous and expect full renderer output immediately after `render(<Markdown />)`.

## Existing Partial Protection / 既有保护

The current code already routes `liveRenderMode="lightweight"` and syntax-incomplete inline-code fallback through `LightweightMarkdown` in `renderMarkdownContent(...)`. This reduces per-update render cost but does not reduce bundle/import cost because full parser modules are still statically imported by `Markdown.tsx`.

## Safe Split Strategy / 安全拆分策略

Recommended next implementation slice:

1. Create `FullMarkdownRuntime.tsx` to own `ReactMarkdown`, remark plugins, rehype plugins, sanitize schema, and full renderer execution.
2. Keep `Markdown.tsx` as the shell for throttle/progressive reveal/tool-call segmentation/link handlers.
3. Export a typed `FullMarkdownComponents` alias from `FullMarkdownRuntime.tsx` so `Markdown.tsx` can type its component map without importing full runtime values.
4. For full rendering, mount the lazy runtime inside local `Suspense`; fallback should be `LightweightMarkdown` for content-safe readable output.
5. Update existing Markdown tests that assert full renderer DOM synchronously to `await screen.findBy...` or `waitFor(...)` only where the full renderer is expected.
6. Add a static boundary test proving `Markdown.tsx` no longer has static imports from `react-markdown`, `remark-*`, or `rehype-*`.

## Risk / 风险

This split is behavior-sensitive because many existing tests assume full Markdown render is synchronous. The implementation should be done as a dedicated slice with focused test migration, not mixed into AppShell boundary work.

## 2026-06-11 Implementation Slice / 实施切片

- Added `src/features/messages/components/FullMarkdownRuntime.tsx` as the lazy full renderer module.
- `FullMarkdownRuntime.tsx` owns `react-markdown`, `remark-breaks`, `remark-gfm`, `remark-math`, `rehype-raw`, `rehype-sanitize`, sanitize schema, and full renderer plugin assembly.
- `src/features/messages/components/Markdown.tsx` remains the shell for throttle, progressive reveal, tool-call segmentation, file-link handling, local image normalization, Mermaid/LaTeX block wrappers, and lightweight fallback selection.
- Full rendering now mounts through a local `Suspense` boundary with `LightweightMarkdown` fallback; the whole message list is not suspended.
- Added `src/features/messages/components/Markdown.lazy-runtime.test.ts` to prevent `Markdown.tsx` from statically importing `react-markdown`, `remark-*`, or `rehype-*`.
- Focused Markdown tests that assert full renderer DOM now wait for lazy runtime completion with `waitFor` / `findByRole`, while lightweight live streaming tests remain synchronous.

## 2026-06-11 Verification / 验证

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npx vitest run src/features/messages/components/Markdown.lazy-runtime.test.ts src/features/messages/components/Markdown.list-rendering.test.tsx src/features/messages/components/Markdown.tool-call.test.tsx src/features/messages/components/Markdown.codeblock-rendering.test.tsx src/features/messages/components/Markdown.math-rendering.test.tsx src/features/messages/components/Markdown.file-links.test.tsx` passed, 52 tests.
- `npm run build` passed.
- `npm run check:bundle-chunking` passed.
- `openspec validate lazy-markdown-runtime --strict --no-interactive` passed.

## 2026-06-11 Bundle Evidence / Bundle 证据

- Production build emitted `FullMarkdownRuntime-BuJyWBZ5.js`: gzip `0.64 KiB`.
- `FullMarkdownRuntime-BuJyWBZ5.js` imports `vendor-markdown-BUXHHUYG.js`: gzip `181.66 KiB`.
- `App-DdzqeRcY.js` gzip is `1,125.40 KiB` (`1.07 MiB` in bundle gate output).
- `src/features/messages/components/Markdown.tsx` no longer has static import lines for `react-markdown`, `remark-*`, or `rehype-*`; the shell uses `import("./FullMarkdownRuntime")` instead.
- `dist/assets/App-DdzqeRcY.js` contains a lazy import edge to `FullMarkdownRuntime-BuJyWBZ5.js`, and the full parser stack is isolated behind that runtime chunk.
