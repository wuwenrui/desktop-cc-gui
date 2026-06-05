## 1. Contract And Type Foundation

- [x] 1.1 [P0][deps:none][input: proposal/design/specs][output: shared BrowserSession and BrowserSnapshot TypeScript types][validation: focused type tests compile] Define frontend browser-agent domain types for session, snapshot, sanitized facts, attachment, evidence, and action audit without wiring UI.
- [x] 1.2 [P0][deps:1.1][input: TypeScript browser-agent types][output: Rust DTO structs with camelCase serialization][validation: cargo DTO serialization tests] Define matching Rust DTOs for BrowserSession, BrowserContextSnapshot, BrowserContextAttachment, and BrowserActionAuditEntry.
- [x] 1.3 [P0][deps:1.1,1.2][input: existing service bridge pattern][output: `src/services/tauri/browserAgent.ts` command wrapper skeleton][validation: frontend service mapping tests mock invoke names] Add browser-agent service bridge functions and export them through the central tauri service boundary.
- [x] 1.4 [P0][deps:1.2][input: existing command registry pattern][output: backend browser_agent module and command registration skeleton][validation: cargo compile or focused command registry test] Create backend module boundaries for browser-agent commands without implementing WebView behavior yet.
- [x] 1.5 [P0][deps:1.1,1.2][input: design data model contract][output: complete DTO coverage for settings, platform capability, privacy report, provider route decision, and snapshot budget][validation: TypeScript and Rust serialization tests cover all enums and degraded states] Complete cross-layer data structures before feature wiring to avoid later contract drift.

## 2. Browser Session Store And Policy

- [x] 2.1 [P0][deps:1.2][input: storage conventions and workspace id/path][output: workspace-scoped BrowserSession metadata store][validation: Rust store tests cover create/list/update/close] Implement BrowserSession metadata persistence with no sensitive page payload stored by default.
- [x] 2.2 [P0][deps:2.1][input: allowed URL policy requirements][output: URL normalization and scheme guard][validation: unit tests cover http/https allowed and local/dangerous schemes blocked] Add Browser Dock URL validation and explicit blocked diagnostics.
- [x] 2.3 [P1][deps:2.1][input: detached/orphan session rules][output: session cleanup policy][validation: store tests cover detached cleanup and no AI injection for orphan sessions] Implement bounded cleanup and detached state handling for browser sessions.
- [x] 2.4 [P1][deps:2.1][input: privacy/evidence TTL requirements][output: browser evidence retention constants and cleanup command shape][validation: unit tests cover expired evidence visibility state] Define retention/TTL metadata for snapshots and evidence without deleting unrelated task/session records.
- [x] 2.5 [P0][deps:1.5][input: BrowserAgentSettings contract][output: persisted enable/disable and provider preference settings][validation: settings tests cover disabled blocks context injection and enabled prefers built-in provider] Add Browser Agent settings model with explicit enable/disable and AI browser operation preference.

## 3. Browser Dock MVP UI

- [x] 3.1 [P0][deps:1.1,1.3][input: existing feature slice patterns][output: `src/features/browser-agent` UI shell][validation: render test covers empty/loading/error/ready states] Add Browser Dock component shell with URL bar, status line, and workspace ownership display.
- [x] 3.2 [P0][deps:3.1,2.2][input: URL policy and service bridge][output: navigate/create session UI flow][validation: component test covers allowed URL submit and blocked URL diagnostic] Wire Browser Dock URL submission through browser-agent service, not direct component invoke.
- [x] 3.3 [P1][deps:3.1][input: i18n conventions][output: English and Chinese Browser Dock copy][validation: locale merge test or focused i18n key test] Add visible copy for Browser Dock status, privacy, stale snapshot, unsupported platform, and blocked action states.
- [x] 3.4 [P1][deps:3.1][input: workspace/orchestration surface decision][output: Browser Dock mounted behind feature flag in vibecoding/orchestration surface][validation: render test confirms feature flag hides/shows surface] Mount Browser Dock in the target operation-room surface without replacing existing Task Center or conversation panels.
- [x] 3.5 [P0][deps:2.5][input: BrowserAgentSettings][output: default-enabled setting, settings toggle, and dock-level enable action][validation: settings render test covers default enabled, toggle off, and disabled-state enable copy] Add user-visible enable/disable controls while keeping Browser Agent immediately usable by default.
- [x] 3.6 [P0][deps:3.1,3.3][input: top-level toolbar icon group][output: Browser Dock opener in the global top toolbar][validation: render test confirms opener toggles Browser Dock without requiring Workspace Home] Add a top-level Browser Dock icon opener so users can open the browser from the global client chrome.
- [x] 3.7 [P0][deps:3.6][input: conversation workspace layout][output: Browser Dock as right-side companion split beside conversation][validation: layout test confirms Browser Dock does not open as modal/floating overlay] Render Browser Dock in the main content split like file-system companion panels instead of a Sidebar overlay.
- [x] 3.8 [P0][deps:3.7][input: browser companion split][output: draggable splitter between conversation and Browser Dock][validation: layout interaction test confirms bounded horizontal resize] Add left-right drag resizing for the main content Browser Dock split.
- [x] 3.9 [P0][deps:3.7][input: Browser Dock multi-page model][output: tab strip with active tab ownership][validation: UI/manual check covers new tab, active tab URL ownership, and no internal session count display] Render Browser Dock as tabbed browser UI so users can run multiple pages without seeing raw BrowserSession counts.
- [x] 3.10 [P0][deps:3.9,4.1][input: user acceptance bug report][output: compact file-system-style Browser Dock tabs, independent tab WebView visibility, and icon-only diagnostics footer][validation: manual check covers multiple tabs, tab switching, compressed header, and info icon popover] Fix Browser Dock tab UX regressions found during MVP acceptance.
- [x] 3.11 [P0][deps:3.10][input: user regression report][output: stable WebView mount effect independent from session load events][validation: manual check confirms loaded pages do not repeatedly refresh or flash] Stop Browser Dock page-load events from causing remount/navigation loops.
- [x] 3.12 [P0][deps:3.11,4.1][input: cross-platform native WebView layering regression][output: multi-tab session model backed by one native Browser Dock renderer][validation: manual check confirms second tab renders without closing the first tab] Replace per-tab child WebView instances with a single renderer to avoid platform-specific native z-order failures.

