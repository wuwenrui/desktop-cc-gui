## ADDED Requirements

### Requirement: Harness Governance Release-Grade Readiness MUST Define Percentage Gates

The system MUST treat 90% as a minimum floor, 95% as the release-grade target, and 99% as evidence-complete governance-layer readiness.

#### Scenario: 90 percent is only the minimum floor

- **WHEN** the live policy path, gate result evidence, one domain-event runtime path, and structural evidence are complete
- **THEN** the implementation MAY claim the 90% minimum floor
- **BUT** it MUST NOT claim 95%-99% until provenance, replay, recovery, operator handoff, and platform evidence are complete

#### Scenario: 95 percent requires operational closure

- **WHEN** the implementation claims 95% readiness
- **THEN** it MUST include provenance metadata for consumed evidence
- **AND** it MUST include deterministic replay coverage
- **AND** it MUST include degraded-state recovery tests
- **AND** it MUST include operator handoff guidance
- **AND** it MUST include macOS local evidence plus explicit Windows/Linux CI qualifiers or actual Windows/Linux evidence

#### Scenario: 99 percent requires platform-complete evidence

- **WHEN** the implementation claims 99% readiness
- **THEN** actual Windows, macOS, and Linux evidence MUST be recorded
- **AND** any unresolved platform qualifier MUST cap the claim below 99%

### Requirement: Harness Governance Readiness MUST Close The Live Policy Path

The system MUST feed collected governance evidence into the live checkpoint policy chain, not only render it as a read-only evidence section.

#### Scenario: StatusPanel checkpoint consumes governance snapshot

- **WHEN** `StatusPanel` loads governance evidence for the active workspace
- **THEN** it MUST create or receive a frozen `GovernanceEvidenceSnapshot`
- **AND** it MUST pass that snapshot to `buildCheckpointViewModel`
- **AND** bridge-fed policies MUST be able to emit policy audit decisions from that snapshot

#### Scenario: evidence display without policy injection is rejected

- **WHEN** governance evidence is displayed in the checkpoint dock
- **THEN** the governance bridge conformance check MUST also verify that the same evidence can reach the checkpoint policy input
- **AND** a UI-only evidence surface MUST NOT be considered release-grade complete

### Requirement: Gate Evidence MUST Distinguish Configuration From Result

The system MUST distinguish configured governance gates from parsed gate results before using those gates for release-grade readiness claims.

#### Scenario: configured gate is not treated as passing result

- **WHEN** a package script or workflow file exists but no latest artifact is available
- **THEN** the bridge MAY report configured evidence
- **BUT** it MUST NOT claim a passing gate result unless the corresponding artifact or command result is parsed

#### Scenario: missing gate artifact degrades safely

- **WHEN** a large-file, heavy-test-noise, realtime, or runtime-contract artifact is missing or malformed
- **THEN** the adapter MUST emit `unknown` or `warn` evidence with `degraded: true`
- **AND** policy evaluation MUST continue without throwing

#### Scenario: advisory gates remain advisory

- **WHEN** heavy-test-noise or large-file near-threshold evidence reports a problem
- **THEN** it MUST contribute at most `warn`
- **AND** hard release blocking MUST remain reserved for hard-debt, runtime-contract, strict-validation, or equivalent non-advisory failures

### Requirement: Domain Events MUST Have One Bounded Runtime Adoption Path Before Release-Grade Readiness

The system MUST promote the current domain event schema/runtime from isolated foundation to at least one bounded runtime producer/consumer path before claiming release-grade readiness.

#### Scenario: selected producer emits through internal controller only

- **WHEN** the first runtime producer emits an `AgentDomainEvent`
- **THEN** it MUST use the internal controller surface
- **AND** the application-facing runtime MUST remain subscribe-only

#### Scenario: first consumer is governance-scoped

- **WHEN** the first runtime consumer subscribes to domain events
- **THEN** it MUST be governance-scoped
- **AND** it MUST NOT persist, transmit, or expose event payloads through a new dashboard in this readiness pass

### Requirement: Structural Substrate Evidence MUST Be Honest And Reproducible

The system MUST keep first-slice substrate evidence separate from final readiness evidence.

#### Scenario: long-list browser evidence is recorded or explicitly unsupported

- **WHEN** long-list virtualization is used as release-grade readiness evidence
- **THEN** `S-LL-1000` MUST include browser-level scroll evidence
- **OR** the implementation evidence MUST explicitly mark browser scroll evidence as unsupported with a reproducible reason and follow-up task

#### Scenario: webview startup timing is not invented

- **WHEN** bundle chunking is used as release-grade readiness evidence
- **THEN** `firstPaintMs` and `firstInteractiveMs` MUST remain explicitly unsupported unless a trustworthy Tauri/webview timing source is introduced
- **AND** unsupported values MUST NOT be replaced with synthetic or jsdom-only measurements

#### Scenario: mega-hub split continues by one hub per slice

- **WHEN** another large hub is split
- **THEN** exactly one primary hub MUST be selected per implementation slice
- **AND** the slice MUST preserve public contracts, pass large-file governance, and record before/after size evidence

### Requirement: Evidence Provenance And Replay MUST Be Auditable

