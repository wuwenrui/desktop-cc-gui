## ADDED Requirements

### Requirement: Renderer heartbeat MUST provide a backend-observable liveness signal
The system SHALL emit a privacy-safe renderer heartbeat that lets the backend distinguish normal renderer activity from missed heartbeat windows.

#### Scenario: heartbeat is recorded without content
- **WHEN** the renderer heartbeat is sent
- **THEN** the backend MUST record timestamp, platform, app version, active workspace/thread identifiers when available, and diagnostic support flags
- **AND** the heartbeat payload MUST NOT include prompt text, assistant text, tool output, file content, environment values or screenshots

#### Scenario: heartbeat misses are classified
- **WHEN** the backend does not receive the renderer heartbeat within the configured threshold
- **THEN** the system MUST record a bounded `renderer.heartbeat_missed` or equivalent diagnostic
- **AND** the diagnostic MUST distinguish heartbeat evidence from confirmed native process crash evidence

### Requirement: Renderer process failure evidence MUST be feature-detected by platform
The system SHALL capture native renderer process failure or unresponsive evidence when the current platform and WebView stack expose a supported hook.

#### Scenario: native hook is supported
- **WHEN** the platform reports renderer process failure, browser/web process exit, or equivalent unresponsive event
- **THEN** the system MUST record event kind, platform, timestamp, recovery eligibility, and any safe exit reason/code exposed by the platform
- **AND** the system MUST NOT require prompt/body content to diagnose the event

#### Scenario: native hook is unsupported
- **WHEN** a platform does not expose a safe renderer process failure hook
- **THEN** the system MUST record the hook support state as `unsupported` or `not-implemented`
- **AND** heartbeat/watchdog evidence MUST remain available as the portable fallback

### Requirement: Renderer pressure snapshots MUST be bounded and redacted
The system SHALL attach bounded renderer pressure snapshots to stability diagnostics so long-run white-screen cases can be investigated without leaking user content.

#### Scenario: pressure snapshot is emitted
- **WHEN** renderer heartbeat misses, process failure, unresponsive state, or recovery is recorded
- **THEN** the system MUST include bounded metadata for active engine count, active streaming turn count, background helper process count when supported, memory/long-task support status, and current recovery attempt count
- **AND** the diagnostic store MUST cap repeated snapshots by label and time window

### Requirement: Renderer recovery MUST use backoff and preserve user context
The system SHALL only attempt renderer reload or rebuild recovery through a bounded policy that records evidence before recovery.

#### Scenario: recovery is attempted
- **WHEN** a renderer failure is classified as recoverable
- **THEN** the system MUST record the failure evidence before attempting reload or rebuild
- **AND** repeated recovery attempts MUST use a bounded backoff
- **AND** unsent Composer draft state MUST be preserved or the user MUST see a clear diagnostic recovery state

#### Scenario: recovery is blocked
- **WHEN** recovery attempts exceed the configured limit or required state cannot be preserved
- **THEN** the system MUST stop automatic recovery
- **AND** the user MUST be shown a diagnostic state instead of entering an infinite reload loop
