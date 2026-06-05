## 1. Contract And Type Foundation

- [x] 1.1 [P0][deps:none][input: Phase 2 specs/design][output: TypeScript Snapshot v2, Landmark, CodeCandidate, Attachment v2, Evidence v2 types][validation: focused type compile or unit test fixtures compile] Define browser page understanding domain types without wiring capture.
- [x] 1.2 [P0][deps:1.1][input: TypeScript contracts][output: Rust DTOs with camelCase serialization for Snapshot v2, Landmark, CodeCandidate, Evidence v2][validation: cargo serialization tests] Add matching backend DTOs and conversion helpers.
- [x] 1.3 [P0][deps:1.1,1.2][input: existing `src/services/tauri/browserAgent.ts` bridge][output: service wrappers for capture v2, refresh, evidence v2, candidate generation][validation: service mapping tests assert invoke names and payload shape] Extend the Tauri browser-agent service boundary without direct UI invoke usage.
- [x] 1.4 [P0][deps:1.1][input: Phase 1 attachment model][output: compatibility adapter from Phase 1 browser attachment to Attachment v2 view model][validation: unit tests cover legacy shallow context fallback] Preserve Phase 1 behavior while making v2 the canonical attachment shape.
- [x] 1.5 [P0][deps:1.1][input: Phase 1 BrowserDock active session/onSessionChange behavior][output: active browser context source-of-truth contract shared by BrowserDock, Composer, TaskRun, orchestration][validation: unit/component test covers multi-ready-tabs attaches active tab only] Replace first-ready-session inference with explicit active tab/session ownership.
- [x] 1.6 [P0][deps:1.1][input: Phase 1 URL validation and workspace identity][output: workspace-scoped local URL allow policy types and diagnostics][validation: unit tests cover workspace localhost allowed and non-workspace private network blocked] Define safe local development page access for page-to-code bridge.

## 2. Snapshot Capture And Sanitization

- [x] 2.1 [P0][deps:1.1][input: Snapshot v2 spec][output: pure sanitizer for every AI-visible string field, landmarks, forms, links, budget, privacy report][validation: unit tests cover redaction, truncation, selectedText, href, aria labels, placeholders, diagnostics, hidden/password/token fields, script/style omission] Implement frontend or shared snapshot sanitizer independent of live WebView.
- [x] 2.2 [P0][deps:1.2,1.5,2.1][input: active BrowserSession and single renderer][output: backend capture command returning Snapshot v2 skeleton with source, viewport, title, URL, active-renderer diagnostics][validation: cargo command tests or mocked integration covers active session missing/closed/renderer-mismatch/degraded] Add backend capture v2 command boundary.
- [x] 2.3 [P0][deps:2.2][input: Browser Dock single renderer][output: read-only WebView capture transport for title, visible text, headings, links, buttons, forms, regions, viewport, scroll][validation: mocked capture fixture tests cover semantic extraction and capture failure degraded result] Implement read-only capture script and JSON-safe transport with strict field allowlist.
- [x] 2.4 [P0][deps:2.3][input: capture script raw facts][output: sanitized bounded Snapshot v2][validation: tests cover large page truncation and diagnostics] Pipe raw page facts through sanitizer before any UI, storage, or AI payload can consume them.
- [x] 2.5 [P1][deps:2.4][input: platform capability matrix][output: degraded/unsupported diagnostics for capture limitations][validation: unit tests cover unsupported platform and partial capture warnings] Surface capture degradation without silently pretending full page understanding.
- [x] 2.6 [P0][deps:1.6,2.2][input: URL validation policy][output: workspace-scoped local URL allow implementation with diagnostics][validation: backend tests cover localhost/127 workspace allow, arbitrary private network block, external site no candidates] Enable local development page understanding without opening SSRF/private-network holes.

## 3. Composer Preview And Stale Policy

- [x] 3.1 [P0][deps:1.4,1.5,2.4][input: Attachment v2 view model][output: composer browser context preview with URL, title, text excerpt, counts, budget, privacy, diagnostics][validation: component test covers fresh preview, remove action, and active tab attachment] Replace generic “attached browser context” copy with visible AI-context preview.
- [x] 3.2 [P0][deps:3.1][input: active tab state and snapshot metadata][output: stale/fresh/expired/degraded preview state][validation: component/unit tests cover URL change, tab switch, TTL expiry, degraded capture] Implement stale policy visible before send.
- [x] 3.3 [P0][deps:3.1,3.2][input: Browser Dock active tab][output: refresh browser context action from composer][validation: component test covers refresh replacing stale attachment] Add explicit refresh action that recaptures active tab and updates preview.
- [x] 3.4 [P1][deps:3.1][input: preview detail requirements][output: expandable preview detail panel with element counts and diagnostics][validation: component test covers collapsed/expanded detail] Let users inspect what AI will actually see without dumping raw DOM.
- [x] 3.5 [P0][deps:3.1][input: large-file governance and current Composer size][output: `BrowserContextPreview` component plus attachment hook extracted from Composer][validation: large-file near-threshold check or documented file-size diff] Keep Composer as wiring only and avoid growing large files.

