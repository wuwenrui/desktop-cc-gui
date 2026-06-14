## ADDED Requirements

### Requirement: Claude Live Stream Visibility MUST Survive App-Server Event Channel Migration

Claude Code live stream visibility MUST remain progressive when app-server event transport is migrated from single-event delivery to batched delivery. A batch-enabled frontend MUST NOT lose Claude live text solely because the Claude producer still uses the legacy single-event channel.

#### Scenario: batch-enabled frontend receives legacy Claude live text

- **WHEN** a Claude Code turn emits assistant text deltas on `app-server-event`
- **AND** the frontend batch consumer is enabled
- **THEN** the conversation canvas MUST still show progressive live assistant text
- **AND** it MUST NOT remain in a processing-only state until timeout, interrupt, or manual history reload.

#### Scenario: completed output is not the first visible assistant content

- **WHEN** a Claude Code turn emits live deltas followed by `turn/completed`
- **AND** event batching is enabled
- **THEN** intermediate assistant text growth MUST be visible before terminal completion
- **AND** the final completed message MUST reconcile with streamed text rather than becoming the first meaningful output.

#### Scenario: no-channel-receipt is classified as transport compatibility

- **WHEN** the backend emits Claude stream events
- **AND** frontend diagnostics show no matching app-server event receipt while batch mode is enabled
- **THEN** triage MUST classify the issue as app-server event channel compatibility or transport migration drift
- **AND** it MUST NOT be misclassified as Claude CLI unavailable or model first-token latency without channel evidence.
