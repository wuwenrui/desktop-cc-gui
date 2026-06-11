## Implementation Status

**Phase 1 complete** (see `notes/phase-1-implementation-evidence.md`).

- Fast HTML renderer shipped as opt-in wrapper behind feature flags.
- Parser-derived outline wired to UI: `PreviewOutlineSidebar` rendered alongside fast HTML surface when `rendererProfile="fast-html"`.
- Heading IDs injected into HAST tree (`attachHeadingIds`) so outline anchor links resolve in the mounted DOM.
- Click-to-scroll jump-to-heading works via `anchorId` matching.
- All validation items (7.1–7.7) passed.
- No new dependencies introduced.
- Message Markdown renderer untouched.

Phase 2 (Worker adapter) is tracked as task 6.2 and remains deferred.

---

## Context

The current file Markdown preview already has several good safeguards: frontmatter extraction, source block segmentation, deterministic render budgets, heavy block reveal cache, Mermaid render cache, KaTeX lazy asset loading, table scroll cache, and annotation line mapping. The remaining architectural problem is that the visible Markdown body is still rendered by many `ReactMarkdown` instances and component overrides. For long documents, this makes React reconciliation part of the document rendering hot path.

Yank Note (`yn`) takes a different shape:

- `markdown-it` is a long-lived renderer service.
- renderer plugins transform Markdown tokens into HTML/VNode output.
- preview mounts the rendered content into `.markdown-body` and uses actions/hooks/event capture for interactions.
- render cadence is debounced and adjusted by observed render cost.
- outline/jump behavior relies on source-line attributes attached during token rendering, not on expensive React tree ownership.

mossx should copy the architecture boundary, not the full plugin ecosystem.

## Design Goals

- Move file Markdown body rendering toward `compile -> sanitized document surface -> interaction islands`.
- Keep source fidelity and GitHub-style semantics.
- Preserve existing file-preview annotation and heavy-block behavior.
- Make outline/Toc cheap, deterministic, and parser-derived.
- Preserve a rollback path to the current `ReactMarkdown` implementation.

## Proposed Architecture

```text
FileMarkdownPreview
  -> compileFileMarkdownDocument(rawMarkdown)
     -> metrics/frontmatter/body/contentHash/lineMap
  -> resolveMarkdownRendererProfile(metrics, settings/flag)
     -> react-block-renderer | fast-html-renderer | low-cost fallback
  -> fastMarkdownRenderer.compile(snapshot)
     -> markdown parser tokens
     -> html fragments with source-line attrs
     -> outline entries from heading tokens
     -> heavy block placeholders/metadata
     -> sanitized html
  -> FileMarkdownDocumentSurface
     -> <article class="..." dangerouslySetInnerHTML={{ __html }} />
     -> event delegation for links / annotation affordance / heading jump
     -> hydrate heavy islands by stable metadata keys
```

### Renderer Profile

The renderer selector should be deterministic:

- `rich-react`: existing renderer, allowed for small documents while rollout is guarded.
- `fast-html`: preferred file Markdown path for medium/large documents after feature flag is enabled.
- `bounded-fast-html`: fast renderer with visible line/block projection for very large documents.
- `low-cost-readable`: readable fallback when rich/fast compile fails or the file is truncated beyond safe budget.

Renderer profile MUST use document metrics and explicit flags, not local timing.

### Fast HTML Compile Contract

The fast renderer should return a pure result:

```ts
type FastMarkdownRenderResult = {
  cacheKey: string;
  contentHash: string;
  html: string;
  outline: MarkdownOutlineEntry[];
  sourceLineAnchors: MarkdownSourceLineAnchor[];
  heavyBlocks: FastMarkdownHeavyBlock[];
  diagnostics: FastMarkdownRenderDiagnostics;
};
```

Expected properties:

- HTML is sanitized before mounting.
- Source-line attributes are attached to block-level elements when parser token maps exist.
- Heavy blocks have stable IDs derived from document key, source line range, language, and content hash.
- Unsupported or invalid syntax degrades locally.
- Compile result is independent from annotation UI state, hover state, localized labels, and Mermaid active tab state.

### Outline / Toc Contract

Outline must follow the `yn` idea: derive navigable structure from parser/tokens/source lines.

```ts
type MarkdownOutlineEntry = {
  id: string;
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  startLine: number;
  endLine: number;
  anchor: string;
  ordinal: number;
};
```

Rules:

- Heading tokens produce outline entries during compile.
- Duplicate headings get stable disambiguated anchors.
- Outline generation MUST NOT query the mounted Markdown DOM as the primary source of truth.
- Activating an outline entry scrolls to a source-line anchor or heading anchor.
- Outline state is derived from compile result and must not force Markdown body recompilation.
- For progressive/bounded rendering, outline may include all headings from the full document and mark headings outside the visible projection as not-yet-rendered or scroll/reveal them on demand.

