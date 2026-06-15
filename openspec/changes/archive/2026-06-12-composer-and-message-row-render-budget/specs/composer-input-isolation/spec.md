## ADDED Requirements

### Requirement: Composer Draft State MUST Be Isolated From Unrelated High-Frequency Updates

Composer draft value handling MUST stay inside a Composer-owned boundary and MUST NOT depend on global streaming, radar, session activity, file tree, git, or runtime tick state unless that state directly changes the submitted draft contract.

#### Scenario: streaming does not drive textarea value renders

- **WHEN** the active thread receives assistant delta, runtime progress, session activity refresh, or radar tick
- **THEN** the Composer textarea value path MUST NOT rerender solely because of that event
- **AND** diagnostics MUST record whether the input-facing render budget stayed within the documented target.

#### Scenario: explicit draft-affecting changes still update Composer

- **WHEN** the user inserts a file reference, applies a slash command, restores a draft, or submits / clears the Composer
- **THEN** the Composer draft value MUST update correctly
- **AND** the isolation layer MUST NOT drop legitimate local edits.

#### Scenario: IME composition remains lossless under streaming pressure

- **WHEN** a user composes IME text while assistant output is streaming
- **THEN** the existing composition lifecycle MUST protect the in-progress candidate text from controlled-value overwrite
- **AND** the final committed text MUST match the user's committed value
- **AND** `inputEventLossCount` MUST remain inside the documented budget.

### Requirement: Input History Hydration MUST Be Background And Stale-Safe

Input history MUST NOT block Composer first paint or first keystroke, and in-flight history hydration MUST be cancellable or stale-guarded.

#### Scenario: first keystroke is accepted before history hydration

- **WHEN** a Composer mounts for a fresh thread
- **THEN** the input surface MUST accept typing before input history is fully loaded
- **AND** history-dependent suggestions MAY appear later without rewriting the draft.

#### Scenario: stale history hydration is ignored

- **WHEN** the user switches thread, closes Composer, or starts a newer history load while an older load is in flight
- **THEN** the older result MUST be ignored or cancelled
- **AND** it MUST NOT replace the active thread's history suggestions.
