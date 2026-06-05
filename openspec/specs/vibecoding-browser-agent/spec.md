# vibecoding-browser-agent Specification

## Purpose

Defines the vibecoding browser agent behavior contract.

## Requirements

### Requirement: Browser Dock SHALL provide a client-owned embedded web surface

The system SHALL provide a Browser Dock inside the vibecoding or orchestration workspace surface so users can view web pages inside the client without replacing the main application webview.

#### Scenario: user opens Browser Dock from the global toolbar
- **WHEN** the user clicks the Browser Dock icon in the top global toolbar
- **THEN** the system SHALL open Browser Dock in the main content area
- **AND** Browser Dock SHALL appear as a right-side companion panel beside the conversation
- **AND** the conversation SHALL remain visible and usable on the left side
- **AND** Browser Dock SHALL NOT open as a blocking modal, popover, or floating overlay for its primary workspace view

#### Scenario: user resizes the Browser Dock split
- **WHEN** Browser Dock is open beside the conversation
- **AND** the user drags the splitter between the conversation and Browser Dock
- **THEN** the system SHALL resize the two panels horizontally
- **AND** the system SHALL preserve minimum usable widths for both panels
- **AND** the resize interaction SHALL NOT close Browser Dock or interrupt the active conversation

#### Scenario: user opens a page inside Browser Dock
- **WHEN** the user enters an allowed `http` or `https` URL in Browser Dock
- **THEN** the system SHALL create or reuse a workspace-scoped browser session
- **AND** the page SHALL render inside a browser-specific WebView rather than navigating the main application window
- **AND** the system SHALL show URL, title, loading state, and error state when available

#### Scenario: browser navigation does not break main app navigation policy
- **WHEN** a Browser Dock session navigates to an external page
- **THEN** the main application webview SHALL remain on the client app route
- **AND** existing ordinary external links outside Browser Dock SHALL continue to open through the existing external-link policy

#### Scenario: unsupported platform degrades explicitly
- **WHEN** the current platform cannot provide the required Browser Dock WebView behavior
- **THEN** the Browser Dock SHALL render an explicit unsupported or degraded state
- **AND** the system SHALL NOT pretend that browser context is available to AI

### Requirement: Browser Sessions SHALL be workspace-scoped and traceable

The system SHALL model each embedded browsing runtime as a Browser Session with stable identity and workspace ownership so browser state can be linked to conversations, TaskRuns, and orchestration tasks.

#### Scenario: browser session records ownership
- **WHEN** a Browser Session is created from a workspace surface
- **THEN** the session SHALL store a stable `browserSessionId`
- **AND** the session SHALL store the owning workspace id or path
- **AND** the session SHALL record URL, title, status, created time, and updated time when available

#### Scenario: session can link to execution context
- **WHEN** a browser session is attached to a conversation, TaskRun, or orchestration task
- **THEN** the system SHALL preserve a traceable link between the browser session and that execution context
- **AND** the link SHALL be visible in the relevant UI surface

#### Scenario: orphan browser state is bounded
- **WHEN** a browser session has no active visible owner or linked execution context
- **THEN** the system SHALL either close it or mark it as detached with an explicit cleanup path
- **AND** detached browser state SHALL NOT be silently injected into AI context

### Requirement: Browser Context Snapshot SHALL expose bounded structured page facts to AI

The system SHALL convert a Browser Session page into a bounded Browser Context Snapshot before exposing it to AI. The snapshot SHALL contain structured page facts rather than an unbounded raw DOM dump.

#### Scenario: snapshot captures key page facts
- **WHEN** the user requests to attach the current browser page to AI context
- **THEN** the system SHALL capture URL, title, capture time, visible text summary, headings, landmarks, links, buttons, forms, and available diagnostics
- **AND** each captured fact SHALL include enough source metadata for the AI and user to identify which page it came from

#### Scenario: snapshot remains bounded
- **WHEN** the page content exceeds the configured context budget
- **THEN** the system SHALL truncate or summarize the snapshot within the configured character or token budget
- **AND** the snapshot SHALL include a visible truncation or capture warning

#### Scenario: snapshot rejects unbounded DOM exposure
- **WHEN** a browser page contains large DOM trees, hidden nodes, scripts, style sheets, or implementation-only markup
- **THEN** the system SHALL NOT expose the full raw DOM to AI by default
- **AND** the snapshot SHALL prioritize visible and semantically relevant content

