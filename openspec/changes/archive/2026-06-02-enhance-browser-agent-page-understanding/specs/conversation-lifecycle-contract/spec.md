## ADDED Requirements

### Requirement: Conversation requests include BrowserContextAttachment v2
Conversation lifecycle SHALL support BrowserContextAttachment v2 as an explicit, removable, refreshable attachment on user messages without breaking streaming, message persistence, replay, or recovery.

#### Scenario: Browser context is sent with a message
- **WHEN** the user sends a message with an attached Browser Context Snapshot v2
- **THEN** the conversation request SHALL include the bounded engine-agnostic attachment and SHALL continue normal streaming behavior

#### Scenario: Browser context is sent through canonical path
- **WHEN** BrowserContextAttachment v2 is present on a message
- **THEN** conversation lifecycle SHALL avoid duplicating the same browser context as both structured metadata and inline prompt text

#### Scenario: Conversation is reopened
- **WHEN** a conversation containing browser context attachments is reopened
- **THEN** the UI SHALL show historical browser attachment references with available, expired, stale, or degraded state

### Requirement: Conversation UI exposes browser context freshness
Conversation lifecycle SHALL show whether the active browser attachment is fresh, stale, expired, or degraded before message send.

#### Scenario: Attachment becomes stale before send
- **WHEN** the attached browser snapshot becomes stale before the user sends a message
- **THEN** the composer SHALL indicate stale state and provide a refresh affordance without silently replacing the attachment
