# Phase 1 Implementation Evidence

> **Status**: live implementation fact, not a drift marker.
> Captures the rendering state of `harden-file-markdown-preview-rendering`
> at the end of Phase 1 (fast HTML renderer opt-in wrapper, behind
> feature flag). Updated when the change is re-validated, not when
> code is reorganized.

## Scope landed

Phase 1 ships the fast HTML renderer as a **fail-closed opt-in
wrapper** behind two feature flags. The default behaviour (no
profile / `rich-react` / `low-cost-readable`) is unchanged from the
pre-change state.

### New module: `src/features/markdown/fastMarkdownRenderer/`

- `compile.ts` — mdast → hast → HTML + `rehype-raw` + `rehype-sanitize`
  + `rehype-katex` compile pipeline, with diagnostics and a content
  hash. Pure / serializable result.
- `sanitize.ts` — DOMPurify allowlist sanitizer with regex fallback
  for non-DOM environments (Tauri WebView, Vitest node env). Strip
  `on*` event handlers, `javascript:` / `data:` / `vbscript:` URL
  schemes, and the forbid list (script, style, iframe, etc.).
- `parserOutline.ts` — outline extraction from mdast `heading`
  nodes with stable slug + disambiguated anchors. CJK preserved.
- `heavyBlocks.ts` — heavy-block detection (mermaid, katex, large
  code fences) without scanning the live DOM.
- `sourceLineAttrs.ts` — attaches `data-source-line-start/end` /
  `data-source-block-id` to the rendered HTML so the existing
  annotator can keep its hover behaviour.
- `cache.ts` — LRU Map cache keyed by document key + content hash.
- `resolveProfile.ts` — deterministic profile selector
  (`rich-react` / `low-cost-readable` / `fast-html` /
  `bounded-fast-html`). No `performance.now()` or other
  machine-local timing.
- `useFastMarkdownRender.ts` — React hook that owns the compile
  lifecycle, profiles, status, and fallback signal.
- `FileMarkdownFastPreview.tsx` — preview surface that mounts the
  sanitized HTML, intercepts external link clicks via the Tauri
  opener, and reports fallback via `onShouldFallback`. Returns
  `null` on fallback so the wrapper can degrade.
- `types.ts` — `FastMarkdownFeatureFlags`,
  `FastMarkdownRendererProfileId`, `FastMarkdownRenderResult`.
- `index.ts` — public exports for the hook, the preview component,
  and the types.

### New wrapper: `src/features/files/components/FileMarkdownPreviewFast.tsx`

- Lives in `features/files/components/` (above the
  `features/markdown/fastMarkdownRenderer/` layer) to avoid the
  circular import that would arise if the rich
  `FileMarkdownPreview` ever pulled the wrapper in.
- Decision tree:
  - `rendererProfile` is undefined / `rich-react` /
    `low-cost-readable` → mount `FileMarkdownPreview` directly.
  - `rendererProfile` is `fast-html` / `bounded-fast-html` →
    mount `FileMarkdownFastPreview`. When the fast path reports
    `shouldFallback` (compile failure, sanitizer failure, profile
    mismatch) the wrapper degrades to `FileMarkdownPreview` on the
    next tick and fires `onFastRendererFallback(reason)`.
- No changes to `FileMarkdownPreview.tsx` itself — the original
  rich path remains the single source of truth for the legacy
  surface.

## Decision-point fixes during implementation

1. **`IDLE_RESULT.shouldFallback` was `true`** in
   `useFastMarkdownRender.ts`. This caused any consumer of the
   hook to flip straight to the rich path on mount, before the
   compile even started. Changed to `false` with an inline comment
   explaining the contract: "IDLE = not yet attempted; the next
   effect tick will transition to pending or fallback."

2. **`FileMarkdownPreview.tsx` early-return was rejected.** The
   first cut tried to add an opt-in branch with a `useState` +
   early return inside the existing component. That violated
   the React hooks rules (different hook counts between fast and
   rich paths). Reverted and re-implemented as a separate
   `FileMarkdownPreviewFast` wrapper instead.

