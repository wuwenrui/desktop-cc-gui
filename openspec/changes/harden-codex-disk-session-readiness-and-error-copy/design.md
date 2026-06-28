## Context

Codex disk session creation already has recovery-oriented behavior in the surrounding specs: disk create-session can retry after runtime recovery, disk `thread/start` readiness confirmation must not be applied to managed providers, and stale binding recovery has classified `reasonCode` semantics. The observed failure shows a narrower product contract gap: the UI loading state can appear complete while the first send still encounters stale runtime/thread binding diagnostics, and the global notice copy exposes raw internal wording.

The user's mental model is simpler and correct for this product surface: once the Codex disk session loading completes, the session should be ready for the first message. If the runtime is not ready, loading should not claim readiness; if readiness fails, the failure should be actionable and should not blame a manual shutdown the user did not perform.

## Goals / Non-Goals

**Goals:**

- Treat Codex disk session loading completion as a send-readiness boundary.
- Audit whether the existing disk create-session path already waits for native thread/runtime readiness.
- Fix only the confirmed gap if the audit shows a defect.
- Convert recoverable disk Codex runtime/thread-binding diagnostics into concise user-facing copy.
- Preserve stable diagnostics fields for debugging.
- Add regression checks that prove Claude Code and managed Codex provider session creation are not changed.

**Non-Goals:**

- No Claude Code behavior change.
- No managed Codex provider readiness change.
- No broad runtime lifecycle redesign.
- No new dependency.
- No silent provider switching or cross-provider fallback.

## Decisions

### Decision 1: Scope readiness hardening to disk Codex only

The disk provider is the only target because the observed issue is tied to the user's disk Codex configuration and its local/proxy runtime instability. Managed Codex providers already have explicit provider-scoped runtime isolation and must not inherit disk recovery shortcuts.

Alternatives considered:

- Apply the same readiness gate to every Codex provider. Rejected because the existing spec explicitly says disk confirmation must not be applied to managed provider `thread/start` unless a future spec enables it.
- Apply the behavior to Claude Code too. Rejected because Claude Code uses a different session/runtime model and is outside the reported failure.

### Decision 2: Audit first, then patch the smallest failing boundary

Implementation should first trace disk create-session loading from UI action through `thread/start` / readiness confirmation to composer send enablement. If the path already satisfies readiness, code changes should be limited to notice copy and tests documenting the existing behavior.

Alternatives considered:

- Immediately add another readiness probe. Rejected because duplicate probes can create slow starts or new races.
- Only patch the visible copy. Rejected because a broken loading/readiness contract would remain.

### Decision 3: Keep raw diagnostics out of final notice copy

`reasonCode`, `shutdownSource`, and raw provider text remain useful for logs, diagnostics bundles, and tests, but the runtime notice summary should translate known recoverable states into user language.

Alternatives considered:

- Display every raw diagnostic for transparency. Rejected because it leaks implementation details and misleads users in cases like `manual shutdown (source: stale_reuse_cleanup)`.
- Hide all details. Rejected because support/debug flows still need stable structured fields.

### Decision 4: Model internal cleanup as recovery state when foreground readiness is affected

`stale_reuse_cleanup` is an internal lifecycle cleanup source. If it affects disk create-session or immediate first send, the user-facing result should be "connection interrupted / reconnect or retry", not "manual shutdown".

Alternatives considered:

- Treat all manual-shutdown reason codes as benign. Rejected because cleanup during foreground readiness can block the user and needs visible recovery.
- Treat all runtime-ended events as fatal. Rejected because existing recovery contracts classify some cases as retryable.

## Risks / Trade-offs

- [Risk] Extra readiness waiting could slow down healthy disk session creation.
  - Mitigation: audit existing gates first; only add bounded waits where evidence proves the current path settles too early.
- [Risk] Copy softening could hide an unrecoverable backend failure.
  - Mitigation: only map known classified states; unknown errors remain visible with raw detail available in diagnostics.
- [Risk] A shared helper change could accidentally affect Claude Code or managed Codex providers.
  - Mitigation: require focused non-regression tests for those paths and keep disk-provider checks explicit.

## Migration Plan

1. Inspect the disk Codex create-session/loading path and record whether readiness is already enforced.
2. Patch only the failing boundary:
   - readiness/loading if the audit finds a readiness defect;
   - notice copy/interpolation if readiness already holds or after readiness is fixed.
3. Add focused frontend tests and any necessary backend tests.
4. Validate this OpenSpec change and focused implementation tests.

Rollback is a normal revert of the implementation/spec commit. No data migration is required.

## Open Questions

- Does the current loading state end after frontend thread object creation, backend native `thread/start`, or successful same-runtime readiness confirmation?
- Is the screenshot notice produced by the create-session path, first send path, runtime-ended event handler, or a combination of runtime-ended plus stale recovery notices?
- Should the final user action wording prefer `重试`, `重新连接`, or `重新打开会话` for disk first-turn stale binding after bounded recovery fails?
