## ADDED Requirements

### Requirement: Large Final Markdown MUST Use Worker-Capable Precompute Or Explicit Fallback

Large final assistant Markdown MUST move serializable heavy precompute off the main thread when thresholds are met, while preserving safe main-thread rich rendering for React-bound features.

#### Scenario: large final message uses worker precompute

- **WHEN** a final assistant message exceeds the documented size or complexity threshold
- **THEN** serializable Markdown precompute MUST run in a worker when worker support is available
- **AND** diagnostics MUST report worker-precompute mode, duration, threshold reason, and evidence class.

#### Scenario: React-bound rich render remains safe

- **WHEN** Markdown requires React components, sanitized raw HTML, KaTeX, Mermaid, file links, or custom code-block actions
- **THEN** the final rich render MAY still execute through the existing React renderer on the main path
- **AND** worker output MUST NOT be treated as trusted DOM or a substitute for sanitization.

#### Scenario: small final message stays on main path

- **WHEN** a final message is below the documented threshold and lacks heavy complexity signals
- **THEN** the renderer MAY use the existing main path
- **AND** diagnostics MUST make the parse/precompute mode visible.

#### Scenario: worker failure falls back safely

- **WHEN** worker creation fails, worker support is unavailable, or precompute exceeds the documented timeout
- **THEN** the renderer MUST fall back to the existing readable main path
- **AND** fallback reason MUST be reported in diagnostics and runtime evidence.

#### Scenario: stale worker result is dropped

- **WHEN** a worker result resolves after a newer content hash or source version exists for the same message
- **THEN** the stale result MUST be ignored
- **AND** it MUST NOT replace newer visible content.

### Requirement: Markdown Precompute Cache MUST Be Keyed By Content And Renderer Options

Markdown precompute results MUST be cached using content identity and renderer options so unchanged large messages do not repeat serializable heavy work.

#### Scenario: cache hit avoids repeat precompute

- **WHEN** a message is rendered again with the same renderer profile, message id, content hash, options hash, and schema version
- **THEN** cached precompute MUST be reused when still valid
- **AND** diagnostics MUST report `cache-hit` rather than running worker/main precompute again.

#### Scenario: renderer option change invalidates cache

- **WHEN** renderer profile, feature flags, sanitization-affecting options, or schema version changes
- **THEN** the cached precompute MUST be invalidated
- **AND** a new precompute or main-path render MUST run.

#### Scenario: diagnostics remain content-safe

- **WHEN** markdown parse/precompute diagnostics are emitted
- **THEN** they MUST include mode, duration, cache state, content length, content hash, fallback reason, and evidence class
- **AND** they MUST NOT include raw Markdown body, prompt text, assistant body text, tool output body, or file content.

### Requirement: Live Markdown Streaming MUST Preserve Existing Lightweight Behavior

The off-main-thread final Markdown pipeline MUST NOT regress live streaming Markdown protections.

#### Scenario: partial live deltas do not force full parser work

- **WHEN** assistant live Markdown is still incomplete or streaming at high frequency
- **THEN** it MUST continue to use bounded stabilization, lightweight rendering, or readable fallback
- **AND** it MUST NOT run the full rich parser pipeline for every partial fragment.

#### Scenario: final output converges with history restore

- **WHEN** a live message completes and is later restored from history
- **THEN** the final visible Markdown semantics MUST converge across live-completed and history-restore paths
- **AND** worker precompute cache MUST NOT create a divergent final structure.
