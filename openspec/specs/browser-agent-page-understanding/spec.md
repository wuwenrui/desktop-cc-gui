# browser-agent-page-understanding Specification

## Purpose

Defines the browser agent page understanding behavior contract.

## Requirements

### Requirement: Phase 2 inherits Browser Dock MVP baseline
Browser Agent Page Understanding SHALL inherit the Phase 1 Browser Dock MVP baseline, including the top-level toolbar opener, right-side companion split, draggable conversation/browser divider, non-modal Browser Dock, multi-tab UI, single native WebView renderer, active-tab ownership, engine-agnostic attachments, default built-in Browser Agent preference, explicit disable setting, cross-platform capability degradation, large-file governance, and privacy-safe defaults.

#### Scenario: Phase 2 keeps Browser Dock runtime stable
- **WHEN** Browser Agent Page Understanding features are enabled
- **THEN** Browser Dock SHALL still render as the right-side companion panel with multi-tab UI backed by one native renderer

#### Scenario: Inactive tabs do not leak into AI context
- **WHEN** multiple Browser Dock tabs are open and the user attaches browser context
- **THEN** the attachment SHALL describe only the active tab unless the user explicitly switches tabs and captures again

### Requirement: Snapshot v2 captures structured page facts
Browser Agent Page Understanding SHALL provide a Browser Context Snapshot v2 for the active tab that includes source metadata, viewport state, bounded visible text, headings, links, buttons, forms, content regions, element landmarks, budget metadata, privacy metadata, and diagnostics.

#### Scenario: Active page capture succeeds
- **WHEN** the user captures browser context from a loaded active tab
- **THEN** the snapshot SHALL include URL, title, capture time, viewport, visible text excerpt, semantic element summaries, budget state, and privacy state

#### Scenario: Capture is bounded
- **WHEN** a page contains more text or elements than the configured browser snapshot budget
- **THEN** the snapshot SHALL truncate excess content and include truncation metadata visible to the user and AI runtime

### Requirement: Browser context is captured from the active tab source of truth
Browser Agent Page Understanding SHALL capture and attach browser context only from the Browser Dock active tab and active renderer binding, not from the first ready session or any inactive tab heuristic.

#### Scenario: Multiple tabs are ready
- **WHEN** multiple Browser Dock tabs are open and more than one session is ready
- **THEN** attaching browser context SHALL use the currently active tab only

#### Scenario: Renderer binding does not match requested session
- **WHEN** a capture request targets a session that is not bound to the active single native renderer
- **THEN** the system SHALL return stale or degraded diagnostics instead of capturing the wrong page

### Requirement: Snapshot v2 never exposes sensitive raw page data
Browser Agent Page Understanding SHALL NOT expose raw DOM, cookies, headers, storage, password values, token values, Authorization values, hidden input values, script content, style content, or page secrets in Snapshot v2 or AI attachments.

#### Scenario: Sensitive form fields are present
- **WHEN** the active page contains password, token, hidden, or authorization-like fields
- **THEN** the snapshot SHALL include only redacted field metadata and SHALL NOT include their values

#### Scenario: Page contains scripts or styles
- **WHEN** the active page contains inline scripts or style blocks
- **THEN** the snapshot SHALL omit those contents and include no raw script or style text in the AI payload

#### Scenario: Sensitive data appears in element metadata
- **WHEN** sensitive data appears in selected text, labels, placeholders, hrefs, ARIA text, landmark previews, form metadata, or diagnostics
- **THEN** those AI-visible string fields SHALL be sanitized before preview, evidence, or AI payload usage

### Requirement: Element landmarks describe interactive and semantic targets
Browser Agent Page Understanding SHALL generate element landmarks for visible headings, links, buttons, text inputs, textareas, selects, forms, main regions, articles, and navigation regions using safe labels, role, visibility, enabled state, selector hints, and optional viewport-relative bounds.

#### Scenario: Page has interactive controls
- **WHEN** the active page contains visible buttons, links, or form controls
- **THEN** the snapshot SHALL include landmarks with role, safe name, visible text or placeholder summary, and enabled/visible state

#### Scenario: Landmark values are sensitive
- **WHEN** a visible control contains sensitive values
- **THEN** the landmark SHALL redact values while retaining safe role and label metadata

### Requirement: Composer preview shows the actual browser context
Browser Agent Page Understanding SHALL expose a composer preview that summarizes the exact browser context attachment that will be sent to AI, including URL, title, freshness, visible text excerpt, element counts, code candidate counts, budget state, redaction state, diagnostics, and refresh/remove actions.

