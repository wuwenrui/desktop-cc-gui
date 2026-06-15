## ADDED Requirements

### Requirement: Codex Runtime Isolation Claims MUST Distinguish Provider Scope From Thread Process Scope
Codex runtime isolation claims MUST distinguish provider-scoped process/config isolation from per-thread process isolation.

#### Scenario: provider-scoped isolation is evaluated
- **WHEN** a change claims Codex runtime isolation for managed providers
- **THEN** the claim MUST be evaluated against provider-scoped `CODEX_HOME`, provider runtime key, persisted provider binding, and thread routing correctness
- **AND** it MUST NOT require one app-server process per thread unless a later behavior spec explicitly introduces that requirement

#### Scenario: per-thread process isolation is requested
- **WHEN** a user or artifact asks for per-thread Codex app-server process isolation
- **THEN** the system MUST treat it as a new behavior requirement requiring a separate proposal, design, risks, and validation plan
- **AND** it MUST NOT be retroactively treated as missing work for the existing provider-scoped runtime contract
