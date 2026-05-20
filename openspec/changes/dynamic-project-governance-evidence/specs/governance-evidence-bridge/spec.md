## ADDED Requirements

### Requirement: Governance Bridge MUST Use Profile-Aware Adapter Selection
The governance evidence bridge MUST select evidence adapters using `ProjectGovernanceProfile` applicability instead of a globally fixed harness checklist. Existing evidence readers MAY remain as implementation helpers, but they MUST be invoked only through applicable adapters or an equivalent profile-aware selection layer.

#### Scenario: global harness script list is not treated as universal
- **WHEN** a workspace does not expose harness governance scripts
- **THEN** the bridge MUST NOT emit a generic harness script evidence row solely because the product knows about mossx harness scripts

#### Scenario: applicable harness adapter preserves current mossx behavior
- **WHEN** a workspace profile detects mossx-style harness scripts and workflows
- **THEN** the bridge MAY emit harness script, workflow, and artifact evidence
- **AND** that evidence MUST continue to use the canonical `GovernanceEvidence` substrate

#### Scenario: adapter selection is deterministic
- **WHEN** the same profile and file contents are collected twice
- **THEN** the selected adapter list and emitted evidence ids MUST be deterministic

### Requirement: Governance Bridge MUST Merge Auto Profile And Optional Config Deterministically
The governance evidence bridge MUST merge automatically detected profile facts and optional `governance.config.json` override facts before adapter selection. Merge order and conflict resolution MUST be deterministic.

#### Scenario: config overrides OpenSpec root
- **WHEN** auto detection finds `openspec/`
- **AND** valid config declares `openspec.root` as `specs`
- **THEN** OpenSpec evidence MUST use the configured root
- **AND** the evidence row MUST preserve enough source metadata to explain that config influenced the root

#### Scenario: config can mark detected script as required
- **WHEN** auto detection finds a package script
- **AND** config marks that script as required
- **THEN** missing result artifacts for that script's declared gate MAY produce degraded evidence
- **AND** the required semantics MUST NOT apply to unrelated projects without that config or detected script

#### Scenario: malformed config does not suppress auto adapters
- **WHEN** config parsing fails
- **THEN** the bridge MUST emit config-degraded evidence
- **AND** adapters that apply from auto profile facts MUST still collect evidence

### Requirement: Non-Applicable Capabilities MUST Not Become Unknown Evidence
The bridge MUST distinguish non-applicable governance capabilities from missing evidence. Non-applicable capabilities MUST be omitted, while missing evidence for applicable capabilities MUST be emitted as degraded or unknown evidence.

#### Scenario: no OpenSpec workspace omits OpenSpec evidence
- **WHEN** a workspace has no OpenSpec directory or configured external OpenSpec workspace
- **THEN** the bridge MUST omit OpenSpec task evidence

#### Scenario: malformed OpenSpec workspace emits degraded evidence
- **WHEN** a workspace has OpenSpec task files but they cannot be parsed
- **THEN** the bridge MUST emit degraded OpenSpec evidence with a parse failure reason

### Requirement: Evidence Rows SHOULD Carry Action Metadata For Non-Pass States
Governance evidence emitted with `warn`, `fail`, `unknown`, stale, or degraded state MUST expose enough metadata for UI consumers to render impact and suggested action without hard-coding source-specific copy in the component.

#### Scenario: missing artifact evidence includes suggested command metadata
- **WHEN** an applicable artifact-backed gate is missing its result artifact
- **THEN** the evidence MUST identify the artifact path
- **AND** the evidence MUST expose a suggested validation command when one is known

#### Scenario: stale evidence includes freshness metadata
- **WHEN** artifact-backed evidence is stale
- **THEN** the evidence MUST include observed time or stale time metadata
- **AND** UI consumers MUST be able to render the stale reason without re-reading the artifact

### Requirement: Bridge Conformance MUST Guard Against Product-Specific Global Evidence Lists
The governance evidence bridge conformance check MUST fail when a new globally fixed product-specific evidence list is introduced without an applicability gate.

#### Scenario: hard-coded product-only adapter without appliesTo fails conformance
- **WHEN** a contributor adds a product-specific evidence adapter or known script list
- **AND** the adapter can emit evidence without checking `ProjectGovernanceProfile`
- **THEN** the conformance check MUST fail

#### Scenario: profile-scoped product adapter passes conformance
- **WHEN** a product-specific adapter declares and tests an applicability predicate
- **THEN** the conformance check MAY pass if non-applicable fixture profiles emit no rows from that adapter
