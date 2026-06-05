## 中文阅读导引

这份 spec delta 仍保留 OpenSpec 的 English contract 结构：`Requirement / Scenario / WHEN / THEN`。为了实现时不产生歧义，字段名和状态值保持 English；中文说明用于帮助阅读。

本次新增的 `BrowserUserAnnotation` 要点：

- 用户可以在 Browser Dock 页面上标注 point、region、element 或 text range。
- Annotation 必须绑定 `BrowserObservation`，不能脱离 capture trust 独立存在。
- AI 默认收到 structured text evidence：user note、anchor metadata、nearby evidence、stale reasons。
- 默认不发送 annotated screenshot、overlay image 或 multimodal region payload。
- AI 不能因为用户标注就自动 click/type/submit。

## Related Documents

- Proposal: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/proposal.md`
- Technical design: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/design.md`
- Task breakdown: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/tasks.md`
- Implementation plan: `docs/plans/2026-06-01-browser-dock-phase3.md`
- First Trellis execution task: `.trellis/tasks/06-01-browser-dock-phase3-observation-core/prd.md`

## ADDED Requirements

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
