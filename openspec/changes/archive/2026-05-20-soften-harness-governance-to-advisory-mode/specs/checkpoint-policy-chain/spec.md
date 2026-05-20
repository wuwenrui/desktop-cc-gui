## ADDED Requirements

### Requirement: Optional Governance Policies MUST NOT Introduce New Blocking Contributions

Optional governance policies introduced for harness governance advisory signals MUST cap their `verdictContribution` below `blocked`. Only the existing core policy path for runtime, fatal, or already-defined hard failures MAY contribute `blocked` in this phase.

#### Scenario: advisory governance warning caps at needs_review

- **WHEN** an optional governance policy evaluates warning evidence from OpenSpec, large-file governance, heavy-test-noise, platform qualifiers, stale artifacts, or missing artifacts
- **THEN** its `verdictContribution` MUST be `needs_review`, `running`, `ready`, or `no_contribution`
- **AND** it MUST NOT return `blocked`

#### Scenario: existing fatal failures remain blocking

- **WHEN** the core policy evaluates an existing runtime or fatal failure that was already blocking before this change
- **THEN** the final checkpoint verdict MAY remain `blocked`
- **AND** the advisory-only rule MUST NOT downgrade that existing hard failure

#### Scenario: most severe wins cannot upgrade advisory to blocked

- **WHEN** all contributing optional governance policies return advisory-level contributions
- **THEN** chain composition MUST NOT synthesize a `blocked` verdict from those advisory contributions
- **AND** the final verdict MUST remain at or below `needs_review` unless the core policy contributes `blocked`

#### Scenario: same-source governance evidence preserves the most severe advisory signal

- **WHEN** a bridge-fed governance source emits multiple evidence rows in the same snapshot
- **THEN** the corresponding optional governance policy MUST select the row with the most severe advisory contribution
- **AND** a `pass` row MUST NOT hide a same-source `warn`, `fail`, stale, degraded, or platform-qualified row

### Requirement: Policy Audit MUST Identify Advisory Contribution Class

Policy decisions produced from governance evidence MUST include enough structured metadata for audit renderers to distinguish advisory warnings from blocking failures.

#### Scenario: advisory policy decision is classifiable

- **WHEN** a governance policy emits a non-blocking warning
- **THEN** the policy decision MUST identify the contribution as advisory through `enforcement` metadata or an equivalent structured field
- **AND** audit consumers MUST NOT infer that the AI execution flow was blocked

#### Scenario: advisory decision keeps repair guidance separate from enforcement

- **WHEN** a policy decision contains a suggested repair or validation command
- **THEN** the command MUST be represented as guidance
- **AND** the policy decision MUST NOT require the command to run before continuing the AI flow
