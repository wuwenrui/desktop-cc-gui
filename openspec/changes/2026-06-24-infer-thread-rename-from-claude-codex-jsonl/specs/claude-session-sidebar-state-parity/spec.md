## ADDED Requirements

### Requirement: Claude Sidebar Title SHALL Reuse JSONL `/rename` Alias When No Stronger Source Exists

`Claude` sidebar / recent conversation surfaces MUST reuse the most recent `/rename` command's `args` from the session's jsonl as the visible title when no stronger title source exists (no GUI custom title in `thread_titles_core`, no in-memory `customName`, no `mappedTitle`, no `autoName`). Any stronger title source MUST still take precedence over the alias per the existing stable precedence rules.

#### Scenario: cli /rename alias is visible when no stronger title source exists
- **WHEN** a `Claude` session's jsonl contains a user message `<command-name>/rename</command-name><command-args>foo</command-args>`
- **AND** the session has no entry in `thread_titles_core` and no in-memory `customName` or `mappedTitle`
- **THEN** the sidebar MUST display `foo` as the session title
- **AND** the first-message preview MUST NOT override the alias

#### Scenario: cli /rename alias is overridden by stronger custom title
- **WHEN** a `Claude` session has a GUI-set custom title
- **AND** the session's jsonl also contains a `/rename` command
- **THEN** the sidebar MUST display the GUI custom title
- **AND** the jsonl alias MUST NOT override the GUI custom title
- **AND** the jsonl alias MUST NOT be written back to `thread_titles_core`

#### Scenario: cli /rename alias is overridden by autoName
- **WHEN** a `Claude` session has been renamed via `autoName`, which writes to `thread_titles_core` and surfaces through the `mappedTitle` path
- **AND** the session's jsonl also contains a `/rename` command
- **THEN** the sidebar MUST display the `autoName` value
- **AND** the jsonl alias MUST NOT override `autoName`

#### Scenario: last /rename command wins
- **WHEN** a `Claude` jsonl contains multiple `/rename` commands
- **THEN** the system MUST take the args of the **last** `/rename` command in the file as the alias
- **AND** an earlier `/rename` MUST NOT override a later one

#### Scenario: legacy jsonl without /rename is unchanged
- **WHEN** a `Claude` jsonl contains no `/rename` command
- **THEN** `cli_rename_alias` MUST be `None`
- **AND** the sidebar MUST fall back to first-message preview, matching pre-change behavior

#### Scenario: alias extraction ignores isMeta internal records
- **WHEN** a `/rename` command appears inside a record with `isMeta=true` (system / local-command-caveat context)
- **THEN** the alias MUST NOT be derived from that record
- **AND** only non-meta user `/rename` records MUST contribute to the alias
