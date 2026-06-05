## ADDED Requirements

### Requirement: Orchestration Tasks SHALL support linked browser context evidence

Agent Task Orchestration Center SHALL allow orchestration tasks to reference Browser Sessions and Browser Context Snapshots as source or execution evidence while preserving the orchestration task as the work-item truth.

#### Scenario: browser snapshot becomes task source evidence
- **WHEN** the user creates or dispatches an orchestration task from a Browser Dock page
- **THEN** the task SHALL store a reference to the browser session or snapshot used as evidence
- **AND** the task surface SHALL show the page title, URL, and capture time when available

#### Scenario: orchestration dispatch includes browser context explicitly
- **WHEN** a task dispatch uses browser context as AI input
- **THEN** the dispatch confirmation SHALL show the browser attachment before launch
- **AND** the dispatched prompt SHALL include only the bounded sanitized snapshot rather than unrestricted live browser state

#### Scenario: browser evidence does not overwrite provider artifacts
- **WHEN** a browser-linked orchestration task also has Project Map, workflow, OpenSpec, or manual source evidence
- **THEN** Browser evidence SHALL be additive
- **AND** the system SHALL NOT delete or rewrite other provider artifacts because browser evidence changed
