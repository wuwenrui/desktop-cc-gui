## ADDED Requirements

### Requirement: Codex Sidebar Title SHALL Reuse JSONL `/rename` Alias When No Stronger Source Exists

`Codex` sidebar / recent conversation surfaces MUST reuse the most recent `/rename` user message's args from the rollout jsonl as the visible title when no stronger title source exists (no GUI custom title in `thread_titles_core`, no in-memory `customName`, no `mappedTitle`, no `autoName`). Any stronger title source MUST still take precedence over the alias per the existing stable precedence rules.

#### Scenario: cli /rename alias is visible when no stronger title source exists
- **WHEN** a `Codex` rollout jsonl contains a `role=user` `response_item` whose `content[0]` is an `input_text` of form `/rename foo` (or the equivalent `<command-name>/rename</command-name>...<command-args>foo</command-args>` form)
- **AND** the session has no entry in `thread_titles_core` and no in-memory `customName` or `mappedTitle`
- **THEN** the sidebar MUST display `foo` as the session title
- **AND** the first-message preview MUST NOT override the alias

#### Scenario: cli /rename alias is overridden by stronger custom title
- **WHEN** a `Codex` session has a GUI-set custom title
- **AND** the rollout jsonl also contains a `/rename` user message
- **THEN** the sidebar MUST display the GUI custom title
- **AND** the jsonl alias MUST NOT override the GUI custom title
- **AND** the jsonl alias MUST NOT be written back to `thread_titles_core`

#### Scenario: cli /rename alias is overridden by autoName
- **WHEN** a `Codex` session has been renamed via `autoName`, which writes to `thread_titles_core` and surfaces through the `mappedTitle` path
- **AND** the rollout jsonl also contains a `/rename` user message
- **THEN** the sidebar MUST display the `autoName` value
- **AND** the jsonl alias MUST NOT override `autoName`

#### Scenario: last /rename command wins
- **WHEN** a `Codex` rollout jsonl contains multiple `/rename` user messages
- **THEN** the system MUST take the args of the **last** `/rename` user message as the alias

#### Scenario: legacy rollout without /rename is unchanged
- **WHEN** a `Codex` rollout jsonl contains no `/rename` user message
- **THEN** `cli_rename_alias` MUST be `None`
- **AND** the sidebar MUST fall back to first-message preview, matching pre-change behavior