3. **ESLint regular-whitespace error in `parserOutline.ts`.**
   The slugify regex contained a literal full-width space (U+3000)
   which `no-irregular-whitespace` rejected. Replaced with a
   `　` Unicode escape; also dropped unnecessary backslash
   escapes flagged by `no-useless-escape`.

4. **Wrapper integration test for fallback path** was originally
   designed to use `featureFlags={{ fastHtmlRendererEnabled:
   false }}` to trigger the fallback, but the hook treats an
   explicit `rendererProfile="fast-html"` as an override and
   always attempts the compile. Reworked to use
   `vi.spyOn(compileFastMarkdown).mockRejectedValueOnce(...)` so
   the test exercises the *real* runtime-fallback contract
   (compile error → wrapper degrades + callback fires).

## Renderer diagnostics

`FileMarkdownFastPreview` exposes the following data attributes
on the surface div so tests and tooling can inspect the renderer
state without parsing the HTML body:

- `data-markdown-render-strategy` — `"fast-html"`.
- `data-markdown-render-profile` — `rich-react` / `fast-html` /
  `bounded-fast-html`.
- `data-markdown-render-status` — `idle` / `pending` / `ready` /
  `fallback`.
- `data-markdown-content-hash` — sha of the raw markdown.
- `data-markdown-cache-key` — cache key used by the LRU map.
- `data-markdown-total-headings` / `-total-heavy-blocks` —
  counters for the parser-derived outline / heavy-block index.
- `data-markdown-truncated` — `"true"` when the bounded profile
  pre-clamped the document.
- `data-fast-renderer-marker` — the same status as a stable
  string for `waitFor(...).toHaveAttribute(...)` style tests.

## Sanitizer / XSS regression evidence

The `sanitize.ts` allowlist is **scoped to file-preview** Markdown
output — it does not apply to the message Markdown renderer (which
keeps its existing sanitize pipeline). The deny list covers the
classic XSS vectors:

| Vector | Coverage |
| --- | --- |
| `<script>`, `<style>`, `<iframe>`, `<frame>`, `<frameset>` | forbid tag list |
| `<object>`, `<embed>`, `<form>`, `<input>`, `<button>` | forbid tag list |
| `<select>`, `<textarea>`, `<svg>`, `<math>`, `<noscript>`, `<meta>`, `<link>`, `<base>` | forbid tag list |
| `on*` event handler attributes (e.g. `onclick`, `onerror`, `onload`) | forbid attribute prefix list |
| `href="javascript:..."`, `src="javascript:..."` | DOMPurify URL allowlist + regex fallback |
| `href="data:..."` (except image data URIs in DOMPurify defaults) | DOMPurify URL allowlist + regex fallback |
| `href="vbscript:..."` | regex fallback |

Defense-in-depth: even after `rehype-sanitize` has stripped
dangerous nodes at the HAST layer, the rendered HTML passes
through `sanitizeFastMarkdownHtml` before mount. The unit tests in
`__tests__/sanitize.test.ts` exercise both the DOMPurify path and
the regex fallback path, and the `workerReady.test.ts` suite
asserts the fallback path works without a DOM.

## Validation evidence

- `openspec validate harden-file-markdown-preview-rendering
  --strict --no-interactive` → `Change 'harden-file-markdown-
  preview-rendering' is valid`.
- `npm run typecheck` → 0 errors.
- `npm run lint` → 0 errors, 0 warnings.
- `npm run check:large-files` → 0 new large files (no CSS or
  source file crossed the 800-line threshold).
- `npm run test` → all 619 test files pass (final batch visible
  in `boq8el6op.output`: `Test Files  3 passed (3) / Tests  31
  passed (31)`).
- Focused suites:
  - `src/features/markdown/fastMarkdownRenderer/` — 73 tests
    across compile / sanitize / parserOutline / heavyBlocks /
    resolveProfile / workerReady. All pass.
  - `src/features/files/components/__tests__/FileMarkdownPreviewFast.test.tsx`
    — 7 integration tests covering routing, fallback, and the
    no-fallback happy path. All pass.
  - `src/features/files/` — 211 tests across components / hooks /
    utils. All pass.

