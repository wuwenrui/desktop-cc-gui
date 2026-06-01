# Phase 2 Implementation Notes

## Current implementation scope

- Snapshot v2 contracts now exist on frontend and Rust DTOs with camelCase serialization.
- Browser Dock active tab remains the source of truth for Composer and TaskRun browser context capture.
- Composer uses a dedicated `useBrowserContextAttachment` hook plus `BrowserContextPreview` component.
- AI request injection is centralized in `useThreadMessaging`; Composer and TaskRun no longer prepend browser prompt blocks directly.
- Snapshot sanitizer covers visible text, selected text, headings, links, buttons, form labels, placeholders, hrefs, landmarks, content regions, and diagnostics.
- Local page-to-code candidates are generated only for localhost / 127.* / ::1 style workspace-local pages and are labelled as suggestions with confidence.
- Backend capture validates the active single native renderer binding. Renderer mismatch returns stale/degraded diagnostics instead of silently capturing the wrong page.
- Browser evidence records include freshness, diagnostics, privacy metadata, and code candidates. Raw DOM/cookies/headers/storage/scripts/styles remain omitted.

## Runtime capture transport

The Tauri child WebView path now executes a read-only DOM capture script against the active single renderer and returns a sanitized Snapshot v2 when the renderer is ready. The return channel is intentionally narrow: the page script sends base64url JSON chunks through a reserved `browser-agent-capture.invalid` navigation URL, Rust intercepts that navigation in `on_navigation`, denies the real navigation, reassembles the payload, and only then builds the AI-visible snapshot.

If script execution, chunk return, parsing, renderer binding, or platform behavior fails, capture still falls back to a degraded metadata snapshot with diagnostics. Degraded is now a failure fallback, not the expected successful path.

## Large-file governance handling

New Phase 2 responsibilities are split into focused modules:

- `src/features/browser-agent/hooks/useBrowserContextAttachment.ts`
- `src/features/browser-agent/components/BrowserContextPreview.tsx`
- `src/features/browser-agent/utils/codeCandidates.ts`
- `src/features/browser-agent/utils/readOnlyCaptureScript.ts`
- `src/features/browser-agent/utils/snapshotSanitizer.ts`
- `src/features/browser-agent/utils/attachment.ts`

Composer and BrowserDock remain wiring/lifecycle surfaces rather than absorbing the full preview/sanitizer/candidate implementation.

## Manual regression checklist

- Top toolbar Browser Dock opener still opens the right companion panel.
- Browser Dock remains in the middle/right split, not as modal overlay.
- Conversation/browser divider remains draggable.
- Browser Dock tab strip still supports multiple tabs with one native renderer.
- Attaching browser context uses the active tab, not the first ready session.
- Sending with browser context produces one canonical `<browser_context_v2>` block through the thread send path.
- Removing browser context prevents the next send from including it.
- Localhost / 127.* workspace pages are allowed for read-only understanding; non-workspace private network URLs remain blocked/degraded.

## 2026-06-01 acceptance refinement: compact context preview and semantic fallback

- Browser Context Preview now collapses debug details by default whenever a new snapshot is attached, so the composer shows a compact AI-visible summary instead of a persistent diagnostic panel.
- Preview summary trims repeated title prefixes and clamps text to a short human-readable excerpt while keeping refresh/remove actions available.
- Read-only WebView capture now includes visual heading fallback for pages that do not expose standard `h1`-`h6` nodes, using visible text, font size, font weight, and bounds as bounded heuristics.
- Content region discovery now covers common article/news containers such as `.article-content`, `.detail-content`, `.news-content`, `.rich-text`, `#article`, and `#content` while preserving the no raw DOM/cookies/headers constraint.
- This refinement keeps the Phase 1 single native renderer, active-tab-only capture, engine-agnostic attachment, and privacy-safe output constraints unchanged.

## 2026-06-01 acceptance refinement: generic semantic-first capture

- Heading extraction now uses standard semantic headings first and only falls back to visual heading inference when a page exposes no visible `h1`-`h6` headings.
- This avoids over-counting generic application pages with valid semantic markup while still supporting mobile/news pages that render article titles through non-semantic containers.
- Composer preview was tightened again: new captures reset detail expansion by snapshot/title/URL, text excerpts are shorter, and the default card shows two summary lines plus compact count pills.

## 2026-06-01 acceptance refinement: remove duplicate sidebar browser entry

- Removed the left primary sidebar Browser Dock opener because Browser Dock is already exposed through the top-level toolbar and right companion split workflow.
- This keeps Browser Agent access single-source for users and avoids implying a second browser surface.

## 2026-06-01 acceptance refinement: sent browser context summary card

- Sent user messages now render Browser Context attachments through a dedicated `BrowserContextSummaryCard` instead of a title-only inline card.
- The card distinguishes a browser-visible page snapshot from API raw data, shows URL source, short excerpt, structure counts, capture state, and expandable privacy/budget/diagnostic details when available.
- Legacy prompt-parsed browser context still falls back to the basic card shape, while full `BrowserContextAttachment` rows expose the richer structure.
- The AI payload now includes a source kind and usage hint telling engines to answer current-page questions from browser context first, and only switch to CLI/API/raw fetch when explicitly requested or when context is degraded/insufficient.

