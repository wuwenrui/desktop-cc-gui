## ADDED Requirements

### Requirement: Project Governance Profile MUST Be Derived From Workspace Facts
The system MUST derive a `ProjectGovernanceProfile` from workspace-relative files, known configuration files, package/build metadata, CI definitions, governance directories, and known artifact paths. The profile MUST be computed before evidence adapters are selected.

#### Scenario: Node TypeScript project is identified from package metadata
- **WHEN** a workspace contains `package.json` with scripts and a TypeScript config
- **THEN** the profile MUST include a Node/TypeScript ecosystem signal
- **AND** the profile MUST expose relevant scripts such as lint, typecheck, test, build, and check commands when present

#### Scenario: Python project is identified from Python metadata
- **WHEN** a workspace contains `pyproject.toml`, `pytest.ini`, `ruff.toml`, or equivalent Python tooling files
- **THEN** the profile MUST include a Python ecosystem signal
- **AND** Python verification adapters MAY become applicable

#### Scenario: Rust project is identified from Cargo metadata
- **WHEN** a workspace contains `Cargo.toml`
- **THEN** the profile MUST include a Rust ecosystem signal
- **AND** Rust verification adapters MAY become applicable

#### Scenario: Go project is identified from module metadata
- **WHEN** a workspace contains `go.mod`
- **THEN** the profile MUST include a Go ecosystem signal
- **AND** Go verification adapters MAY become applicable

#### Scenario: Maven or Gradle project is identified from build metadata
- **WHEN** a workspace contains `pom.xml`, `build.gradle`, or `build.gradle.kts`
- **THEN** the profile MUST include the matching JVM build ecosystem signal
- **AND** Maven or Gradle verification adapters MAY become applicable

### Requirement: Optional Governance Config MUST Override Rather Than Replace Auto Profile
The system MAY read a project-root `governance.config.json` v1 file as an explicit override for profile facts such as scripts, workflows, gate artifacts, severity, and OpenSpec/Trellis roots. The config MUST NOT be required for dynamic profile detection.

#### Scenario: workspace without config still uses auto profile
- **WHEN** a workspace has no `governance.config.json`
- **THEN** the system MUST still derive governance profile facts from workspace files and metadata
- **AND** it MUST NOT render an onboarding-only state that hides dynamically detected evidence

#### Scenario: config adds an explicit gate
- **WHEN** auto profile detection does not infer a custom gate
- **AND** `governance.config.json` declares that gate and artifact path
- **THEN** the resulting profile MUST include the custom gate
- **AND** an applicable adapter MAY emit evidence for that gate

#### Scenario: malformed config degrades without losing auto evidence
- **WHEN** `governance.config.json` exists but fails parsing or schema validation
- **THEN** the system MUST emit a degraded config evidence row
- **AND** auto-detected evidence that does not depend on the malformed config MUST continue to be available

#### Scenario: generated config template is safe
- **WHEN** the user chooses to generate a governance config template
- **THEN** the generated template MUST be an empty or minimal skeleton
- **AND** it MUST NOT copy mossx-specific scripts, workflows, or artifact paths into another project

### Requirement: Evidence Adapter Applicability MUST Be Profile-Aware
Every governance evidence adapter MUST declare whether it applies to the current `ProjectGovernanceProfile` before it is allowed to collect or emit evidence. A non-applicable adapter MUST emit no evidence.

#### Scenario: generic repository does not show harness-specific unknown evidence
- **WHEN** a workspace has no OpenSpec, Trellis, harness scripts, harness workflows, or harness artifacts
- **THEN** harness-specific evidence such as large-file gate and heavy-test-noise MUST NOT be emitted as `unknown`

#### Scenario: missing required artifact is shown only when the project declares the gate
- **WHEN** a profile detects a large-file governance script or workflow
- **AND** the expected large-file result artifact is missing
- **THEN** the large-file adapter MUST emit degraded evidence with a suggested command

#### Scenario: OpenSpec evidence applies only to OpenSpec workspaces
- **WHEN** a workspace does not contain an OpenSpec workspace
- **THEN** OpenSpec task evidence MUST NOT be emitted
- **AND** the absence of OpenSpec MUST NOT count as a governance problem

### Requirement: Governance Evidence UI MUST Group Evidence By Actionability
The StatusPanel governance evidence surface MUST group evidence into action-oriented groups: `needs_action`, `watch`, and `passed`. The UI MUST make the needs-action count visible before detailed evidence rows.

#### Scenario: non-pass evidence appears before pass evidence
- **WHEN** the evidence snapshot contains both healthy pass rows and degraded rows
- **THEN** degraded or failing rows MUST appear in the needs-action or watch group before passed rows

#### Scenario: passed evidence is collapsed by default
- **WHEN** the evidence snapshot contains only pass rows or many pass rows
- **THEN** the passed group MUST be collapsed or summarized by default
- **AND** the user MUST still be able to inspect the passed evidence details

#### Scenario: non-pass row exposes impact and action
- **WHEN** a governance evidence row is rendered outside the passed group
- **THEN** the row MUST expose impact, source, and a suggested action or explicit no-action rationale

#### Scenario: config guide is secondary to detected evidence
- **WHEN** no governance config exists but the project has dynamically detected evidence
- **THEN** the UI MAY show a subtle config guide or override affordance
- **AND** it MUST still render the detected evidence groups

### Requirement: Project-Type Evidence Expectations MUST Be Fixture-Tested
The system MUST include fixture-based tests for generic, Node/TypeScript, Python, Rust, Go, Maven, Gradle, and OpenSpec/Trellis workspaces. These tests MUST prove that only applicable evidence is emitted.

#### Scenario: Python fixture does not emit Node-only evidence
- **WHEN** the Python fixture profile is collected
- **THEN** Node-only package evidence MUST NOT be emitted unless Node files are also present

#### Scenario: mossx fixture preserves existing governance evidence
- **WHEN** the mossx-like fixture profile includes OpenSpec, Trellis, harness scripts, workflows, and artifacts
- **THEN** the system MUST still emit the relevant OpenSpec, Trellis, large-file, heavy-test-noise, and harness governance evidence

### Requirement: Profile And Evidence Identity MUST Be Workspace-Relative And Cross-Platform
Profile facts, adapter ids, evidence ids, source paths, and artifact paths MUST use workspace-relative normalized paths and MUST be stable across Windows, macOS, and Linux.

#### Scenario: Windows path separators are normalized
- **WHEN** profile detection receives paths using Windows separators
- **THEN** evidence-facing paths MUST be normalized to POSIX-style workspace-relative paths

#### Scenario: CRLF and LF configuration files parse equivalently
- **WHEN** configuration or task files use CRLF on Windows and LF on Unix-like systems
- **THEN** profile detection and evidence emission MUST produce equivalent semantic results