## Dependency decision

**No new packages** were introduced. The fast renderer reuses the
existing `unified` ecosystem already pulled in by the rich path:

- `unified`, `remark-parse`, `remark-gfm`, `remark-math`,
  `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-katex`,
  `hast-util-to-html` — all already in `package.json`.
- `dompurify` 3.3.1 — already in `package.json`; the file-preview
  path reuses it (the rich path uses an even narrower `dompurify`
  call site, so the allowlist is strictly more permissive for
  legitimate Markdown and strictly stricter for hostile input).
- `katex` 0.16.45 — already in `package.json`.
- `mermaid` 11.12.2 — already in `package.json` (heavy-block
  detection only; the fast path does not render Mermaid — that
  stays in the rich path).

## Reversibility guarantee

The wrapper is **opt-in**. Production builds without
`rendererProfile="fast-html"` (the current default in every
caller) never mount `FileMarkdownFastPreview`. Removing the
fast renderer module — including `FileMarkdownPreviewFast.tsx`,
the `fastMarkdownRenderer/` directory, and the `__tests__/`
files — leaves the rich path and its tests intact. The change
has no destructive impact on the message Markdown renderer
(it shares no code with the new module).

## Worker-ready boundary (Phase 2 prerequisite)

`compileFastMarkdown` returns a plain JSON-serializable object.
Verified in `workerReady.test.ts`:

- The result has a stable key set
  (`cacheKey`, `contentHash`, `diagnostics`, `heavyBlocks`,
  `html`, `outline`, `rendererProfile`, `sourceLineAnchors`).
- `JSON.parse(JSON.stringify(result))` round-trips losslessly
  on the combined fixture.
- The sanitizer has a non-DOM regex fallback so the pipeline
  can run in a Worker without a `window` global.
- Parser-side helpers (`extractMarkdownOutline`,
  `extractHeavyBlocks`) are pure functions of the mdast root
  and survive `JSON.parse(JSON.stringify(...))`.

Phase 2 prerequisite is now implemented as an optional Worker adapter:

- `fastMarkdown.worker.ts` receives a serializable compile request,
  runs `compileFastMarkdown`, and posts either the serializable result
  or a normalized error.
- `workerAdapter.ts` lazily constructs the Worker, tracks pending
  request IDs, resets on Worker failure, and falls back to
  main-thread `compileFastMarkdown` when Worker construction or
  transport is unavailable.
- `useFastMarkdownRender` increments a request ordinal for every
  Markdown snapshot/profile change. A late Worker/main-thread result
  is ignored when its ordinal is no longer current, so stale compile
  output cannot overwrite a newer preview.
- The adapter is only imported by the file-preview fast renderer hook.
  Message Markdown remains outside this boundary.

## Preview-only large Markdown read path — 2026-06-07

Large Markdown files exposed a second boundary distinct from renderer
performance: the editable file read path is capped at 400 KB and marks the
file as truncated. That is correct for edit/save safety, but it also forced
Markdown preview into the low-cost code surface before the bounded Markdown
renderer could run.

The file preview path now has a separate read budget:

- `read_workspace_file` remains capped at 400 KB and continues to mark the
  document truncated, which disables unsafe editing/saving of partial content.
- `read_workspace_file_preview` reads up to 4 MB for preview-only Markdown
  content.
- `FileViewPanel` only requests the preview override when the active surface is
  Markdown preview, the normal text read is truncated, and the target is a
  workspace file.
- The override is passed only into `FileMarkdownPreviewFast`; editor content,
  dirty tracking, and save protection keep using the original truncated
  document snapshot.
- The rich bounded Markdown line cap was raised from 1800 to 2800 visible
  lines. Larger preview content still goes through bounded/fast rendering
  rather than unbounded rich rendering.

## Outline sidebar integration (yn-style parser-derived TOC)

