## Context

Harness governance currently has several real implementation slices:

- Governance evidence types, snapshot construction, and read-only workspace readers.
- Checkpoint policy chain and policy audit surface.
- Large-file and heavy-test-noise workflows.
- Engine capability matrix and runtime contract checks.
- Agent domain event schema/runtime foundation.
- Realtime event batching, long-list virtualization, bundle chunking, and one mega-hub split slice.

The code review found one critical seam: `useGovernanceEvidence()` feeds a visible `GovernanceEvidenceSection`, but the live `StatusPanel` checkpoint construction does not currently pass a `GovernanceEvidenceSnapshot` into `buildCheckpointViewModel()`. Therefore bridge-fed governance policies are proven by tests and types, but the real dock checkpoint path is not fully closed.

The structural substrate is also first-slice complete rather than final: long-list browser evidence and webview startup timing remain explicitly unsupported, and mega-hub split work has reduced one selected hub but left major hubs in follow-up order.

The previous 90% target is now only the minimum readiness floor. The updated target is 95%-99% governance-layer readiness. That requires not only live policy closure, but also provenance, replayability, cross-platform validation, recovery behavior, and archive-ready handoff evidence.

## Architecture

The 95%-99% readiness target is a closure layer over existing implementations, not a new product surface.

```text
workspace artifacts / runtime facts
  -> governance evidence readers and adapters
  -> frozen GovernanceEvidenceSnapshot
  -> CheckpointPolicyEvidence.governanceSnapshot
  -> bridgeGovernancePolicies / consolidated gate policies
  -> PolicyDecisionAuditPanel
  -> StatusPanel checkpoint verdict and audit rationale
  -> implementation evidence / replay bundle / archive handoff
```

The implementation sequence must preserve these boundaries:

- Collection may read workspace artifacts through existing Tauri workspace file APIs.
- Snapshot creation remains pure and framework-free.
- Policy evaluation consumes a snapshot and performs no I/O.
- UI renders decisions and evidence but does not mutate OpenSpec, Trellis, or governance artifacts.
- Gate consolidation never runs checks itself; it only consumes collected evidence.
- Evidence records must carry enough source metadata to explain where a decision came from without re-running the gate.
- Replay must be possible from captured artifacts and frozen snapshots without live filesystem mutation.
- Recovery must degrade to `unknown` or advisory `warn`; malformed evidence must not break the checkpoint UI.

## Current Calibration

| Area | Current Fact | Release-Grade Gap |
|---|---|---|
| Evidence bridge | Typed union, snapshot core, path normalization, readers, tests exist. | Live checkpoint path must receive snapshot; artifact-backed gate evidence needs stronger ingestion. |
| Policy chain | Core/validation/bridge policies exist; audit UI exists. | Real UI path must prove governance decisions appear from actual snapshot input. |
| Gate governance | large-file/heavy-test workflows and adapters exist. | Reports/logs must become evidence, not only workflow/script presence. |
| Domain events | Schema, factories, runtime controller exist. | One bounded producer/consumer path must be implemented before claiming runtime governance maturity. |
| Realtime batching | Contract batcher and hook integration exist. | Production/browser observation remains follow-up for tuning. |
| Long-list virtualization | Viewport boundary exists; active streaming row protected. | Browser-level S-LL-1000 evidence is still unsupported/pending. |
| Bundle chunking | Manual chunks and checker exist. | Webview first-paint/interactive timing is unsupported. |
| Mega-hub split | One `MessagesRows` helper slice extracted. | Additional hub slices remain; app-shell is intentionally last. |
| Provenance/replay | Evidence types are structured, but replay contract is not yet formalized. | Need source id, observed-at, parser version, artifact path/hash where available, and replay fixtures. |
| Recovery/rollback | Slice rollback strategy exists at design level. | Need executable degraded-state tests and operator recovery guidance. |
| Cross-platform | Compatibility is documented as a constraint. | Need Windows/macOS/Linux path/newline/case/command evidence or explicit external-CI qualifier. |
| Sync/archive | OpenSpec lifecycle exists. | Need implementation evidence, sync/archive readiness checklist, and no stale "90%" wording before closure. |

## Design Decisions

### Decision 1: Use a readiness umbrella instead of reopening every first-slice change

The existing substrate changes contain useful implementation evidence. Reopening them as if they were unstarted would create churn and obscure what is already done. The umbrella change records remaining closure work, keeps 90% as the minimum floor, and defines the stricter 95%-99% release-grade target.

### Decision 2: Close the live policy path first

