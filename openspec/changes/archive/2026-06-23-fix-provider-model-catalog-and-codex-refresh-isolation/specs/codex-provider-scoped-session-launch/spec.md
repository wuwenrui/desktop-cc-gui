## ADDED Requirements

### Requirement: Codex Provider Custom Models MUST Feed Model Catalog

Custom models stored on managed Codex provider profiles MUST be treated as model catalog facts for composer selection. Adding, editing, loading, or deleting Codex providers MUST update the composer-visible Codex custom model catalog without requiring an app restart.

#### Scenario: provider custom model appears after provider add
- **WHEN** the user creates a managed Codex provider with `customModels`
- **THEN** those custom models MUST become visible in the Codex model selector catalog
- **AND** the update MUST NOT trigger Codex runtime reload

#### Scenario: provider custom model appears after provider edit
- **WHEN** the user edits a managed Codex provider and changes `customModels`
- **THEN** the Codex model selector catalog MUST reflect the provider custom model additions
- **AND** it MUST deduplicate them against existing global custom model entries by model id

#### Scenario: provider management is not active runtime switch
- **WHEN** the user adds, edits, or deletes a managed Codex provider profile
- **THEN** existing Codex conversations MUST keep their thread-bound provider runtime
- **AND** provider management MUST NOT switch or restart the active runtime as a side effect
