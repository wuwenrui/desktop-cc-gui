## ADDED Requirements

### Requirement: Claude Sidebar Display MUST Be Produced By Stable Session Projection

Claude sidebar display rows MUST be derived through a stable projection step that compares source candidates by canonical identity, title confidence, and membership evidence rather than by source arrival order alone.

#### Scenario: weaker generic row cannot replace stable projection
- **WHEN** the projection already has a Claude row with a meaningful mapped, custom, native, or first-user title
- **AND** a later source candidate for the same canonical session only contains a weak generic title such as `Agent N` or `Claude Session`
- **THEN** the projected sidebar row MUST keep the stronger title
- **AND** the weak generic title MUST NOT become the visible row name

#### Scenario: incomplete refresh cannot delete last-good projection
- **WHEN** a Claude source reports timeout, error, startup partial, catalog partial, or equivalent incomplete membership evidence
- **AND** the projection has last-good in-scope Claude rows
- **THEN** the projected sidebar MUST preserve those rows
- **AND** the incomplete source MUST NOT be treated as authoritative proof that the rows no longer exist

#### Scenario: authoritative removal still wins over projection continuity
- **WHEN** a Claude row is archived, hidden, explicitly deleted, not found by authoritative native truth, control-plane filtered, or proven out of workspace scope
- **THEN** the projection MUST remove or suppress that row
- **AND** last-good continuity MUST NOT resurrect it

#### Scenario: ambiguous pending finalization does not create generic duplicate
- **WHEN** a Claude pending session is finalizing into a native session id
- **AND** the frontend cannot yet prove which pending row should be aliased to the finalized id
- **THEN** the sidebar projection MUST NOT create an additional visible finalized row named only by an ordinal fallback such as `Agent N`
- **AND** the row MUST become visible through explicit alias evidence or meaningful native session truth