#### Scenario: User attaches browser context
- **WHEN** the user attaches browser context from Browser Dock
- **THEN** the composer SHALL show a preview of the AI-visible browser context instead of only a generic attached label

#### Scenario: User removes browser context
- **WHEN** the user removes the browser context attachment
- **THEN** the next AI request SHALL NOT include the removed browser snapshot

### Requirement: Snapshot stale state is explicit
Browser Agent Page Understanding SHALL mark browser context stale when the active tab URL changes, title changes after capture, the active tab changes, the viewport scroll changes beyond threshold, the snapshot exceeds TTL, or capture diagnostics degrade the result.

#### Scenario: Page changes after capture
- **WHEN** the user captures browser context and then navigates the active tab to a different URL
- **THEN** the composer preview SHALL mark the attachment stale and offer a refresh action

#### Scenario: Stale context is sent
- **WHEN** the user sends a message with stale browser context
- **THEN** the AI payload SHALL include stale metadata so the model does not treat the snapshot as current

### Requirement: Local page-to-code candidates are generated only for workspace pages
Browser Agent Page Understanding SHALL generate page-to-code candidates only for local or workspace-recognized pages, using route, visible text, and landmark matches, and each candidate SHALL include file path, reason, confidence, and optional matched text.

#### Scenario: Local route matches source files
- **WHEN** the active tab is a local development page whose route or visible text matches workspace source files
- **THEN** the snapshot SHALL include code candidates with route_match, visible_text_match, or landmark_match reasons

#### Scenario: External website is captured
- **WHEN** the active tab is an external website
- **THEN** the snapshot SHALL NOT include workspace code candidates unless the user explicitly provides a manual mapping

### Requirement: Workspace-scoped local URL policy supports local page understanding
Browser Agent Page Understanding SHALL support workspace-scoped local development URLs for page understanding while continuing to block arbitrary private-network browsing by default.

#### Scenario: Workspace local dev page is opened
- **WHEN** the active workspace explicitly allows a localhost, 127.0.0.1, app route, or workspace-local origin
- **THEN** Browser Agent SHALL allow that page for read-only understanding and MAY generate local page-to-code candidates

#### Scenario: Non-workspace private network URL is opened
- **WHEN** the user opens a private-network URL that is not associated with the active workspace
- **THEN** Browser Agent SHALL keep the URL blocked or degraded according to policy and SHALL NOT generate code candidates

### Requirement: Browser context has one canonical AI injection path
Browser Agent Page Understanding SHALL send browser context through a single engine-agnostic BrowserContextAttachment v2 formatter and SHALL NOT duplicate the same context as both structured attachment and prompt text in the same request.

#### Scenario: Structured browser attachment is available
- **WHEN** the user sends a message with BrowserContextAttachment v2
- **THEN** the AI request SHALL include the canonical attachment payload without duplicating the same browser context in the user prompt text

#### Scenario: Legacy fallback is required
- **WHEN** a provider path cannot accept structured attachments
- **THEN** a legacy prompt block MAY be used as fallback, but the request SHALL NOT also include the same structured browser attachment

### Requirement: Browser evidence v2 is retained as bounded references
Browser Agent Page Understanding SHALL persist browser evidence v2 as bounded references containing snapshot metadata, source, summary, budget state, privacy state, diagnostics, candidate file references, capture time, expiry time, and availability state.

#### Scenario: Snapshot evidence is created
- **WHEN** a browser snapshot is attached to a conversation, TaskRun, or orchestration task
- **THEN** the system SHALL store a browser evidence reference without storing raw DOM, cookies, headers, storage, or secret values

#### Scenario: Evidence expires
- **WHEN** browser evidence exceeds its retention window
- **THEN** consumers SHALL display an expired state instead of silently showing stale or missing data

### Requirement: Capture degradation is visible
Browser Agent Page Understanding SHALL report degraded or unsupported capture states to both user-facing UI and AI runtime when WebView, platform, page policy, privacy filters, or budget limits prevent complete context capture.

#### Scenario: Capture script cannot collect all facts
- **WHEN** platform or page constraints prevent full page fact capture
- **THEN** the snapshot SHALL include diagnostics explaining what was omitted or degraded

#### Scenario: AI receives degraded context
- **WHEN** degraded context is sent to AI
- **THEN** the AI payload SHALL include diagnostics so the model can explain uncertainty instead of overclaiming page understanding

### Requirement: Phase 2 implementation respects large-file governance
Browser Agent Page Understanding SHALL split new preview, stale-state, sanitizer, attachment, and candidate logic into focused modules and SHALL NOT continue growing existing large Composer or Browser Dock files with unrelated responsibilities.

