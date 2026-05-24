## ADDED Requirements

### Requirement: Claude Repeat-Turn Reopen MUST Preserve Issue 529 Session Surface

When a Claude conversation has completed an initial turn and a second-or-later turn creates user, tool, or assistant transcript rows, reopening that session MUST preserve a readable conversation surface.

#### Scenario: issue 529 second turn restores non-empty rows
- **WHEN** a Claude history session contains a first real user turn
- **AND** the same session later contains a second real user turn followed by tool-use or assistant rows
- **AND** synthetic continuation rows are present between the real turns
- **THEN** reopening the session MUST show at least one real user, tool, or assistant row
- **AND** the conversation MUST NOT collapse into a blank or empty-thread surface

#### Scenario: repeat-turn recovery remains Claude scoped
- **WHEN** the issue-shaped recovery logic evaluates a non-Claude engine such as Codex
- **THEN** it MUST NOT change that engine's session activation, catalog membership, or message rendering behavior
