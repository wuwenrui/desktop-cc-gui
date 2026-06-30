## ADDED Requirements

### Requirement: Claude Stream JSON Stdin MUST NOT Use Positional Prompt Placeholders

When Claude Code runtime sends prompt content through `--input-format stream-json` stdin, the launched CLI command MUST NOT include a user prompt positional argument or an empty positional placeholder after `-p`.

#### Scenario: stream-json stdin has no empty prompt placeholder
- **WHEN** a Claude Code prompt is sent through stream-json stdin
- **THEN** the runtime MUST launch Claude CLI with `--input-format stream-json`
- **AND** the argv list MUST NOT include an empty positional prompt placeholder after `-p`
- **AND** the stdin payload MUST remain the only carrier for the user message content

#### Scenario: Windows wrapper receives stable stream-json args
- **WHEN** Claude Code is launched through a Windows `.cmd` or `.bat` wrapper
- **AND** the prompt is sent through stream-json stdin
- **THEN** the command argv MUST preserve Claude control flags without injecting an empty prompt argument
- **AND** the raw JSON stdin payload MUST NOT become the visible user message or sidebar title

#### Scenario: Unix direct launches use the same protocol contract
- **WHEN** Claude Code is launched on macOS or Linux without a Windows command wrapper
- **AND** the prompt is sent through stream-json stdin
- **THEN** the runtime MUST use the same no-placeholder stdin protocol contract
- **AND** existing stream-json output parsing and live text streaming MUST remain unchanged