## 4. Embedded WebView Runtime

- [x] 4.1 [P0][deps:2.1,3.1][input: Tauri WebView APIs and capability config][output: browser-specific WebView creation path][validation: focused manual dev check or backend command test where possible] Create Browser Dock WebView labels and ensure they do not navigate the main application webview.
- [x] 4.2 [P0][deps:4.1][input: current main-window external navigation policy][output: separate Browser Dock navigation policy][validation: manual check verifies Browser Dock opens external URL while normal app links keep existing behavior] Separate Browser Dock navigation from main-window external-link handling.
- [x] 4.3 [P1][deps:4.1][input: platform WebView support][output: platform capability status result][validation: unit tests cover supported/degraded/unsupported mapping] Add explicit platform capability reporting for macOS, Windows, Linux, and unsupported contexts.
- [x] 4.4 [P1][deps:4.1][input: WebView load events available in Tauri][output: loading/title/error state projection][validation: UI test with mocked service updates covers loading->ready and loading->failed] Project browser load state into Browser Dock UI.
- [x] 4.5 [P0][deps:4.3][input: macOS/Windows/Linux WebView runtime matrix][output: compatibility matrix documented in code and UI status][validation: unit tests cover WKWebView/WebView2/WebKitGTK capability mapping] Implement explicit cross-platform capability matrix before enabling snapshot or action routing.

## 5. Snapshot Capture And Sanitization

- [x] 5.1 [P0][deps:1.1,1.2][input: snapshot spec][output: snapshot sanitizer utility][validation: unit tests cover password/token/cookie/authorization/hidden-field redaction] Implement redaction and bounded snapshot shaping independent of live WebView capture.
- [x] 5.2 [P0][deps:5.1][input: browser page facts from capture adapter][output: BrowserContextSnapshot builder][validation: unit tests cover headings/links/buttons/forms/truncation/warnings] Implement snapshot builder that produces structured page facts with budget metadata.
- [x] 5.3 [P0][deps:4.1,5.2][input: live Browser Session][output: read-only snapshot capture command][validation: mocked integration test or manual check captures URL/title/visible text] Add backend/frontend command flow to request a read-only snapshot for the current browser session.
- [x] 5.4 [P1][deps:5.3][input: capture diagnostics][output: console/network summary placeholders or supported diagnostics][validation: tests cover unsupported diagnostics emit explicit capture warning] Add diagnostics fields with explicit unsupported/degraded states where platform capture is not available.
- [x] 5.5 [P1][deps:5.3][input: evidence retention policy][output: optional snapshot evidence persistence][validation: store tests cover available/expired/deleted evidence states] Persist snapshot evidence references under bounded retention rules.

## 6. AI Context Attachment