### Requirement: Browser Snapshot Sanitization SHALL protect sensitive page data

The system SHALL sanitize Browser Context Snapshots before they become visible to AI or persistent evidence.

#### Scenario: sensitive inputs are redacted
- **WHEN** the browser page contains password fields, token-like values, cookie values, authorization values, hidden secrets, or secret-like form fields
- **THEN** the snapshot SHALL redact those values before AI context injection
- **AND** the snapshot SHALL mark that redaction was applied without revealing the original secret

#### Scenario: sensitive diagnostics are redacted
- **WHEN** console or network diagnostics contain tokens, credentials, cookies, or private header values
- **THEN** the system SHALL redact the sensitive values before storing or exposing diagnostics
- **AND** the diagnostics SHALL remain useful enough to show non-sensitive failure category and source

#### Scenario: user can see privacy state
- **WHEN** a snapshot has been sanitized
- **THEN** the Browser Dock or attachment UI SHALL expose a privacy indicator or equivalent text
- **AND** the user SHALL be able to distinguish sanitized context from raw page access

### Requirement: Browser Context Attachment SHALL be explicit and visible in conversation flow

The system SHALL attach browser context to AI conversation or task dispatch only through an explicit user-visible attachment path or an explicit orchestration rule.

#### Scenario: user attaches current page to composer
- **WHEN** the user chooses to attach the current Browser Session to an AI message
- **THEN** the composer SHALL show a browser context attachment with title, URL, capture time, and stale/refresh state
- **AND** the message send path SHALL include only the bounded snapshot, not live unrestricted browser access

#### Scenario: stale snapshot is not silently reused
- **WHEN** the Browser Session navigates or the snapshot becomes older than the configured freshness window
- **THEN** the attachment UI SHALL mark the snapshot as stale or require refresh
- **AND** the system SHALL NOT silently present stale page facts as current page facts

#### Scenario: user can remove browser context before send
- **WHEN** a browser snapshot is attached to a message or task dispatch
- **THEN** the user SHALL be able to remove that attachment before sending
- **AND** removal SHALL prevent the snapshot from being included in that AI request

### Requirement: Browser Agent Actions SHALL require explicit gates before mutating page state

The system SHALL keep the initial Browser Agent read-only and SHALL require explicit gates before AI-driven browser actions can navigate, click, type, submit, or otherwise mutate page state.

#### Scenario: MVP does not allow silent page mutation
- **WHEN** the Browser Agent capability is in read-only phase
- **THEN** AI SHALL be able to request or consume browser snapshots
- **AND** AI SHALL NOT be able to click, type, submit forms, or trigger mutating navigation without a disabled or blocked action result

#### Scenario: action preview precedes high-impact operation
- **WHEN** a later phase allows AI to perform click, type, submit, or multi-step browser actions
- **THEN** the system SHALL show action target, reason, and expected operation before execution unless a task-level permission explicitly covers it
- **AND** the user SHALL have a stop or cancel path for active multi-step browser tasks

#### Scenario: browser action result is audited
- **WHEN** a browser action is executed, blocked, failed, or canceled
- **THEN** the system SHALL record an audit entry with action kind, target description when available, outcome, diagnostic message, and before/after snapshot references when available
- **AND** the audit entry SHALL be linkable from the relevant browser session and execution context

### Requirement: Browser Evidence SHALL support review without becoming source-of-truth for task completion

The system SHALL treat browser snapshots, screenshots, selected text, and action history as evidence for review, not as automatic proof that a user goal is complete.

#### Scenario: task references browser evidence
- **WHEN** a TaskRun or orchestration task uses browser context during execution
- **THEN** the system SHALL preserve a reference to the relevant browser snapshot or browser session evidence
- **AND** the user SHALL be able to inspect that evidence from the task or run detail surface

#### Scenario: browser evidence does not auto-accept a task
- **WHEN** a browser action sequence or snapshot capture completes successfully
- **THEN** the system SHALL NOT automatically mark the linked user goal as accepted or complete solely because browser evidence exists
- **AND** completion or acceptance SHALL remain governed by the relevant task review flow

