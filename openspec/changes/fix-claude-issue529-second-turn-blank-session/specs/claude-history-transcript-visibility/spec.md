## ADDED Requirements

### Requirement: Claude Issue 529 Transcript MUST Keep Real Rows Around Synthetic Resume Rows

Claude history restore MUST ignore synthetic resume/no-response rows without dropping adjacent real second-turn user, tool, and assistant rows.

#### Scenario: synthetic resume rows do not hide following real turn
- **WHEN** a Claude JSONL transcript contains synthetic resume rows such as continuation prompts or `No response requested.`
- **AND** later rows contain a real user request and Claude assistant/tool output
- **THEN** the restored transcript MUST omit the synthetic rows
- **AND** it MUST keep the later real user, tool, and assistant rows visible

#### Scenario: missing explicit session id still uses file session identity
- **WHEN** Claude JSONL message rows omit explicit `session_id` fields
- **AND** the JSONL filename and workspace `cwd` identify the session and project
- **THEN** history restore and listing MUST use the file session identity as the canonical session identity
- **AND** the absence of per-line `session_id` MUST NOT make the restored transcript empty
