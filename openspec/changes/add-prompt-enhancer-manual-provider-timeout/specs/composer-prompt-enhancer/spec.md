## ADDED Requirements

### Requirement: Prompt enhancer dialog manual run

The Composer prompt enhancer SHALL open as a configuration and review dialog without starting an enhancement request automatically.

#### Scenario: Opening dialog does not run enhancement

- **WHEN** the user triggers prompt enhancement from Composer
- **THEN** the system SHALL open the prompt enhancer dialog with the current draft as the original prompt
- **AND** the system SHALL NOT call the engine runtime until the user explicitly starts enhancement

#### Scenario: Empty composer draft does not open runnable enhancement

- **WHEN** the user triggers prompt enhancement with an empty Composer draft
- **THEN** the system SHALL NOT start an enhancement request

### Requirement: Per-run enhancer engine selection

The prompt enhancer dialog SHALL allow the user to select the engine used for the next prompt enhancement run.

#### Scenario: User selected engine is used for enhancement

- **WHEN** the user selects an enhancer engine and starts enhancement
- **THEN** the system SHALL call the engine runtime with the selected engine
- **AND** the selected engine SHALL apply only to the current prompt enhancement run

#### Scenario: Non-Claude selected engine fails without Claude fallback

- **WHEN** the user selects a non-Claude engine and that engine fails
- **THEN** the system SHALL show a traceable failure for that selected engine
- **AND** the system SHALL NOT silently retry through Claude fallback

### Requirement: Per-run enhancer timeout control

The prompt enhancer dialog SHALL allow the user to configure the timeout used for the next prompt enhancement run.

#### Scenario: User configured timeout is applied

- **WHEN** the user enters a valid timeout and starts enhancement
- **THEN** the system SHALL apply that timeout to the enhancement request

#### Scenario: Invalid timeout is sanitized

- **WHEN** the user enters an invalid or out-of-range timeout
- **THEN** the system SHALL normalize the value to a safe bounded timeout before running

### Requirement: Per-run enhancer model selection

The prompt enhancer dialog SHALL allow the user to select a model for the selected enhancer engine when models are available.

#### Scenario: Engine model list is shown

- **WHEN** the user selects an enhancer engine with available models
- **THEN** the dialog SHALL show a model selector populated from that engine model list

#### Scenario: Selected model is used for enhancement

- **WHEN** the user selects an engine model and starts enhancement
- **THEN** the system SHALL call the engine runtime with that selected model

#### Scenario: Engine without models can still run

- **WHEN** the selected enhancer engine has no available models
- **THEN** the dialog SHALL allow the model selection to be empty
- **AND** the system SHALL call the engine runtime with no explicit model

### Requirement: Enhancement result adoption remains explicit

The prompt enhancer SHALL require explicit user action before replacing Composer content with the enhanced prompt.

#### Scenario: Successful enhancement can be adopted

- **WHEN** an enhancement run succeeds and returns normalized enhanced text
- **THEN** the dialog SHALL enable the use-enhanced action
- **AND** activating that action SHALL replace the Composer draft with the enhanced prompt

#### Scenario: Keeping original does not mutate composer draft

- **WHEN** the user keeps the original prompt or closes the dialog
- **THEN** the Composer draft SHALL remain unchanged

### Requirement: Prompt enhancer run lifecycle safety

The prompt enhancer SHALL prevent duplicate concurrent runs and ignore stale results after closure or a newer run.

#### Scenario: Running state blocks duplicate execution

- **WHEN** an enhancement request is already running
- **THEN** the dialog SHALL prevent starting another enhancement request from the same dialog state

#### Scenario: Closed dialog invalidates in-flight result

- **WHEN** the user closes the dialog while an enhancement request is in flight
- **THEN** the system SHALL ignore the eventual result from that stale request