- [x] 6.1 [P0][deps:5.3][input: BrowserContextSnapshot][output: BrowserContextAttachment view model][validation: unit tests cover title/url/capture/stale metadata] Build attachment model used by composer and task dispatch surfaces.
- [x] 6.2 [P0][deps:6.1][input: composer attachment patterns][output: composer UI showing browser snapshot attachment][validation: component test covers attach/remove/stale state before send] Add explicit attach/remove flow for current browser snapshot in conversation composer.
- [x] 6.3 [P0][deps:6.2][input: message send path][output: bounded browser snapshot included in AI request payload][validation: send-path test asserts only sanitized bounded snapshot is included] Inject browser context into AI request only when attachment is present.
- [x] 6.4 [P1][deps:6.3][input: context budget rules][output: token/char budget enforcement for browser attachment][validation: unit tests cover truncation marker and omitted oversized details] Enforce browser attachment budget before send.
- [x] 6.5 [P1][deps:6.3][input: conversation replay behavior][output: visible historical browser attachment reference][validation: lifecycle test covers reopened message with missing evidence degrades visibly] Preserve browser attachment references across conversation lifecycle without forcing processing state.
- [x] 6.6 [P0][deps:6.3][input: engine-agnostic attachment contract][output: shared browser context path for Claude/Codex/Gemini/OpenCode/custom providers][validation: routing tests assert no engine-specific browser payload is produced] Ensure browser context attachment remains universal across engines.
- [x] 6.7 [P0][deps:2.5,6.6][input: provider route decision contract][output: default AI browser operation routing prefers built-in Browser Agent after MVP][validation: routing tests cover enabled, disabled, explicit opt-out, unsupported, and phase-blocked fallbacks] Add provider preference routing so built-in Browser Agent is used first unless user or capability state says otherwise.

## 7. TaskRun And Orchestration Evidence

- [x] 7.1 [P0][deps:6.1][input: orchestration dispatch flow][output: browser context attachment shown in task dispatch confirmation][validation: render test covers browser evidence visible before launch] Add browser snapshot attachment to orchestration dispatch confirmation.
- [x] 7.2 [P0][deps:7.1][input: TaskRun creation/update model][output: linked browser evidence reference on TaskRun][validation: TaskRun storage/projection test covers linked browser evidence] Store browser evidence reference on TaskRun without changing task completion semantics.
- [x] 7.3 [P0][deps:7.2][input: TaskCenterView detail][output: browser evidence section in run detail][validation: component test covers available and expired evidence states] Show linked browser evidence in Task Center details.
- [x] 7.4 [P1][deps:7.1][input: OrchestrationTask source evidence][output: browser evidence source entry][validation: orchestration projection test covers additive browser evidence] Allow orchestration tasks to reference browser evidence without rewriting other provider artifacts.

## 8. Browser Action Gate Skeleton

- [x] 8.1 [P1][deps:1.1,1.2][input: action gate spec][output: BrowserActionRequest and BrowserActionAuditEntry service types][validation: serialization tests cover completed/blocked/failed/canceled outcomes] Add action request/audit types before enabling mutating actions.
- [x] 8.2 [P1][deps:8.1][input: read-only MVP phase][output: blocked action result for click/type/submit][validation: tests assert mutating actions are blocked while feature phase is read-only] Implement read-only phase gate returning explicit blocked results for mutating actions.
- [x] 8.3 [P2][deps:8.2][input: safe navigation phase rules][output: optional navigate/reload/scroll action preview path behind feature flag][validation: UI test covers preview/cancel/execute audit flow] Add feature-flagged safe navigation actions after MVP snapshot path is stable.
- [x] 8.4 [P2][deps:8.3][input: targeted element action rules][output: click/type/select preview skeleton behind disabled flag][validation: tests assert disabled flag prevents execution] Prepare later click/type/select action surfaces without enabling them by default.

## 9. Validation And Rollout

- [x] 9.1 [P0][deps:5.1,5.2][input: sanitizer and snapshot builder][output: focused sanitizer/snapshot unit test suite][validation: tests cover redaction, truncation, landmarks, and warnings] Add focused tests for snapshot safety and structure.
- [x] 9.2 [P0][deps:6.2,7.3][input: UI attachment/evidence surfaces][output: focused React render tests][validation: tests cover attach/remove/stale/degraded/evidence display] Add focused UI tests for composer attachment and Task Center evidence.
- [x] 9.3 [P0][deps:2.1,5.5][input: backend store and DTOs][output: focused Rust tests][validation: cargo test covers store, serialization, retention states] Add backend tests for browser session/evidence persistence boundaries.
- [x] 9.4 [P1][deps:4.1,5.3][input: platform WebView behavior][output: manual QA matrix for macOS/Windows/Linux][validation: recorded results include supported/degraded/unsupported notes] Record cross-platform manual verification for Browser Dock and snapshot capture.
- [x] 9.5 [P0][deps:all P0 tasks][input: completed implementation][output: OpenSpec and project quality gate evidence][validation: openspec validate plus focused frontend/Rust tests documented] Run and record final validation gates before archive or implementation closure.
- [x] 9.6 [P0][deps:all MVP implementation tasks][input: `.github/workflows/large-file-governance.yml` gate commands][output: large-file governance evidence][validation: `npm run check:large-files:near-threshold` and `npm run check:large-files:gate` pass on the implementation branch] Validate Browser Agent implementation against repository large-file governance before declaring MVP complete.
