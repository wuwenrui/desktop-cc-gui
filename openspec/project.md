# Project Context

- Type: OpenSpec Workspace
- Updated At: 2026-06-18T11:20:00+08:00
- Scope: governance snapshot for the current `mossx` repository workspace
- Product version fact: `ccgui@0.5.11` from `package.json` and `src-tauri/tauri.conf.json`

## Domain

OpenSpec workflow and governance for `mossx`, covering change lifecycle, main spec maintenance, validation, sync, and archive discipline.

The product in this repository is `ccgui`: a Tauri 2 desktop AI engineering workbench that integrates multiple coding engines, project intelligence, task execution, session activity, memory, terminal, Git, and governance surfaces.

## Architecture

- Product app: Tauri 2 + React 19 + TypeScript + Vite
- Frontend source: `src/**`
- Rust backend source: `src-tauri/src/**`
- Spec artifacts: `openspec/specs/*`
- Change workflow artifacts: `openspec/changes/<change-id>/{proposal,design,tasks,verification}.md`
- Archive: `openspec/changes/archive/*`
- Implementation rules: `.trellis/spec/**`
- Current workspace state: tracked active changes = `0`, archive changes = `506`, main specs = `353`

## Entry Surfaces

- `AGENTS.md`
  - repository entry, rule priority, PlanFirst gate, OpenSpec/Trellis boundary, merge guardrails
- `README.md` / `README.zh-CN.md`
  - product overview, development commands, documentation map
- `openspec/README.md`
  - concise OpenSpec navigation and common commands
- `openspec/project.md`
  - detailed governance overview and current workspace snapshot
- `openspec/changes/<change-id>/*`
  - change-local truth for proposal, design, tasks, and verification
- `openspec/specs/*`
  - mainline capability truth after sync/archive
- `.trellis/spec/**`
  - code-level implementation contracts and development rules

## Governance Model

- `AGENTS.md`
  - repo entry, global gates, minimal reading path, session record invariant, merge guardrails
- `.trellis/spec/**`
  - frontend/backend/guides implementation rules and executable contracts
- `openspec/**`
  - behavior specs, change workflow, archive, and workspace governance
- `.claude/**` / `.codex/**`
  - host hooks, commands, skills, and adapter glue
- `.omx/**` and local state files
  - runtime artifacts, not repository truth

## Current Inventory

- Active changes: `0`
- Archive changes: `506`
- Main specs: `353`
- Completed task sets still active: `0`
- Ready-for-implementation task sets: `0`

## Active Changes

No active OpenSpec changes remain after the 2026-06-18 closure batch. New behavior work should start from a fresh `openspec/changes/<change-id>/` directory.

## P1 Performance Execution Order

The previous v0.5.11 performance and recovery follow-up chain has been archived. Future performance work should open a new chain instead of reusing the archived change directories.

## Recent Archive / Sync Snapshot

### 2026-06-18 v0.5.11 Closure Batch

Archived 11 verified changes and synced their delta specs into main specs:

- `fix-runtime-reconnect-card-state-loop`
- `v0511-performance-evidence-and-runtime-jank-hardening`
- `reduce-streaming-reducer-commit-lag`
- `reduce-message-row-render-amplification`
- `reduce-turn-trace-batch-flush-lag`
- `measure-codex-first-delta-latency`
- `measure-codex-turn-start-ack-latency`
- `optimize-governance-sentry-noise-and-large-file-split`
- `fix-disk-codex-empty-draft-fresh-replay`
- `refactor-v0511-thread-messaging-recovery-and-streaming`
- `follow-up-v0511-large-file-cookbook-and-measured-evidence`

Spec sync summary: 25 main specs were created or updated, including v0.5.11 performance evidence, streaming latency diagnostics, Codex message recovery, stale binding recovery, large-file governance, and recovery cookbook capabilities. Counts after archive: active=0, archive=506, specs=353.

Validation: each change passed `openspec validate <change> --strict --no-interactive` immediately before archive. The batch archive used `openspec archive <change> -y`, which synced delta specs before moving each change into `openspec/changes/archive/2026-06-18-*`.

### 2026-05-30 Closure Baseline