#### Scenario: Composer preview is implemented
- **WHEN** Browser context preview UI is added
- **THEN** Composer SHALL delegate preview rendering and attachment state to dedicated Browser Agent modules

#### Scenario: Large-file governance runs
- **WHEN** large-file governance checks run for Phase 2
- **THEN** Browser Agent changes SHALL comply with near-threshold and hard-debt gates

### Requirement: Phase 3 exposes trusted browser observation state
Browser Agent Page Understanding SHALL expose a Browser Observation state for each capture that distinguishes page facts from capture trust.

#### Scenario: Capture succeeds with full page facts
- **WHEN** the active Browser Dock tab is ready and bound to the active renderer
- **THEN** the observation SHALL be marked `available` and include source, capture time, transport, budget, privacy, and diagnostics metadata

#### Scenario: Capture cannot collect complete facts
- **WHEN** platform, page policy, renderer, timeout, or transport limitations prevent complete capture
- **THEN** the observation SHALL be marked `degraded`, `stale`, `expired`, or `unsupported` with explicit diagnostics

### Requirement: Browser context stale reasons are explicit
Browser Agent Page Understanding SHALL represent stale state as one or more explicit stale reasons rather than only a boolean flag.

#### Scenario: Active tab changes after capture
- **WHEN** the user captures browser context and then switches Browser Dock active tab
- **THEN** the attachment SHALL include `active_tab_changed` as a stale reason

#### Scenario: Renderer binding mismatches requested session
- **WHEN** a capture request targets a session that is not bound to the active single native renderer
- **THEN** the system SHALL not capture another page and SHALL include `renderer_mismatch` as a stale or degraded reason

#### Scenario: Snapshot exceeds TTL
- **WHEN** the attachment age exceeds the configured stale threshold
- **THEN** the attachment SHALL include `ttl_expired` as a stale reason

### Requirement: Capture script has one canonical source
Browser Agent Page Understanding SHALL use a single canonical read-only capture script source for Browser Dock page extraction.

#### Scenario: Capture extraction logic changes
- **WHEN** extraction for headings, readable blocks, primary content, visual evidence, forms, links, or buttons changes
- **THEN** the change SHALL update the canonical capture script source and fixture regression coverage rather than duplicating logic in separate frontend and backend files

### Requirement: Browser Context Evidence Inspector is sectioned
Browser Agent Page Understanding SHALL present browser context evidence through a sectioned inspector rather than a single undifferentiated detail block.

#### Scenario: User inspects attached browser context before sending
- **WHEN** Browser Context is attached in Composer
- **THEN** the user SHALL be able to inspect overview, primary content, readable blocks, interactive elements, visual evidence, code candidates, diagnostics, and privacy/budget sections

#### Scenario: Evidence contains long text
- **WHEN** primary content or readable blocks exceed compact display limits
- **THEN** the inspector SHALL keep the default surface compact and expose long evidence in bounded expandable sections

### Requirement: Workspace-local page-to-code candidates are explainable
Browser Agent Page Understanding SHALL generate workspace-local code candidates with reason, confidence, matched text, source evidence, explanation, and open action.

#### Scenario: Local route maps to source files
- **WHEN** the active tab is a workspace-local development URL
- **THEN** the code bridge MAY generate route, file name, visible text, heading, button label, form label, ARIA label, test id, or component symbol candidates

#### Scenario: Candidate confidence is low
- **WHEN** evidence for a candidate is weak or indirect
- **THEN** the candidate SHALL be labelled low confidence and SHALL NOT be described as definitive ownership

#### Scenario: External site is captured
- **WHEN** the active tab is an external website
- **THEN** Browser Agent SHALL NOT generate local code candidates unless a later explicit manual mapping capability is introduced

### Requirement: Code candidate navigation reuses existing file navigation
Browser Agent Page Understanding SHALL delegate candidate open/inspect actions to existing file-view or code-intelligence navigation surfaces.

#### Scenario: User opens a code candidate
- **WHEN** the user selects a Browser Code Candidate
- **THEN** the app SHALL open the file through existing navigation contracts and SHALL NOT implement a separate Browser Agent-specific file navigator

### Requirement: Visual evidence is opt-in for model injection
Browser Agent Page Understanding SHALL treat screenshot, OCR, and multimodal visual evidence as opt-in supplemental context.

