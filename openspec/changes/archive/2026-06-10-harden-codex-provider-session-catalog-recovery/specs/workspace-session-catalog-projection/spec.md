## ADDED Requirements

### Requirement: Workspace Session Projection MUST Scan Managed Codex Provider Homes

Workspace session catalog projection MUST include Codex sessions stored under managed provider-scoped homes in addition to disk/default and workspace-resolved Codex homes.

#### Scenario: managed provider home session appears after restart

- **WHEN** a Codex session history exists under an app-local managed provider home such as `codex-provider-homes/<providerId>/sessions`
- **AND** the app restarts with no live Codex runtime for that provider
- **AND** the session belongs to the requested workspace by source ownership evidence
- **THEN** the workspace session catalog MUST include that Codex session in the active strict projection
- **AND** the row MUST expose provider profile id, source, name, and availability when that metadata can be resolved

#### Scenario: disk Codex scan behavior remains compatible

- **WHEN** a Codex session history exists under the disk/default or workspace-resolved Codex home
- **THEN** the workspace session catalog MUST continue to discover it through the existing disk scan behavior
- **AND** the row MUST remain compatible with the disk provider profile `__disk__`

#### Scenario: provider home scan does not leak sessions across workspaces

- **WHEN** a managed provider home contains Codex sessions for multiple workspaces
- **AND** the user requests a strict projection for one workspace
- **THEN** only sessions whose source ownership evidence belongs to the requested workspace scope MUST enter the projection
- **AND** the provider home id alone MUST NOT be treated as workspace membership proof

#### Scenario: provider binding metadata is overlay not membership proof

- **WHEN** catalog metadata contains a Codex provider binding for a session id
- **BUT** no disk or provider-home source can prove the session exists for the requested workspace
- **THEN** the provider binding MUST NOT by itself create an active catalog row
- **AND** the projection MAY expose missing-on-disk or metadata-cleanup evidence according to existing catalog rules

#### Scenario: unavailable provider-backed history remains visible

- **WHEN** a Codex session is discovered under a managed provider home or has persisted provider binding
- **AND** the referenced provider profile no longer exists
- **THEN** the catalog row MUST remain visible when source ownership is proven
- **AND** provider availability MUST be projected as unavailable
- **AND** the row MUST NOT be rewritten to the disk provider profile

### Requirement: Workspace Session Projection MUST Report Codex Provider Source Completeness

Workspace session catalog projection MUST expose enough Codex source completeness evidence for consumers to distinguish authoritative absence from incomplete provider-home scans.

#### Scenario: provider home scan failure is partial evidence

- **WHEN** one or more managed provider homes cannot be enumerated or scanned
- **THEN** the Codex source status MUST indicate partial or degraded provider-home coverage
- **AND** consumers MUST NOT treat omitted managed-provider sessions as authoritative deletions

#### Scenario: authoritative absence requires all relevant Codex roots

- **WHEN** the backend reports that a Codex session is absent from the requested workspace projection
- **THEN** that absence MAY be treated as authoritative only if disk/default roots, workspace-resolved roots, and relevant managed provider-home roots were scanned or otherwise proven complete for the requested scope

#### Scenario: source completeness remains engine-specific

- **WHEN** Codex provider-home scanning is partial or degraded
- **THEN** the projection MUST preserve that Codex-specific degraded evidence
- **AND** completeness of another engine source MUST NOT hide the incomplete Codex provider-home state

### Requirement: Projection Mutations MUST Resolve Provider-Home Codex Sessions

Workspace session catalog mutations MUST support Codex sessions whose physical source is a managed provider home.

#### Scenario: folder assignment targets provider-home session

- **WHEN** the user assigns a folder to a Codex session discovered from a managed provider home
- **THEN** the mutation MUST resolve the target by stable workspace, engine, session id, and provider/source evidence
- **AND** the durable folder assignment MUST apply to the same session after refresh or restart

#### Scenario: archive and delete target one provider-backed session

- **WHEN** the user archives or deletes a Codex session discovered from a managed provider home
- **THEN** the operation MUST target that session's catalog/disk artifact according to existing delete/archive semantics
- **AND** it MUST NOT delete or mutate the entire provider home

#### Scenario: unresolved provider mutation fails visibly

- **WHEN** a mutation targets a provider-backed Codex session but the backend cannot resolve the source or metadata target safely
- **THEN** the mutation MUST fail with a user-visible diagnostic
- **AND** it MUST NOT silently apply the mutation to a disk-profile session with the same id
