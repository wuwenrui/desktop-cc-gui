## ADDED Requirements

### Requirement: Renderer Bootstrap MUST Separate Critical And Post-Render Work

renderer bootstrap path MUST 区分 first shell render 必需 work、可并行 work、以及 shell mount 后执行的 post-render work。

#### Scenario: non-critical input history does not block first render

- **WHEN** app starts and composer input history is not required to render initial composer
- **THEN** input history restore MUST NOT block root render
- **AND** composer MUST remain usable before history hydration completes
- **AND** history navigation MUST become available after hydration settles

#### Scenario: best-effort migration does not block shell when safe

- **WHEN** localStorage migration is not required for initial shell correctness
- **THEN** migration SHOULD run after root render or in a non-blocking background phase
- **AND** migration failure MUST be recorded as bounded diagnostics instead of preventing shell render
- **AND** any migration proven critical MUST document the invariant that requires blocking

#### Scenario: app import and current locale load run in parallel where safe

- **WHEN** bootstrap starts
- **THEN** `import("./App")`, critical store preload, and current-locale i18n loading SHOULD begin without unnecessary serial waits
- **AND** root render MUST wait only for the critical subset needed to render shell correctly

### Requirement: Startup Locale Loading MUST Load Only The Current Locale Initially

i18n startup path MUST avoid importing all supported locales before first render；startup only needs active locale resources。

#### Scenario: startup loads stored or default locale only

- **WHEN** app starts with stored locale or default locale
- **THEN** startup MUST load active locale resources required for first render
- **AND** startup MUST NOT statically import every supported full locale resource into startup module path

#### Scenario: language switch loads target locale before commit

- **WHEN** user switches language after startup
- **THEN** target locale resource MUST load before visible language change is committed
- **AND** existing `saveLanguage` behavior MUST remain unchanged
- **AND** missing key fallback behavior MUST remain deterministic

### Requirement: Bootstrap Trace MUST Attribute Startup Delay To Concrete Milestones

startup trace MUST 记录足够 milestone timing，使 slow startup 可以归因到具体 bootstrap phase。

#### Scenario: granular milestones are recorded

- **WHEN** renderer starts through bootstrap path
- **THEN** startup trace MUST record start and end timing for storage preload, migration, input history, i18n, app import, root render, and shell readiness where those phases execute
- **AND** trace payloads MUST contain timing/status metadata rather than prompt, assistant, tool, or file content
