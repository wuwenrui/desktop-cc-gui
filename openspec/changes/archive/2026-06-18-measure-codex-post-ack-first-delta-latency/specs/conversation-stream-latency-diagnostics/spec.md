## ADDED Requirements

### Requirement: Codex Backend Phase Timing Diagnostics MUST Be Content Safe
Codex backend phase timing diagnostics MUST remain bounded and content-safe while exposing enough timestamps to split post-ack first-delta latency.

#### Scenario: backend timing metadata excludes conversation content
- **WHEN** backend enriches a Codex app-server event with `ccguiTiming`
- **THEN** the timing metadata MUST include only ids, method/source labels, timestamps, durations, and bounded counters
- **AND** it MUST NOT include prompt text, assistant text, tool output, terminal output, or file content

#### Scenario: backend timing separates runtime activity from assistant first text
- **WHEN** Codex emits reasoning, tool, lifecycle, or assistant message events before the first assistant text delta
- **THEN** `ccguiTiming` MUST preserve `firstRuntimeEventReceivedAtMs`, `firstReasoningEventReceivedAtMs`, `firstAssistantItemEventReceivedAtMs`, `firstAgentMessageEventReceivedAtMs`, `firstToolEventReceivedAtMs`, and `firstTextDeltaReceivedAtMs` independently
- **AND** `firstTextDeltaReceivedAtMs` MUST only be set by a non-empty `item/agentMessage/delta`, not by reasoning deltas
- **AND** `firstAssistantItemEventReceivedAtMs` MUST be set by the first `item/started`, `item/updated`, or `item/completed` event whose item type is `agentMessage` or `assistantMessage`
- **AND** `eventCountBeforeFirstTextDelta`, `reasoningEventCountBeforeFirstTextDelta`, `toolEventCountBeforeFirstTextDelta`, and `methodsBeforeFirstTextDelta` MUST remain bounded and content-free

#### Scenario: malformed or missing timing remains safe
- **WHEN** an app-server event lacks timing metadata or contains malformed timing fields
- **THEN** renderer diagnostics MUST ignore or normalize those fields without throwing
- **AND** report generation MUST mark unavailable metrics as unsupported rather than inventing proxy values

#### Scenario: long sessions preserve realtime evidence
- **WHEN** renderer diagnostics contain high-volume lifecycle, `perf.*`, `realtime.turnTrace.summary`, and `stream-latency/*` entries
- **THEN** `realtime.turnTrace.summary` entries MUST be retained in an independent bounded bucket
- **AND** `stream-latency/*` entries MUST be retained in an independent bounded bucket
- **AND** retention MUST remain content-safe and bounded rather than preserving unbounded raw diagnostics
