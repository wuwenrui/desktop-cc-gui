## ADDED Requirements

### Requirement: Conversation Render Failures MUST Be Classified And Contained Locally

Renderer stability under pressure MUST classify conversation-local render failures, including React #185 / update-loop-style failures, without leaking conversation content and without unnecessary full-app failure escalation.

#### Scenario: React update-loop style failure is diagnosed content-safely
- **WHEN** a conversation row, heavy Markdown island, tool-card detail, diff detail, anchor rail, or popover triggers a React #185 / maximum update depth style failure
- **THEN** diagnostics MUST record a content-safe failure entry with component surface, workspace id, thread id, row kind, engine when known, render weight, and bounded stack/classification data
- **AND** diagnostics MUST NOT include prompt text, assistant body text, tool output body, diff body, file content, screenshots, or environment values

#### Scenario: local fallback prevents global crash when possible
- **WHEN** the failure is contained by a conversation-local boundary
- **THEN** the app shell, Composer, navigation, and other conversation rows MUST remain usable
- **AND** the local fallback MUST expose a recoverable retry or rehydrate path where safe

#### Scenario: repeated local failures are backoff-limited
- **WHEN** the same row or heavy island repeatedly fails after retry or rehydrate attempts
- **THEN** automatic retries MUST stop after a documented limit
- **AND** diagnostics MUST record the blocked recovery state instead of entering an infinite render/reload loop

### Requirement: Conversation Measurement And Overlay Updates MUST Be Loop-Guarded

Conversation renderer measurement, anchor, tooltip, and popover logic MUST avoid unbounded state-update loops under heavy histories and MUST release long-lived resources when the conversation changes.

#### Scenario: repeated measurement updates are bounded
- **WHEN** virtualization measurement, row resize observation, anchor readiness, tooltip placement, or popover placement receives repeated equivalent values
- **THEN** the renderer MUST avoid redundant state writes for unchanged effective state
- **AND** any forced remeasure path MUST have a documented per-row or per-frame bound

#### Scenario: overlay and measurement diagnostics are content-safe
- **WHEN** a repeated measurement, anchor, tooltip, or popover update-loop guard is triggered
- **THEN** diagnostics MUST record surface, row kind, counter, threshold, and component classification data
- **AND** diagnostics MUST NOT include prompt text, assistant body text, tool output body, diff body, file content, screenshots, or environment values

#### Scenario: long-running conversation resources are released
- **WHEN** the selected thread changes, a heavy row unmounts, lightweight mode changes, or an async hydration/precompute request becomes stale
- **THEN** observers, timers, pending callbacks, hydration queue entries, and measurement cache entries associated with the stale surface MUST be released or ignored
- **AND** diagnostics SHOULD expose bounded live resource counts without conversation content
