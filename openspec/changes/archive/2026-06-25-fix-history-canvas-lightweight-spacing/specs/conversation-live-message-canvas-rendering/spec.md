## ADDED Requirements

### Requirement: History Lightweight Rows MUST Compress Virtualized Layout Height

The message timeline virtualization layer MUST keep lightweight history summary rows visually compact and MUST NOT let stale heavy-row measurements create large blank canvas gaps.

#### Scenario: lightweight summary row does not inherit stale heavy height

- **WHEN** timeline virtualization is enabled for a completed history conversation
- **AND** a heavy projection row is rendered as a lightweight summary row
- **THEN** the virtualized row wrapper MUST use a compact lightweight placeholder height
- **AND** it MUST NOT use a stale heavy measured height as the row's minimum visual height

#### Scenario: expanded history uses document flow instead of virtual canvas

- **WHEN** a completed history conversation expands previously hidden history rows
- **THEN** the timeline MUST render those projection rows in normal document flow
- **AND** it MUST NOT use the absolute-positioned virtualized canvas for the expanded lightweight history view
- **AND** heavy rows MUST remain eligible for lightweight summaries when lightweight mode is active so the document-flow fallback does not hydrate every heavy row unnecessarily

#### Scenario: manual history reveal resets to the revealed history head

- **WHEN** the user clicks the control that reveals previously hidden history rows
- **THEN** the timeline MUST NOT restore the prior viewport by applying a `scrollHeight delta`
- **AND** the viewport MUST move to the revealed history head so the newly revealed top operation surfaces are visible

#### Scenario: expanded lightweight history keeps top operation card visible

- **WHEN** a completed history conversation expands previously hidden history rows
- **AND** the expanded lightweight history view renders in normal document flow
- **THEN** the lightweight operation card MUST render inside the same padded timeline flow as message rows
- **AND** the operation card MUST NOT be clipped by the top viewport boundary or application chrome
- **AND** the sticky history header MUST NOT require a separate extra top offset just because the lightweight operation card exists

#### Scenario: lightweight mode switch remeasures bounded layout

- **WHEN** the conversation enters lightweight mode or returns to hydrated detail mode
- **AND** timeline virtualization is enabled
- **THEN** the timeline MUST request a bounded virtualizer remeasure
- **AND** the system MUST NOT hydrate every heavy history row solely to recover spacing

#### Scenario: render details exits lightweight summary mode

- **WHEN** the user clicks the lightweight mode render-detail action
- **THEN** the timeline MUST render hydrated detail rows for the conversation
- **AND** the lightweight mode bar MUST no longer present the conversation as still in lightweight summary mode
