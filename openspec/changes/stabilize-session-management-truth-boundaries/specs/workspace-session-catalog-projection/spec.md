## ADDED Requirements

### Requirement: Workspace Session Projection MUST Preserve Non-Authoritative Source Status

Workspace session catalog projection MUST NOT report an engine/source as complete when the source was bounded, capped, timed out, cache-degraded, or otherwise unable to prove the requested scope was fully covered.

#### Scenario: bounded scan cap prevents complete status
- **WHEN** an engine source returns one or more rows from a bounded scan
- **AND** the scan reaches the documented cap or lookahead limit before completeness can be proven
- **THEN** the source status MUST be `partial`, `degraded`, `uncertain_empty`, or an equivalent non-authoritative status
- **AND** the response MUST expose cap evidence such as `scanCapReached`, `scannedCandidates`, `reason`, or equivalent diagnostics

#### Scenario: non-authoritative source cannot prove deletion or empty membership
- **WHEN** a source status is partial, degraded, capped, timed out, or uncertain
- **THEN** dependent surfaces MUST NOT treat omitted sessions as deleted, archived, or out of scope
- **AND** continuity rows MAY be preserved with degraded evidence until authoritative source truth is available

#### Scenario: complete status requires coverage proof
- **WHEN** the catalog reports an engine source as complete for a workspace scope
- **THEN** the backend MUST have proof that the source was reachable, not capped, not timed out, and fully evaluated for the requested scope/filter
- **AND** frontend surfaces MAY use that complete status as authoritative empty or authoritative omission evidence

### Requirement: Workspace Session Projection MUST Bound Archived Evidence

Archived evidence used by sidebar or workspace surfaces MUST be acquired through bounded requests, backend-provided archive metadata evidence, or an equivalent finite contract; failure to acquire archived evidence MUST be exposed as degraded rather than interpreted as no archived sessions.

#### Scenario: archived lookup failure is degraded evidence
- **WHEN** a sidebar refresh needs archived metadata to filter last-good continuity rows
- **AND** the archived evidence lookup times out, fails, or cannot prove completeness
- **THEN** the refresh MUST expose archived evidence as degraded or uncertain
- **AND** it MUST NOT interpret the failure as an empty archived map

#### Scenario: archived row is not resurrected by missing archive evidence
- **WHEN** a row is known archived from current projection, authoritative native source, or previous complete archive evidence
- **AND** a later archived evidence lookup is partial, degraded, or failed
- **THEN** sidebar continuity MUST NOT resurrect that archived row as active
- **AND** the UI MUST keep enough degraded evidence to explain why archived truth is incomplete

#### Scenario: archived evidence does not require full catalog exhaustion
- **WHEN** a workspace has more archived or active sessions than the sidebar display window
- **THEN** archived evidence collection for a regular sidebar refresh MUST remain bounded
- **AND** full archive exploration MUST be reserved for Session Management or global history pagination surfaces

### Requirement: Workspace Session Projection MUST Use Stable Continuation Cursors

Workspace session catalog pagination MUST use a stable continuation cursor or equivalent anchor-based model instead of relying solely on mutable list offsets.

#### Scenario: cursor chain survives new session insertion
- **WHEN** a caller reads the first page of a sorted catalog result
- **AND** a newer session is inserted before the caller requests the next page with the returned cursor
- **THEN** the next page MUST NOT skip existing entries that belonged after the original page anchor
- **AND** it MUST NOT duplicate entries already returned in the same cursor chain

#### Scenario: cursor encodes stable ordering anchor
- **WHEN** the backend returns `nextCursor`
- **THEN** the cursor MUST encode or reference stable ordering evidence such as updated timestamp, stable session identity, owner workspace, and filter context
- **AND** callers MUST treat the cursor as opaque

#### Scenario: legacy offset cursor remains compatibility only
- **WHEN** a caller passes an old offset-style cursor
- **THEN** the backend MAY accept it for compatibility
- **AND** any new `nextCursor` returned by the backend SHOULD use the stable cursor format
