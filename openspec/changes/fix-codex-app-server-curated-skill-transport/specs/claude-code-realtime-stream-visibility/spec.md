## ADDED Requirements

### Requirement: Claude Windows Launch MUST Avoid Curated Skill Body Argv

Claude Code launch MUST keep stream-json stdin prompt delivery intact and MUST avoid placing large ccgui-generated curated skill bodies in Windows argv.

#### Scenario: Windows skips curated append system prompt
- **WHEN** a Claude Code send runs on Windows
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the launched command MUST NOT include `--append-system-prompt` with the generated curated skill body
- **AND** the user message MUST still be sent through `--input-format stream-json` stdin
- **AND** the enabled curated skill MUST be made available through Claude native skill discovery instead of argv
- **AND** any automatic curated-skill activation MUST use `--append-system-prompt-file`, not inline `--append-system-prompt`

#### Scenario: non-wrapper Claude launch preserves curated skills
- **WHEN** a Claude Code send runs on macOS or Linux
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the launched command MUST keep the existing `--append-system-prompt` curated skill injection behavior

#### Scenario: Windows mirrors curated skill before Claude send
- **WHEN** a Claude Code send runs on Windows
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** ccgui MUST sync `lazy-senior-dev` into `<effective Claude home>/skills/lazy-senior-dev/SKILL.md`
- **AND** effective Claude home MUST come from configured Claude home, then `CLAUDE_HOME`, then platform default
- **AND** the sync MUST protect user-owned skill directories by requiring a ccgui ownership marker before overwrite or delete

#### Scenario: Windows passes activation hint file for curated skills
- **WHEN** a Claude Code send runs on Windows
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** ccgui MUST pass `--append-system-prompt-file <hint-file-path>`
- **AND** `<hint-file-path>` MUST be a ccgui-managed file under the effective Claude home
- **AND** the launched command MUST NOT include the curated skill body in argv
