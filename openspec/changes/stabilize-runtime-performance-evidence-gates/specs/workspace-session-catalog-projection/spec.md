## ADDED Requirements

### Requirement: Session Catalog Stability Evidence MUST Preserve Bounded Projection Semantics

Session catalog stability evidence MUST evaluate scan, cursor, degraded-state, and compatibility behavior without changing membership truth.

#### Scenario: evidence report preserves degraded projection semantics
- **WHEN** session catalog evidence is summarized
- **THEN** degraded or partial projection states MUST remain visible
- **AND** the report MUST NOT treat omitted rows from degraded evidence as authoritative deletion proof

#### Scenario: compatibility list APIs remain diagnostic unless removed by change
- **WHEN** legacy or native list APIs are present for session continuity
- **THEN** reports MUST describe them as compatibility or diagnostic paths
- **AND** they MUST NOT be removed solely because the shared projection is the preferred membership truth
