## ADDED Requirements

### Requirement: Codex Composer First Send MUST Preserve Selected Provider Origin

When Composer creates a new Codex conversation from a selected model that carries managed provider origin metadata, the creation request MUST use that provider profile instead of silently falling back to the disk provider.

#### Scenario: selected managed custom model starts provider-bound conversation

- **WHEN** the user selects a Codex custom model whose selector option carries `providerProfileId`
- **AND** the user sends the first message with no active Codex thread
- **THEN** the frontend MUST pass that `providerProfileId` to the Codex thread creation path
- **AND** the created conversation MUST use the selected managed provider binding

#### Scenario: provider origin is absent

- **WHEN** the user selects a Codex model whose selector option does not carry `providerProfileId`
- **AND** the user sends the first message with no active Codex thread
- **THEN** the frontend MUST NOT infer provider binding from model id alone
- **AND** the creation path MUST preserve the existing disk/default provider behavior

#### Scenario: active provider-bound thread continues using thread metadata

- **WHEN** the user sends a message in an existing Codex thread
- **THEN** the send path MUST continue resolving provider binding from thread metadata and backend recovery rules
- **AND** Composer's current model option MUST NOT override the existing thread provider binding
