## ADDED Requirements

### Requirement: Source Fact Cache SHALL Separate Attribution Mode Completeness

Workspace session source fact cache SHALL NOT reuse attribution-mode-specific completeness or membership evidence across `related` and `workspace-only` requests.

#### Scenario: cached source fact still runs mode-aware projection
- **WHEN** a Claude source fact is served from cache
- **THEN** backend SHALL still run the workspace session projection using the current attribution mode
- **AND** cached facts SHALL NOT include final workspace membership that bypasses the mode-aware resolver

#### Scenario: related cache does not prove workspace-only empty
- **WHEN** a `related` mode scan result is cached
- **AND** a later request uses `workspace-only` mode
- **THEN** the backend SHALL NOT use the related cached completeness result to prove workspace-only authoritative empty
- **AND** it SHALL evaluate workspace-only coverage or expose degraded/partial evidence

#### Scenario: workspace-only cache does not shrink related mode
- **WHEN** a `workspace-only` request caches a narrow candidate set or source status
- **AND** a later request uses `related` mode
- **THEN** the backend SHALL NOT use the workspace-only cached status to narrow related discovery
- **AND** related mode SHALL keep its broader candidate semantics

### Requirement: Source Fact Cache Namespace SHALL Include Effective Scan Scope Evidence

Workspace session source fact cache namespace or cache lookup condition SHALL include all inputs that affect scan coverage or source completeness.

#### Scenario: attribution scope changes cache namespace
- **WHEN** effective Claude home, workspace path, git root scope, attribution mode, or scan coverage semantics change
- **THEN** the cache namespace or lookup condition SHALL prevent stale completeness evidence from the previous scope from being reused as current scope truth
- **AND** direct scan or mode-appropriate rebuild SHALL remain available

#### Scenario: transcript metadata may be reused without membership truth
- **WHEN** cached transcript metadata is independent of workspace membership
- **THEN** backend MAY reuse that metadata for performance
- **AND** membership, authoritative empty, scan cap, and completeness conclusions SHALL still be recomputed or validated for the requested attribution mode
