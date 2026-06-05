## ADDED Requirements

### Requirement: Browser page facts are attributed and bounded
Conversation facts SHALL represent browser page facts as attributed, bounded, redacted facts with source URL, capture time, snapshot id, budget metadata, and diagnostics.

#### Scenario: Browser facts enter conversation context
- **WHEN** Browser Context Snapshot v2 is included in an AI request
- **THEN** the facts SHALL carry snapshot id, URL, capture time, freshness, budget, and redaction metadata

#### Scenario: Browser facts are truncated
- **WHEN** browser page facts exceed the configured fact budget
- **THEN** conversation facts SHALL include truncation metadata and SHALL NOT silently present the partial text as complete

### Requirement: Browser facts do not become unbounded prompt text
Conversation facts SHALL NOT inject raw DOM, raw HTML, cookies, headers, storage, password values, token values, or authorization secrets into prompts.

#### Scenario: Sensitive page data is available to the page
- **WHEN** sensitive page data exists in the active browser page
- **THEN** the conversation fact contract SHALL include only redacted safe metadata

#### Scenario: Sensitive data appears outside visible text
- **WHEN** browser facts include labels, placeholders, hrefs, ARIA text, selected text, landmark previews, form metadata, or diagnostics
- **THEN** every AI-visible string field SHALL pass through the shared browser sanitizer before entering conversation facts
