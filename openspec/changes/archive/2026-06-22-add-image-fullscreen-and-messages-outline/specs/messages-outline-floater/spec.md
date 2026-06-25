# messages-outline-floater Specification

## Purpose

Defines the contract for surfacing a collapsible outline / TOC floater for Markdown-rendered messages on the messages surface, so users can navigate long AI responses by heading. The messages surface uses a lightweight raw Markdown extractor that emits `MarkdownOutlineEntry[]`-compatible records without switching the rich ReactMarkdown runtime to the file-preview fast worker path.

## ADDED Requirements

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

### Requirement: Outline Floater MUST Hide When Message Has No Headings

The floater entry point MUST be hidden (not render an empty box) when the current message has zero headings.

#### Scenario: empty outline hides entry

- **WHEN** `outline` is `null` or an empty array
- **THEN** the floater component MUST return `null`
- **AND** no DOM element with class `messages-outline-floater` MUST be present.

#### Scenario: outline with at least one heading shows entry

- **WHEN** `outline.length >= 1`
- **THEN** the floater MUST render its collapsed entry button.

### Requirement: Outline Floater MUST Have Three UI States

The floater MUST support `collapsed`, `expanded-hover`, and `pinned` states with deterministic transitions.

#### Scenario: collapsed shows entry button only

- **WHEN** the floater is in `collapsed` state
- **THEN** only the entry button MUST be visible.
- **AND** clicking the entry button MUST transition to `expanded-hover`.

#### Scenario: expanded-hover collapses on mouse leave

- **WHEN** the floater is in `expanded-hover` state
- **THEN** moving the mouse outside the floater for more than 200ms MUST transition to `collapsed`.
- **AND** moving the mouse back inside the floater within that window MUST keep it expanded.

#### Scenario: pinned stays open on mouse leave

- **WHEN** the floater is in `pinned` state
- **THEN** moving the mouse outside the floater MUST NOT collapse it.
- **AND** clicking the pin button again MUST transition back to `expanded-hover`.

### Requirement: Active Heading MUST Track Scroll Position

The floater MUST highlight the heading that is closest to (and at or above) the viewport top, computed from a `requestAnimationFrame`-throttled scroll listener and outline line metadata.

#### Scenario: scroll listener uses rAF throttle

- **WHEN** the user scrolls the messages container
- **THEN** the active-heading recomputation MUST be scheduled via `requestAnimationFrame` and MUST NOT block the scroll frame.
- **AND** at most one recomputation MUST be in flight at a time.

#### Scenario: active heading resolves to nearest above-viewport heading

- **WHEN** the scroll position places heading `h_i` at the viewport top
- **THEN** `h_i` MUST be marked active.
- **AND** when the scroll position places the viewport between `h_i` and `h_{i+1}`, `h_i` MUST remain active.

#### Scenario: missing heading DOM does not break active resolution

- **WHEN** a heading's DOM node is not available for direct measurement
- **THEN** the active resolution MUST use the outline data and the timeline container's `getBoundingClientRect()` / `scrollHeight` fallback.
- **AND** active resolution MUST remain correct as the user scrolls.

### Requirement: Clicking A Heading MUST Jump The Message To That Heading

Clicking a heading in the floater MUST scroll the message to the corresponding heading DOM when that heading is mounted, using the heading's `id`.

#### Scenario: heading is in DOM

- **WHEN** the user clicks a heading whose DOM is currently mounted
- **THEN** `element.scrollIntoView({ behavior: "smooth", block: "start" })` MUST be called on the heading element.
- **AND** the floater MUST transition to `collapsed` (unless `pinned`).

#### Scenario: heading is not mounted

- **WHEN** the user clicks a heading whose DOM is not currently mounted
- **THEN** the click MUST be a safe no-op.
- **AND** no exception MUST leak from the click handler.

### Requirement: Outline Floater MUST NOT Break Existing Messages Capabilities

The floater MUST NOT alter the existing virtualized list, scroll restoration, streaming-render, message fork, or user-bubble behaviors.

#### Scenario: virtualized list invariants preserved

- **WHEN** the floater is mounted
- **THEN** `messagesTimelineVirtualization` MUST continue to recycle rows based on its existing heuristic.
- **AND** no additional rows MUST be kept mounted for the floater's sake.

#### Scenario: streaming messages continue to update outline

- **WHEN** an AI message is still streaming
- **THEN** the `onOutlineReady` callback MUST fire each time the throttled Markdown value produces a new outline (because headings may be added as more text streams in).
- **AND** the floater MUST reflect the latest outline without animation jank.

#### Scenario: switching message resets floater

- **WHEN** the user scrolls such that a different message becomes the active visible message
- **THEN** the floater's outline MUST be replaced with the new message's outline.
- **AND** the floater's state MUST reset to `collapsed` (not stay `pinned` across messages).