The previous workspace snapshot archived 13 completed 0.5.4 changes and synced their delta specs into main specs. The archived set covered foreground settlement diagnostics, persisted client error logs, three-evidence settlement design/implementation/status-query reconciliation, appearance transparency controls, composer input affordance tuning, assistant message tail actions, client runtime environment recovery hardening, close-current-session shortcuts, Web Service workspace path entry, and Codex goal command discovery UX.

### 2026-05-28 Closure Baseline

The earlier closure pass archived 51 explicitly verified active changes across closure batches and synced main specs where the delta had not already been incorporated. This included session management, markdown preview, stale-thread recovery, runtime stability, governance evidence, file reference, email controls, Project Map closure work, performance gates, workspace session catalog, reasoning effort support, composer control surface, file rendering scheduler, and harness/performance governance.

### 2026-06-10 Closure Batch

Archived 15 verified changes across two closure passes and synced their delta specs into main specs:

- `extend-client-font-size-coverage`
- `add-semantic-diff-review`
- `deepen-semantic-diff-review`
- `harden-live-message-canvas-rendering`
- `polish-project-map-files-api-mvp`
- `refine-project-map-api-contract-detail-view`
- `harden-file-markdown-preview-rendering`
- `add-codex-provider-scoped-session-launch`
- `add-prompt-enhancer-manual-provider-timeout`
- `harden-codex-provider-session-catalog-recovery`
- `fix-message-fork-workspace-mutation`
- `fix-browser-context-light-theme-contrast`
- `fix-windows-titlebar-controls-overlap`
- `split-app-shell-runtime-boundaries`
- `unify-client-workflow-runtime-model`

Validation: `openspec validate --specs --strict --no-interactive` passed for all 325 main specs. Full `openspec validate --all --strict --no-interactive` is currently blocked by the pre-existing active change `harden-realtime-composer-status-panel-performance`, which has no spec delta.

### 2026-06-10 P0 Performance Closure Batch

Archived 5 verified P0 performance changes and synced their delta specs into main specs:

- `refresh-v059-performance-baseline`
- `enforce-bundle-budget-gate`
- `harden-file-editor-typing-latency`
- `parallelize-bootstrap-locale-loading`
- `split-startup-css-loading`
- `split-app-shell-performance-boundaries`
- `lazy-markdown-runtime`

Validation: each change passed `openspec validate <change> --strict --no-interactive` before archive. After archive, `openspec validate --specs --strict --no-interactive` passed for all 328 main specs.

## Code Fact Snapshot

Current-branch implementation substrate includes:

- Multi-engine runtime: Claude, Codex, OpenCode, Gemini, and custom provider surfaces.
- Project intelligence: Project Map / Project X-Ray, Project Memory, Context Ledger, SpecHub, and governance evidence panels.
- Execution surfaces: Task Center / TaskRun, Kanban, Plan panel, Session Activity, runtime log, terminal, Git history, and engine task output inspection.
- Runtime reliability: realtime batching, runtime evidence gates, lifecycle hardening, stalled recovery contracts, global client error log, and startup orchestration.
- Model output safety: provider-agnostic structured-output parser/repair/validator path for untrusted model JSON.
- Cross-platform shell/app behavior: Tauri 2 backend, platform build scripts, Linux startup guard, Windows config, macOS private API/title integration.

This snapshot is evidence-oriented. It does not claim full product QA for every surface. Archive notes must record exact focused tests, manual checks, skipped gates, and platform qualifiers.

## Namespace Policy

- Canonical prefix: `spec-hub-*`
- Compatibility prefix: `spec-platform-*` (legacy only; no new requirements)
- New proposals SHOULD use canonical prefixes unless compatibility migration requires otherwise.

## Workflow Governance

- OpenSpec is the source of truth for behavior changes:
  - `openspec/changes/<change-id>/*` defines proposal/design/tasks/spec deltas.
  - behavior changes SHOULD be tracked by an OpenSpec change before implementation.
- Trellis is the execution container for delivery:
  - `.trellis/tasks/*` should map back to one OpenSpec change.
  - implementation and verification should be traceable to linked change artifacts.
- Recommended delivery loop:
  1. Select or create an OpenSpec change.
  2. Create or activate the linked Trellis task.
  3. Implement and verify.
  4. Sync main specs and archive when the change passes gate checks.

## Key Commands