## 2026-06-01 acceptance refinement: align composer browser preview wording

- Composer's pre-send Browser Context preview now uses the same visible-page-snapshot language as the sent message summary card.
- The preview source line shows a compact host/path plus `Not API raw data`, avoiding the old generic attached-browser-context copy.
- The change only affects UI wording/presentation and keeps the underlying active-tab snapshot contract unchanged.

## 2026-06-01 acceptance refinement: content-first visible text

- Browser capture now selects `visibleText` from the best main-content candidate instead of always using `document.body.innerText`.
- Candidate scoring is generic: it favors article/main/content/markdown/detail-like blocks, paragraph density, title overlap, and visible bounds, while penalizing navigation/header/footer/aside containers, link-heavy regions, control-heavy regions, and oversized aggregate containers.
- This is intended to reduce navigation noise such as `Skip to content / Navigation Menu / Sign in` in browser context summaries without adding site-specific API adapters.

## 2026-06-01 acceptance refinement: live browser context card and readable blocks

- Live sends now create an optimistic user row whenever a Browser Context attachment is present, even on Claude/shared paths that normally wait for history/realtime reconciliation. This lets the Browser Context card enter the curtain immediately instead of only appearing after history reload.
- Main-content extraction now performs a second readable-block pass inside the selected main container. It favors article/comment/markdown/body/description/content blocks and paragraph/list/blockquote/pre text while penalizing sign-in/sign-up/comment-action noise and link-heavy blocks.
- The refinement remains generic and does not use site-specific APIs or GitHub-specific adapters.

## 2026-06-01 proposal backfill and remaining optimization review

The proposal/design have been updated to reflect the real acceptance findings from manual testing:

- Browser Context has three user-visible surfaces: composer preview, live curtain card, and history restore card. They must use the same BrowserContextAttachment view model and remain consistent.
- Live sends with BrowserContextAttachment must insert an optimistic user row immediately so the card is visible during streaming, not only after history restore.
- Browser context must be presented as a browser-visible page snapshot, not API raw data, both in UI and AI payload usage hints.
- `visibleText` should be content-first and should not default to the first characters of `document.body.innerText` when better main-content/readable blocks exist.

Remaining optimization candidates captured in proposal:

- Add fixture-based regression coverage for content extraction quality.
- Add live/history/queued consistency tests for BrowserContextAttachment cards.
- Consider explicit `primaryContent`, `readableBlocks`, and `noiseDiagnostics` fields in Snapshot v2.
- Add safe image/attachment evidence summaries.
- Add a copyable bounded browser context summary action.
- Add generic page-type inference for article/issue/docs/form/dashboard pages.

## 2026-06-01 Phase 2 closure

- The remaining optimization candidates above have been implemented as Phase 2 hardening: primary-content fixtures, live/history/queued alignment, `primaryContent` / `readableBlocks` / `noiseDiagnostics`, `visualEvidence`, copy-safe summary, and generic page type inference.
- The Browser Context attach entry moved from the Composer area into the Browser Dock header. The implementation uses a small browser context attachment command bus so the original Composer attachment hook remains the owner of capture, refresh, remove, stale state, and preview state.
- Composer now renders Browser Context UI only after an attachment or error exists. The unassociated attach button is no longer shown above the input.
- The composer preview outer card no longer shows the long visible-text excerpt. Source and visible snapshot text live inside the expandable detail panel, which has a bounded scroll area.
- Phase 2 is closed as a read-only, evidence-grade page understanding MVP. OCR/vision, complex SPA deep understanding, advanced detail filtering, broader real-site fixtures, and authorized browser actions are explicitly next-stage inputs.

## 2026-06-01 post-closure hardening: Browser Dock auto-navigation intent

- Composer previously treated any text containing navigation words such as `打开` / `open` plus a URL/domain as a Browser Dock navigation request.
- That heuristic was too broad for real bug reports: a user can describe "Browser Dock 莫名其妙打开" or paste a screenshot/log containing URL text, and the send path must not be hijacked.
- Navigation intent is now resolved through `src/features/composer/utils/browserNavigation.ts` as a pure utility.
- The utility only accepts explicit short commands such as `打开 https://hatch.rs/`, `访问 hatch.rs`, `open https://example.com/docs`, `go to example.com/path`, plus known short destinations like `百度`.
- Descriptive long text, bug reports, screenshots, logs, or "不要打开" style context fail closed and continue through the normal message send path.
- Focused coverage lives in `src/features/composer/utils/browserNavigation.test.ts`.

## 2026-06-01 release CI hotfix: workspace open command cfg scope

- Release #111 failed on Linux AppImage and Windows installer builds with Rust `E0425`: `cannot find value status in this scope` at `src/workspaces/commands.rs:2092`.
- The root cause was a macOS-only `let status = ...` binding followed by an unconditional `status` expression. Non-macOS compilation removed the binding but kept the use site.
- The fix keeps macOS command construction, execution, and status return inside the same `#[cfg(target_os = "macos")]` block.
- The non-macOS branch continues to delegate to `open_workspace_with_non_macos_app(...)` and returns `Ok(())`.
- This is a cross-platform release build hotfix and does not change Browser Agent page-understanding behavior.
