# parallel-conversation-runtime-residuals delta

## MODIFIED Requirements

### Requirement: Progressive Reveal Cadence MUST Remain Measurable For Long Turns

The Markdown progressive reveal path MUST avoid repeated full-window boundary scans when revealing long streaming content. Boundary selection MUST preserve readable Markdown chunking while keeping the scan linear in the candidate window.

#### Scenario: short pending text flushes immediately

- **WHEN** `pendingText.length <= PROGRESSIVE_REVEAL_SMALL_PENDING_CHARS`
- **THEN** `resolveProgressiveRevealValue()` MUST return `targetValue`
- **AND** it MUST NOT require boundary scanning to decide the result

#### Scenario: boundary finder uses a single candidate-window scan

- **WHEN** `resolveProgressiveRevealValue()` reveals a partial chunk from long pending text
- **THEN** boundary classification MUST be computed in one pass over newline boundaries in the candidate window
- **AND** it MUST NOT run multiple regex passes over the same candidate text

#### Scenario: readable Markdown boundaries keep priority

- **WHEN** candidate text contains paragraph, heading, list, quote, code fence, and plain newline boundaries
- **THEN** the reveal boundary SHOULD prefer readable structural boundaries over plain newline fallback
- **AND** the fallback MUST still return `preferredEnd` when no safe boundary is available

#### Scenario: long pending reveal remains partial

- **WHEN** pending text is long but below the extreme backlog immediate-flush threshold
- **THEN** `resolveProgressiveRevealValue()` MUST return a value longer than `visibleValue`
- **AND** it MUST remain shorter than `targetValue`
