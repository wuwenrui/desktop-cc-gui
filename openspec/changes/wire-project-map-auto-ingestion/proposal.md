## Why

The Project Map footer exposes Auto Ingestion controls, but the current implementation is only partially wired: it persists settings and can create regex-derived conversation candidates, while `checkIntervalMinutes`, `autoApplyEvidenceBacked`, and the real generation queue contract are not operational.

This creates a misleading product surface. Users see a scheduler-like control, but enabling it does not create the AI analysis run required by the Project Map spec.

## 目标与边界

- Wire the existing Auto Ingestion footer controls into the Project Map generation queue.
- Make `checkIntervalMinutes` and `memoryCursor.lastCheckedAt` control when Project Memory is scanned.
- Keep default behavior conservative: automatic ingestion creates candidates for human review, not direct active-map mutation.
- Preserve existing Project Memory and Project Map storage formats where possible.

## 非目标

- Do not introduce a native daemon worker in this change.
- Do not invent a new graph/map generation engine.
- Do not enable fully automatic active-map writes without an explicit, evidence-gated implementation.
- Do not scan arbitrary conversation history outside the Project Memory surface.

## What Changes

- Auto Ingestion will enqueue a real Project Map `auto` run when enabled and the unprocessed Project Memory count reaches the configured threshold.
- The scheduler will respect `checkIntervalMinutes`, last check time, active queued/running auto runs, and React StrictMode remounts.
- The auto run will carry Project Memory evidence into the worker prompt and use the existing Project Map queue/active-slot lifecycle.
- Default `createCandidate` mode will keep generated updates as candidate nodes for manual confirm/reject.
- Auto-generated nodes will be normalized into the existing root topology so automatic ingestion cannot create unreachable orphan subgraphs.
- Enabling Auto Ingestion will require an explicit engine/model confirmation before `enabled=true` is persisted, preventing hidden fallback runs such as `codex/default`.
- Worker validation will perform one JSON-only repair turn when the first AI response is natural language or malformed JSON, then keep the run failed if the repaired response is still invalid.
- Generation and Auto Ingestion configuration dialogs will use content-adaptive width: the current compact dialog width is the minimum desktop width, while longer paths/source chips may expand the dialog up to the viewport-safe maximum instead of clipping labels or forcing awkward horizontal overflow.
- Project Map canvas layout controls will default to a collapsed compact entry and remember the user's explicit collapsed/expanded preference without letting zoom, reset, auto-layout, drilldown, or overview navigation mutate that preference.
- `autoApplyEvidenceBacked` remains visible as an advanced option only if it has an explicit path; otherwise it must not silently disable ingestion.

## 技术方案对比

### Option A: Keep the current lightweight regex candidate path

Pros: small code diff and no extra worker prompts.

Cons: it bypasses the generation queue, ignores interval settings, does not create AI analysis runs, and diverges from the spec. It also creates a fake `completed` run even though no Project Map worker executed.

### Option B: Reuse the existing Project Map run queue and worker

Pros: one lifecycle for manual and automatic generation, existing Task drawer visibility, existing parser/merge/evidence gates, and no new daemon substrate.

Cons: requires the worker prompt and request model to accept Project Memory evidence.

### Decision

Use Option B. It is the least surprising architecture: Auto Ingestion becomes another scoped Project Map generation request, not a separate hidden write path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Auto Ingestion settings must create real queued AI analysis runs, respect interval/threshold scheduling, and default to candidate review before active-map writes.

## Impact

- Affected frontend code:
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - `src/features/project-map/utils/autoIngestion.ts`
  - `src/features/project-map/utils/generationRequests.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/features/project-map/types.ts`
  - `src/i18n/locales/*.part5.ts`
- Affected behavior:
- Auto Ingestion footer settings become operational.
- Automatic work is visible in the Project Map background task drawer.
- Project Memory messages are marked processed only after a successful auto run.
- Auto-generated nodes remain reachable from the Project Map root, including when the AI payload omits the existing parent node.
- The enable flow stores the selected engine/model with the setting before any scheduler run can start.
- Non-JSON AI output gets one bounded repair retry through the same engine/model before the run is marked failed.
- Dependencies:
  - No new external dependency.

## 验收标准

- Enabling Auto Ingestion with enough unprocessed Project Memory entries queues a `kind="auto"` Project Map run.
- Auto Ingestion does not queue again before `checkIntervalMinutes` has elapsed.
- Auto Ingestion does not queue duplicate auto runs while one is pending or running.
- Successful auto runs mark consumed Project Memory messages processed; failed runs do not.
- Default `createCandidate` mode produces candidate state requiring manual confirmation rather than silently mutating active map facts.
- Auto Ingestion merge/read paths preserve a single root-reachable graph topology and repair persisted orphan roots.
- Clicking enable shows engine/model selection first; cancelling keeps Auto Ingestion disabled, and confirming persists the chosen engine/model.
- If the first AI response does not contain a valid Project Map JSON payload, the worker requests one JSON-only repair response and succeeds only when that repaired payload validates.
- Configuration dialogs keep their compact baseline width for normal content, expand when read sources or write paths need more room, and still collapse to a single-column viewport-safe layout on narrow screens.
- Canvas layout controls default to collapsed, can be expanded by the user, and preserve that user preference across remounts/reloads independently from graph actions.

## Stability Review Writeback

- Auto Ingestion memory evidence extraction now uses the shared Project Map evidence-path normalizer, so Windows-style paths such as `src\features\project-map\types.ts:42` are normalized to repo-relative slash paths before they enter candidates or worker read requests.
- Auto Ingestion no longer lets invalid numeric settings distort scheduling. Runtime trigger checks clamp `newSessionThreshold` to `1..50`, clamp `checkIntervalMinutes` to `5..1440`, and treat non-finite persisted values as defaults during dataset load.
- Worker source selection rejects absolute Windows paths, URL-like strings, parent traversal, `.git`, `node_modules`, build outputs, and unsupported binary extensions before calling `readWorkspaceFile`.
- Conversation candidates now derive their first evidence path through the same shared extraction logic, avoiding divergent regex behavior between candidate creation and worker evidence reads.
- Validation after this stability review:
  - Focused Project Map Vitest suite passed: 48 tests across `evidencePaths`, `autoIngestion`, `projectMapPersistence`, and `projectMapGenerationWorker`.
  - `npm run typecheck` passed.
  - `npm run check:large-files:gate` passed with `found=0`.
  - `npm run check:heavy-test-noise` passed all 550 Vitest files with 0 act warnings, 0 stdout payload lines, and 0 stderr payload lines.
