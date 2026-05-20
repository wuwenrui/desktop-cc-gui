## 1. Advisory Policy Semantics

- [x] 1.1 [P0][depends:none][input:`src/features/status-panel/utils/policies/**`, `src/features/governance/evidence/**`][output: advisory contribution inventory][verify: inventory lists every governance-fed policy and its max contribution] Inventory current governance-fed checkpoint policies and classify which paths are core hard failures versus optional advisory signals.
- [x] 1.2 [P0][depends:1.1][input: governance-fed optional policies][output: policy contribution updates][verify: optional governance policies never return `blocked`] Cap optional governance policy contributions below `blocked` while preserving existing core runtime/fatal blocking behavior.
- [x] 1.3 [P0][depends:1.2][input: policy decision metadata][output: advisory classification metadata or equivalent structured mapping][verify: audit renderer can distinguish advisory rows from blocking rows without parsing display text] Add structured advisory classification for governance policy decisions.
- [x] 1.4 [P0][depends:1.2-1.3][input: policy tests][output: focused regression tests][verify: tests cover warning, stale, missing, malformed, and platform-qualified evidence without `blocked`] Add policy-chain tests for advisory-only governance contribution semantics.

## 2. Checkpoint View Structure

- [x] 2.1 [P0][depends:1.1][input:`StatusPanel` checkpoint view-model and panel components][output: section projection design in code][verify: projection exposes Summary, Advisory Signals, Evidence Trail, Policy Audit, and Suggested Actions] Introduce a stable checkpoint section projection without changing evidence readers or policy engine ownership.
- [x] 2.2 [P0][depends:2.1][input: checkpoint panel rendering][output: expanded dock section layout][verify: dock expanded view renders all required sections in stable order] Refactor expanded checkpoint rendering to separate summary, advisory signals, evidence trail, policy audit, and suggested actions.
- [x] 2.3 [P1][depends:2.1][input: compact/popover rendering][output: compact advisory summary][verify: compact hosts show advisory presence, highest advisory level, source summary, or expandable entry point] Preserve advisory visibility in compact checkpoint hosts without rendering the full audit table by default.
- [x] 2.4 [P1][depends:2.2-2.3][input: checkpoint styles/i18n][output: visual and copy differentiation][verify: advisory rows do not use fatal/blocking wording or visual severity] Update checkpoint wording, i18n keys, and styles to distinguish advisory signals from blocking failures.

## 3. Evidence Trail And Suggested Actions

- [x] 3.1 [P0][depends:2.1][input: governance evidence provenance fields][output: evidence trail projection][verify: source id, observed time, stale/degraded reason, and available artifact identity are renderable] Project governance evidence provenance into an evidence trail suitable for checkpoint rendering.
- [x] 3.2 [P1][depends:3.1][input: known validation commands and existing detail surfaces][output: suggested action mapping][verify: each suggested action maps to an existing command or detail surface] Add optional suggested actions for advisory evidence gaps without executing commands on render or policy evaluation paths.
- [x] 3.3 [P1][depends:3.2][input: suggested action rendering][output: non-enforcing action UI][verify: displaying an action does not mutate verdict or require command execution] Render suggested actions as guidance rather than enforcement.

## 4. Validation And Governance Checks

- [x] 4.1 [P0][depends:1-3][input: StatusPanel/checkpoint tests][output: UI regression coverage][verify: dock and compact tests prove advisory signals are visible and non-blocking] Add focused StatusPanel / Checkpoint rendering tests for advisory section structure and compact parity.
- [x] 4.2 [P0][depends:1-3][input:`scripts/check-checkpoint-policy-chain.mjs`, `scripts/check-governance-evidence-bridge.mjs`][output: updated conformance checks for existing and new bridge governance policies][verify: checker fails if any optional governance policy can contribute `blocked`] Harden governance/policy conformance checks for advisory-only contribution ceilings.
- [x] 4.3 [P0][depends:4.1-4.2][input: local validation commands][output: verification evidence][verify: `npm run typecheck` passes and focused checkpoint/policy/audit tests pass] Run TypeScript and focused frontend regression validation.
- [x] 4.4 [P0][depends:4.3][input: governance commands][output: governance gate evidence][verify: `npm run check:governance-evidence-bridge`, `npm run check:checkpoint-policy-chain`, and relevant large-file/heavy-noise checks pass or remain advisory-documented] Run governance checks and document any advisory-only residual warning.
- [x] 4.5 [P0][depends:4.4][input: OpenSpec artifacts][output: strict validation result][verify: `openspec validate soften-harness-governance-to-advisory-mode --strict --no-interactive` and `openspec validate --all --strict --no-interactive` pass] Validate OpenSpec artifacts before implementation handoff.

## 5. Rollout And Handoff

- [x] 5.1 [P1][depends:4][input: implementation evidence][output: advisory rollout note][verify: note states that no new blocking gate was introduced] Record implementation evidence showing governance remains advisory-only in this phase.
- [x] 5.2 [P1][depends:5.1][input: completed tasks and validation evidence][output: sync/archive readiness note][verify: main spec sync/archive prerequisites are explicit] Prepare sync/archive handoff after implementation and validation are complete.