Snapshot injection is the highest-leverage missing seam. Without it, evidence appears in UI but policy decisions are not actually governed by it in the live checkpoint path.

### Decision 3: Separate artifact presence from artifact result

The current script/workflow readers can prove that checks are configured. The next readiness step must distinguish:

- configured gate exists
- latest gate artifact exists
- artifact parsed successfully
- artifact contributes pass/warn/fail/unknown to policy

### Decision 4: Promote one domain event path, not a global EventBus

The first runtime domain-event adoption should be narrow: one bounded producer and one governance consumer, with tests proving no duplicate or unbounded fan-out. A general EventBus remains out of scope.

### Decision 5: Structural substrate must be evidence-backed

Virtualization and chunking are implemented enough to support growth, but release-grade readiness requires honest browser/runtime evidence or explicitly documented unsupported markers with follow-up tasks.

### Decision 6: Raise the goal to 95%-99% without pretending 100%

90% means the main governance loop is closed. It does not prove operational maturity. The upgraded target uses three gates:

- 90% floor: live snapshot injection, gate result evidence, one domain-event runtime path, structural evidence recorded.
- 95% target: the same loop also has provenance, replay fixtures, degraded-state recovery tests, and operator handoff notes.
- 99% evidence-complete: the same target has actual Windows/macOS/Linux result evidence with no unresolved platform qualifier.

100% is intentionally out of scope because it would require long-running production telemetry, release-channel evidence, and real user workload data that this local change cannot truthfully provide.

### Decision 7: Evidence provenance is mandatory but persistence is still out of scope

Evidence must explain source, parser, timestamp, artifact identity, and degradation reason where applicable. That metadata can live in the evidence payload and implementation-evidence docs. This does not authorize a persistent governance database, telemetry export, or dashboard.

## Implementation Plan

### Execution Guardrails

- Implementation MUST proceed in small slices. Do not combine snapshot injection, gate artifact ingestion, domain-event adoption, browser evidence, and hub split in one code change.
- Existing dirty work in unrelated `src/**` or `styles/**` files MUST be treated as external user/teammate work. Do not revert or reformat it.
- Each slice MUST update only its declared write set unless a compile error proves a directly related type surface must move with it.
- If a slice touches files already modified by another person, stop and re-scope rather than resolving by whole-file overwrite.
- No slice may introduce a parallel `src/governance/` business layer, a new dashboard, a persistent governance store, or a global EventBus.

### Slice Order And Ownership

| Slice | Purpose | Primary Write Set | Can Run In Parallel? | Exit Gate |
|---|---|---|---|---|
| S0 | Planning validation | `openspec/changes/advance-harness-governance-to-90/**` | Yes, docs only | OpenSpec strict validation |
| S1 | Live snapshot injection | `src/features/status-panel/components/StatusPanel.tsx`, `src/features/status-panel/components/StatusPanel.test.tsx`, `scripts/check-governance-evidence-bridge.mjs` | No, blocks S2 policy consumption | governance audit appears from live snapshot |
| S2 | Gate artifact ingestion | `src/features/governance/evidence/**`, `scripts/check-large-files.mjs`, `scripts/check-heavy-test-noise.mjs`, tests only as needed | After S1 design is known; implementation can be split by gate | artifact-backed evidence distinguishes missing/configured/result |
| S3 | Domain event adoption | `src/features/threads/domain-events/**`, one selected producer/consumer path, focused tests, `scripts/check-agent-domain-event-adoption.mjs`, `package.json` | After S1; independent from S2 if write sets do not overlap | one bounded runtime producer/consumer path plus adoption checker |
| S4 | Structural evidence hardening | perf scripts/docs for long-list/browser and webview timing | Yes, if it does not touch message/style split files under active work | honest browser/runtime evidence or explicit unsupported record |
| S5 | Next hub split slice | one selected hub and extracted helper/tests | No if another teammate is already splitting the same area | one-hub-per-slice size and test evidence |
| S6 | Evidence provenance and replay | `src/features/governance/evidence/**`, replay fixtures/tests, implementation evidence | After S1-S2; can split into fixture-only and metadata-only tasks | decisions can be replayed from captured evidence without re-running gates |
| S7 | Cross-platform release evidence | scripts/tests/docs for path/newline/case/platform behavior | After S2/S6; can run independently per platform | Win/macOS/Linux evidence or explicit external-CI qualifier |
| S8 | Recovery and operator handoff | recovery tests, runbook docs, implementation evidence | After S1-S7 | degraded states are documented, tested, and operator-actionable |
| S9 | Final sync/archive readiness | `implementation-evidence.md`, OpenSpec sync/archive notes | No; final slice only | 95%-99% percentage rationale and archive checklist are complete |

