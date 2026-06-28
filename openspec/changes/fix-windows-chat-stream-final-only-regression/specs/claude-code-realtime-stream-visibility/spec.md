## ADDED Requirements

### Requirement: Claude Backend Stream MUST Emit Text Before Process Completion

Claude Code backend streaming MUST forward valid assistant text delta events before the Claude CLI process exits, including on Windows wrapper launches, while preserving existing non-Windows immediate flush semantics.

#### Scenario: delayed stdout delta is visible before process exit

- **WHEN** a Claude Code runtime process emits a valid assistant text delta on stdout
- **AND** the process remains alive before emitting later stdout lines or terminal completion
- **THEN** the backend MUST emit the assistant text delta to the conversation event stream before waiting for process exit
- **AND** the terminal completed output MUST NOT be the first meaningful assistant text event when earlier valid deltas existed

#### Scenario: non-Windows flush behavior is unchanged

- **WHEN** Claude Code emits adjacent assistant text deltas on macOS or Linux
- **THEN** the backend MUST preserve immediate per-delta forwarding semantics
- **AND** Windows-specific coalescing MUST NOT be applied to non-Windows platforms

#### Scenario: Windows coalescing remains bounded

- **WHEN** Claude Code emits adjacent assistant text deltas on Windows
- **THEN** the backend MAY coalesce deltas inside the existing bounded coalescing window
- **AND** coalescing MUST NOT defer all assistant text until process completion
