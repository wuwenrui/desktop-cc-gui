## ADDED Requirements

### Requirement: File view side channels MUST remain bounded during interaction

External change awareness, git markers, annotations, preview refresh, and code intelligence MUST remain side channels that cannot block editor typing, line switching, or first useful viewport rendering.

#### Scenario: git marker delay does not block editor mount

- **WHEN** a user opens a modified workspace file
- **AND** git marker loading is slow or fails
- **THEN** the editor MUST still mount with file content when the document snapshot is ready
- **AND** markers MAY appear later or degrade to empty markers
- **AND** marker results MUST verify current file identity and render epoch before committing

#### Scenario: code intelligence does not run for every cursor move

- **WHEN** the user moves the cursor repeatedly inside an editor
- **THEN** code intelligence requests MUST be explicit, debounced, or otherwise bounded
- **AND** cursor movement MUST NOT issue one backend command per movement by default

#### Scenario: stable preview does not refresh on every editor draft change

- **WHEN** the user edits a file in editor mode
- **AND** live preview mode is not active
- **THEN** Markdown or structured preview snapshots MUST NOT rebuild on every editor draft change
- **AND** preview MAY refresh on explicit preview switch, save, external refresh, or bounded idle publication

### Requirement: Runtime stability evidence MUST classify file interaction lag

File view performance evidence MUST classify whether observed lag is caused by IO, editor render, tab remount, preview work, side-channel work, or concurrent realtime pressure when enough signals are available.

#### Scenario: evidence classifies unsupported measurements

- **WHEN** runtime tooling cannot measure a file interaction dimension directly
- **THEN** the report MUST classify that dimension as `proxy`, `manual-only`, or `unsupported`
- **AND** it MUST NOT claim release-grade measured improvement for that dimension
