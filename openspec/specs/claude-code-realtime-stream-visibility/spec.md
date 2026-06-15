# claude-code-realtime-stream-visibility Specification

## Purpose

Define the Windows-facing Claude Code stream visibility contract so live assistant text remains progressively visible once realtime text ingress has begun.
## Requirements
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

### Requirement: Claude Code Stream Visibility Mitigation MUST Be Engine-Level And Model-Independent

The system MUST activate Claude Code stream visibility protection from engine/platform evidence, not from model or provider identity.

#### Scenario: Windows native Claude path can activate mitigation without provider fingerprint
- **WHEN** the active engine is `claude`
- **AND** the platform is Windows
- **AND** stream evidence shows visible output stalled after the first delta
- **THEN** the system MUST be able to activate the Claude Code stream visibility mitigation profile
- **AND** activation MUST NOT require `providerId`, `providerName`, `baseUrl`, or `model` to match a provider-specific fingerprint

#### Scenario: model changes do not change the bug classification
- **WHEN** a Windows `Claude Code` conversation shows the same first-delta-then-stall behavior across different models
- **THEN** diagnostics MUST classify the issue as a Claude Code stream visibility problem
- **AND** the system MUST NOT create separate root-cause categories solely from model identity

### Requirement: Claude Code Stream Visibility Mitigation MUST Preserve Conversation Semantics

The system MUST reduce visible output stalls without changing Claude Code conversation semantics.

#### Scenario: mitigation preserves ordering and terminal outcome
- **WHEN** Claude Code stream visibility mitigation is active
- **THEN** assistant text deltas, reasoning/tool items, and terminal completion MUST preserve their logical order
- **AND** the final visible assistant text MUST match the turn outcome that would be produced without mitigation

#### Scenario: processing controls remain available during mitigation
- **WHEN** mitigation is active and the turn is still processing
- **THEN** waiting/ingress/processing indicators and stop controls MUST remain available
- **AND** the user MUST still be able to tell that Claude Code is actively working

### Requirement: Claude Runtime Request MUST Receive Disable Thinking Intent

When Claude thinking visibility is explicitly disabled for a Claude Code send, the engine request path MUST pass a request-level disable-thinking intent to the Claude runtime without applying that intent to other engines.

#### Scenario: hidden thinking disables Claude CLI thinking for the request
- **WHEN** a user sends a message through the `claude` engine
- **AND** Claude thinking visibility is explicitly disabled
- **THEN** the frontend MUST pass `disableThinking=true` through the engine send contract
- **AND** the backend MUST start Claude Code with `CLAUDE_CODE_DISABLE_THINKING=1` for that request

#### Scenario: non-Claude sends ignore Claude disable thinking
- **WHEN** a user sends a message through `codex`, `gemini`, or `opencode`
- **AND** Claude thinking visibility is disabled
- **THEN** the engine send contract MUST NOT disable that engine's reasoning behavior

### Requirement: Claude Realtime Reasoning MUST Respect Thinking Visibility

Claude realtime stream handling MUST keep assistant final text progressive visibility intact while applying Claude thinking visibility to realtime reasoning presentation.

#### Scenario: hidden thinking suppresses realtime reasoning rows
- **WHEN** a `Claude Code` turn is running
- **AND** Claude thinking visibility is disabled
- **AND** the runtime emits `thinking_delta`, `reasoning_delta`, or equivalent reasoning events
- **THEN** the frontend MUST NOT render those events as visible reasoning rows in the conversation canvas
- **AND** it MUST NOT render those events in the Claude docked reasoning module

#### Scenario: hidden thinking preserves assistant final text
- **WHEN** a `Claude Code` turn is running
- **AND** Claude thinking visibility is disabled
- **AND** the runtime emits assistant text deltas or final assistant output
- **THEN** the frontend MUST continue rendering assistant text through the existing progressive visibility path
- **AND** hiding reasoning MUST NOT cause the final assistant answer to disappear

