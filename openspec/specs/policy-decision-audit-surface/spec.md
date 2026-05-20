# policy-decision-audit-surface Specification

## Purpose

Defines the inline checkpoint policy decision audit surface contract.

## Requirements

### Requirement: Checkpoint Audit Surface MUST Explain The Current Verdict Inline

The audit surface MUST render inside the existing `CheckpointPanel` and MUST explain the current verdict from the existing `StatusPanelData.policyAudit` projection.

#### Scenario: audit section is inline and collapsed by default

- **WHEN** `CheckpointPanel` renders with `policyAudit` entries
- **THEN** the verdict badge and next action remain visible
- **AND** the audit section is available inside `CheckpointPanel`
- **AND** the audit section is collapsed by default

#### Scenario: no separate audit tab is created

- **WHEN** StatusPanel tabs are enumerated
- **THEN** no dedicated audit tab MUST be added by this capability

### Requirement: Audit Surface MUST Render Policy Contributions Defensively

Each rendered policy row MUST show the policy id, verdict contribution, reason text when available, and source id when available. The renderer MUST NOT assume an evidence payload exists on `PolicyDecision`.

#### Scenario: every current policy decision is rendered

- **WHEN** the audit section is expanded
- **THEN** each current `policyAudit` entry MUST be represented by one row
- **AND** each row MUST include policy id and contribution
- **AND** each row SHOULD include reason and source id when available

#### Scenario: incomplete policy decision does not crash the panel

- **WHEN** a policy decision has `reasonKey: null`, `sourceId: null`, or `verdictContribution: "no_contribution"`
- **THEN** the audit panel MUST render a safe fallback label
- **AND** no exception MUST be thrown

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

### Requirement: Audit Surface MUST Not Persist, Export, Or Repair

This capability MUST be read-only for the current verdict. It MUST NOT introduce localStorage history, JSON export, telemetry, or repair actions.

#### Scenario: no audit persistence is introduced

- **WHEN** this capability is implemented
- **THEN** it MUST NOT write audit entries to localStorage, IndexedDB, or filesystem storage

#### Scenario: no repair action is introduced

- **WHEN** audit rows are rendered
- **THEN** they MUST NOT trigger policy repair actions from this capability

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

### Requirement: Audit Surface MUST Preserve Governance Workflow Gates And Three-Platform Compatibility

The implementation MUST remain compatible with large-file governance and the final harness-wide noise sentry, and MUST be portable across Linux, macOS, and Windows.

#### Scenario: full noise sentry is deferred to integration closure

- **WHEN** this capability is implemented
- **THEN** full noise sentry execution MAY be deferred to final harness-wide integration closure

#### Scenario: large file governance gate remains compatible

- **WHEN** this capability is implemented
- **THEN** `node --test scripts/check-large-files.test.mjs` MUST pass
- **AND** `npm run check:large-files:near-threshold` MUST pass without hard failures
- **AND** `npm run check:large-files:gate` MUST pass

#### Scenario: rendering tests are three-platform safe

- **WHEN** tests and snapshots are added
- **THEN** they MUST avoid OS-specific path separators, case-sensitive filename assumptions, and CRLF/LF fragile assertions
