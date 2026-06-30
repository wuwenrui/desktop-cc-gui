## ADDED Requirements

### Requirement: Codex Custom Model Options MUST Retain Provider Origin

Codex model selector catalog composition MUST retain managed provider origin metadata for user custom models so downstream send paths can distinguish disk/default models from managed-provider models.

#### Scenario: managed provider custom model carries provider profile id

- **WHEN** a Codex managed provider exposes a custom model
- **THEN** the composed model selector option for that custom model MUST include the provider's profile id
- **AND** the option MUST remain selectable with its configured label

#### Scenario: hydrated catalog keeps custom model provider origin

- **WHEN** the parent composer passes a hydrated Codex model catalog
- **AND** a managed provider custom model is merged into that catalog
- **THEN** the merged custom model option MUST retain its provider profile id
- **AND** equivalent runtime choices MUST NOT duplicate the custom model row

#### Scenario: disk and config-derived models do not claim managed origin

- **WHEN** a Codex model option comes from disk config, built-in defaults, or runtime discovery rather than a managed provider custom model
- **THEN** the option MUST NOT carry a managed provider profile id
