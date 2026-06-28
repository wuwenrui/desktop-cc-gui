## ADDED Requirements

### Requirement: Runtime Failure Notices MUST Not Leak Missing Template Placeholders

Global runtime notice copy MUST render optional diagnostic fields safely and MUST NOT expose interpolation placeholders or raw internal lifecycle text as the final user-facing summary.

#### Scenario: optional action fields are absent
- **WHEN** a runtime failure notice is created without `reasonCode`, `actionHint`, or equivalent optional message parameters
- **THEN** the rendered notice MUST omit the missing optional segments cleanly
- **AND** it MUST NOT display literal placeholders such as `{{reasonCode}}` or `{{actionHint}}`

#### Scenario: known disk Codex recovery states use user-readable summary
- **WHEN** a runtime notice represents disk Codex `stale-thread-binding`, `stale_reuse_cleanup`, `stopping-runtime-race`, or recoverable `RUNTIME_ENDED` during create/send readiness
- **THEN** the notice summary MUST use concise user-readable recovery copy
- **AND** raw diagnostic values MAY be retained in structured notice params, logs, or diagnostics bundles

#### Scenario: unknown failures remain diagnosable
- **WHEN** a runtime notice does not match a known recoverable Codex disk state
- **THEN** the notice MAY include a concise raw error summary
- **AND** it MUST still avoid leaking unresolved template placeholders