The system MUST make governance decisions explainable and replayable without re-running live gates.

#### Scenario: consumed evidence carries provenance

- **WHEN** governance evidence contributes to a policy audit decision
- **THEN** the consumed evidence MUST identify its source type and source id
- **AND** it MUST expose an observed-at timestamp
- **AND** it MUST expose parser or adapter identity when the evidence passed through a parser or adapter
- **AND** it MUST expose artifact path and artifact hash when the evidence came from a file artifact
- **AND** unavailable parser/adapter or artifact identity MUST be explicitly qualified in replay fixtures or implementation evidence
- **AND** `unknown` or advisory evidence MUST include a degradation reason

#### Scenario: policy decisions can be replayed from captured evidence

- **WHEN** a replay fixture is loaded
- **THEN** the fixture MUST create a frozen `GovernanceEvidenceSnapshot`
- **AND** the snapshot MUST reproduce deterministic checkpoint policy audit decisions
- **AND** replay MUST NOT read the live filesystem, run shell commands, or mutate OpenSpec/Trellis artifacts

### Requirement: Recovery Behavior MUST Fail Safely

The system MUST preserve checkpoint stability when governance evidence is absent, malformed, stale, or duplicated.

#### Scenario: missing or malformed evidence does not break checkpoint

- **WHEN** workspace id, artifact content, or parsed evidence is missing or malformed
- **THEN** checkpoint policy evaluation MUST continue
- **AND** the governance contribution MUST degrade to `unknown` or advisory `warn`
- **AND** the degradation reason MUST be visible in evidence metadata or implementation evidence

#### Scenario: stale or duplicate evidence does not overstate readiness

- **WHEN** artifact evidence is stale or duplicated
- **THEN** stale evidence MUST NOT become a fresh passing result
- **AND** duplicate evidence MUST NOT create duplicate blocking policy decisions

#### Scenario: domain event unsubscribe remains idempotent

- **WHEN** the bounded governance consumer unsubscribes more than once
- **THEN** the runtime MUST remain stable
- **AND** no duplicate fan-out or retained listener MUST be required for readiness

### Requirement: Cross-Platform Evidence MUST Be Explicit

The system MUST validate governance readiness across Windows, macOS, and Linux compatibility dimensions.

#### Scenario: path and newline compatibility is covered

- **WHEN** gate artifacts use POSIX paths, Windows-style paths, LF, or CRLF
- **THEN** governance parsers MUST normalize them consistently
- **AND** the resulting evidence identity MUST not depend on platform-specific separators

#### Scenario: shell and filesystem assumptions are controlled

- **WHEN** governance checks are added or modified
- **THEN** required cross-platform entrypoints MUST use Node/npm scripts or an explicitly isolated platform adapter
- **AND** they MUST NOT rely on POSIX-only inline shell, `/tmp`, `rm`, `cp`, `grep`, executable bit semantics, or case-sensitive filesystem behavior without explicit adapter isolation or documented qualification

#### Scenario: platform evidence is recorded before 99 percent claim

- **WHEN** release-grade closure is reported
- **THEN** macOS local evidence MUST be recorded when available
- **AND** Windows/Linux CI evidence MUST be recorded for a 99% claim
- **AND** missing Windows/Linux evidence MUST be recorded as an external-CI qualifier and cap the claim below 99%
- **AND** each platform evidence row MUST include platform, command, run URL or artifact path, date, commit, result, and qualifier

### Requirement: Release-Grade Readiness MUST Be Validated Across Governance Gates

The system MUST define a validation bundle for declaring the harness governance layer release-grade ready.

#### Scenario: readiness validation bundle passes

- **WHEN** the release-grade readiness implementation is complete
- **THEN** the following commands or their documented equivalents MUST pass:
- **AND** `npm run typecheck` MUST pass
- **AND** `npm run check:governance-evidence-bridge` MUST pass
- **AND** `npm run check:checkpoint-policy-chain` MUST pass
- **AND** `npm run check:agent-domain-event-schema` MUST pass
- **AND** `npm run check:agent-domain-event-adoption` MUST pass after the bounded adoption path is implemented
- **AND** `npm run check:engine-capability-matrix` MUST pass
- **AND** `npm run check:large-files:gate` MUST pass
- **AND** `npm run check:large-files:near-threshold` MUST pass without hard failures
- **AND** `openspec validate advance-harness-governance-to-90 --strict --no-interactive` MUST pass
- **AND** `openspec validate --all --strict --no-interactive` MUST pass

#### Scenario: noisy or large-file-sensitive changes run sentries

- **WHEN** implementation touches test execution, governance scripts, CI gates, large source files, or style files
- **THEN** heavy-test-noise and large-file sentries MUST be run according to the affected scope
- **AND** any warning-only residuals MUST be documented as backlog, not hidden as pass evidence

#### Scenario: archive handoff is complete

- **WHEN** this change is prepared for sync/archive
- **THEN** `implementation-evidence.md` MUST document readiness percentage, commands, dates, platform qualifiers, replay fixtures, sentry results, and residual risks
- **AND** it MUST distinguish harness governance-layer readiness from whole-harness ecosystem maturity
- **AND** it MUST list sync/archive prerequisites before the change is archived
