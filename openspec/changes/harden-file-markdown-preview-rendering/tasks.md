## 1. Planning / Contract

- [ ] 1.1 Confirm renderer rollout flag and deterministic profile names. Input: proposal/design. Output: selected rollout contract for `rich-react` / `fast-html` / `bounded-fast-html` / readable fallback. Verification: reviewer can identify how to force fallback and how diagnostics expose profile/fallback reason.
- [ ] 1.2 Define fast renderer result types. Input: design type sketches. Output: typed compile result / outline / source-line / heavy-block metadata / diagnostics. Verification: typecheck covers public signatures and compile result contains no React/DOM instance dependency.
- [ ] 1.3 Add fixture set for Markdown parity and security. Input: tables, nested lists, task lists, code, raw HTML, unsafe links, inline event attributes, math, Mermaid, duplicate headings, Chinese headings. Output: reusable test fixtures. Verification: fixtures are consumed by focused tests including sanitizer failure fallback.

## 2. Fast Renderer Core

- [ ] 2.1 Add file-preview Markdown parser service. Input: raw markdown + document key + renderer profile. Output: sanitized HTML compile result. Verification: unit test returns stable cache key, sanitized HTML, and rejected unsafe attributes/schemes.
- [ ] 2.2 Attach source-line attributes from parser token maps. Input: heading/paragraph/list/table/code tokens. Output: block-level `data-source-line-start/end` or equivalent. Verification: fixture assertions cover original line ranges.
- [ ] 2.3 Add compile cache independent from annotation UI state. Input: document key/content hash/profile. Output: reusable compile result. Verification: same-content annotation-state rerender does not call compile again.
- [ ] 2.4 Implement readable fallback on compile failure. Input: malformed Markdown/plugin failure fixture. Output: existing ReactMarkdown or low-cost readable fallback. Verification: preview is not blank and error is isolated.

## 3. Outline / Toc

- [ ] 3.1 Extract outline entries from parser heading tokens. Input: Markdown heading tokens. Output: `MarkdownOutlineEntry[]`. Verification: duplicate headings get stable disambiguated anchors.
- [ ] 3.2 Wire file-preview outline to compile result. Input: fast renderer outline. Output: outline panel/quick-jump uses parser-derived entries. Verification: outline does not scan mounted Markdown DOM as primary source.
- [ ] 3.3 Support jump-to-heading/source-line. Input: outline entry. Output: scroll/reveal behavior against rendered source-line anchor. Verification: clicking outline jumps to expected section.
- [ ] 3.4 Handle bounded/progressive not-yet-rendered targets. Input: outline target outside visible projection. Output: reveal-or-mark behavior. Verification: target becomes reachable without full document rebuild.

## 4. Interaction Islands / Feature Parity

- [ ] 4.1 Preserve link and file-link behavior through event delegation. Input: anchor clicks/context menu. Output: existing open-file/open-url behavior. Verification: focused tests cover external URL and file link.
- [ ] 4.2 Preserve annotation source-line mapping. Input: source-line attrs and annotation actions. Output: original file line ranges. Verification: annotation tests cover math-normalized and normal blocks.
- [ ] 4.3 Preserve table overflow and scroll cache. Input: wide table fixture. Output: stable wrapper and restored scrollLeft. Verification: same-content rerender keeps horizontal position.
- [ ] 4.4 Preserve code highlight readability without full-file code-preview work. Input: fenced code fixtures. Output: highlighted block HTML. Verification: markdown preview does not run full-file code preview highlight.
- [ ] 4.5 Preserve KaTeX behavior. Input: inline/block math and invalid math fixtures. Output: valid formulas render, invalid formulas fail locally. Verification: focused math tests pass.
- [ ] 4.6 Preserve Mermaid Source/Render tabs. Input: Mermaid fixture. Output: lazy render tab, cached SVG, stable geometry. Verification: tab switch does not flicker or reset scroll anchor.

## 5. Render Profile / Rollout

- [ ] 5.1 Add deterministic renderer profile selector. Input: metrics, truncation, feature flag. Output: `rich-react` / `fast-html` / `bounded-fast-html` / fallback profile. Verification: unit tests cover thresholds across platforms and do not use machine-local timing as the primary selector.
- [ ] 5.2 Integrate fast renderer into `FileMarkdownPreview`. Input: compile result and profile. Output: stable document surface. Verification: focused component test renders large Markdown through fast path.
- [ ] 5.3 Keep message Markdown isolated. Input: chat/release/spec surfaces. Output: no implicit migration to file renderer. Verification: existing message Markdown tests remain targeted to message renderer.

## 6. Worker-Ready Follow-up

- [ ] 6.1 Keep compile service pure and serializable. Input: compile API. Output: no direct DOM/React dependency inside compile. Verification: unit test can call compile in isolation.
- [ ] 6.2 Add optional Worker adapter if Phase 1 parity is stable. Input: same compile request/result contract. Output: latest-request-wins async compile. Verification: stale Worker result cannot overwrite newer preview.

## 7. Validation / Closure

- [ ] 7.1 Run `openspec validate harden-file-markdown-preview-rendering --strict --no-interactive`.
- [ ] 7.2 Run focused Vitest suites for renderer compile, outline, source-line mapping, and FileMarkdownPreview parity.
- [ ] 7.3 Run `npm run typecheck`.
- [ ] 7.4 Run `npm run lint`.
- [ ] 7.5 Run `npm run check:large-files` if touched files/styles cross large-file thresholds.
- [ ] 7.6 Record parser/sanitizer dependency decision if a new dependency is introduced.
- [ ] 7.7 Record implementation evidence in verification/archive notes before closing the change, including renderer diagnostics, fallback path, and sanitizer/security fixture results.