The fast HTML renderer generates a `MarkdownOutlineEntry[]` during the
mdast → hast compile pass. To surface this as a clickable table-of-contents
sidebar alongside the document (matching the yn-project approach):

1. **`attachHeadingIds`** (`attachHeadingIds.ts`) — walks the HAST tree
   after `remark-rehype` + `rehype-katex` processing and injects `id`
   attributes onto heading elements (`h1`–`h6`) using the anchor IDs computed
   by `extractMarkdownOutline`. This ensures the anchor links in the outline
   resolve in the mounted DOM.

2. **`FileMarkdownFastPreview.onOutlineReady`** — the fast preview component
   accepts an `onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void`
   callback prop. When the compile resolves (`status === "ready"`), the
   effect fires `onOutlineReady(result.outline)`.

3. **`FileMarkdownPreviewFast` outline state** — the wrapper maintains
   `fastOutline: PreviewOutlineItem[]` state and `activeOutlineItemId`.
   When `handleOutlineReady` fires, `convertMdastOutlineToPreviewItems`
   converts the flat mdast outline into the hierarchical `PreviewOutlineItem`
   structure expected by `PreviewOutlineSidebar`. The wrapper renders:

   ```
   <div class="fvp-preview-scroll">
     <div class="fvp-preview-shell">
       <PreviewOutlineSidebar items={fastOutline} ... />
       <FileMarkdownFastPreview onOutlineReady={handleOutlineReady} ... />
     </div>
   </div>
   ```

