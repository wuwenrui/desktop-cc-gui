## ADDED Requirements

### Requirement: Codex Turn Start Ack Diagnostics MUST Be Content Safe

Codex turn-start acknowledgement diagnostics MUST remain bounded and content-safe.

#### Scenario: prompt text is not emitted in ack diagnostics

- **WHEN** a user sends a Codex message
- **THEN** the turn-start ack diagnostic MUST include workspace id, thread id, model, duration, and outcome where available
- **AND** it MUST NOT include prompt text, assistant text, tool output, terminal output, or file content
