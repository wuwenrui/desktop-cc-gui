## ADDED Requirements

### Requirement: V0511 Frontend Prop Chain Summary MUST Use Render Counters

Frontend prop-chain stability evidence MUST use existing render/profile counters before classifying composer, sidebar, row, or layout recompute metrics as unsupported.

#### Scenario: profiler counters populate frontend summary

- **WHEN** a v0.5.11 frontend profile fixture records composer or sidebar render counts
- **THEN** `frontendPropChainStabilitySummary` MUST expose `composer_render_count_per_streaming_minute` or `sidebar_render_count_per_streaming_minute`
- **AND** the report MUST preserve the producer evidence class

#### Scenario: unavailable row evidence remains explicit

- **WHEN** thread row rerender or layout recompute counts are not available
- **THEN** the matching fields MUST remain unsupported
- **AND** the report MUST identify the missing producer or runtime source
