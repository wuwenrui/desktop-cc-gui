## MODIFIED Requirements

### Requirement: Claude Custom Models MUST Remain Supported

The system MUST continue to support user-added Claude custom models even when they are not present in Claude settings/env overrides. Claude custom model normalization MUST be shape-only: the GUI MUST NOT reject a user-entered custom model id solely because it contains spaces, punctuation, Unicode characters, provider-specific syntax, or a non-official naming pattern.

#### Scenario: custom model appears beside configured models
- **WHEN** the user has added a Claude custom model
- **AND** Claude settings/env overrides contain configured models
- **THEN** the custom model MUST remain present in the merged Claude model catalog
- **AND** it MUST NOT be removed solely because settings/env did not list it

#### Scenario: custom model sends as configured
- **WHEN** the user selects a custom Claude model
- **THEN** the sent Claude runtime model MUST equal the custom model value configured by the user
- **AND** the system MUST NOT rewrite it to a built-in alias or configured model

#### Scenario: custom model wins over legacy migration
- **WHEN** a selected model value matches a user custom model
- **THEN** the system MUST treat it as user intent
- **AND** it MUST NOT migrate that value as if it were a deprecated built-in id

#### Scenario: custom model id with spaces remains selectable
- **WHEN** the user adds a Claude custom model with id `Haiku 4.5`
- **THEN** the Claude model selector MUST include that custom model
- **AND** the runtime model value MUST remain `Haiku 4.5`

#### Scenario: custom model id is not checked against official syntax
- **WHEN** the user adds a Claude custom model whose id contains punctuation, Unicode, or provider-specific syntax
- **THEN** frontend catalog normalization MUST preserve the entry when the id is a non-empty string
- **AND** it MUST NOT apply the generic model-id regex allowlist used by other providers

#### Scenario: malformed custom entries are ignored by shape only
- **WHEN** the custom model payload contains a non-object entry, a missing id, or an id that is empty after trimming
- **THEN** the malformed entry MUST be ignored
- **AND** valid user custom model entries in the same payload MUST remain available
