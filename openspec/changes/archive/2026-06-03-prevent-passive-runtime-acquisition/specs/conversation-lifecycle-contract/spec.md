## ADDED Requirements

### Requirement: Passive Runtime Helper Reads MUST NOT Acquire Codex Runtime
The system SHALL treat model metadata, account metadata, account rate-limit reads, and similar helper reads as passive operations unless the user explicitly performs a runtime-required action.

#### Scenario: model list read without existing Codex runtime
- **WHEN** the client requests Codex model metadata for a workspace that has no existing Codex runtime session
- **THEN** the system SHALL return cached, static, degraded, or empty fallback data without starting a Codex runtime process

#### Scenario: rate-limit read without existing Codex runtime
- **WHEN** the client requests Codex account rate limits for a workspace that has no existing Codex runtime session
- **THEN** the system SHALL return cached, degraded, unavailable, or empty fallback data without starting a Codex runtime process

### Requirement: Background Workspace Refresh MUST NOT Reconnect Runtime
The system SHALL prevent background workspace refresh, idle hydration, passive restore, and focus refresh for non-active workspaces from starting or reconnecting AI runtime processes.

#### Scenario: idle hydration refreshes multiple visible workspaces
- **WHEN** idle hydration or background prewarm refreshes thread lists for visible or restored workspaces
- **THEN** the system SHALL load available cached/list data without invoking automatic runtime recovery for those workspaces

#### Scenario: focus refresh sees disconnected background workspace
- **WHEN** a window focus or visibility refresh encounters a disconnected non-active workspace
- **THEN** the system SHALL skip runtime reconnect for that workspace unless the user explicitly activates or reconnects it

### Requirement: Explicit Runtime Actions MAY Acquire Runtime
The system SHALL preserve runtime acquisition for explicit user actions that require a live AI runtime.

#### Scenario: user sends a Codex message
- **WHEN** the user sends a Codex message or explicitly requests reconnect/retry for a workspace
- **THEN** the system MAY start or reuse the required Codex runtime session
