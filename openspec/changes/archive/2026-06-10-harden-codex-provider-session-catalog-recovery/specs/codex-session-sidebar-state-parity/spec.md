## ADDED Requirements

### Requirement: Codex Sidebar MUST Preserve Provider-Backed Sessions Across Refresh And Restart

Codex sidebar and recent conversation surfaces MUST treat provider-backed workspace catalog rows as first-class sessions, not as creation-time-only frontend overlays.

#### Scenario: provider-backed row survives app restart

- **WHEN** the user creates a Codex session with a managed provider
- **AND** the app restarts or the frontend loses in-memory reducer state
- **AND** the workspace catalog returns that session from a provider home scan
- **THEN** the sidebar MUST render the session row
- **AND** the row MUST show provider metadata from catalog/thread fields rather than a global active provider state

#### Scenario: degraded provider source does not erase last-good row

- **WHEN** a previously visible managed-provider Codex session is omitted from a later refresh
- **AND** the backend marks Codex provider-home source coverage as partial or degraded
- **THEN** the sidebar MUST NOT treat the omission alone as authoritative deletion
- **AND** it MAY preserve the last-good row with degraded or continuity-preserved state until authoritative evidence arrives

#### Scenario: authoritative provider source absence may remove row

- **WHEN** backend catalog evidence proves the provider-backed Codex session no longer exists or no longer belongs to the requested workspace scope
- **AND** provider-home source coverage for the relevant scope is authoritative
- **THEN** the sidebar MAY remove the row
- **AND** it MUST NOT keep the row indefinitely as a ghost session

#### Scenario: provider label is preserved through catalog refresh

- **WHEN** a Codex sidebar row is rebuilt from catalog data after refresh or restart
- **THEN** provider label and unavailable-provider state MUST derive from `providerProfileId`, `providerProfileName`, and `providerAvailability`
- **AND** the row MUST NOT fall back to disk label unless the catalog identifies the session as disk profile
