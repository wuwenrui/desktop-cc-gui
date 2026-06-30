## MODIFIED Requirements

### Requirement: Claude history control-plane filtering

Claude history parsing MUST filter GUI, Codex, and Claude protocol control-plane payloads before projecting user-visible sessions or messages.

#### Scenario: leaked stream-json stdin payload is not used as first message
- **WHEN** a Claude JSONL entry contains text that parses as a Claude stream-json stdin user-message envelope
- **THEN** backend session scanning MUST NOT use that text as `firstMessage`
- **AND** backend session loading MUST NOT return it as a visible user message
- **AND** frontend fallback history parsing MUST skip that row

#### Scenario: mixed polluted transcript keeps real conversation
- **WHEN** a Claude transcript contains leaked stream-json stdin payload rows followed by real user and assistant messages
- **THEN** the session MUST remain visible
- **AND** the first real user message MUST become the title fact
- **AND** real assistant/user messages MUST be preserved

#### Scenario: polluted assistant echo is quarantined
- **WHEN** a Claude transcript contains a leaked stream-json stdin payload followed by assistant-side reasoning or final text created from that payload
- **THEN** backend session scanning MUST NOT count that assistant-side echo as a visible message
- **AND** backend session loading MUST NOT return that assistant-side echo
- **AND** frontend fallback history parsing MUST skip that assistant-side echo
- **AND** quarantine MUST end when the next real user row is encountered

#### Scenario: normal JSON discussion remains visible
- **WHEN** a real user message mentions JSON or includes JSON text that does not match the Claude stream-json stdin envelope
- **THEN** the message MUST remain visible in history restore
