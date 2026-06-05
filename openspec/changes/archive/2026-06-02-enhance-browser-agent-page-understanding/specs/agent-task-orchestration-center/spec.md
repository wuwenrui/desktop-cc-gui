## ADDED Requirements

### Requirement: Orchestration dispatch accepts Browser Snapshot v2 as input evidence
Agent Task Orchestration Center SHALL allow Browser Snapshot v2 evidence and page-to-code candidates to be attached to task dispatch inputs.

#### Scenario: User dispatches a task with browser context
- **WHEN** the user launches an orchestration task while Browser Context Snapshot v2 is attached
- **THEN** the dispatch confirmation SHALL show the browser evidence source, freshness, diagnostics, and candidate code files before launch

#### Scenario: Browser context is degraded
- **WHEN** attached browser context is degraded or stale
- **THEN** orchestration dispatch SHALL surface the degraded/stale state rather than hiding it from the user

### Requirement: Orchestration uses engine-agnostic browser payloads
Agent Task Orchestration Center SHALL pass browser context through the shared BrowserContextAttachment v2 contract and SHALL NOT create engine-specific browser payloads.

#### Scenario: Task is routed to a different engine
- **WHEN** an orchestration task using browser context is routed to Claude, Codex, Gemini, OpenCode, or a custom provider
- **THEN** the browser context SHALL remain in the shared attachment shape with provider-specific formatting limited to final request serialization
