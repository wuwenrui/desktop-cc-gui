## ADDED Requirements

### Requirement: Conversation Timeline Virtualization MUST Account For Heavy Render Weight

Conversation timeline virtualization MUST be triggered by accumulated render weight as well as row count so short but heavy conversations remain bounded.

#### Scenario: heavy rows virtualize before the row-count threshold
- **WHEN** a conversation has fewer rows than the ordinary long-list threshold
- **AND** those rows include large Markdown tables, long code fences, tool-call raw payloads, batch file-read cards, diffs, images, or anchor-heavy surfaces
- **THEN** the timeline MAY enable virtualization or an equivalent bounded projection based on documented render weight
- **AND** row identity, ordering, selection, copy actions, and anchor navigation MUST continue to derive from canonical conversation state

#### Scenario: non-visible heavy details stay bounded
- **WHEN** virtualization is active for a heavy restored conversation
- **THEN** non-visible heavy row details MUST remain summarized, placeholder-rendered, or unmounted outside the viewport plus documented overscan
- **AND** the number of hydrated heavy details MUST remain bounded by viewport, overscan, active row, selected row, and anchor target requirements

#### Scenario: scroll restoration survives delayed hydration
- **WHEN** a restored heavy conversation reopens at a saved scroll position
- **AND** heavy details hydrate after the initial paint
- **THEN** scroll restoration MUST remain stable within the documented tolerance
- **AND** hydration MUST trigger bounded measurement updates rather than a full timeline rebuild loop

### Requirement: Conversation History Open MUST Be Selected-Conversation On Demand

Opening one history conversation MUST avoid synchronous all-history rendering and MUST keep first interaction bounded to selected conversation metadata plus viewport-bounded rows.

#### Scenario: workspace history catalog does not hydrate every conversation
- **WHEN** a workspace has many historical conversations
- **AND** the user opens one selected conversation
- **THEN** conversation catalog/list metadata MAY be loaded for navigation
- **AND** full message payload rendering, heavy Markdown hydration, tool detail hydration, and diff detail hydration for unselected conversations MUST NOT run synchronously before the selected conversation becomes interactive

#### Scenario: selected conversation details hydrate by demand
- **WHEN** the selected conversation contains many heavy rows
- **THEN** only rows inside viewport, overscan, active row, selected row, anchor target, or explicit expansion budget MAY hydrate rich details before first interaction
- **AND** hidden heavy details MUST remain summarized, placeholder-rendered, or unmounted until demanded

#### Scenario: loader contract limitations are made explicit
- **WHEN** an existing history loader must parse more than selected metadata before it can identify the selected conversation
- **THEN** the implementation MUST record evidence for that coupling
- **AND** any required loader pagination or catalog contract expansion MUST be split into a follow-up change rather than hidden inside renderer code
