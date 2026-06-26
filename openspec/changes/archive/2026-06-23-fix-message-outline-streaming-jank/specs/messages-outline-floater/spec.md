## MODIFIED Requirements

### Requirement: Messages Surface MUST Surface Markdown-Derived Outline

The messages surface MUST derive a `MarkdownOutlineEntry[]`-compatible outline from the Markdown text and pass it up to the floater via a callback. The `MarkdownOutlineEntry` type itself MUST NOT be extended (its existing fields `id / depth / title / startLine / endLine / anchor / ordinal` are sufficient).

#### Scenario: Markdown component reports outline

- **WHEN** `Markdown` renders or throttle-flushes a message value and obtains an outline from `extractOutlineFromMarkdown`
- **THEN** `Markdown` MUST invoke the optional `onOutlineReady` prop with the outline.
- **AND** if `onOutlineReady` is not provided, `Markdown` MUST remain inert (no console warning, no side effect).

#### Scenario: messages component stores latest outline

- **WHEN** the messages component receives a new outline via `onOutlineReady`
- **THEN** the floater MUST render against the new outline.
- **AND** if the outline identity changes, the floater MUST reset its `expanded` state.

#### Scenario: repeated same outline is ignored during streaming

- **WHEN** the live assistant row reports an outline whose `messageId` and outline entries are semantically identical to the currently stored outline
- **THEN** the messages component MUST preserve the previous outline state reference.
- **AND** the floater MUST NOT reset or re-render solely because the same outline payload was replayed.

#### Scenario: live outline callback identity remains stable

- **WHEN** `MessagesTimeline` re-renders while the same assistant message remains the live row
- **THEN** the parent-owned outline callback passed into the live row MUST remain stable unless the live message identity changes.
- **AND** callback identity churn MUST NOT trigger outline extraction for an unchanged throttled Markdown value.

### Requirement: Outline Floater MUST NOT Break Existing Messages Capabilities

The floater MUST NOT alter the existing virtualized list, scroll restoration, streaming-render, message fork, or user-bubble behaviors.

#### Scenario: virtualized list invariants preserved

- **WHEN** the floater is mounted
- **THEN** `messagesTimelineVirtualization` MUST continue to recycle rows based on its existing heuristic.
- **AND** no additional rows MUST be kept mounted for the floater's sake.

#### Scenario: streaming messages continue to update outline

- **WHEN** an AI message is still streaming
- **THEN** the `onOutlineReady` callback MUST fire each time the throttled Markdown value produces a semantically new outline (because headings may be added as more text streams in).
- **AND** the floater MUST reflect the latest outline without animation jank.

#### Scenario: switching message resets floater

- **WHEN** the user scrolls such that a different message becomes the active visible message
- **THEN** the floater's outline MUST be replaced with the new message's outline.
- **AND** the floater's state MUST reset to `collapsed` (not stay `pinned` across messages).
