## ADDED Requirements

### Requirement: Conversation Lifecycle SHALL preserve explicit browser context attachments

Conversation lifecycle handling SHALL preserve explicit browser context attachments as bounded evidence without allowing browser context to destabilize streaming, recovery, or replay semantics.

#### Scenario: browser snapshot attachment is visible in sent message lifecycle
- **WHEN** a user sends a message with an attached Browser Context Snapshot
- **THEN** the conversation SHALL preserve a visible attachment reference with title, URL, snapshot id, and capture time when available
- **AND** the attachment SHALL remain associated with the user turn during streaming and terminal settlement

#### Scenario: browser attachment does not force processing state
- **WHEN** a browser snapshot attachment exists on a conversation turn
- **THEN** lifecycle processing state SHALL still be governed by engine events and existing terminal settlement rules
- **AND** the presence of browser evidence SHALL NOT leave the thread in pseudo-processing

#### Scenario: reopened conversation handles missing browser evidence
- **WHEN** a conversation is reopened and a historical browser snapshot reference is no longer available
- **THEN** the conversation SHALL show a degraded or unavailable attachment state
- **AND** the message history SHALL remain readable without requiring the browser evidence payload to be restored

#### Scenario: browser context is not injected into unrelated turns
- **WHEN** a browser snapshot is attached to one message or task dispatch
- **THEN** lifecycle replay and subsequent sends SHALL NOT automatically inject that snapshot into unrelated future turns
- **AND** future browser context use SHALL require a new explicit attachment or orchestration rule

### Requirement: Browser Context Attachments SHALL remain engine-neutral in conversation lifecycle

Conversation lifecycle SHALL preserve browser context attachments without coupling the attachment model to a specific engine runtime.

#### Scenario: browser attachment survives engine selection
- **WHEN** the user switches between Claude, Codex, Gemini, OpenCode, or a custom provider before sending a browser-attached message
- **THEN** the browser attachment SHALL keep the same visible metadata and bounded snapshot reference
- **AND** engine-specific adapters SHALL NOT mutate the stored attachment into provider-specific history shape

#### Scenario: engine fallback preserves browser evidence visibility
- **WHEN** a browser-attached request falls back to another engine or provider
- **THEN** the conversation SHALL preserve the browser attachment reference and fallback reason
- **AND** the user SHALL be able to tell whether the final engine consumed, ignored, or could not support that browser context
