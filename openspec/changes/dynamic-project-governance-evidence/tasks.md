## 1. Phase 1 - Stop The Bleeding For Cost/Budget

- [x] 1.1 [P0][depends:none][I: active StatusPanel cost props and active thread state][O: active thread/session id reaches cost surface][V: CostBudgetSection/StatusPanel tests prove valid active thread does not render a generic dash] Fix active session attribution for Cost/Budget.
- [x] 1.2 [P0][depends:none][I: active engine/model/usage and pricing lookup result][O: token-only fallback state for pricing unavailable][V: unknown model renders token usage and explicit pricing-unavailable action, never silent `$0.00`] Make missing pricing explicit and actionable.
- [x] 1.3 [P0][depends:1.2][I: ThreadTokenUsage breakdown][O: token breakdown view model usable by legacy or V2 UI][V: input/output/cached/reasoning zero and non-zero cases are covered] Prepare TokenBreakdownBar semantics without requiring Cost V2 rollout.
- [x] 1.4 [P1][depends:1.2][I: pricing fixtures/source metadata][O: visible pricing freshness/provenance in cost UI][V: monetary values show source date or stale marker] Surface pricing source freshness.
- [x] 1.5 [P1][depends:1.2][I: budget prop/config absence][O: budget-unconfigured watch state][V: unconfigured budget is not rendered as a failed budget] Clarify unconfigured Budget UX.

## 2. Phase 2 - Project Profile Foundation

- [x] 2.1 [P0][depends:none][I: workspace-relative file list, package/build/config metadata][O: `ProjectGovernanceProfile` type and detector][V: generic, Node/TS, Python, Rust, Go, Maven, Gradle, OpenSpec/Trellis fixtures classify correctly] Define the project governance profile model and detector.
- [x] 2.2 [P0][depends:2.1][I: native path variants and CRLF/LF fixtures][O: normalized workspace-relative profile facts][V: Windows separator and CRLF fixture tests produce the same semantic profile as POSIX/LF] Add cross-platform path and newline normalization coverage.
- [x] 2.3 [P1][depends:2.1][I: package scripts, build files, CI files, lockfiles, artifacts][O: profile facts for scripts, package managers, CI providers, lockfiles, and artifacts][V: mixed Tauri/Node+Rust fixture preserves both ecosystems] Cover mixed-ecosystem workspaces without dropping secondary toolchains.
- [x] 2.4 [P1][depends:2.1][I: optional `governance.config.json` v1][O: override loader and merge semantics][V: missing config still uses auto profile; malformed config emits degraded config evidence without suppressing auto evidence] Add optional governance config override.
- [x] 2.5 [P2][depends:2.4][I: config template action][O: safe empty/minimal governance config template][V: generated template contains no mossx-specific scripts, workflows, or artifact paths] Add non-destructive config template generation only if existing write APIs make it low-risk.

## 3. Phase 2 - Evidence Adapter Registry

- [x] 3.1 [P0][depends:2.1][I: existing governance readers][O: `EvidenceAdapter` contract and registry][V: adapters can be selected by `appliesTo(profile)` without emitting non-applicable rows] Introduce the profile-aware evidence adapter registry.
- [x] 3.2 [P0][depends:3.1][I: OpenSpec/Trellis readers][O: OpenSpec and Trellis adapters][V: generic fixture emits no OpenSpec/Trellis evidence; OpenSpec/Trellis fixture preserves task/session evidence] Wrap OpenSpec and Trellis readers with applicability gates.
- [x] 3.3 [P0][depends:3.1][I: package scripts and workflow readers][O: script/workflow adapters derived from detected scripts/workflows and optional config][V: Node fixture emits real package-script evidence; non-harness fixtures do not emit mossx harness script unknowns] Replace global harness script/workflow assumptions.
- [x] 3.4 [P0][depends:3.1][I: `.artifacts/*` governance reports and detected/configured scripts/workflows][O: artifact-backed gate adapters][V: artifact missing is emitted only when the related gate is applicable] Scope large-file and heavy-test artifact evidence to applicable profiles.
- [x] 3.5 [P1][depends:3.1][I: Python/Rust/Go/Maven/Gradle profile facts][O: ecosystem verification adapters with suggested commands][V: each ecosystem fixture emits only its applicable verification evidence] Add ecosystem-specific verification evidence expectations.

## 4. Phase 2 - Governance UI Grouping And Policy