## 4. AI Request Integration

- [x] 4.1 [P0][deps:3.1][input: Attachment v2][output: bounded engine-agnostic AI payload formatter][validation: unit tests assert no raw DOM/cookies/headers/secrets and budget metadata included] Format Snapshot v2 for AI requests through one shared canonical path.
- [x] 4.2 [P0][deps:4.1][input: existing send path][output: conversation send includes Attachment v2 when present and omits it when removed without duplicate prompt block][validation: send-path tests cover attach/remove/stale/degraded metadata and no structured+prompt double injection] Wire Attachment v2 into conversation lifecycle without breaking streaming.
- [x] 4.3 [P0][deps:4.1][input: provider routing][output: Claude/Codex/Gemini/OpenCode/custom providers consume same browser payload contract][validation: routing tests assert no engine-specific browser payloads] Keep browser context engine-agnostic.
- [x] 4.4 [P1][deps:4.2][input: conversation persistence][output: historical browser attachment references with available/stale/expired/degraded states][validation: lifecycle test covers reopened conversation] Preserve browser context references across conversation restore.

## 5. Local Page-To-Code Bridge

- [x] 5.1 [P0][deps:1.1,2.4][input: Snapshot v2 URL, visible text, landmarks, workspace id][output: page-to-code candidate generator interface][validation: unit tests cover external URL returns no candidates and local URL produces bounded query plan] Define the local-only candidate pipeline contract.
- [x] 5.2 [P0][deps:5.1][input: local route and existing workspace file search/navigation capabilities][output: route_match and visible_text_match candidates with reason/confidence][validation: focused tests with fixture workspace routes/text] Generate explainable candidate files for local pages.
- [x] 5.3 [P1][deps:5.2][input: landmarks][output: landmark_match candidates for buttons/forms/headings][validation: tests cover button text and form label matches] Add landmark-based candidate discovery.
- [x] 5.4 [P1][deps:5.2][input: file-view-code-intelligence-navigation][output: candidate open/inspect affordance through existing navigation surfaces][validation: UI test or service test confirms candidate path can open without duplicate navigation implementation] Reuse existing code navigation instead of creating Browser Agent-specific file navigation.
- [x] 5.5 [P1][deps:5.2][input: candidate confidence metadata][output: AI/user-visible candidate explanation][validation: unit tests cover low-confidence wording and no confirmed ownership claim] Ensure candidates remain suggestions, not fabricated certainty.

## 6. Evidence, TaskRun, And Orchestration

- [x] 6.1 [P0][deps:1.2,2.4][input: Snapshot v2][output: bounded Browser Evidence v2 persistence metadata][validation: Rust store tests cover available/expired/degraded states and no raw sensitive payload] Persist snapshot references and metadata under retention rules.
- [x] 6.2 [P0][deps:6.1][input: TaskRun detail UI][output: Browser Snapshot v2 evidence section with source, summary, freshness, diagnostics, privacy, candidates][validation: component test covers evidence states] Show browser evidence v2 in Task Center.
- [x] 6.3 [P1][deps:6.1][input: orchestration dispatch][output: Browser Snapshot v2 evidence shown before task launch][validation: render test covers fresh/stale/degraded context at dispatch] Add browser evidence v2 to orchestration dispatch confirmation.
- [x] 6.4 [P1][deps:6.1,4.1][input: orchestration engine payload][output: shared Attachment v2 passed to task execution providers][validation: routing tests assert engine-agnostic orchestration browser payload] Keep orchestration browser context universal across engines.

## 7. Browser Dock Baseline Regression Guard

- [x] 7.1 [P0][deps:all P0 UI tasks][input: Phase 1 Browser Dock baseline][output: regression checks for top toolbar opener, right companion split, draggable divider, multi-tab UI, single renderer][validation: focused UI/manual checklist documented] Verify Phase 2 does not regress Browser Dock MVP layout/runtime.
- [x] 7.2 [P0][deps:2.4,4.1][input: privacy requirements][output: snapshot and AI payload privacy tests][validation: tests assert raw DOM/cookies/headers/storage/password/token/authorization are absent] Add privacy regression coverage.
- [x] 7.3 [P1][deps:2.5][input: macOS/Windows/Linux capability matrix][output: manual QA matrix update for capture v2 degraded behavior][validation: recorded matrix notes supported/degraded/unsupported states] Document cross-platform Browser Agent Page Understanding behavior.

## 8. Validation And Governance