### Concrete First Slice: S1 Snapshot Injection

S1 is the first implementation task because it closes the actual governance-policy loop.

Current seam:

```text
StatusPanel
  -> useGovernanceEvidence(workspaceId, enabled)
  -> GovernanceEvidenceSection
  -> buildCheckpointViewModel(...) without governanceSnapshot
```

Target seam:

```text
StatusPanel
  -> useGovernanceEvidence(workspaceId, enabled)
  -> createFrozenGovernanceEvidenceSnapshot({ evidence, createdAt/id })
  -> buildCheckpointViewModel({ governanceSnapshot })
  -> bridgeGovernancePolicies
  -> PolicyDecisionAuditPanel
```

S1 constraints:

- Snapshot creation MUST happen outside policy evaluation.
- Snapshot identity SHOULD be stable for the same evidence array within a React render cycle.
- Compact popover MUST continue hiding the policy audit surface.
- The evidence section MUST remain read-only.
- Bridge-fed policies MUST NOT contribute `blocked`.
- Missing or empty evidence MUST keep existing checkpoint behavior.
- Implementation ordering MUST close the current `StatusPanel` hook/useMemo seam: `useGovernanceEvidence()` and the snapshot memo must be available before the `buildCheckpointViewModel()` useMemo receives `governanceSnapshot`, without conditional hook calls.
- If the checkpoint tab enablement currently depends on values created after `checkpoint`, the implementation MUST extract a pre-checkpoint enablement calculation rather than leaving `governanceSnapshot` unavailable to policy evaluation.

S1 target tests:

- `src/features/status-panel/components/StatusPanel.test.tsx`
  - add/update a dock checkpoint test proving governance evidence causes a bridge-fed policy audit row.
  - assert compact checkpoint popover still does not render policy audit.
- `src/features/status-panel/utils/checkpoint.test.ts`
  - keep or add a direct `governanceSnapshot` policy-chain regression if needed.
- `scripts/check-governance-evidence-bridge.mjs`
  - add a source-level guard that `StatusPanel.tsx` imports/uses `createFrozenGovernanceEvidenceSnapshot` and passes `governanceSnapshot` to `buildCheckpointViewModel`.

S1 validation:

```bash
npm exec vitest run src/features/status-panel/components/StatusPanel.test.tsx src/features/status-panel/utils/checkpoint.test.ts src/features/status-panel/utils/policies/bridgeGovernancePolicies.test.ts
npm run typecheck
npm run check:governance-evidence-bridge
npm run check:checkpoint-policy-chain
```

### Concrete Second Slice: S2 Gate Artifact Ingestion

S2 must be split by gate if needed.

Large-file gate target:

- Treat `scripts/check-large-files.mjs` output as a source of result evidence only when a structured report or deterministic parsed output exists.
- Preferred canonical source is a structured JSON report emitted by `scripts/check-large-files.mjs` because the current package scripts are command gates, not stable consumed artifacts.
- If implementation proves an existing output is already deterministic enough, record that decision in `implementation-evidence.md` before consuming it from UI policy code.
- Keep hard debt capable of `fail`; keep near-threshold watch as advisory `warn`.

Heavy-test-noise gate target:

- Prefer `.artifacts/heavy-test-noise.log` plus an optional structured summary if log parsing is too brittle.
- If log parsing remains brittle after tests cover ANSI/noisy output, add a structured summary before policy ingestion.
- Preserve advisory ceiling: raw failures can become evidence, but the governance policy contribution must not become `blocked` alone.

S2 validation:

```bash
node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs
npm run check:large-files:gate
npm run check:large-files:near-threshold
npm run check:governance-evidence-bridge
npm run check:checkpoint-policy-chain
```

Run `npm run check:heavy-test-noise` if test execution behavior, parser output, or noisy logs change.

### Concrete Third Slice: S3 Domain Event Adoption

S3 must choose exactly one low-risk producer before editing code.

Recommended producer candidates:

| Candidate | Pros | Risk | Recommendation |
|---|---|---|---|
| usage update event | Aligns with cost/context governance; narrow payload. | Token usage paths may be high frequency. | Good if batching/debounce is explicit. |
| turn completed/failed event | Low frequency; clear lifecycle. | Requires careful correlation with existing thread handlers. | Recommended first default. |
| message delta event | Rich evidence. | High frequency; likely fan-out risk. | Reject for first adoption. |

