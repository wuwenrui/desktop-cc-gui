# message-assistant-tool-call-card-fallback Specification

## Purpose
TBD - created by archiving change add-message-tool-call-card-fallback. Update Purpose after archive.
## Requirements
### Requirement: Assistant Markdown SHALL Render Residual Tool-Call XML As A Fallback Card

The system SHALL detect residual Anthropic tool-call XML (`<function_calls>` / `<invoke>` / `<parameter>` and their `antml:`-prefixed variants such as `<antml:function_calls>` / `<antml:invoke>` / `<antml:parameter>`) emitted as plain assistant text inside the unified message markdown renderer, and SHALL render each detected block as a fallback tool-call card instead of leaving raw XML fragments in the reading surface.

The detection and rendering MUST apply uniformly to every assistant message consumer of the shared markdown renderer (including primary thread, subagent thread, shared session, history replay, and other reuse sites), without requiring any consumer-side opt-in.

#### Scenario: paired function_calls block becomes a tool-call card

- **WHEN** an assistant message contains a paired block of the form `<function_calls><invoke name="X"><parameter name="K">V</parameter></invoke></function_calls>` inside its text body
- **THEN** the renderer SHALL replace that block with a tool-call fallback card identifying `X` as the tool name and surfacing each `<parameter>` as a key/value entry
- **AND** the raw XML fragment MUST NOT remain as the primary reading surface for that block

#### Scenario: antml-prefixed variant is treated identically

- **WHEN** the assistant text contains the `antml:` prefixed variants (e.g. `<antml:function_calls>`, `<antml:invoke>`, `<antml:parameter>`) in a paired block
- **THEN** the renderer SHALL recognize the block equivalently to the unprefixed form and render the same fallback card
- **AND** the prefix MUST NOT cause the block to be skipped or rendered as raw text

#### Scenario: bare invoke block becomes a tool-call card

- **WHEN** an assistant message contains a paired bare invoke block of the form `<invoke name="X"><parameter name="K">V</parameter></invoke>` or `<antml:invoke name="X"><antml:parameter name="K">V</antml:parameter></antml:invoke>` without an outer `function_calls` wrapper
- **THEN** the renderer SHALL replace that invoke block with a tool-call fallback card identifying `X` as the tool name and surfacing each parameter as a key/value entry
- **AND** the absence of the outer wrapper MUST NOT cause the block to bypass fallback detection

#### Scenario: card preserves surrounding markdown segments unchanged

- **WHEN** an assistant message mixes ordinary markdown (headings, lists, fenced code blocks, KaTeX, Mermaid, file-link tooltips) with one or more tool-call XML blocks
- **THEN** the ordinary markdown segments SHALL continue to render via the existing message markdown pipeline with identical structure and styling
- **AND** tool-call cards MUST be inserted only at the positions of the detected XML blocks, without re-ordering or mutating the surrounding markdown

### Requirement: Tool-Call Fallback Detection MUST NOT Trigger Inside Protected Markdown Regions

The fallback detector MUST treat fenced code blocks and inline code spans as protected regions; tool-call XML that appears literally inside such regions MUST be rendered as ordinary code content rather than as a card.

#### Scenario: fenced code block containing literal XML stays as code

- **WHEN** an assistant message contains a fenced code block whose body literally includes `<function_calls>...</function_calls>` for documentation or example purposes
- **THEN** the renderer SHALL render that fenced block as a normal code block with the literal XML preserved verbatim
- **AND** the renderer MUST NOT extract the literal XML into a fallback card

#### Scenario: inline code span containing literal tag stays as code

- **WHEN** an assistant message contains an inline code span such as `` `<function_calls>` `` used as a literal token in prose
- **THEN** the renderer SHALL render the span as an ordinary inline code token
- **AND** the renderer MUST NOT promote the inline span into a fallback card

### Requirement: Tool-Call Fallback Card SHALL Provide Collapse, Expand, And Copy Affordances

Each tool-call fallback card SHALL render in a collapsed state by default, MUST allow the reader to expand it to inspect parameters and raw XML, and MUST allow the reader to copy the raw XML payload in a single action.

#### Scenario: collapsed card surfaces tool name and short preview

