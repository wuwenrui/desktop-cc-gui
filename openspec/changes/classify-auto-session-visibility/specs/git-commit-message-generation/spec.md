## ADDED Requirements

### Requirement: Commit Message Helper Sessions SHALL Be Hidden Automatic Sessions
AI commit message generation sessions SHALL be classified as hidden automatic helper sessions and SHALL NOT appear in normal workspace session lists.

#### Scenario: Commit message generation creates hidden helper
- **WHEN** the system starts a session or thread to generate a commit message
- **THEN** it SHALL record automatic session metadata with `sessionPurpose=commit-message`
- **AND** it SHALL set `visibility=hidden`

#### Scenario: Commit helper remains excluded from root
- **WHEN** commit message generation completes or fails
- **THEN** the helper session SHALL NOT appear at workspace root
- **AND** any existing archive or background hide behavior SHALL remain compatible with the generic hidden classification
