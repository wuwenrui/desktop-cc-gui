## ADDED Requirements

### Requirement: Claude Runtime Prompt Input MUST Use Stream JSON Stdin

Claude Code runtime MUST send user prompt content through `--input-format stream-json` stdin by default instead of passing prompt text as a CLI argv argument.

#### Scenario: single-line prompt uses stream-json stdin

- **WHEN** a user sends a single-line Claude Code prompt without images
- **THEN** the runtime MUST launch Claude CLI with `--input-format stream-json`
- **AND** the prompt content MUST be written through stdin
- **AND** the prompt content MUST NOT appear as a positional argv argument

#### Scenario: special-character prompt is not shell-interpreted argv

- **WHEN** a user sends a Claude Code prompt containing shell metacharacters such as `&`, `|`, `<`, `>`, `^`, `%`, `!`, `(`, or `)`
- **THEN** the runtime MUST keep the prompt content out of CLI argv
- **AND** the runtime MUST preserve normal Claude CLI control flags such as permission mode, model, session, and hook event flags

#### Scenario: multiline and image prompts keep existing stdin behavior

- **WHEN** a user sends a multiline prompt or attaches images to a Claude Code turn
- **THEN** the runtime MUST continue using stream-json stdin input
- **AND** the existing stream-json content builder behavior MUST remain compatible with prior multiline and image support

#### Scenario: diagnostics expose the active input format

- **WHEN** Claude CLI exits with a non-zero status and no stdout or stderr diagnostics
- **THEN** the runtime error diagnostics MUST include the active input format
- **AND** after this change normal prompt sends SHOULD report `input_format=stream-json` rather than `input_format=argv`
