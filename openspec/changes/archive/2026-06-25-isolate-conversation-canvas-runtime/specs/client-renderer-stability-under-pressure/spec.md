# client-renderer-stability-under-pressure Specification

## ADDED Requirements

### Requirement: Renderer Pressure Diagnostics MUST Include Resource Retention Evidence

Renderer stability diagnostics SHALL include bounded, privacy-safe evidence for long-running resource retention that can degrade interaction smoothness.

#### Scenario: long-running client reports resource-owner counts

- **WHEN** the renderer records a pressure snapshot during or after repeated realtime turns
- **THEN** the snapshot MUST include bounded support/count fields for active listeners, timers, RAF or idle callbacks, canvas render caches, and diagnostics buffer pressure when available
- **AND** the snapshot MUST NOT include prompt text, assistant text, tool output, file content, environment values, or screenshots

#### Scenario: stale resource cleanup is observable

- **WHEN** a workspace/thread/canvas scope is torn down
- **THEN** diagnostics or tests MUST be able to prove owned listeners/timers/caches are released, cancelled, or bounded
- **AND** late callbacks MUST be guarded against post-teardown state writes
