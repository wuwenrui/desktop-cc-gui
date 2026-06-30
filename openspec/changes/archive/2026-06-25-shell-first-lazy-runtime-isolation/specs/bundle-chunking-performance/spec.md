## ADDED Requirements

### Requirement: Lazy Boundaries MUST Include Lazy Compute Evidence
Heavy optional surface lazy boundaries SHALL prove both startup import isolation and inactive compute isolation where the surface has expensive projections.

#### Scenario: Lazy import does not imply lazy compute
- **WHEN** a heavy optional surface is moved behind a `React.lazy` or dynamic import boundary
- **THEN** the implementation MUST also identify whether parent hooks still compute heavy data for that surface
- **AND** startup or runtime notes MUST NOT describe the surface as fully isolated if hidden heavy compute still runs

#### Scenario: Inactive compute gate is reviewable
- **WHEN** a heavy optional surface has expensive dataset, projection, hydration, or render-weight work
- **THEN** the implementation MUST include an activation guard, selector, or equivalent lazy compute boundary
- **AND** focused tests SHOULD prove hidden realtime updates do not trigger that heavy work
