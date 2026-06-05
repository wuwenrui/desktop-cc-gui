## ADDED Requirements

### Requirement: Workspace Session Projection SHALL Accept Attribution Mode

Workspace session projection SHALL accept workspace session attribution mode as an explicit all-engine membership resolver input.

#### Scenario: projection request carries attribution mode
- **WHEN** frontend requests workspace session catalog, default sidebar hydration, Workspace Home membership, or Session Management active workspace view
- **THEN** the request SHALL carry the effective workspace session attribution mode
- **AND** backend projection SHALL use that mode when resolving membership for every participating engine

#### Scenario: missing mode preserves compatibility
- **WHEN** a caller omits workspace session attribution mode
- **THEN** backend projection SHALL treat the request as `related`
- **AND** existing callers SHALL keep current behavior until they are migrated to pass the setting explicitly

### Requirement: Related Attribution Mode SHALL Preserve Existing Projection Semantics

`related` attribution mode SHALL preserve current workspace session projection semantics for all engines, including broad Claude related discovery.

#### Scenario: related mode keeps global Claude candidate discovery
- **WHEN** projection runs in `related` mode
- **THEN** Claude history listing MAY scan current workspace Claude project dirs and other Claude project dirs
- **AND** transcript `cwd`, workspace path, git root, and existing related attribution evidence MAY be used according to current behavior

#### Scenario: related mode keeps non-Claude engine discovery
- **WHEN** projection runs in `related` mode
- **THEN** Codex, Gemini, OpenCode, and future engine discovery SHALL keep their current related-mode behavior
- **AND** the new workspace-only strategy SHALL NOT narrow their related-mode candidate sets

#### Scenario: related mode keeps current tests meaningful
- **WHEN** existing tests assert that a Claude transcript from an unrelated project dir is visible because its `cwd` matches the current workspace scope
- **THEN** those tests SHALL remain valid for `related` mode
- **AND** `workspace-only` tests SHALL be added separately instead of changing the related expectation

### Requirement: Workspace-Only Attribution Mode SHALL Prevent Cross-Project Claude Membership

`workspace-only` attribution mode SHALL prevent Claude sessions from other workspace scopes from entering the current workspace membership through broad scan or related attribution.

#### Scenario: unrelated Claude project dir is excluded
- **GIVEN** current workspace path is `/projects/app`
- **AND** a Claude session file is located under another known workspace's Claude project dir
- **WHEN** projection runs in `workspace-only` mode for `/projects/app`
- **THEN** that session SHALL NOT appear in `/projects/app` membership solely because broad related discovery found it

#### Scenario: conflicting project dir owner is excluded
- **GIVEN** current workspace path is `/projects/app`
- **AND** a Claude session file is located under another known workspace's Claude project dir
- **AND** the same transcript `cwd` is `/projects/app/src`
- **WHEN** projection runs in `workspace-only` mode for `/projects/app`
- **THEN** the projection SHALL NOT include that transcript as `/projects/app` membership
- **AND** the projection SHALL expose conflict diagnostics or exclude the candidate without silently guessing ownership

#### Scenario: shared worktree family does not widen workspace-only membership
- **GIVEN** a Claude session is owned by a parent workspace or sibling worktree outside the requested workspace scope
- **WHEN** projection runs in `workspace-only` mode for the selected workspace
- **THEN** shared worktree family or sibling relationship SHALL NOT add that session to the selected workspace membership

#### Scenario: git-root inference does not widen workspace-only membership
- **GIVEN** a Claude transcript `cwd` is outside the selected workspace path
- **AND** it only matches the selected workspace through git-root or related inference
- **WHEN** projection runs in `workspace-only` mode
- **THEN** the projection SHALL NOT include that transcript as selected workspace membership

### Requirement: Workspace-Only Attribution Mode SHALL Preserve Current Workspace Child Cwd Sessions

`workspace-only` attribution mode SHALL keep Claude sessions whose transcript `cwd` is the current workspace path or a child path inside the current workspace scope.