- [x] 4.1 [P0][depends:3.1][I: `GovernanceEvidence[]`][O: grouped governance view model with `needs_action`, `watch`, `passed`][V: degraded rows sort before pass rows and pass rows collapse by default] Build action-oriented grouping for governance evidence.
- [x] 4.2 [P0][depends:4.1][I: grouped view model][O: updated `GovernanceEvidenceSection` UI][V: StatusPanel tests show counts, needs-action rows, watch rows, and collapsed passed group] Update StatusPanel governance evidence rendering.
- [x] 4.3 [P1][depends:4.2][I: non-pass evidence metadata][O: impact/source/suggested-action display][V: non-pass UI rows expose impact, source, and action or no-action rationale] Make evidence rows actionable rather than decorative.
- [x] 4.4 [P0][depends:3.1][I: dynamic governance evidence snapshot][O: policies that ignore non-applicable capabilities][V: Python fixture absence of harness large-file evidence contributes `no_contribution`] Prevent non-applicable capabilities from changing checkpoint verdicts.
- [x] 4.5 [P0][depends:4.4][I: applicable missing artifact evidence][O: advisory policy contribution capped at `needs_review`][V: missing applicable artifact never contributes `blocked`] Preserve advisory-first governance semantics.
- [x] 4.6 [P1][depends:4.4][I: policy decisions from profile-aware evidence][O: audit rows with source, artifact, observed time, qualifier, degradation reason][V: audit panel explains contribution without inventing evidence for non-applicable capabilities] Preserve applicability context in policy audit.

## 5. Phase 3 - Cost/Budget Productization

- [x] 5.1 [P1][depends:1.3][I: token breakdown view model][O: `TokenBreakdownBar` component][V: segment labels, percentages, zero-category omission, compact layout tests pass] Implement TokenBreakdownBar behind Cost V2 readiness.
- [x] 5.2 [P1][depends:1.2][I: projected cost records and active session id][O: local CostHistoryStore with session/today/month selectors][V: same-session accumulation, local day rollover, local month rollover tests pass] Add local accumulated cost history.
- [x] 5.3 [P1][depends:5.2][I: CostHistoryStore selectors][O: `AccumulatedCostCard` for Session/Today/Month][V: unavailable pricing hides monetary totals without hiding token evidence] Implement accumulated cost display.
- [x] 5.4 [P1][depends:1.5][I: local budget state][O: BudgetStore with monthly limit and thresholds][V: set/edit/clear budget tests pass; localStorage failure degrades to memory] Add local budget store.
- [x] 5.5 [P1][depends:5.4][I: BudgetStore and month-to-date cost][O: `BudgetBar` with unset/warn/exceeded states][V: 80%/100% visual states do not block AI requests] Implement BudgetBar.
- [x] 5.6 [P2][depends:5.4][I: settings surface][O: Budget settings section][V: changing monthly budget updates StatusPanel without app restart] Add budget settings UI.
- [x] 5.7 [P1][depends:5.1,5.3,5.5][I: feature flag config][O: `statusPanel.costV2` guarded container][V: flag off renders legacy UI; flag on renders V2 modules] Gate expanded Cost V2 UI behind feature flag.
- [x] 5.8 [P1][depends:5.1,5.3,5.5][I: cost degraded states][O: cost-budget evidence or grouped governance contribution][V: pricing unavailable can appear in needs-action and budget unconfigured can appear in watch] Integrate cost states into governance grouping.

## 6. Conformance And Validation

- [x] 6.1 [P0][depends:3.1][I: adapter registry and source files][O: conformance check against product-specific global evidence lists][V: checker fails on an adapter/list that can emit without `appliesTo(profile)`] Add guardrail against reintroducing global mossx-only evidence.
- [x] 6.2 [P0][depends:1-5][I: changed frontend code][O: focused Vitest coverage][V: `npm exec vitest run` on governance evidence, StatusPanel, CostBudgetSection, checkpoint policy tests passes] Run focused frontend regression tests.
- [x] 6.3 [P0][depends:1-5][I: changed TypeScript surface][O: type safety confirmation][V: `npm run typecheck` passes] Run TypeScript validation.
- [x] 6.4 [P0][depends:6.1][I: conformance checker][O: governance evidence bridge check result][V: `npm run check:governance-evidence-bridge` passes] Run governance bridge conformance.
- [x] 6.5 [P0][depends:spec/design/tasks complete][I: OpenSpec change artifacts][O: strict OpenSpec validation][V: `openspec validate dynamic-project-governance-evidence --strict --no-interactive` passes] Validate the OpenSpec change.
