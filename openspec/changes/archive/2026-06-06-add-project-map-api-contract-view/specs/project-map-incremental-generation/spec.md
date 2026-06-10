## ADDED Requirements

### Requirement: Project Map generation consumes API contract evidence without flattening

The system SHALL allow Project Map generation and scan flows to consume API contract artifacts as source-backed evidence while preserving API contracts as a separate fact layer.

#### Scenario: API contract artifacts enrich Project Map generation

- **WHEN** Project Map generation builds context for a workspace that has API contract artifacts
- **THEN** the generation flow SHALL be able to read API endpoint summaries, API groups, and method chain evidence as source-backed context
- **AND** the generation flow SHALL NOT delete existing Project Map nodes merely because an API endpoint is absent from the latest API scan

#### Scenario: API contracts are not flattened into semantic nodes

- **WHEN** API contract scan artifacts contain many endpoints
- **THEN** Project Map generation SHALL NOT blindly create one semantic node per endpoint under the project root
- **AND** API contract hierarchy SHALL remain available through the API contract view or source-backed grouped evidence

#### Scenario: API evidence keeps provenance

- **WHEN** Project Map generation references API contract information
- **THEN** generated or enriched Project Map content SHALL keep provenance linking back to API contract artifacts, source files, schema files, or evidence lines when available
- **AND** weak API inference SHALL remain distinguishable from strong schema-backed API evidence

#### Scenario: API evidence consumed by generation is redacted

- **WHEN** Project Map generation consumes API contract evidence containing examples, headers, cookies, tokens, passwords, secrets, credentials, or api keys
- **THEN** the generation context SHALL use redacted evidence values
- **AND** unredacted sensitive values SHALL NOT be injected into prompts or generated Project Map content
