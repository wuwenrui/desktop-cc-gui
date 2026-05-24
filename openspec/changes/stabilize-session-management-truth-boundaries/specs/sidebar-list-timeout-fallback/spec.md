## ADDED Requirements

### Requirement: Sidebar Last-Good Snapshot MUST Be Persisted Per Engine Source

Sidebar last-good continuity MUST maintain health and snapshot eligibility per engine/source so a degraded refresh from one engine does not prevent healthy engines from updating their own last-good entries.

#### Scenario: one degraded engine does not block healthy engine snapshot
- **WHEN** a sidebar refresh returns degraded Claude evidence
- **AND** Codex or OpenCode returns healthy current entries in the same refresh
- **THEN** the system MUST be able to save healthy Codex or OpenCode entries as that engine's last-good snapshot
- **AND** Claude degraded evidence MUST NOT make the entire workspace list ineligible for last-good storage

#### Scenario: engine continuity reads its own snapshot first
- **WHEN** an engine subsource times out, rejects, or returns non-authoritative empty evidence
- **THEN** the continuity seed for that engine MUST prefer that engine's last healthy snapshot
- **AND** it MUST NOT depend on an unrelated engine's degraded or healthy state to decide whether the engine can be seeded

#### Scenario: authoritative removal still overrides engine snapshot
- **WHEN** a row is proven archived, hidden, deleted, control-plane filtered, or out of strict workspace scope by authoritative evidence
- **THEN** the engine-specific last-good snapshot MUST NOT resurrect that row
- **AND** the removal evidence MUST be applied before the row is seeded into the visible sidebar list
