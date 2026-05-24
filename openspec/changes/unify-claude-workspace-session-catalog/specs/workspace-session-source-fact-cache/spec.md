## ADDED Requirements

### Requirement: Workspace Session Source Fact Cache SHALL Be Read-Through Acceleration Only

Workspace session source fact cache SHALL accelerate bounded engine source fact reads without becoming the workspace session membership truth source.

#### Scenario: cache hit still runs ownership and projection
- **WHEN** a Claude transcript summary is served from source-fact cache
- **THEN** the backend MUST still run the current ownership resolver and catalog projection for the requested workspace scope
- **AND** it MUST NOT reuse cached final workspace membership as authoritative truth

#### Scenario: cache disabled falls back to direct scan
- **WHEN** source-fact cache is disabled, unavailable, or not configured
- **THEN** the backend MUST fall back to direct bounded source scanning
- **AND** default workspace membership semantics MUST remain the same aside from performance and degraded diagnostics

#### Scenario: cache does not store organization overlay
- **WHEN** the backend writes a source-fact cache entry
- **THEN** it MUST NOT store archive, folder assignment, custom title, display window, selected state, or processing state as cached source truth
- **AND** those overlays MUST be applied from their authoritative sources during catalog projection

### Requirement: Workspace Session Source Fact Cache SHALL Invalidate By Fingerprint And Version

Workspace session source fact cache SHALL use transcript file fingerprint and cache/schema versioning so stale facts do not masquerade as current session facts.

#### Scenario: changed transcript fingerprint triggers rescan
- **WHEN** a cached Claude transcript's physical path exists but its mtime, size, or equivalent fingerprint no longer matches the cache entry
- **THEN** the backend MUST treat the cache entry as stale
- **AND** it MUST rescan the transcript summary before returning source facts for catalog projection

#### Scenario: scanner or schema version mismatch triggers rebuild
- **WHEN** a cache entry was written with an incompatible scanner version, schema version, or cache namespace
- **THEN** the backend MUST ignore or rebuild that cache entry
- **AND** it MUST NOT use the stale entry to prove authoritative empty or deletion

#### Scenario: engine home change uses isolated namespace
- **WHEN** the effective Claude home or engine history root changes
- **THEN** the backend MUST use a distinct cache namespace or invalidate entries from the previous root
- **AND** sessions from the previous root MUST NOT appear in the current workspace projection solely because of cache reuse

### Requirement: Workspace Session Source Fact Cache SHALL Be Recoverable And Non-Authoritative

Workspace session source fact cache SHALL be treated as derived data that can be deleted, rebuilt, or bypassed without changing correctness semantics.

#### Scenario: corrupt cache entry degrades instead of clearing sessions
- **WHEN** the backend detects a corrupt or unreadable source-fact cache entry
- **THEN** it MUST ignore that entry and attempt direct scanning for the affected source
- **AND** it MUST NOT convert the corrupt cache state into authoritative empty membership

#### Scenario: deleting cache preserves rebuild path
- **WHEN** the user or system deletes the source-fact cache
- **THEN** the next catalog refresh MUST be able to rebuild source facts from engine disk history
- **AND** the rebuilt projection MUST follow the same ownership and membership rules as a warm cache projection

#### Scenario: cache excludes full transcript and large payloads
- **WHEN** the backend stores cached Claude source facts
- **THEN** it MUST store only bounded metadata, title evidence, file metadata, and diagnostics needed for catalog projection
- **AND** it MUST NOT store full transcript bodies, large inline media payloads, or control-plane payload text

### Requirement: Workspace Session Source Fact Cache SHALL Expose Diagnostics

Workspace session source fact cache SHALL expose cache hit, miss, stale, rebuild, and failure diagnostics without requiring frontend surfaces to parse low-level storage errors.

#### Scenario: cache miss remains explainable
- **WHEN** a catalog request falls back from cache miss to direct scan
- **THEN** the backend SHOULD expose cache miss or rebuild evidence in source diagnostics
- **AND** successful direct scan results MUST remain eligible for normal projection

#### Scenario: cache store failure is not fatal to listing
- **WHEN** reading or writing the source-fact cache fails
- **THEN** the backend MUST continue with direct scan when possible
- **AND** the response MUST expose degraded cache diagnostics if the failure affects completeness or latency

#### Scenario: cache metrics do not redefine session count
- **WHEN** the backend reports cache hit, miss, stale, or rebuild counts
- **THEN** those metrics MUST remain diagnostic
- **AND** they MUST NOT be used as workspace session totals or membership counts
