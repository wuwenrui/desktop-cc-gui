## MODIFIED Requirements

### Requirement: Client Interaction Performance Evidence SHALL Be Classified

Runtime performance closure evidence SHALL classify client interaction scenarios by evidence strength before an optimization is considered release-grade.

#### Scenario: realtime evidence source is explicit

- **WHEN** a performance report covers realtime streaming visible lag, render amplification, terminal settlement, Composer typing, file editor typing, thread switching, sidebar projection, or session catalog hydration
- **THEN** each scenario MUST be classified as `measured`, `proxy`, `manual-only`, or `unsupported`
- **AND** the report MUST explain the classification and list the next action for non-measured scenarios.

## ADDED Requirements

### Requirement: Realtime Visible Lag Budgets SHALL Use Correlated Milestones

Realtime performance budgets SHALL use correlated turn milestones rather than isolated first-token or fixture-only timings.

#### Scenario: visible text lag budget uses ingress-to-visible timing

- **WHEN** realtime visible lag evidence is collected
- **THEN** the report SHOULD compute lag from first assistant text ingress to first visible text growth where measured timing exists
- **AND** it MUST preserve evidence class when the path is only fixture/proxy observable.

#### Scenario: render amplification budget remains content-safe

- **WHEN** render amplification evidence is collected
- **THEN** the report MAY include counts, durations, queue depths, and milestone deltas
- **AND** it MUST NOT include prompt text, assistant output body, tool output body, or terminal output content.