#### Scenario: visible thinking allows realtime reasoning rows
- **WHEN** a `Claude Code` turn is running
- **AND** Claude thinking visibility is enabled
- **AND** the runtime emits reasoning events
- **THEN** the frontend MAY render realtime reasoning using the existing reasoning presentation

#### Scenario: reasoning data remains available after visibility toggle
- **WHEN** a `Claude Code` turn has received reasoning events while Claude thinking visibility was disabled
- **AND** the user enables Claude thinking visibility before or after the turn completes
- **THEN** the system SHOULD be able to present retained reasoning data if it is still part of the conversation state
- **AND** it MUST NOT require replaying the runtime stream to recover the presentation

### Requirement: Claude Realtime Reasoning Visibility MUST Be Engine-Scoped

Claude realtime reasoning visibility behavior MUST only apply to Claude Code conversations.

#### Scenario: non-Claude realtime reasoning is unchanged
- **WHEN** a realtime conversation is running for `codex`, `gemini`, or `opencode`
- **AND** Claude thinking visibility is disabled
- **THEN** the frontend MUST keep that engine's existing realtime reasoning behavior unchanged

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

### Requirement: Claude Code Live Text MUST Remain Visible Beyond Preview Limits

Claude Code live assistant text visibility MUST continue beyond ordinary preview and list-summary limits during long outputs.

#### Scenario: long Claude output continues after preview budget
- **WHEN** a Claude Code turn is processing
- **AND** assistant text deltas continue after the active text exceeds the ordinary preview truncation budget
- **THEN** the live assistant message MUST continue visible text progression from the untruncated body
- **AND** the UI MUST NOT append new output after an inserted ellipsis caused by preview truncation

#### Scenario: interrupted long Claude output restores visible text
- **WHEN** a Claude Code turn streamed long assistant text
- **AND** the client closed before Claude history contained the final assistant body
- **THEN** reopening the session MUST restore the latest trusted local assistant text when a matching shadow transcript exists
- **AND** the restored surface MUST remain readable instead of rendering an empty or thinking-only conversation

#### Scenario: mitigation remains model-independent
- **WHEN** a Claude Code long-output visibility issue occurs across models or providers
- **THEN** diagnostics MUST classify the issue by engine, stream, reducer, render, and recovery evidence
- **AND** it MUST NOT require model-specific fingerprints to protect long-output visibility

### Requirement: Claude Runtime Prompt Input MUST Use Stream JSON Stdin

Claude Code runtime MUST send user prompt content through `--input-format stream-json` stdin by default instead of passing prompt text as a CLI argv argument.

#### Scenario: single-line prompt uses stream-json stdin

- **WHEN** a user sends a single-line Claude Code prompt without images
- **THEN** the runtime MUST launch Claude CLI with `--input-format stream-json`
- **AND** the prompt content MUST be written through stdin
- **AND** the prompt content MUST NOT appear as a positional argv argument

#### Scenario: special-character prompt is not shell-interpreted argv

- **WHEN** a user sends a Claude Code prompt containing shell metacharacters such as `&`, `|`, `<`, `>`, `^`, `%`, `!`, `(`, or `)`
- **THEN** the runtime MUST keep the prompt content out of CLI argv
- **AND** the runtime MUST preserve normal Claude CLI control flags such as permission mode, model, session, and hook event flags

#### Scenario: multiline and image prompts keep existing stdin behavior

- **WHEN** a user sends a multiline prompt or attaches images to a Claude Code turn
- **THEN** the runtime MUST continue using stream-json stdin input
- **AND** the existing stream-json content builder behavior MUST remain compatible with prior multiline and image support

#### Scenario: diagnostics expose the active input format

- **WHEN** Claude CLI exits with a non-zero status and no stdout or stderr diagnostics
- **THEN** the runtime error diagnostics MUST include the active input format
- **AND** after this change normal prompt sends SHOULD report `input_format=stream-json` rather than `input_format=argv`

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