Default decision:

- Unless implementation inventory proves the turn lifecycle path is unsafe in the current dirty worktree, S3 MUST start with a turn completed/failed event.
- Choosing usage update instead MUST be recorded in `implementation-evidence.md` with the batching/debounce reason.

Consumer rule:

- The first consumer should derive governance evidence or test-only audit facts.
- It must not persist events, transmit events, or add a user-facing event dashboard.

Adoption proof:

- `npm run check:agent-domain-event-schema` is necessary but not sufficient because it proves schema/runtime boundaries, not real adoption.
- The implementation MUST add a focused adoption conformance check, `npm run check:agent-domain-event-adoption`, backed by `scripts/check-agent-domain-event-adoption.mjs`.
- The adoption checker MUST verify the selected producer emits through the internal controller, the selected governance consumer subscribes through the subscribe-only runtime, and no persistence, transport, or dashboard surface is introduced in the first adoption path.
- The adoption checker MUST fail if the only evidence is a schema/factory/runtime test with no real producer/consumer path.

S3 validation:

```bash
npm exec vitest run src/features/threads/domain-events/*.test.ts
npm run check:agent-domain-event-schema
npm run check:agent-domain-event-adoption
npm run typecheck
```

### Concrete Fourth Slice: S4 Structural Evidence

Long-list:

- Prefer an in-app browser or browser-use based local verification for S-LL-1000 if an app target is available.
- If not available, update implementation evidence with an explicit unsupported reason and a concrete command or manual matrix for later execution.

Bundle:

- Do not invent `firstPaintMs` or `firstInteractiveMs`.
- Only replace unsupported values if a real Tauri/webview timing source is added and documented.

S4 validation depends on touched files:

```bash
npm run perf:long-list:baseline
npm run perf:cold-start:baseline
npm run perf:baseline:aggregate
npm run check:bundle-chunking
```

### Concrete Fifth Slice: S5 Hub Split Continuation

S5 should not start while another person is actively splitting the same large files.

Default follow-up order remains:

1. Continue `MessagesRows.tsx` only if no one else is touching it.
2. Then `Messages.tsx`.
3. Then `src/utils/threadItems.ts`.
4. `src/app-shell.tsx` last.

Each S5 slice must state:

- selected single hub
- before/after line count
- extracted responsibility boundary
- public API compatibility
- targeted test list
- large-file gate result

### Concrete Sixth Slice: S6 Evidence Provenance And Replay

S6 is the difference between "policy works now" and "policy can be audited later".

Every governance evidence item consumed by policy decisions MUST expose or derive:

- stable evidence id
- source type and source id
- observed-at timestamp
- workspace-relative normalized path, never user-specific absolute paths in committed fixtures
- degradation reason for `unknown` or advisory evidence

Conditional provenance:

- Parser or adapter identity MUST be recorded when the consumed evidence passed through a parser or adapter.
- Artifact path and artifact hash MUST be recorded when the consumed evidence came from a file artifact.
- If parser/adapter identity or artifact identity is genuinely unavailable, the replay fixture or implementation evidence MUST document that absence explicitly; silent omission is not release-grade.

Replay target:

- A captured fixture should feed `createFrozenGovernanceEvidenceSnapshot`.
- The snapshot should feed `buildCheckpointViewModel`.
- The resulting policy audit decisions should be deterministic.
- Replay must not read the live filesystem, run shell commands, or mutate OpenSpec/Trellis artifacts.

S6 validation:

```bash
npm exec vitest run src/features/governance/evidence src/features/status-panel/utils/policies src/features/status-panel/utils/checkpoint.test.ts
npm run check:governance-evidence-bridge
npm run check:checkpoint-policy-chain
```

### Concrete Seventh Slice: S7 Cross-Platform Release Evidence

S7 converts compatibility guidance into evidence.

Required compatibility dimensions:

- path separators: POSIX and Windows-style paths normalize into the same governance source identity
- newline handling: LF and CRLF artifacts parse equivalently
- case behavior: fixtures do not assume case-sensitive filesystem semantics unless documented
- shell behavior: package scripts use Node entrypoints or npm scripts, not inline POSIX-only shell where cross-platform behavior is required
- executable behavior: no hardcoded `.sh`, `/tmp`, `rm`, `cp`, `grep`, or unquoted POSIX path dependency in new governance checks

S7 evidence levels:

