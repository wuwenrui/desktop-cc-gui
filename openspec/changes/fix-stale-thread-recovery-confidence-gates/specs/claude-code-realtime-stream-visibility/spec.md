## MODIFIED Requirements

### Requirement: Claude Code Live Text MUST Remain Progressively Visible On Windows

The system MUST preserve progressive visible assistant text for `Claude Code` realtime conversations on Windows once the first assistant text delta has been received.

#### Scenario: first delta is followed by continued visible text progression

- **WHEN** a `Claude Code` turn is running on Windows
- **AND** the runtime has emitted at least one assistant text delta for the active turn
- **THEN** the frontend MUST continue making assistant text updates visible during processing
- **AND** the UI MUST NOT remain stuck on only the first few characters until the terminal completed event arrives

#### Scenario: completed output does not become the only visible update

- **WHEN** a `Claude Code` turn emits multiple assistant deltas before completion
- **THEN** the live assistant message MUST reflect intermediate text growth before `turn/completed`
- **AND** the final completed message MUST reconcile with the streamed text without replacing a stalled live surface as the first meaningful output

#### Scenario: degraded prefix stub does not replace a more readable same-turn live surface

- **WHEN** a `Claude Code` turn on Windows has already rendered a longer live assistant body in the current turn
- **AND** the live surface later regresses to a shorter prefix or stub while `visible-output-stall-after-first-delta` evidence is active
- **THEN** the frontend MUST preserve or recover the most recent more-readable same-turn live surface
- **AND** the shorter stub MUST NOT become the only meaningful visible assistant output before completion

#### Scenario: large context reopen does not leave a blank canvas

- **WHEN** a Windows `Claude Code` session with large context is reopened
- **AND** current history load, hydrate, or live render cannot produce the full conversation immediately
- **THEN** the frontend MUST show a degraded-readable, last-good, or explicit failed-recovery state
- **AND** it MUST NOT settle to a blank conversation canvas without explanation

### Requirement: Claude Visible Stream Mitigation MUST Require Assistant Text Ingress

Claude Code visible-stream mitigation MUST activate only after assistant text delta ingress exists, while still allowing candidate and first-visible diagnostics to be recorded earlier.

#### Scenario: no first text delta stays in first-token diagnostics

- **WHEN** a Claude Code turn is processing
- **AND** no assistant text delta has been emitted for the active turn
- **AND** no non-text runtime progress has arrived for the active turn
- **THEN** the frontend MUST NOT activate `visible-output-stall-after-first-delta` recovery for that turn
- **AND** diagnostics MUST keep the issue in first-token/startup latency until assistant text or non-text runtime progress exists

#### Scenario: command progress is visible backend activity before assistant text

- **WHEN** a Claude Code turn emits `commandExecution`, file/tool output, or terminal interaction before the next assistant text delta
- **THEN** the frontend MUST treat that event as active runtime progress rather than backend silence
- **AND** first-token pending warnings MUST NOT be shown solely because the model is currently inside the command/tool step
- **AND** visible-stream mitigation MUST still wait for actual assistant text ingress before classifying visible-output stall

#### Scenario: first text delta hands off to visible-stream diagnostics

- **WHEN** a Claude Code assistant text delta has been emitted and app-server delivery has occurred
- **THEN** subsequent lack of visible text growth MAY be classified as visible-output stall
- **AND** the existing Claude Windows visible-stream mitigation rules MUST remain available

#### Scenario: candidate profile is observable separately from active mitigation

- **WHEN** the frontend selects a Claude Windows stream mitigation candidate profile
- **THEN** diagnostics MUST record the candidate profile and candidate reason separately from active mitigation escalation
- **AND** triage MUST be able to tell whether the render path used a candidate profile, an active mitigation profile, or no mitigation profile
