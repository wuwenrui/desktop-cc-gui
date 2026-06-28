## MODIFIED Requirements

### Requirement: Codex Engine MUST Append Curated Skill Bodies As Developer Instructions

Codex app-server launch MUST make enabled curated skill bodies available as
merged `developer_instructions` when curated skills are enabled and the user has
not supplied an instruction override. For primary launches, this MAY continue to
use a `-c developer_instructions=...` argv config value. For Windows `.cmd/.bat`
wrapper compatibility retry, the engine MUST avoid sending generated curated
skill bodies through argv and MUST instead project them into a ccgui-generated
Codex profile file under the effective `CODEX_HOME`.

The merge MUST preserve existing internal developer instructions and append a
`## Curated Skills` section containing `<skill id="...">...</skill>` blocks.

#### Scenario: empty enabled set produces no curated arg

- **WHEN** no curated skills are enabled
- **THEN** Codex args MUST not add a curated `developer_instructions` block.

#### Scenario: enabled skill is injected on primary launch

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Codex app-server launch is the primary launch path
- **THEN** Codex launch args MUST include generated `developer_instructions`
  containing `<skill id="lazy-senior-dev">`.

#### Scenario: wrapper compatibility retry uses generated profile

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Windows wrapper compatibility retry builds Codex app-server launch
- **THEN** retry argv MUST NOT include generated `developer_instructions`
  containing `<skill id="lazy-senior-dev">`
- **AND** a ccgui-owned generated profile under the effective `CODEX_HOME` MUST
  contain generated `developer_instructions` containing
  `<skill id="lazy-senior-dev">`
- **AND** the retry args MUST still include user-authored Codex args such as
  `--profile` or `--sandbox` when those args are valid.

#### Scenario: user override wins

- **WHEN** user-supplied Codex args already include `developer_instructions=` or
  `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override
- **AND** wrapper compatibility retry MUST NOT create a competing generated
  curated-skill profile for that launch.
