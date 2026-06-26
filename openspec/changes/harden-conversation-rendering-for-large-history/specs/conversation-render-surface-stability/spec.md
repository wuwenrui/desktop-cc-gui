## ADDED Requirements

### Requirement: Restored Heavy Conversation Surfaces MUST Stay Readable And Locally Recoverable

Restored conversation surfaces with heavy history content MUST keep a readable conversation surface and MUST contain row-level render failures inside the conversation area.

#### Scenario: heavy restored history does not blank or overlap the conversation
- **WHEN** a restored conversation contains long Markdown, tables, tool cards, batch file-read cards, diffs, anchors, or popovers
- **THEN** the conversation surface MUST keep visible readable rows
- **AND** the surface MUST NOT collapse to an empty-thread placeholder, full blank area, or incoherent row overlap solely because heavy rows are present

#### Scenario: row render failure stays local to the row
- **WHEN** one conversation row, Markdown island, tool-card detail, or diff detail throws during render
- **THEN** the conversation surface MUST render a local recoverable fallback for the failing row or island
- **AND** the failure MUST NOT force the entire app into the global `Application Error` page when the rest of the shell can continue

#### Scenario: anchor target gets hydration priority
- **WHEN** the user jumps to a message anchor whose row is virtualized, summarized, or not yet hydrated
- **THEN** the target row MUST receive hydration priority
- **AND** the anchor-ready signal MUST wait for a readable target surface rather than resolving against a missing or placeholder-only DOM node

### Requirement: Heavy Conversations MUST Offer A Lightweight Mode And Oversized-History Recovery Path

The conversation surface MUST provide an explicit lightweight render policy for heavy histories and MUST avoid freezing or crashing when a history is too large or complex for immediate full-detail hydration.

#### Scenario: lightweight mode keeps canonical actions
- **WHEN** a heavy conversation opens in lightweight mode or the user enables lightweight mode for the selected conversation
- **THEN** tool cards, batch read cards, diffs, and heavy Markdown islands MAY render summaries or placeholders by default
- **AND** copy, export, open-file, open-diff, fork, rewind, and anchor actions MUST continue to read canonical conversation data where those actions are available

#### Scenario: severe history opens with a degraded prompt
- **WHEN** row count, payload size, and render weight exceed the documented severe-history threshold
- **THEN** the conversation surface MUST show a bounded prompt, banner, or degraded surface with choices to stay lightweight, hydrate visible details, or retry full detail
- **AND** navigation, Composer input, and safe row summaries MUST remain usable while the prompt is displayed

#### Scenario: normal conversations keep full fidelity
- **WHEN** a conversation is below the documented heavy-history thresholds
- **THEN** the renderer SHOULD keep the normal eager-rich behavior where current budgets allow
- **AND** lightweight-mode summaries MUST NOT become the global default for ordinary histories
