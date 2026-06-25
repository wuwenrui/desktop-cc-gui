# conversation-canvas-runtime-isolation Specification

## ADDED Requirements

### Requirement: Conversation Canvas MUST Be Isolated From Shell Interaction Lanes

The client MUST treat the center conversation canvas as a high-throughput render lane that cannot monopolize the top, left, right, or bottom interaction lanes during realtime execution.

#### Scenario: shell controls remain responsive during active realtime rendering

- **WHEN** a conversation is actively receiving realtime stream updates
- **AND** the conversation canvas is rendering Markdown, code blocks, tool cards, history hydration, or virtualization placeholders
- **THEN** topbar buttons, session tabs, sidebar rows, panel controls, and Composer input MUST keep immediate visual feedback
- **AND** those controls MUST NOT subscribe to full canvas item arrays or canvas-only render snapshots
- **AND** any pressure propagated from the canvas MUST be represented as a narrow typed signal

#### Scenario: canvas overload degrades the canvas before controls

- **WHEN** the renderer detects canvas render pressure above the accepted budget
- **THEN** the canvas MAY coalesce intermediate snapshots, defer heavy islands, or show bounded lightweight placeholders
- **AND** shell/control lanes MUST keep their interaction budget before the canvas resumes heavy rendering
- **AND** terminal conversation settlement MUST still reconverge to the latest semantic state

### Requirement: Canvas Runtime MUST Use Explicit Lane Scheduling

Realtime UI work MUST be classified into interaction, canvas, or background lanes before expensive rendering or diagnostics are scheduled.

#### Scenario: realtime burst separates interaction and canvas work

- **WHEN** a burst of realtime events arrives while the user is typing in Composer or clicking session controls
- **THEN** interaction-lane updates MUST be allowed to flush ahead of non-critical canvas-lane heavy rendering
- **AND** canvas-lane work MUST be resumable without losing the latest semantic conversation state

#### Scenario: background work cannot block interaction feedback

- **WHEN** diagnostics, history reconciliation, cleanup, or precompute work is scheduled during active streaming
- **THEN** the work MUST run in a background lane or bounded deferred slot
- **AND** it MUST NOT synchronously block button feedback, input echo, or session tab selection

### Requirement: Long-Running Canvas Resources MUST Be Released

Conversation canvas runtime resources MUST have deterministic cleanup ownership so long-running clients do not retain stale listeners, timers, animation callbacks, render caches, or diagnostics buffers.

#### Scenario: teardown cancels late realtime render callbacks

- **WHEN** a conversation canvas unmounts, switches thread, switches workspace, or leaves realtime mode
- **THEN** listeners, timers, RAF callbacks, idle callbacks, measurement maps, and heavy render caches owned by that canvas scope MUST be released or bounded
- **AND** late callbacks MUST NOT call `setState` after teardown

#### Scenario: diagnostics expose retained resource pressure

- **WHEN** the client has been running for a long duration with repeated realtime turns
- **THEN** renderer diagnostics MUST expose bounded counts or support states for retained listener/timer/cache/resource owners
- **AND** diagnostics MUST redact prompt text, assistant text, tool output, file content, environment values, and screenshots

### Requirement: Canvas Placeholder Layout MUST Preserve Visual Bounds

Canvas degradation and virtualization placeholders MUST preserve the conversation surface dimensions without stretching blank blocks or changing the surrounding shell layout.

#### Scenario: lightweight placeholders do not enlarge the curtain

- **WHEN** active stream pressure enables lightweight canvas placeholders or virtualized blank space
- **THEN** placeholders MUST use measured or bounded fallback row heights
- **AND** they MUST NOT stretch a message group into oversized blank blocks
- **AND** top, left, right, and bottom lanes MUST keep their existing dimensions
