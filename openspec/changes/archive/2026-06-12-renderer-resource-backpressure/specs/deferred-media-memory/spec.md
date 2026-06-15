## ADDED Requirements

### Requirement: Deferred Media Object URLs MUST Be Owned And Released

Deferred media references that create object URLs or retain decoded buffers MUST be tracked by an owner collection and released when no longer needed.

#### Scenario: object URLs are revoked after lifecycle end

- **WHEN** a tracked deferred media element unmounts, is replaced, or is no longer visible under the documented lifecycle
- **THEN** its object URL MUST be revoked at a safe time
- **AND** retained buffer references MUST be released where the platform allows.

#### Scenario: release timing does not blank loaded media prematurely

- **WHEN** a tracked image or media element is still the active visible element
- **THEN** release logic MUST NOT revoke its object URL before the safe lifecycle point
- **AND** tests or manual evidence MUST cover the release timing.

#### Scenario: media references live in an owner collection

- **WHEN** a tracked media reference is created
- **THEN** it MUST be added to a `Set` or equivalent owner collection
- **AND** the collection MUST expose a release hook that revokes and removes entries.

#### Scenario: media memory budget is reported

- **WHEN** renderer diagnostics report media resource usage
- **THEN** the report MUST include active media count, revoked count, approximate retained bytes when available, and evidence class
- **AND** unsupported retained-byte measurement MUST be explicit rather than inferred.
