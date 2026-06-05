## ADDED Requirements

### Requirement: Claude Doctor MUST Report Windows Runtime Wrapper Selection

The engine environment doctor MUST expose the Windows Claude executable path and wrapper kind used or preferred for managed runtime execution.

#### Scenario: Windows Claude candidates include wrapper kind

- **WHEN** the doctor resolves Claude executable candidates on Windows
- **THEN** the diagnosis MUST include wrapper kind metadata for `.cmd`, `.bat`, `.exe`, `.ps1`, or direct candidates
- **AND** the diagnosis MUST identify the selected runtime candidate

#### Scenario: implicit Windows resolution prefers stable managed-runtime wrapper

- **WHEN** implicit Windows Claude resolution finds both stable candidates such as `.cmd` or `.exe` and a `.ps1` candidate
- **THEN** the runtime resolver MUST prefer the stable non-`.ps1` candidate
- **AND** the doctor MUST make the selected candidate visible in diagnostic output

#### Scenario: explicit ps1 configuration remains supported

- **WHEN** the user explicitly configures a Claude `.ps1` path
- **THEN** the runtime MUST preserve that configured path
- **AND** the doctor MUST classify it as `ps1-wrapper` or equivalent metadata
