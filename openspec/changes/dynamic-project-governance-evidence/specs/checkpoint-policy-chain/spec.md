## ADDED Requirements

### Requirement: Dynamic Governance Policies MUST Ignore Non-Applicable Capabilities
Checkpoint governance policies MUST consume only evidence emitted by applicable adapters. A capability that is absent because it is non-applicable to the current project profile MUST contribute `no_contribution` and MUST NOT create a checkpoint warning or blocker.

#### Scenario: absent non-applicable evidence does not affect verdict
- **WHEN** a Python workspace has no harness large-file evidence because the adapter is non-applicable
- **THEN** the large-file governance policy MUST contribute `no_contribution`
- **AND** the final checkpoint verdict MUST NOT change because of that absent harness evidence

#### Scenario: missing applicable artifact remains advisory
- **WHEN** a mossx-like workspace declares an applicable large-file gate
- **AND** the large-file result artifact is missing
- **THEN** the large-file governance policy MAY contribute at most `needs_review`
- **AND** it MUST NOT contribute `blocked`

### Requirement: Dynamic Governance Policy Audit MUST Preserve Applicability Context
Policy audit rows produced from dynamic governance evidence MUST preserve enough context to explain why a policy contributed or did not contribute.

#### Scenario: advisory evidence includes profile-derived source context
- **WHEN** a dynamic governance policy contributes from evidence selected by profile-aware adapter applicability
- **THEN** the audit row MUST identify the evidence source
- **AND** it MUST expose artifact path, observed time, qualifier, or degradation reason when available

#### Scenario: no contribution does not invent evidence
- **WHEN** a policy has no applicable evidence for the current project profile
- **THEN** the audit trail MUST NOT invent a missing evidence row
- **AND** UI consumers MUST NOT display a repair action for a non-applicable capability