- [x] 8.1 [P0][deps:all P0 tasks][input: completed implementation][output: OpenSpec strict validation evidence][validation: `openspec validate enhance-browser-agent-page-understanding --strict` passes] Validate Phase 2 OpenSpec artifacts.
- [x] 8.2 [P0][deps:all P0 frontend tasks][input: changed frontend files][output: focused Vitest coverage for sanitizer, preview, send path, stale policy, candidates][validation: focused Vitest suite passes] Run focused frontend tests.
- [x] 8.3 [P0][deps:all P0 backend tasks][input: changed Rust files][output: focused Rust tests for DTOs, capture command, evidence store][validation: `cargo test --manifest-path src-tauri/Cargo.toml browser_agent` passes or documented focused equivalent] Run focused backend tests.
- [x] 8.4 [P0][deps:all implementation tasks][input: `.github/workflows/large-file-governance.yml`][output: large-file governance evidence][validation: `npm run check:large-files:near-threshold` and `npm run check:large-files:gate` pass] Ensure Browser Agent Phase 2 respects large-file governance.

## 9. Post-Acceptance Page Understanding Hardening

- [x] 9.1 [P0][deps:2.4,4.1][input: GitHub issue/news/docs/form/SPA page fixtures][output: primary-content regression coverage][validation: sanitizer fixture tests assert primary content does not regress to navigation/header/footer prefixes] Add content extraction fixture regression coverage for common page categories.
- [x] 9.2 [P0][deps:4.2,4.4][input: live/history/queued browser context paths][output: Browser Context card metadata preserved across optimistic, historical, and queued handoff paths][validation: existing live card path plus queued metadata regression cover the shared attachment contract] Keep live/history/queued Browser Context card behavior aligned around one attachment shape.
- [x] 9.3 [P1][deps:1.1,2.3][input: Snapshot v2 body/region signals][output: `primaryContent`, `readableBlocks`, and `noiseDiagnostics` fields][validation: attachment and sanitizer tests assert formatter prefers primary content over `visibleText`] Make Snapshot v2 structured enough that `visibleText` is no longer the only semantic carrier.
- [x] 9.4 [P1][deps:2.3,2.4][input: visible images/figures/attachments][output: bounded `visualEvidence` clues with alt text, origin, nearby text, and redaction][validation: sanitizer test covers image evidence without exposing sensitive raw URLs or payloads] Structure image and attachment clues for issue screenshots and news media.
- [x] 9.5 [P1][deps:3.1,4.1][input: sent browser context reference card][output: copy-safe browser context summary action][validation: UI uses sanitized attachment fields only and avoids raw DOM/cookies/headers] Add a "copy browser context summary" affordance to the reference card.
- [x] 9.6 [P2][deps:2.3][input: generic DOM/URL/form/control/article signals][output: page type inference for article/issue/docs/form/dashboard/SPA/unknown][validation: fixture regression tests lock inferred type fields in Snapshot v2] Add generic page type inference without site-specific payload forks.

## 10. Phase 2 Closure And Handoff

- [x] 10.1 [P0][deps:3.1,3.5][input: Browser Dock header and Composer attachment hook][output: Browser Dock header attach entry using existing Composer attachment capability][validation: code review confirms attach/refresh/remove/detail abilities remain on the same BrowserContextAttachment path] Move the attach entry to Browser Dock while preserving the original capability.
- [x] 10.2 [P0][deps:3.4,9.3,9.4][input: composer preview detail content][output: compact outer preview plus bounded scroll detail panel][validation: preview no longer exposes long visible text outside details] Keep Browser Context details inspectable without letting long evidence blocks dominate the composer.
- [x] 10.3 [P0][deps:all Phase 2 tasks][input: completed implementation and acceptance findings][output: proposal closure section][validation: OpenSpec status remains all_done] Mark Phase 2 as an evidence-grade page understanding MVP rather than an open-ended visual browser agent.
- [x] 10.4 [P1][deps:10.3][input: remaining acceptance gaps][output: next-stage input list for OCR/vision, complex SPA, detail filtering, real fixture matrix, and authorized actions][validation: proposal distinguishes completed Phase 2 scope from future work] Move non-MVP work out of this change.

## 11. Post-Closure Hardening

- [x] 11.1 [P0][deps:10.3][input: Composer browser auto-navigation shortcut][output: strict pure `resolveBrowserNavigationUrl` utility and Composer wiring][validation: focused Vitest covers explicit navigation commands and descriptive bug reports] Prevent Browser Dock auto-open from hijacking normal text, screenshots, logs, or bug reports that merely mention open/browser/URL terms.
- [x] 11.2 [P0][deps:11.1][input: release CI failure on Linux/Windows][output: cfg-scoped Rust status handling in workspace open command][validation: `cargo check --manifest-path src-tauri/Cargo.toml`] Fix cross-platform build failure caused by macOS-only `status` binding leaking into non-macOS compilation.
