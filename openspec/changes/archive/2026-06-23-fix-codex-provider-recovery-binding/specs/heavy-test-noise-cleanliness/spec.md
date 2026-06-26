## MODIFIED Requirements

### Requirement: Expected warning paths SHALL be handled at test boundaries

Expected error-path diagnostics and intentional library warnings SHALL be asserted, muted locally, or otherwise contained within the relevant tests instead of polluting the global heavy regression output.

#### Scenario: Markdown rich preview outline compile does not leak act warning

- **WHEN** the heavy suite runs `FileMarkdownPreviewFast.test.tsx`
- **AND** a default rich preview schedules asynchronous outline compilation
- **THEN** the test MUST wait for the relevant async state to settle before exiting
- **AND** it MUST NOT mute global `console.error` to hide React `act(...)` warnings
- **AND** the heavy-test-noise parser MUST report zero repo-owned act warnings for that focused log.
