## ADDED Requirements

### Requirement: Claude History Restore MUST Recover Interrupted Live Assistant Text From Shadow Transcript

Claude history restore MUST use a trusted local live assistant shadow transcript to preserve a readable assistant surface when the Claude JSONL source lacks the final assistant body for an interrupted long output.

#### Scenario: provider transcript lacks final assistant body but shadow exists
- **WHEN** current engine is `claude`
- **AND** a restored Claude history contains the triggering user turn, thinking, reasoning, or tool transcript entries
- **AND** it does not contain an equivalent assistant final text body for that turn
- **AND** a matching recent live assistant shadow transcript exists
- **THEN** restore MUST insert a readable assistant text surface from the shadow transcript
- **AND** the restored item MUST carry metadata indicating it was recovered from local shadow state

#### Scenario: provider final body prevents shadow duplication
- **WHEN** current engine is `claude`
- **AND** the Claude JSONL source contains a valid assistant final text body for the same turn
- **THEN** restore MUST use the provider transcript as the primary source
- **AND** it MUST NOT add a duplicate recovered assistant item from shadow state

#### Scenario: shadow recovery does not reveal hidden thinking
- **WHEN** Claude thinking visibility is disabled
- **AND** restore recovers assistant text from a shadow transcript
- **THEN** restore MUST preserve the assistant text body
- **AND** it MUST still apply the existing thinking visibility rules to reasoning or thinking content
