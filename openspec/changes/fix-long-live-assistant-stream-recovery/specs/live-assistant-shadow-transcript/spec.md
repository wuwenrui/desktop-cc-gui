## ADDED Requirements

### Requirement: Live Assistant Shadow Transcript MUST Persist Interrupted Streaming Text

The client MUST persist Claude Code active assistant text deltas to a bounded local shadow transcript so text already received during live streaming can be recovered if the client closes before provider history contains a final assistant body. The storage boundary MAY be engine-neutral, but the initial required behavior is Claude Code first.

#### Scenario: Claude Code live assistant deltas are shadowed during streaming
- **WHEN** Claude Code streams assistant text for an active turn
- **THEN** the client MUST append or batch the received text into a local shadow transcript keyed by engine, workspace, session or thread, turn, and assistant item identity when available
- **AND** the shadow write path MUST NOT block visible streaming updates

#### Scenario: interrupted Claude Code stream remains recoverable
- **WHEN** the client exits or crashes after Claude Code live assistant text was received
- **AND** the provider history source does not contain an equivalent final assistant body
- **THEN** the next restore for the matching conversation MUST be able to recover the shadowed assistant text as an interrupted local transcript

#### Scenario: completed Claude provider body supersedes shadow text
- **WHEN** Claude provider history contains a valid assistant final body for the same turn
- **THEN** restore MUST prefer the provider body
- **AND** it MUST NOT insert a duplicate assistant row from the shadow transcript

### Requirement: Live Assistant Shadow Transcript MUST Be Bounded And Recoverable

Shadow transcript storage MUST keep local recovery useful without creating unbounded startup, disk, or parsing risk.

#### Scenario: settled shadow transcripts are cleaned
- **WHEN** an active turn settles and provider history or canonical thread state contains the final assistant body
- **THEN** the shadow transcript MAY be marked settled and removed according to retention policy
- **AND** removing it MUST NOT affect normal provider history restore

#### Scenario: oversized or corrupt shadow data does not break startup
- **WHEN** shadow transcript storage contains oversized, malformed, or partially written data
- **THEN** the client MUST skip or quarantine the invalid shadow entry
- **AND** ordinary session listing and history restore MUST continue

#### Scenario: retention is enforced
- **WHEN** shadow transcript storage exceeds configured time or size budgets
- **THEN** the client MUST prune oldest or settled shadow entries first
- **AND** it MUST preserve recent interrupted entries within the recovery budget when possible