4. **Click-to-scroll** — `handleSelectOutlineItem` reads the item's
   `anchorId` (the heading's `id` attribute), finds the element via
   `document.getElementById`, and calls `anchorNode.scrollIntoView({ behavior:
   "smooth", block: "start" })`. This matches the pattern used in
   `FileDocumentPreview` and `FilePdfPreview`.

The outline is **not** DOM-scanned — it is derived from the mdast heading
tokens before HTML is generated. This matches the yn-project contract:
"outline entries are produced from parser/token/source-line metadata and can
jump to rendered headings without DOM-wide rescans or body recompilation."

## Revalidation Backfill — 2026-06-07

Strict workspace verification found that the first Phase 1 handoff had built
the fast renderer as an opt-in island, but had not routed the real file-view
Markdown preview entrypoint through that wrapper. The following corrective
work is now landed:

- `FileViewBody` routes Markdown preview through `FileMarkdownPreviewFast`
  instead of directly mounting `FileMarkdownPreview`.
- `FileViewPanel` resolves a deterministic fast renderer profile for Markdown
  preview, but only when an explicit rollout flag is enabled.
- Rollout flags:
  - env: `VITE_MOSSX_FILE_MARKDOWN_FAST_HTML=true`
  - env: `VITE_MOSSX_FILE_MARKDOWN_BOUNDED_FAST_HTML=true`
  - local storage: `mossx.fileMarkdownFastHtml=true`
  - local storage: `mossx.fileMarkdownBoundedFastHtml=true`
- Default behavior remains `rich-react`; deleting or disabling those flags is
  the config-level rollback path.
- `FileMarkdownPreviewFast` now forwards the rich renderer props so fallback
  preserves annotation, render-pressure, and marker behavior.
- The fast HTML surface now hydrates two minimal interaction islands:
  annotation-start buttons from `data-source-line-start/end` attributes and
  wide-table scroll wrappers keyed by the fast compile cache identity.
- Existing annotation overlays/drafts and Mermaid blocks intentionally
  fail closed to `FileMarkdownPreview` until those richer islands are
  implemented natively in the fast surface. This preserves behavior instead
  of silently dropping annotation UI or Mermaid Source/Render tabs.

This backfill changes the evidence status from "module exists but production
callers do not mount it" to "real entrypoint is wrapper-routed, with fast HTML
still behind explicit rollout and rich fallback for incomplete islands."

## Markdown outline visibility correction — 2026-06-07

The previous outline note was incomplete: it described the parser-derived TOC
only for the fast HTML path. That made the outline invisible in the default
`rich-react` file-preview path unless a fast renderer rollout flag was enabled.
This was a product-contract bug, because the outline is a Markdown reading
feature rather than a fast-renderer-only affordance.

The wrapper now renders the shared preview shell for both profiles:

- default `rich-react` path: `FileMarkdownPreviewFast` calls the same pure
  parser compile pipeline to derive outline entries, keeps the existing
  `FileMarkdownPreview` as the body renderer, assigns parser-derived heading
  anchors to the rich preview DOM, and scrolls locally on outline selection.
- fast path: `FileMarkdownFastPreview.onOutlineReady` continues to provide the
  parser-derived outline from the fast compile result.

Focused regression coverage was added in
`src/features/files/components/__tests__/FileMarkdownPreviewFast.test.tsx` to
assert that the default rich Markdown preview renders an outline and that
activating an outline item scrolls to the matching heading.

## Markdown outline interaction correction — 2026-06-07

The visible outline also needed the yn-style interaction contract, not just a
static sidebar. The Markdown preview outline now supports:

- whole-panel collapse/expand with a compact floating TOC button while
  unpinned;
- a pin control that keeps the outline open across outline selections;
- automatic collapse after selecting an outline item while unpinned;
- nested heading branch collapse/expand for the outline tree;
- repeated activation of the same outline item, which re-runs the local
  heading scroll instead of treating the active item as a no-op.

Focused regression coverage in
`src/features/files/components/__tests__/FileMarkdownPreviewFast.test.tsx`
asserts default rich-preview outline expansion, unpinned auto-collapse, pinned
repeat selection, and nested section collapse/expand behavior.

## Markdown outline theme and pin semantics correction — 2026-06-07

The outline visual pass was adjusted to match the yn-style interaction model
more closely while staying theme-adaptive:

- the outline surface now uses file-view/theme tokens (`surface-*`,
  `border-*`, `text-*`, and file-preview reader tokens) rather than fixed light
  colors;
- the explicit close (`x`) action was removed from the expanded panel;
- unpinned outline panels collapse automatically on mouse leave;
- pinned outline panels remain visible on mouse leave;
- the compact floating trigger is icon-only, and the pin affordance is rendered
  as a CSS-drawn pin glyph instead of textual placeholder content.

Focused tests cover unpinned mouse-leave collapse and pinned mouse-leave
persistence in the default rich Markdown preview path.

## Markdown outline overlay-layer correction — 2026-06-07

The outline panel and compact trigger were moved out of the preview layout flow.
They are now absolute overlay affordances inside the preview shell, so opening
or closing the Markdown outline does not push the rendered document body down or
change the body layout. Internal outline indentation was also tightened to keep
nested headings readable in the compact floating panel.

## Markdown outline viewport-floating correction — 2026-06-07

The outline overlay is now fixed to the viewport and offset from the right file
panel using `--right-panel-width`, so it remains visible while the Markdown body
scrolls and does not cover the file tree. The pin affordance was also replaced
with an SVG pin glyph and styled as a red, borderless action.

## Markdown outline scroll-container floating correction — 2026-06-07

The viewport-fixed outline placement was replaced with a scroll-container
floating model: the outline anchor is `sticky` within the Markdown preview
scroll container, has zero layout height, and contains a right-aligned panel with
its own pointer events and scrolling. This keeps the outline at the preview
container's upper-right corner without pushing the Markdown body down, without
pinning it to the whole browser window, and without covering the right file
panel.

## Markdown outline final containment correction — 2026-06-07

The final placement model no longer relies on viewport `fixed` positioning or a
sticky anchor inside the Markdown body. `FileMarkdownPreviewFast` now owns a
non-scrolling `fvp-markdown-preview-frame` with two sibling layers: an absolute
`fvp-markdown-outline-layer` for the TOC and a `fvp-markdown-preview-scroll`
layer for the rendered Markdown body. The collapsed trigger and expanded panel
are both positioned inside the outline layer, so they stay anchored to the
preview container's upper-right corner without participating in body layout or
moving with Markdown scroll content.
