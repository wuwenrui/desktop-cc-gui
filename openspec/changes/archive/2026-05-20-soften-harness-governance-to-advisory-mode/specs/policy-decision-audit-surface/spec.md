## ADDED Requirements

### Requirement: Audit Surface MUST Visually Distinguish Advisory Signals From Blocking Failures

The checkpoint audit surface MUST render advisory governance signals with distinct non-fatal wording and visual treatment. It MUST reserve blocking language and fatal visual severity for actual `blocked` contributions from existing hard-failure policy paths.

#### Scenario: advisory row does not use fatal language

- **WHEN** an audit row represents a governance policy contribution below `blocked`
- **THEN** the row MUST use advisory or review-oriented wording
- **AND** it MUST NOT describe the signal as blocked, fatal, or execution-stopping

#### Scenario: blocking row remains explicit

- **WHEN** an audit row represents an actual `blocked` contribution from an existing hard-failure policy path
- **THEN** the row MUST remain clearly distinguishable from advisory rows
- **AND** users MUST be able to identify which policy created the blocking contribution

### Requirement: Audit Surface MUST Expose Evidence Trail Without Adding Enforcement

The audit surface MUST make evidence provenance inspectable for advisory governance signals without adding persistence, command execution, or automatic enforcement.

#### Scenario: advisory row exposes evidence source

- **WHEN** an advisory governance policy decision references a source id, evidence snapshot id, observed time, artifact path, artifact hash, or qualifier
- **THEN** the audit/checkpoint detail surface MUST render or expose the source relationship and provenance
- **AND** the surface MUST allow users to understand where the signal came from

#### Scenario: audit suggested action is not enforcement

- **WHEN** an audit row includes a suggested validation or recovery action
- **THEN** the action MUST be presented as optional guidance
- **AND** rendering the action MUST NOT change the checkpoint verdict to `blocked`
- **AND** rendering the action MUST NOT execute shell commands or filesystem mutations

## MODIFIED Requirements

### Requirement: Audit Surface MUST Preserve Existing Checkpoint Behavior

Adding or reshaping the audit surface MUST NOT change existing checkpoint verdict calculation or next-action text. Dock, popover, and compact hosts MUST preserve equivalent audit signal semantics, but compact hosts MAY summarize advisory audit rows instead of rendering every row by default.

#### Scenario: existing checkpoint tests still pass

- **WHEN** existing StatusPanel and checkpoint tests run
- **THEN** existing verdict and next-action assertions MUST remain valid

#### Scenario: dock and popover preserve audit signal parity

- **WHEN** dock and popover hosts receive the same `policyAudit`
- **THEN** both hosts MUST preserve the same blocking presence, advisory presence, highest advisory level, and source relationship
- **AND** dock expanded view MAY render the full audit rows
- **AND** popover or compact hosts MAY render an advisory summary instead of every row by default
- **AND** compact summaries MUST NOT imply that governance evidence is clean merely because full rows are hidden

#### Scenario: compact audit summary has an expansion path

- **WHEN** compact hosts summarize advisory audit rows
- **THEN** the user MUST have an available path to inspect full audit details through dock expansion or an equivalent detail surface
- **AND** summarizing audit rows MUST NOT change the checkpoint verdict