#### Scenario: Page includes images or screenshots
- **WHEN** Browser Context includes visual evidence metadata
- **THEN** the default AI payload MAY include safe labels, alt text, origin, and nearby text but SHALL NOT include image binary content by default

#### Scenario: User authorizes visual model input
- **WHEN** the user explicitly confirms screenshot/OCR/vision attachment
- **THEN** the payload SHALL include budget, privacy, source, and redaction metadata for the visual evidence

### Requirement: User annotations are structured browser evidence
Browser Agent Page Understanding SHALL allow user-created annotations on the open Browser Dock page to be represented as structured evidence bound to a Browser Observation.

中文说明：用户标注不是单纯 UI overlay，而是一条可审计 evidence record。它必须绑定 observation，并继承 stale/degraded diagnostics。

#### Scenario: User annotates a visible region
- **WHEN** the user marks a point or region in the active Browser Dock page and adds a note
- **THEN** the annotation SHALL include observation identity, session identity, URL/title, viewport size, scroll offset, devicePixelRatio, region coordinates, user note, nearby sanitized text, nearest element metadata when available, and diagnostics

#### Scenario: User annotates text or an element
- **WHEN** the annotation can be anchored to selected text or an interactive element
- **THEN** the annotation SHALL include anchor type, sanitized selected or nearby text, element role/label/placeholder/href-origin metadata when available, and privacy redaction metadata

#### Scenario: Annotation becomes stale
- **WHEN** the bound observation no longer matches the active tab, renderer, URL/title, scroll threshold, DOM fingerprint, session, workspace, or TTL policy
- **THEN** the annotation SHALL expose stale or degraded diagnostics and SHALL NOT be represented as fresh evidence

#### Scenario: Browser Context is attached with annotations
- **WHEN** the user sends a message with Browser Context attached
- **THEN** AI-visible browser evidence SHALL include annotation note, anchor metadata, nearby evidence, and stale reasons as structured text evidence

#### Scenario: Annotation includes a visual region
- **WHEN** an annotation references a point or region
- **THEN** the default AI payload SHALL NOT include annotated screenshot binaries, overlay images, or multimodal region payloads unless a separate explicit opt-in visual flow is confirmed

中文说明：region annotation 在 Phase 3 只进入 text payload，包含坐标和附近证据；带标注截图属于 Phase 4 或后续 opt-in visual flow。

#### Scenario: AI attempts to act on an annotation
- **WHEN** AI proposes click, type, select, submit, or another mutating action based on a user annotation in Phase 3
- **THEN** the action SHALL remain blocked by default and SHALL require a later explicit behavior change before execution is allowed

### Requirement: Browser actions are preview-first and audited
Browser Agent Page Understanding SHALL require browser actions to be previewed and confirmed before execution.

#### Scenario: Safe navigation action is proposed
- **WHEN** an action such as navigate, reload, or scroll is proposed
- **THEN** the app SHALL show action, target, reason, risk, expected effect, confirmation requirement, and privacy notice before execution

#### Scenario: User confirms safe action
- **WHEN** the user confirms an enabled safe action
- **THEN** the app SHALL capture a before snapshot, execute the action, capture an after snapshot when possible, and store an audit entry

#### Scenario: Safe action is disabled by settings or platform capability
- **WHEN** navigation actions are disabled by settings or unavailable on the current platform
- **THEN** confirmation SHALL NOT execute the action and SHALL surface a blocked or degraded diagnostic

#### Scenario: Mutating action is proposed
- **WHEN** click, type, select, or submit is proposed in Phase 3
- **THEN** the action SHALL remain blocked by default and SHALL NOT execute without a later explicit behavior change

### Requirement: Browser action audit does not expose secrets
Browser Agent Page Understanding SHALL redact sensitive values in action previews and audit records.

#### Scenario: Type or submit action contains a value
- **WHEN** a preview or audit record references typed or submitted values
- **THEN** the value preview SHALL be redacted and SHALL NOT expose password, token, Authorization, cookie, or secret-like content

### Requirement: Browser evidence state is consistent across surfaces
Browser Agent Page Understanding SHALL use consistent observation and evidence states across Composer preview, sent message cards, TaskRun evidence, orchestration dispatch, and AI payload formatting.

#### Scenario: Attachment is degraded
- **WHEN** a degraded Browser Context attachment is present
- **THEN** Composer, messages, TaskRun, orchestration, and AI payload SHALL all expose degraded state and diagnostics consistently

#### Scenario: Attachment is removed before send
- **WHEN** the user removes Browser Context from Composer
- **THEN** the next AI request SHALL NOT include the removed observation, evidence, or fallback prompt block