- **WHEN** a tool-call fallback card is rendered in its default state
- **THEN** the card SHALL display a tool-call header with the parsed tool name (or a localized unknown-tool label when the name cannot be parsed) and a one-line preview derived from the first parameter or the raw payload
- **AND** the full parameter table and raw XML MUST NOT be displayed in the collapsed state

#### Scenario: expanding the card reveals parameters and raw payload

- **WHEN** the reader activates the expand affordance on a collapsed tool-call card
- **THEN** the card SHALL reveal a parameter list (each entry mapping a parameter name to its value) and the raw XML payload as a verbatim code block
- **AND** the card MUST remain collapsible back to the default state via the same affordance

#### Scenario: copy affordance copies the raw payload

- **WHEN** the reader activates the copy affordance on a tool-call card
- **THEN** the system SHALL place the raw XML payload of that card on the clipboard
- **AND** the card MUST acknowledge the copy action via a localized confirmation state

### Requirement: Tool-Call Fallback MUST Remain Stable Under Streaming Output

When assistant text is still being streamed and a tool-call block has begun but its closing tag has not yet arrived, the renderer MUST render the incomplete trailing segment as a streaming tool-call card rather than displaying the partial XML as raw text; once the closing tag arrives, the card MUST converge to its completed form without losing reader-visible state.

#### Scenario: unclosed tool-call block renders as a streaming card

- **WHEN** assistant streaming has emitted an opening `<function_calls>` (or `antml:` variant) but the matching closing tag has not yet arrived
- **THEN** the renderer SHALL render the trailing partial segment as a tool-call card marked as streaming
- **AND** the partial XML fragment MUST NOT remain as the primary reading surface for that segment

#### Scenario: closing tag arrival converges the streaming card

- **WHEN** a later streaming delta delivers the missing closing tag for a previously streaming tool-call card
- **THEN** the renderer SHALL converge the card to its completed state, populating any parameters that became parseable
- **AND** the convergence MUST NOT remount the card in a way that loses the reader's expanded/collapsed selection for stable raw-prefix payloads

### Requirement: Tool-Call Fallback MUST Be Inert When No Residual XML Is Present

The renderer MUST short-circuit the fallback path when an assistant message contains no tool-call XML residue, so that unaffected messages render through the existing markdown pipeline with no structural or behavioural change.

#### Scenario: residue-free assistant message renders via the existing pipeline

- **WHEN** an assistant message text contains none of the fallback trigger substrings (`function_calls`, `invoke`, `antml:function_calls`, `antml:invoke`)
- **THEN** the renderer SHALL bypass the segmentation path and render the entire message through the existing markdown pipeline
- **AND** the rendered output MUST be structurally and visually equivalent to the renderer's behaviour prior to this capability

#### Scenario: existing message markdown contracts remain intact

- **WHEN** an assistant message renders through this capability's segmentation path
- **THEN** existing message markdown contracts (including inline code span boundary stability during streaming, assistant text normalization export surface, KaTeX math rendering, Mermaid source/render behaviour, and file-link tooltip behaviour) SHALL continue to hold for every ordinary markdown segment
- **AND** the fallback path MUST NOT mutate the assistant text export surface observed by thread item, loader, or reducer consumers

### Requirement: Tool-Call Fallback User-Visible Strings SHALL Be Localized

All user-visible strings introduced by the tool-call fallback card (including the tool-call title, expand and collapse affordance labels, the copy affordance label, the copy confirmation, the streaming indicator, the unknown-tool placeholder, and the no-parameters placeholder) SHALL be resolved through the project's i18n locale files and MUST be available in every locale supported by the project at the time of introduction.

#### Scenario: every user-visible string resolves through i18n

- **WHEN** a tool-call fallback card is rendered in any supported locale
- **THEN** every user-visible string on the card SHALL be sourced from the project's i18n locale files
- **AND** no user-visible string on the card MUST be hard-coded as a literal English or Chinese token in the component source

#### Scenario: locales remain in parity for fallback keys

- **WHEN** a new i18n key is introduced for the tool-call fallback card in one locale
- **THEN** the corresponding key SHALL also be present in every other locale supported by the project at the time of introduction
- **AND** missing-key fallbacks (such as displaying the raw key) MUST NOT be the user-visible behaviour for any supported locale

