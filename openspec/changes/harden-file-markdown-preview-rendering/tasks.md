## 1. Planning / Contract

- [x] 1.1 Confirm renderer rollout flag and deterministic profile names. Input: proposal/design. Output: selected rollout contract for `rich-react` / `fast-html` / `bounded-fast-html` / readable fallback. Verification: reviewer can identify how to force fallback and how diagnostics expose profile/fallback reason.
- [x] 1.2 Define fast renderer result types. Input: design type sketches. Output: typed compile result / outline / source-line / heavy-block metadata / diagnostics. Verification: typecheck covers public signatures and compile result contains no React/DOM instance dependency.
- [x] 1.3 Add fixture set for Markdown parity and security. Input: tables, nested lists, task lists, code, raw HTML, unsafe links, inline event attributes, math, Mermaid, duplicate headings, Chinese headings. Output: reusable test fixtures. Verification: fixtures are consumed by focused tests including sanitizer failure fallback.

## 2. Fast Renderer Core

- [x] 2.1 Add file-preview Markdown parser service. Input: raw markdown + document key + renderer profile. Output: sanitized HTML compile result. Verification: unit test returns stable cache key, sanitized HTML, and rejected unsafe attributes/schemes.
- [x] 2.2 Attach source-line attributes from parser token maps. Input: heading/paragraph/list/table/code tokens. Output: block-level `data-source-line-start/end` or equivalent. Verification: fixture assertions cover original line ranges.
- [x] 2.3 Add compile cache independent from annotation UI state. Input: document key/content hash/profile. Output: reusable compile result. Verification: same-content annotation-state rerender does not call compile again.
- [x] 2.4 Implement readable fallback on compile failure. Input: malformed Markdown/plugin failure fixture. Output: existing ReactMarkdown or low-cost readable fallback. Verification: preview is not blank and error is isolated.

## 3. Outline / Toc

- [x] 3.1 Extract outline entries from parser heading tokens. Input: Markdown heading tokens. Output: `MarkdownOutlineEntry[]`. Verification: duplicate headings get stable disambiguated anchors.
- [x] 3.2 Wire file-preview outline to compile result. Input: fast renderer outline. Output: outline panel/quick-jump uses parser-derived entries. Verification: outline does not scan mounted Markdown DOM as primary source.
- [x] 3.3 Support jump-to-heading/source-line. Input: outline entry. Output: scroll/reveal behavior against rendered source-line anchor. Verification: clicking outline jumps to expected section.
- [x] 3.4 Handle bounded/progressive not-yet-rendered targets. Input: outline target outside visible projection. Output: reveal-or-mark behavior. Verification: target becomes reachable without full document rebuild.

## 4. Interaction Islands / Feature Parity

- [x] 4.1 Preserve link and file-link behavior through event delegation. Input: anchor clicks/context menu. Output: existing open-file/open-url behavior. Verification: focused tests cover external URL and file link.
- [x] 4.2 Preserve annotation source-line mapping. Input: source-line attrs and annotation actions. Output: original file line ranges. Verification: annotation tests cover math-normalized and normal blocks.
- [x] 4.3 Preserve table overflow and scroll cache. Input: wide table fixture. Output: stable wrapper and restored scrollLeft. Verification: same-content rerender keeps horizontal position.
- [x] 4.4 Preserve code highlight readability without full-file code-preview work. Input: fenced code fixtures. Output: highlighted block HTML. Verification: markdown preview does not run full-file code preview highlight.
- [x] 4.5 Preserve KaTeX behavior. Input: inline/block math and invalid math fixtures. Output: valid formulas render, invalid formulas fail locally. Verification: focused math tests pass.
- [x] 4.6 Preserve Mermaid Source/Render tabs. Input: Mermaid fixture. Output: lazy render tab, cached SVG, stable geometry. Verification: tab switch does not flicker or reset scroll anchor.

## 5. Render Profile / Rollout

- [x] 5.1 Add deterministic renderer profile selector. Input: metrics, truncation, feature flag. Output: `rich-react` / `fast-html` / `bounded-fast-html` / fallback profile. Verification: unit tests cover thresholds across platforms and do not use machine-local timing as the primary selector.
- [x] 5.2 Integrate fast renderer into `FileMarkdownPreview`. Input: compile result and profile. Output: stable document surface. Verification: focused component test renders large Markdown through fast path.
- [x] 5.3 Keep message Markdown isolated. Input: chat/release/spec surfaces. Output: no implicit migration to file renderer. Verification: existing message Markdown tests remain targeted to message renderer.

## 6. Worker-Ready Follow-up

- [x] 6.1 Keep compile service pure and serializable. Input: compile API. Output: no direct DOM/React dependency inside compile. Verification: unit test can call compile in isolation.
- [x] 6.2 Add optional Worker adapter if Phase 1 parity is stable. Input: same compile request/result contract. Output: latest-request-wins async compile. Verification: stale Worker result cannot overwrite newer preview.

## 7. Validation / Closure

- [x] 7.1 Run `openspec validate harden-file-markdown-preview-rendering --strict --no-interactive`.
- [x] 7.2 Run focused Vitest suites for renderer compile, outline, source-line mapping, and FileMarkdownPreview parity.
- [x] 7.3 Run `npm run typecheck`.
- [x] 7.4 Run `npm run lint`.
- [x] 7.5 Run `npm run check:large-files` if touched files/styles cross large-file thresholds.
- [x] 7.6 Record parser/sanitizer dependency decision if a new dependency is introduced (no new dependencies — all reuse existing ecosystem packages).
- [x] 7.7 Record implementation evidence in verification/archive notes before closing the change, including renderer diagnostics, fallback path, and sanitizer/security fixture results.

## 8. Revalidation Backfill

- [x] 8.1 Re-check implementation against current workspace code after external handoff. Output: gap list covering true file-view entrypoint, wrapper prop parity, interaction-island parity, and tasks/evidence drift.
- [x] 8.2 Wire the fast renderer wrapper into the real Markdown file-preview entrypoint without changing the default rollout posture. Output: `FileViewBody` routes Markdown preview through `FileMarkdownPreviewFast`; rollout remains config-gated and reversible to `rich-react`.
- [x] 8.3 Preserve rich-path behavior while fast interaction islands mature. Output: wrapper forwards rich props, fast path supports annotation-start and table scroll islands, and fails closed to the existing file-preview renderer for annotation overlays or Mermaid blocks.
- [x] 8.4 Make Markdown outline visible in the default rich file-preview path. Output: `FileMarkdownPreviewFast` renders the shared outline shell for both rich and fast profiles, derives rich-path outline entries from the parser compile pipeline, and keeps click-to-heading navigation local to the preview surface.
- [x] 8.5 Add yn-style Markdown outline interaction controls. Output: Markdown outline supports tree branch collapse/expand, a pin control for persistent display, automatic collapse while unpinned, and repeated activation of the same outline item.
- [x] 8.6 Align Markdown outline visuals and pin semantics with yn-style behavior. Output: outline colors use theme tokens, the explicit close button is removed, unpinned panels auto-collapse on mouse leave, and pinned panels remain open.
- [x] 8.7 Add preview-only large Markdown read path. Output: editor/read-write file loading remains capped at 400 KB and read-only when truncated, Markdown preview may fetch up to 4 MB through a preview-only command, and rich bounded Markdown render limit is raised from 1800 to 2800 visible lines. Verification: implementation keeps preview override scoped to Markdown preview mode and does not change save/edit truncation protection.
