## ADDED Requirements

### Requirement: Long-Lived Renderer Listeners And Polling MUST Declare Lifecycle Owners

Long-lived renderer listeners, polling loops, intervals, animation frames, and Tauri subscriptions MUST declare lifecycle ownership for migrated surfaces, and inactive owners MUST clean up their subscriptions.

#### Scenario: migrated listener owner is declared

- **WHEN** a migrated surface registers a long-lived listener, interval, polling loop, animation frame, or Tauri subscription
- **THEN** the registration MUST declare an owner from `bootstrap`, `shell`, `workspace`, `panel`, or `modal`
- **AND** the owner MUST be visible to tests, diagnostics, or static checks.

#### Scenario: inactive migrated panels do not keep polling

- **WHEN** a migrated panel becomes inactive or unmounts
- **THEN** its long-lived listener, interval, and polling subscriptions MUST be torn down
- **AND** a cleanup test MUST verify the teardown.

#### Scenario: non-migrated surfaces remain explicit residual risk

- **WHEN** listener inventory finds a surface not yet migrated to owner enforcement
- **THEN** the evidence report MUST list it as uncovered, unsupported, or manual-only
- **AND** the change MUST NOT claim full-app listener compliance.

#### Scenario: focus regain triggers a coalesced refresh wave

- **WHEN** the window regains focus or visibility for migrated refresh sources
- **THEN** those sources MUST join one coalesced refresh wave
- **AND** individual sources MUST NOT each fire independent refreshes for the same focus event unless explicitly exempted.

#### Scenario: diagnostics overhead remains bounded

- **WHEN** renderer diagnostics heartbeat or watchdog runs
- **THEN** it MUST respect documented max frequency and entry caps
- **AND** diagnostics overhead MUST be reported or classified as unsupported when not measurable.