```bash
openspec validate --all --strict --no-interactive
openspec status --change <change-id>
find openspec/specs -mindepth 1 -maxdepth 1 -type d | wc -l
find openspec/changes -mindepth 1 -maxdepth 1 -type d ! -name archive | wc -l
find openspec/changes/archive -mindepth 1 -maxdepth 1 -type d | wc -l
npm run typecheck
npm run lint
npm run test
npm run check:runtime-contracts
npm run check:large-files
```

## Maintenance Boundaries

- `openspec/README.md` stays concise and navigation-oriented.
- `openspec/project.md` keeps durable governance context and current inventory only.
- High-drift implementation evidence, commit matrices, and temporary backfill snapshots should live in the relevant change artifacts or archive notes, not here.
- Host-specific session-start logic belongs in `.claude/**` or `.codex/**`, not in OpenSpec workspace docs.
- Product-facing overview belongs in `README.md` and `README.zh-CN.md`, not in OpenSpec change artifacts.

## Owners

- CodeMoss Team

## Update History

- 2026-06-12: Reconciled active OpenSpec workspace after code rollback. Active changes are the five P1 performance chain changes: `composer-and-message-row-render-budget`, `renderer-resource-backpressure`, `backend-io-cache-and-bridge-payload-budget`, `workspace-tree-and-large-file-listing-budget`, and `markdown-off-main-thread-pipeline`. Current tracked counts are active=5, archive=472, specs=328. Each active change validates individually under strict mode.
- 2026-06-11: Archived `lazy-markdown-runtime` after moving full Markdown parser dependencies behind `FullMarkdownRuntime`, preserving focused Markdown behavior tests, and syncing message markdown streaming compatibility deltas. Current tracked counts are active=3, archive=469, specs=328. Spec-only strict validation passed.
- 2026-06-11: Archived `split-app-shell-performance-boundaries` after removing AppShell `@ts-nocheck`, deferring release notes changelog data into a lazy chunk, and syncing app-shell runtime boundary deltas. Current tracked counts are active=4, archive=468, specs=328. Spec-only strict validation passed.
- 2026-06-10: Archived 2 additional startup P0 performance changes after user-run manual QA and synced their deltas into main specs. Current tracked counts are active=5, archive=467, specs=328. Spec-only strict validation passed.
- 2026-06-10: Archived 3 verified P0 performance changes and synced their deltas into main specs. Current tracked counts were active=7, archive=465, specs=327. Spec-only strict validation passed.
- 2026-06-10: Reconciled the active P0 performance workspace against dirty code evidence. Active changes were tracked as 10 total before archiving: 3 closure candidates, 3 near-complete or partially implemented changes, and 4 implementation backlog changes. Added an explicit closure order and attribution note.
- 2026-06-10: Archived 8 additional verified changes and synced their deltas into main specs. Current tracked counts are active=8, archive=459, specs=325. Spec-only strict validation passed; full strict validation remains blocked by active change `harden-realtime-composer-status-panel-performance` missing deltas.
- 2026-06-10: Archived 7 verified changes and synced their deltas into main specs. Current tracked counts are active=5, archive=451, specs=320. Spec-only strict validation passed; full strict validation remains blocked by active change `harden-realtime-composer-status-panel-performance` missing deltas.
- 2026-06-06: Stage-writeback refresh. Active change list corrected to the current seven active directories. `add-project-map-api-contract-view` and `add-intent-canvas-workspace-files` proposal/design artifacts received stage assessment and implementation calibration notes. Archive/main spec counts were intentionally not refreshed in this pass.
- 2026-06-01: Refreshed project documentation snapshot. Current counts were active=2, archive=402, specs=303. Active changes were `add-agent-task-orchestration-center` and `harden-model-structured-output-normalization`; the former remained 0.5.5 planning/execution work, while the latter was completed active work pending archive/closure decision.
- 2026-05-30: Archived 13 completed 0.5.4 changes after syncing delta specs into main specs. Previous workspace counts were active=2, archive=391, specs=299.
- 2026-05-28: Archived `fix-user-input-dismiss-settlement` after strict OpenSpec validation, focused Vitest coverage, typecheck, and lint. Previous workspace counts were active=4, archive=370, specs=291.
- 2026-05-28: Archived 20 verified changes from `feature/v0.5.4`, including the Project Map verified closure set, runtime performance evidence gates, workspace session catalog, reasoning-effort support, composer control surface, file rendering scheduler, and harness/performance governance changes.