- Local macOS evidence is required because this workspace runs on macOS.
- Windows and Linux evidence must come from CI artifacts, documented external-CI qualifiers, or reproducible commands that can be run by the release owner.
- 95% may proceed with explicit external-CI qualifiers. 99% requires the qualifier to be replaced by actual three-platform evidence.
- A 99% claim MUST NOT rely on "command is reproducible" alone; it requires actual result evidence for Windows, macOS, and Linux.

Each platform evidence row in `implementation-evidence.md` MUST include:

- `platform`
- `command`
- `runUrlOrArtifactPath`
- `date`
- `commit`
- `result`
- `qualifier`

Aggregate wording such as "cross-platform validated" is not sufficient without the per-platform rows above.

S7 validation:

```bash
npm run typecheck
node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs
npm run check:large-files:gate
npm run check:large-files:near-threshold
```

### Concrete Eighth Slice: S8 Recovery And Operator Handoff

S8 proves the governance layer fails safely.

Required recovery cases:

- missing workspace id keeps checkpoint stable
- missing artifact degrades to `unknown` or advisory `warn`
- malformed artifact records degradation reason
- stale artifact does not become a fresh pass
- duplicate evidence does not create duplicate blocking policy decisions
- domain-event consumer unsubscribe is idempotent

Operator handoff must document:

- where to look when governance evidence is missing
- which commands regenerate local evidence
- which warnings are advisory versus release-blocking
- how to rollback each slice without deleting unrelated user work

S8 validation:

```bash
npm exec vitest run src/features/governance/evidence src/features/status-panel src/features/threads/domain-events
npm run check:governance-evidence-bridge
npm run check:checkpoint-policy-chain
npm run check:agent-domain-event-schema
npm run check:agent-domain-event-adoption
```

### Concrete Ninth Slice: S9 Final Release-Grade Closure

S9 is documentation and governance closure only after code tasks pass.

The final `implementation-evidence.md` must include:

- exact readiness percentage and rationale
- commands run, dates, platform qualifiers, and residual risks
- per-platform evidence rows with `platform`, `command`, `runUrlOrArtifactPath`, `date`, `commit`, `result`, and `qualifier`
- evidence replay fixture list
- large-file and heavy-test-noise sentry results
- OpenSpec sync/archive readiness checklist
- explicit distinction between harness governance-layer readiness and whole-harness ecosystem maturity

S9 validation:

```bash
openspec validate advance-harness-governance-to-90 --strict --no-interactive
openspec validate --all --strict --no-interactive
python3 .claude/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full
```

## Validation Matrix

| Readiness Area | Required Evidence |
|---|---|
| Live policy closure | StatusPanel/checkpoint test proves governance snapshot affects policy audit. |
| Bridge conformance | `npm run check:governance-evidence-bridge` fails if snapshot injection is missing. |
| Gate ingestion | Parser tests cover pass/warn/fail/unknown, missing artifacts, CRLF/LF, Windows-style paths. |
| Domain event adoption | Factory/runtime tests plus one producer/consumer regression test and `check:agent-domain-event-adoption`. |
| Structural substrate | Long-list/browser and bundle/webview evidence recorded honestly. |
| Cross-platform | Node entrypoints and tests avoid POSIX-only shell, path, newline, and case-sensitive assumptions. |
| Provenance | Consumed evidence includes source id, observed-at, required parser/adapter identity when parsed/adapted, required artifact identity when artifact-backed, and degradation reason. |
| Replay | Captured fixtures reproduce policy audit decisions without live I/O. |
| Recovery | Missing, malformed, stale, duplicate, and unsubscribed states are tested and documented. |
| Archive handoff | `implementation-evidence.md`, spec validation, consistency validation, and sync/archive checklist are complete. |

## Rollback Strategy

Each implementation slice must be independently reversible:

- Snapshot injection rollback removes the `governanceSnapshot` input while preserving visible evidence display.
- Gate ingestion rollback falls back to configured/present evidence only.
- Domain event adoption rollback removes the selected producer/consumer path while leaving type-only schema/runtime intact.
- Browser/runtime evidence additions can be disabled without changing core UI behavior.
- Provenance/replay rollback removes fixture consumption without removing the core evidence bridge.
- Cross-platform evidence rollback removes the stricter claim and keeps external-CI qualifiers visible.

## Open Questions

- What artifact hash format should be canonical for governance evidence: SHA-256 only, or allow tool-provided hashes when present?
- Which CI run should be the authoritative source for Windows/Linux 99% evidence if local validation is macOS-only?