### Interaction Islands

React should own only interaction islands, not every Markdown node.

- Links: event delegation on the document surface, preserving `openUrl`, file-link, and context-menu behavior.
- Annotation affordance: source-line attrs map clicks/hover to source ranges; overlay state remains outside compiled HTML.
- Mermaid: placeholder metadata hydrates source/render tab component only when visible or activated; cached SVG survives same-content rerenders.
- KaTeX: valid formulas may be compiled to sanitized KaTeX HTML when assets are ready; failures fall back locally to code/source.
- Code highlight: highlight as HTML string with stable class names and copy/annotation affordance outside the code DOM where possible.
- Tables: table wrappers and scroll cache use stable data keys; same-content rerender restores scrollLeft.

### Worker-Ready Boundary

Phase 1 may compile on the main thread behind a feature flag. The compile function must nevertheless be pure and serializable enough to move to a Worker:

- input: raw markdown, document key, renderer profile, theme-relevant options, feature flags;
- output: sanitized or sanitizer-ready HTML, outline, source-line anchors, heavy block metadata, diagnostics;
- cancellation: later compile result wins by request id/cache key;
- fallback: failed Worker/main compile uses existing ReactMarkdown file-preview fallback.

### Security

Raw HTML is a sharper boundary than ReactMarkdown components. The implementation MUST:

- sanitize mounted HTML with an allowlist schema;
- strip event handler attributes and dangerous URL schemes;
- keep file/local resource URL handling behind existing file-link/opening policies;
- avoid trusting parser plugin output from arbitrary Markdown;
- keep any future HTML option explicit and file-preview scoped.

## Decisions

### Decision 1: Use fast document surface for file preview, not message renderer

Chosen: add a file-preview fast renderer boundary.

Rejected: reuse message `Markdown` / `LightweightMarkdown`. Message renderer includes chat-specific normalization, streaming throttling, tool-call parsing, and live diagnostics. File preview needs source fidelity, stable source line anchors, and outline.

### Decision 2: Parser-derived outline, not DOM-derived outline

Chosen: derive outline from parser heading tokens and source maps.

Rejected: scan mounted DOM headings after render. DOM scanning is easy but late, couples outline to mount timing, and can cause large preview rescans after every same-content UI update.

### Decision 3: Keep ReactMarkdown fallback during migration

Chosen: fast renderer is additive and reversible.

Rejected: one-shot replacement. Markdown preview has many edge features; fallback lets us protect users while parity gaps are closed.

## Risks / Trade-offs

- Sanitized HTML renderer can accidentally diverge from existing ReactMarkdown semantics. Mitigation: focused fixtures for tables, lists, code, math, Mermaid, raw HTML, links, and annotations.
- Main-thread Phase 1 may still have compile spikes. Mitigation: cache by content hash, apply only by deterministic profile, then move compile to Worker.
- Hydration islands add complexity. Mitigation: keep island metadata stable and limited to high-cost/interactive blocks only.
- Outline for not-yet-visible headings can point outside the current projection. Mitigation: reveal target block or show not-yet-rendered state before scrolling.

## Migration Plan

1. Create feature-flagged fast renderer service and pure compile result types.
2. Implement parser-derived HTML, source-line attrs, and outline extraction for core Markdown blocks.
3. Mount fast HTML surface in file preview for flagged/large documents; keep ReactMarkdown fallback.
4. Port link handling, annotation source-line mapping, table scroll cache, code highlight, KaTeX, and Mermaid islands.
5. Wire outline consumer to compile result instead of rendered DOM scan.
6. Add focused tests and fixtures.
7. Enable fast renderer by deterministic profile after parity checks.
8. Optional second phase: move compile to Worker using the same pure contract.

Rollback:

- Disable the feature flag or renderer profile selector to force existing ReactMarkdown file preview.
- Keep compile service isolated so rollback does not touch message Markdown or file read/sync code.
- Remove Worker integration independently if Worker-specific failures appear.

## Validation Plan

- `openspec validate harden-file-markdown-preview-rendering --strict --no-interactive`
- focused Vitest for fast renderer compile result, sanitizer, outline extraction, duplicate heading anchors, source-line attrs, and fallback behavior
- focused file preview tests for Mermaid tab stability, table scroll restoration, annotation draft stability, and large-doc projection
- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files` if large component/style files are touched

## Acceptance Criteria

- Opening large Markdown files no longer requires React to own every rendered Markdown element.
- Outline generation is available before/with preview mount from parser metadata.
- Same-content UI updates do not recompile or remount the Markdown body.
- Existing file-preview Markdown feature semantics remain intact or fail closed to current fallback.