#### Scenario: missing evidence degrades visibly
- **WHEN** browser evidence is expired, deleted, unsupported, or unavailable
- **THEN** linked task or conversation surfaces SHALL show a degraded evidence state
- **AND** the system SHALL NOT crash or display fabricated evidence content

### Requirement: Browser Agent SHALL be engine-agnostic

Browser Agent SHALL be a general client capability that works across Claude, Codex, Gemini, OpenCode, and custom providers through the same browser context contract.

#### Scenario: every engine consumes the same browser attachment shape
- **WHEN** a user sends browser context to any supported AI engine
- **THEN** the request SHALL use the shared Browser Context Attachment shape
- **AND** the system SHALL NOT create engine-specific browser snapshot payloads for ordinary browser context use

#### Scenario: unsupported engine behavior is explicit
- **WHEN** an engine or provider cannot consume Browser Context Attachments
- **THEN** the system SHALL return an explicit unsupported or degraded result
- **AND** the system SHALL NOT silently drop browser context while pretending the engine saw the page

### Requirement: Browser Agent SHALL expose enable and disable settings

The system SHALL provide user-visible settings to enable or disable Browser Agent and to control whether it is preferred for AI browser operations.

#### Scenario: default setting makes Browser Agent immediately usable
- **WHEN** a user has not explicitly disabled Browser Agent
- **THEN** Browser Agent SHALL be enabled by default
- **AND** Browser Dock SHALL allow the user to open an allowed page without first visiting Settings

#### Scenario: disabled setting blocks context injection
- **WHEN** Browser Agent is disabled in settings
- **THEN** Browser Dock SHALL NOT automatically inject snapshots into AI requests
- **AND** AI browser operations SHALL NOT route to the built-in Browser Agent

#### Scenario: disabled dock exposes explicit enable path
- **WHEN** Browser Agent is disabled in persisted settings
- **THEN** Browser Dock SHALL show a visible disabled state
- **AND** Browser Dock SHALL provide a user-visible action to enable Browser Agent from the dock surface

#### Scenario: enabled setting prefers built-in provider
- **WHEN** Browser Agent is enabled and the requested browser capability is supported
- **THEN** AI browser understanding and browser operation requests SHALL prefer the built-in Browser Agent by default
- **AND** fallback to Browser skill, Computer Use, or external browser provider SHALL require explicit user opt-out, unsupported capability, degraded platform state, or an operation beyond the enabled phase

#### Scenario: write operation settings are phase-gated
- **WHEN** navigation, element action, or form submit settings are disabled
- **THEN** Browser Agent SHALL block those action types with a structured blocked result
- **AND** read-only snapshot capture SHALL remain independently controllable

### Requirement: Browser Agent SHALL expose platform compatibility explicitly

Browser Agent SHALL expose macOS, Windows, and Linux capability states instead of assuming all WebView features work uniformly across platforms.

#### Scenario: platform matrix describes current runtime
- **WHEN** Browser Agent status is requested
- **THEN** the system SHALL report platform, WebView runtime, Browser Dock support, snapshot support, screenshot support, diagnostics support, and action support
- **AND** unsupported or degraded capabilities SHALL include user-visible reasons

#### Scenario: degraded platform does not mislead AI
- **WHEN** the current platform can render Browser Dock but cannot capture a reliable snapshot
- **THEN** the system SHALL expose Browser Dock as available and snapshot capture as degraded or unsupported
- **AND** AI context routing SHALL NOT claim browser context is available

### Requirement: Browser Agent implementation SHALL respect large-file governance

Browser Agent implementation SHALL remain modular enough to pass repository large-file governance gates on macOS, Windows, and Linux CI.

#### Scenario: implementation is split before large-file debt
- **WHEN** Browser Agent frontend, backend, or test files approach large-file governance thresholds
- **THEN** the implementation SHALL split UI, service, store, sanitizer, platform, action gate, and tests into focused files
- **AND** the feature SHALL NOT rely on a single large Browser Dock component or monolithic backend module

#### Scenario: large-file governance remains a release gate
- **WHEN** Browser Agent MVP is considered complete
- **THEN** the implementation SHALL be compatible with `npm run check:large-files:near-threshold`
- **AND** the implementation SHALL be compatible with `npm run check:large-files:gate`
