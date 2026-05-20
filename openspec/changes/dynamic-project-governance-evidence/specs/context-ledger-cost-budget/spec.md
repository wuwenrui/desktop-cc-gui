## ADDED Requirements

### Requirement: Cost Budget UI MUST Distinguish Pricing Usage And Budget Gaps
The Cost/Budget surface MUST distinguish pricing unavailability, stale pricing, usage unavailability, unconfigured budget, and threshold crossings. These states MUST NOT be collapsed into a generic partial or unknown message.

#### Scenario: missing pricing is actionable
- **WHEN** the active engine/model has usage but no pricing source
- **THEN** the UI MUST show pricing unavailable as the reason
- **AND** the row MUST identify the engine and model
- **AND** the row MUST provide an action such as adding pricing, configuring an alias, or marking the model as not tracked

#### Scenario: unconfigured budget is not displayed as a failed budget
- **WHEN** cost can be projected but no budget is configured
- **THEN** the UI MUST identify the budget as unconfigured
- **AND** the UI MUST NOT imply that the budget check failed

#### Scenario: missing usage does not invent zero cost
- **WHEN** token usage is unavailable
- **THEN** the cost surface MUST show usage unavailable or omit cost projection
- **AND** it MUST NOT display a numeric zero that implies known cost

### Requirement: Cost Budget Evidence MUST Be Eligible For Governance Grouping
Cost and budget degraded states MUST be representable as governance evidence or an equivalent grouped StatusPanel view model so they can appear in needs-action or watch groups.

#### Scenario: pricing unavailable contributes needs-action evidence
- **WHEN** pricing is unavailable for an active model with usage
- **THEN** the grouped governance view MUST be able to classify the cost row as needs-action

#### Scenario: budget unconfigured contributes watch evidence
- **WHEN** cost is projectable but budget is not configured
- **THEN** the grouped governance view MUST be able to classify the budget row as watch or guidance rather than failure

#### Scenario: threshold crossed keeps advisory runtime semantics
- **WHEN** a budget threshold is crossed
- **THEN** the UI MUST show the threshold tier
- **AND** this capability MUST NOT forcibly interrupt the running runtime

### Requirement: Cost Panel MUST Render Token Breakdown When Usage Is Known
The cost surface MUST render a token breakdown whenever `ThreadTokenUsage` is available, regardless of whether pricing is available.

#### Scenario: token breakdown renders without pricing
- **WHEN** token usage is available
- **AND** pricing is unavailable for the active model
- **THEN** the token breakdown MUST remain visible
- **AND** monetary values MUST be hidden or marked unavailable

#### Scenario: zero segments are omitted cleanly
- **WHEN** one token category has zero tokens
- **THEN** that category MUST NOT render as a broken zero-width visual artifact
- **AND** remaining categories MUST still be legible

### Requirement: Cost Panel MUST Support Accumulated Session Today And Month Cost
The cost surface MUST be able to display accumulated cost for the current session, current local day, and current local month when pricing and cost history are available.

#### Scenario: session accumulation follows active thread id
- **WHEN** active thread id is available
- **THEN** session cost MUST aggregate entries for that session id
- **AND** the UI MUST NOT display a generic dash when a valid active session exists

#### Scenario: day and month accumulation use local time boundaries
- **WHEN** cost history contains entries across local day or month boundaries
- **THEN** today and month totals MUST include only entries in their respective local periods

#### Scenario: local history failure degrades safely
- **WHEN** local cost history storage is unavailable or fails to write
- **THEN** the UI MUST continue with in-memory or session-only data
- **AND** it MUST surface a non-blocking warning

### Requirement: Budget Bar MUST Visualize Monthly Limit Consumption
The cost surface MUST be able to render a Budget Bar from a locally configured monthly budget limit and warning thresholds.

#### Scenario: unset budget prompts configuration
- **WHEN** no monthly budget is configured
- **THEN** the Budget Bar slot MUST show a configuration prompt or watch state
- **AND** it MUST NOT imply that the budget check failed

#### Scenario: budget threshold warning is visual only
- **WHEN** month-to-date cost crosses a warning or exceeded threshold
- **THEN** the Budget Bar MUST show the corresponding visual state
- **AND** the UI MUST NOT block AI requests by itself

#### Scenario: settings update is reflected without restart
- **WHEN** the user sets, edits, or clears the monthly budget in settings
- **THEN** the StatusPanel budget state MUST update in the same app session

### Requirement: Cost V2 UI MUST Be Feature-Flagged
The expanded cost UI containing Token Breakdown, Accumulated Cost, and Budget Bar MUST be guarded by a feature flag such as `statusPanel.costV2`, while correctness fixes such as token-only fallback MAY ship outside the flag.

#### Scenario: feature flag disabled preserves legacy UI
- **WHEN** the cost V2 feature flag is disabled
- **THEN** the StatusPanel MUST render the legacy cost surface
- **AND** expanded V2 subcomponents MUST NOT mount

#### Scenario: feature flag enabled renders decision modules
- **WHEN** the cost V2 feature flag is enabled
- **THEN** the StatusPanel MAY render Token Breakdown, Accumulated Cost, and Budget Bar modules according to available data

### Requirement: Pricing Source Configuration MUST Remain Explicit
Pricing source lookup MUST continue to reject unknown engine/model pricing instead of silently falling back to unrelated rates. Any model alias or configured pricing source MUST be explicit and traceable.

#### Scenario: unknown model does not use a silent fallback price
- **WHEN** the active model is not present in fixture, config, remote, or alias pricing sources
- **THEN** cost projection MUST report pricing unavailable
- **AND** it MUST NOT reuse another model's price without an explicit alias

#### Scenario: configured alias preserves provenance
- **WHEN** a configured alias maps an active model to a pricing source
- **THEN** the cost record MUST expose the resolved pricing source
- **AND** the UI MUST be able to show that an alias or configured source was used

#### Scenario: pricing freshness is visible
- **WHEN** monetary cost is displayed
- **THEN** the UI MUST expose pricing source freshness such as `lastUpdatedAt`, `pricedAt`, or equivalent source date
- **AND** stale pricing MUST be distinguishable from missing pricing
