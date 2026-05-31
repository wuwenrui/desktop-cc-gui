# Project Context

- Type: OpenSpec Workspace
- Updated At: 2026-06-01T00:00:00+08:00
- Scope: governance snapshot for the current `mossx` repository workspace
- Product version fact: `ccgui@0.5.4` from `package.json` and `src-tauri/tauri.conf.json`

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
- Current workspace state: active changes = `2`, archive changes = `402`, main specs = `303`

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

- Active changes: `2`
- Archive changes: `402`
- Main specs: `303`
- Completed task sets still active: `1`
- In-progress task sets: `1`

## Active Changes

### `add-agent-task-orchestration-center`

- Task state: `0/31`.
- Current artifact fact: proposal, design, tasks, and spec deltas define the 0.5.5 Agent Task Orchestration Center direction.
- Product boundary: this must be a universal client capability, not a mossx-only OpenSpec/Trellis workbench.
- Core direction: provider-based orchestration task projection, manual task drafts, Project Map task bridge, TaskRun/session linkage, explicit dispatch gate, and review/closure workflow.
- Action: keep active as a 0.5.5 planning/execution change.

### `harden-model-structured-output-normalization`

- Task state: complete.
- Current code fact: shared model structured-output normalization has been implemented and adopted by Project Map generation and organizer paths.
- Captured implementation memory: `.trellis/spec/frontend/model-structured-output.md` and frontend index/quality triggers.
- Validation evidence recorded in change artifacts:
  - focused Vitest coverage for `src/services/modelStructuredOutput.test.ts`
  - focused Project Map organizer/generation tests
  - `openspec validate harden-model-structured-output-normalization --strict --no-interactive`
- Action: keep visible as completed active work until archive/closure decision is made.

## Recent Archive / Sync Snapshot

### 2026-05-30 Closure Baseline

The previous workspace snapshot archived 13 completed 0.5.4 changes and synced their delta specs into main specs. The archived set covered foreground settlement diagnostics, persisted client error logs, three-evidence settlement design/implementation/status-query reconciliation, appearance transparency controls, composer input affordance tuning, assistant message tail actions, client runtime environment recovery hardening, close-current-session shortcuts, Web Service workspace path entry, and Codex goal command discovery UX.

### 2026-05-28 Closure Baseline

The earlier closure pass archived 51 explicitly verified active changes across closure batches and synced main specs where the delta had not already been incorporated. This included session management, markdown preview, stale-thread recovery, runtime stability, governance evidence, file reference, email controls, Project Map closure work, performance gates, workspace session catalog, reasoning effort support, composer control surface, file rendering scheduler, and harness/performance governance.

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

- 2026-06-01: Refreshed project documentation snapshot. Current counts are active=2, archive=402, specs=303. Active changes are `add-agent-task-orchestration-center` and `harden-model-structured-output-normalization`; the former remains 0.5.5 planning/execution work, while the latter is completed active work pending archive/closure decision.
- 2026-05-30: Archived 13 completed 0.5.4 changes after syncing delta specs into main specs. Previous workspace counts were active=2, archive=391, specs=299.
- 2026-05-28: Archived `fix-user-input-dismiss-settlement` after strict OpenSpec validation, focused Vitest coverage, typecheck, and lint. Previous workspace counts were active=4, archive=370, specs=291.
- 2026-05-28: Archived 20 verified changes from `feature/v0.5.4`, including the Project Map verified closure set, runtime performance evidence gates, workspace session catalog, reasoning-effort support, composer control surface, file rendering scheduler, and harness/performance governance changes.
