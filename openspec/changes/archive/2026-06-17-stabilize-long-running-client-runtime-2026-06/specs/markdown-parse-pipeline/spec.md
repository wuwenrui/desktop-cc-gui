# markdown-parse-pipeline Specification (Delta)

## MODIFIED Requirements

### Requirement: Large Final Markdown MUST Use Worker-Capable Precompute Or Explicit Fallback

Large final assistant Markdown MUST move serializable heavy precompute off the main thread when thresholds are met, while preserving safe main-thread rich rendering for React-bound features.

#### Scenario: large final message uses worker precompute

- **WHEN** a final assistant message exceeds the documented size or complexity threshold
- **THEN** serializable Markdown precompute MUST run in a worker when worker support is available
- **AND** diagnostics MUST report worker-precompute mode, duration, threshold reason, and evidence class.
- **AND** worker diagnostics MUST include pending request count and fallback count without raw Markdown content

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
- **AND** diagnostics MUST identify whether the drop was detected by the worker adapter or by the hook/caller latest-source guard

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

## ADDED Requirements

### Requirement: Markdown Worker Requests MUST Have Bounded Lifecycle Diagnostics

The existing fast Markdown worker adapter MUST expose bounded diagnostics for worker lifecycle, pending requests, fallback, stale result drops, and dispose behavior.

#### Scenario: pending worker requests are observable

- **WHEN** Markdown worker precompute requests are in flight
- **THEN** diagnostics MUST expose `pendingRequestCount`
- **AND** diagnostics MUST NOT include raw Markdown body, prompt text, assistant body text, tool output, or file content

#### Scenario: disposing worker rejects pending requests

- **WHEN** `disposeFastMarkdownWorker()` is called while requests are pending
- **THEN** every pending request MUST be rejected with a bounded error
- **AND** `pendingRequestCount` MUST return to zero
- **AND** diagnostics MUST increment `disposedCount`

#### Scenario: stale worker result is ignored at the owning layer

- **WHEN** a worker result arrives for an older content hash, options hash, schema version, or request ordinal
- **THEN** the result MUST be dropped by the layer that owns latest-source knowledge
- **AND** worker adapter diagnostics MUST only increment adapter-level stale counters when the adapter has an explicit latest-source registry
- **AND** hook/caller diagnostics MUST report hook-level stale visible-result drops when request ordinal guards ignore obsolete promise resolutions
- **AND** visible content MUST remain based on the latest source

#### Scenario: adapter lifecycle diagnostics do not infer UI state

- **WHEN** the worker adapter receives an unknown request id, dispose event, worker error, or postMessage failure
- **THEN** adapter diagnostics MAY update pending, disposed, fallback, unknown-response, or bounded error counters
- **AND** it MUST NOT claim a visible-content stale drop unless it has explicit latest-source inputs

#### Scenario: fallback reason is bounded

- **WHEN** worker creation, worker execution, or worker response handling falls back to the main path
- **THEN** diagnostics MUST include a bounded fallback reason
- **AND** the fallback reason MUST NOT contain conversation or file content