#### Scenario: exact workspace cwd remains visible
- **GIVEN** current workspace path is `/projects/app`
- **AND** a Claude transcript `cwd` is `/projects/app`
- **WHEN** projection runs in `workspace-only` mode
- **THEN** the session SHALL remain eligible for current workspace membership

#### Scenario: child workspace cwd remains visible
- **GIVEN** current workspace path is `/projects/app`
- **AND** a Claude transcript `cwd` is `/projects/app/src`
- **WHEN** projection runs in `workspace-only` mode
- **THEN** the session SHALL remain eligible for current workspace membership
- **AND** the projection SHALL NOT require `cwd` to equal the workspace path exactly

#### Scenario: child Claude project dir remains visible
- **GIVEN** current workspace path is `/projects/app`
- **AND** a Claude session file is located under a Claude project dir representing `/projects/app/src`
- **AND** its transcript `cwd` is `/projects/app/src`
- **WHEN** projection runs in `workspace-only` mode for `/projects/app`
- **THEN** the session SHALL remain eligible for current workspace membership
- **AND** workspace-only scanning SHALL NOT be limited to only the exact `/projects/app` Claude project dir

#### Scenario: global unrelated project dirs are not scanned for workspace-only membership
- **GIVEN** current workspace path is `/projects/app`
- **AND** Claude history contains project dirs for `/projects/app`, `/projects/app/src`, and `/projects/other`
- **WHEN** projection runs in `workspace-only` mode for `/projects/app`
- **THEN** scanning for membership SHALL include `/projects/app` and `/projects/app/src` candidate dirs
- **AND** scanning for membership SHALL NOT include `/projects/other` solely because it exists under Claude history root

### Requirement: Workspace-Only Projection SHALL Keep Source Status Mode-Aware

Workspace session projection SHALL expose source completeness and diagnostics according to the requested attribution mode.

#### Scenario: workspace-only empty is scoped to workspace-only coverage
- **WHEN** Claude scanning proves no sessions for `workspace-only` mode
- **THEN** the projection SHALL expose authoritative empty evidence only for that mode and requested workspace scope
- **AND** that evidence SHALL NOT be reused to prove empty related-mode membership

#### Scenario: related scan cap does not define workspace-only completeness
- **WHEN** a previous or parallel `related` scan is capped, partial, or degraded
- **THEN** a `workspace-only` projection SHALL NOT treat that related status as its own authoritative completeness result
- **AND** it SHALL expose its own mode-specific source status

### Requirement: Workspace-Only Projection SHALL Use Independent Engine Strategies

Workspace-only projection SHALL use independent engine listing and attribution strategies instead of executing related-mode discovery and filtering its output.

#### Scenario: workspace-only does not invoke related scanner as implementation
- **WHEN** projection runs in `workspace-only` mode
- **THEN** backend SHALL use workspace-only engine strategies for candidate discovery
- **AND** backend SHALL NOT call the existing related scanner/listing pipeline as the implementation source for workspace-only membership

#### Scenario: related branch remains zero-diff
- **WHEN** projection runs in `related` mode
- **THEN** backend SHALL execute the existing related behavior path
- **AND** workspace-only code SHALL NOT change related-mode scan order, candidate set, attribution reasons, source status, or pagination behavior

### Requirement: Workspace-Only Projection SHALL Reconcile All Engine Adapters

Workspace-only projection SHALL reconcile all engine adapter outputs through the shared mode-aware membership resolver.

#### Scenario: all-engine workspace-only membership is scoped
- **WHEN** projection runs in `workspace-only` mode for a selected workspace
- **THEN** Claude, Codex, Gemini, OpenCode, and future engine sessions SHALL be admitted only when their engine evidence belongs to the selected workspace scope
- **AND** engine-specific native listing SHALL NOT directly widen selected workspace membership

#### Scenario: engine-specific ambiguity is fail-closed
- **WHEN** an engine candidate has conflicting or ambiguous workspace ownership evidence under `workspace-only`
- **THEN** the projection SHALL exclude it from selected workspace membership or expose conflict diagnostics
- **AND** it SHALL NOT silently choose a workspace owner through related-mode inference
