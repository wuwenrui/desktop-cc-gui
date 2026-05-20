## ADDED Requirements

### Requirement: Workspace Session Projection SHALL Carry Reconciliation Evidence

Shared workspace session projection MUST carry enough evidence for consumers to distinguish authoritative absence from degraded or inconsistent source state.

#### Scenario: omission is not deletion during degraded projection
- **WHEN** a projection response omits a session while any source is partial or degraded
- **THEN** consumers MUST NOT treat the omission alone as authoritative deletion
- **AND** stale continuity rows MAY remain marked degraded until authoritative evidence arrives

#### Scenario: missing-on-disk is authoritative cleanup evidence
- **WHEN** a catalog entry is returned with `missing-on-disk`
- **THEN** the management UI MAY offer metadata cleanup
- **AND** sidebar active projection MUST NOT show it as a live session

### Requirement: Projection Mutation Results SHALL Preserve Owner Routing

Archive, unarchive, delete and folder assignment responses MUST remain tied to the actual owner workspace used for mutation.

#### Scenario: project aggregate delete returns owner-aware results
- **WHEN** a project-scoped batch delete includes sessions from multiple child workspaces
- **THEN** each mutation result MUST be attributable to the owner workspace used for deletion
- **AND** frontend selection keys MUST remain stable for partial success handling
