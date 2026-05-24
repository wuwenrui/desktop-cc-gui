## ADDED Requirements

### Requirement: Session Management SHALL Use Stable Engine Owner Session Keys

Session management metadata and mutation results SHALL identify sessions with a stable key that includes engine, owner workspace, and canonical session identity rather than relying only on a bare session id.

#### Scenario: folder assignment does not collide across owners
- **GIVEN** two workspaces contain sessions with the same bare session id
- **WHEN** one session is assigned to a folder
- **THEN** the assignment MUST apply only to the matching engine, owner workspace, and canonical session id
- **AND** the other workspace session MUST remain unassigned

#### Scenario: archive metadata does not prove existence
- **GIVEN** archive metadata exists for a Claude session key
- **WHEN** the engine disk source no longer contains that session
- **THEN** Session Management MUST treat the metadata as organization state or orphan cleanup evidence
- **AND** it MUST NOT present the metadata alone as proof that the Claude session exists

#### Scenario: mutation result returns actual owner
- **WHEN** a project-level mutation targets a Claude session owned by a child workspace
- **THEN** the mutation result MUST identify the owner workspace used for routing
- **AND** frontend selection cleanup MUST use the stable session key from the result

#### Scenario: new metadata writes use stable key
- **WHEN** Session Management writes archive, folder, or custom-title metadata for a Claude session
- **THEN** it MUST write the metadata under the stable engine-owner-session key
- **AND** it MAY continue reading legacy bare session id metadata only for backward compatibility

#### Scenario: stable key migration does not create duplicate organization rows
- **GIVEN** legacy bare session id metadata and new stable-key metadata both refer to the same Claude disk fact
- **WHEN** Session Management builds the catalog entry
- **THEN** it MUST merge them into one organized session row
- **AND** it MUST prefer the stable-key metadata for future mutation results

### Requirement: Session Management SHALL Separate Claude Disk Facts From Metadata Overlay

Session Management SHALL derive Claude existence, timestamps, cwd, transcript path, and parent relationship from Claude disk facts before applying archive, folder, and custom-title metadata.

#### Scenario: Claude transcript produces source facts before overlay
- **WHEN** a Claude transcript file exists on disk and contains usable session metadata
- **THEN** the backend MUST produce a Claude source fact entry with canonical session identity and physical evidence
- **AND** archive, folder, and title metadata MUST be applied after that fact entry is built

#### Scenario: metadata orphan is cleanup candidate
- **GIVEN** folder or archive metadata references a Claude stable session key
- **AND** no matching Claude disk fact can be found after an authoritative scan
- **WHEN** the user views a management surface that exposes inconsistencies
- **THEN** the row MUST be marked as missing on disk or metadata orphaned
- **AND** delete or cleanup MUST remove the organization metadata without requiring a physical transcript delete

#### Scenario: incomplete Claude scan does not create orphan proof
- **WHEN** Claude scanning is partial, degraded, or uncertain
- **THEN** the absence of a matching disk fact MUST NOT be treated as authoritative orphan proof
- **AND** Session Management MUST avoid offering destructive cleanup as if the transcript were proven missing

### Requirement: Session Management SHALL Use One Workspace Ownership Resolver

Session Management SHALL use one backend ownership resolver for Claude workspace attribution across Settings, Sidebar projection, and Workspace Home projection.

#### Scenario: child cwd wins over parent cwd prefix
- **GIVEN** a parent workspace path `/repo`
- **AND** a child worktree path `/repo/sub`
- **AND** a Claude transcript reports `cwd=/repo/sub`
- **WHEN** the backend resolves ownership
- **THEN** the session MUST be owned by the child worktree
- **AND** it MUST NOT be owned by the parent merely because the parent path is a prefix

#### Scenario: Claude project directory can fallback when cwd is missing
- **GIVEN** a Claude transcript lacks usable cwd
- **AND** its Claude project directory directly maps to a known workspace path
- **WHEN** the backend resolves ownership
- **THEN** the resolver MAY attribute the session to that workspace
- **AND** the attribution evidence MUST indicate that project-directory fallback was used

#### Scenario: ambiguous siblings do not pick arbitrary owner
- **GIVEN** a Claude transcript can match multiple sibling workspaces with equal confidence
- **WHEN** the backend resolves ownership
- **THEN** it MUST return ambiguous or unresolved ownership
- **AND** it MUST NOT silently choose a sibling or parent as the owner

#### Scenario: conflicting ownership evidence blocks metadata mutation
- **GIVEN** a Claude transcript has conflicting cwd and Claude project directory ownership evidence
- **WHEN** a caller attempts to archive, move, delete, or rename that session through Session Management
- **THEN** the mutation MUST fail with an unresolved-owner error
- **AND** Session Management MUST NOT write archive, folder, delete, or custom-title metadata into any guessed owner workspace

#### Scenario: project aggregate mutation routes by row owner
- **GIVEN** a main workspace project aggregate includes a Claude row owned by a child worktree
- **WHEN** the user archives, unarchives, deletes, moves, or renames that row
- **THEN** Session Management MUST route the mutation by the row's owner workspace and stable session key
- **AND** it MUST NOT route by the currently selected main workspace merely because the row appears in the aggregate
