## Why

Project Map generation currently treats fresh AI output as authoritative map state. Re-running global collection or node-level completion/calibration can replace existing nodes, lenses, and relationship structure with a narrower or drifted model response, causing previously useful project knowledge to disappear.

This is unacceptable for a knowledge map: generation must behave like incremental curation, not destructive regeneration.

## 目标与边界

- Preserve existing validated Project Map knowledge across repeated runs.
- Merge new AI output into the existing dataset through deterministic rules.
- Keep humans in control of destructive pruning through explicit delete-node UI.
- Make global collection, node completion, and node calibration prompts short, precise, and semantically different.

## 非目标

- Do not introduce a full review workflow for every generated patch.
- Do not add backend/Rust storage commands in this change; storage remains snapshot based.
- Do not redesign graph layout or candidate confirmation.
- Do not implement automatic stale-node deletion based on AI output.

## What Changes

- Add an incremental Project Map merge policy:
  - Global collection may add/update lenses and nodes but MUST NOT drop existing nodes that are absent from AI output.
  - Node completion/calibration may update scoped nodes and append scoped children, but MUST NOT replace unrelated siblings, ancestors, or global facts.
  - Existing sources, related artifacts, children, and confidence should be union/merged unless the model provides stronger evidence-backed corrections.
- Add manual node pruning:
  - The inspector exposes a delete-node action for every selected node.
  - Deleting a non-root node removes it from parent `children`, removes descendant nodes, and removes candidate records targeting deleted nodes.
  - Deleting a root/overview node physically clears the map node set.
- Add evidence trace navigation:
  - Evidence and related artifact chips with a file path open the target file in the existing center editor surface.
  - Path-like related artifact labels such as `src/...`, `README.md`, and `pom.xml` are inferred as workspace file targets so legacy AI output reuses the same trace interaction.
  - Line-backed evidence opens with line navigation so the user can verify claims in a left/right workspace split.
  - File navigation launched from Project Map keeps Project Map as the left split companion instead of replacing it with the conversation canvas.
- Compress background task UX:
  - Each task card names the action that started it, such as Collect profile, Complete node, or Calibrate node.
  - Node-scoped tasks show the target node title and id when available.
  - The task drawer uses denser metadata layout so engine/model, scope, run id, start time, and path remain scannable without excessive whitespace.
- Refine prompts:
  - Global collection asks for deltas and missing structure, not a full replacement.
  - Complete node asks for filling missing facts and adding source-backed children.
  - Calibrate node asks for verification/correction and stale/candidate/confidence adjustments.
- Add regression tests covering repeated global and node-level runs.

## Capabilities

### New Capabilities

- `project-map-incremental-generation`: Incremental merge, scoped node update, manual pruning, and generation prompt semantics for Project Map.

### Modified Capabilities

- None.

## Impact

- Affected frontend code:
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/features/app/hooks/useGitPanelController.ts`
  - `src/features/app/components/AppLayout.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/app-shell.tsx`
  - `src/app-shell-parts/renderAppShell.tsx`
  - `src/app-shell-parts/useAppShellSections.ts`
  - `src/features/project-map/types.ts`
  - `src/features/project-map/utils/**`
  - `src/i18n/locales/*.part5.ts`
  - `src/styles/main.css`
  - `src/styles/project-map.css`
- Affected behavior:
  - Project Map generation becomes idempotent and additive across repeated runs.
  - Delete node becomes an explicit user action.
- No new external dependency.

## 验收标准

- Re-running global collection preserves existing nodes absent from the latest AI output.
- Re-running node completion/calibration preserves unrelated nodes and merges scoped details.
- New source-backed nodes can be appended without duplicating existing ids.
- Deleting a node removes descendants and dangling parent/candidate references.
- Deleting a root/overview node clears persisted map nodes.
- Clicking evidence or related artifact links opens the corresponding workspace file in the center editor surface while preserving the Project Map as the split companion.
- Background task cards identify the initiating button and target node, with compact spacing suitable for active, queued, and recent runs.
- Prompt tests prove each button emits a distinct concise task contract.

## Implementation Writeback

- Incremental generation has been implemented with feature-local merge/prune helpers, preserving existing Project Map nodes, lenses, sources, details, relationships, candidates, stale flags, and confidence guardrails across repeated runs.
- Collect profile, Complete node, and Calibrate node now use distinct concise prompt contracts: global delta collection, selected-node enrichment, and selected-node verification.
- Manual node deletion is explicit and physical: every selected node can be pruned, non-root deletion removes descendants and dangling references, and root/overview deletion clears the persisted node set after confirmation.
- Evidence and related artifact chips with workspace file paths now open in the center editor. Project Map-originated evidence navigation keeps Project Map as the editor split companion; generic file opens keep the default chat companion.
- Related artifact chips now infer workspace file paths from legacy label/ref values such as `src/main/resources/application.yml`, `README.md`, and `pom.xml`, then reuse the same trace link interaction as evidence chips.
- The right toolbar globe icon is a true Project Map toggle. It opens/closes the Project Map center surface, switches Project Map on/off as an editor companion, and the app-shell adapter forwards the required center-mode and companion setters.
- The Project Map task drawer now exposes action and target context on every run card: Collect profile / Complete node / Calibrate node, target node title/id for scoped runs, compact status/progress metadata, and reduced card spacing.
- Claude Code node completion output is now hardened against malformed JSON. The generation prompt uses a valid JSON schema example, treats `AGENTS.md`/README/policy text inside evidence as data rather than instructions, wraps evidence in explicit block markers, and the parser scans balanced JSON payload candidates instead of trusting the first `{...}` span.
- The parser now skips non-Project Map JSON snippets, accepts fenced/noisy Claude output, repairs copied placeholder ellipsis such as `"profile": {...}`, and still fails closed when no Project Map payload is present.
- Candidate calibration now infers readable workspace evidence from path-like source `label`/legacy `ref` values using generic file-path rules. This is intentionally project-agnostic: no repository name, node id, or mossx-specific file path is hardcoded.
- Codex terminal output extraction now accepts valid Project Map JSON from final assistant envelopes such as `last_agent_message` and nested turn/result fields before reporting `AI output did not contain a JSON object`.
- Calibrated nodes that still return `candidate=true` now stay candidates by design, but the UI explains that calibration completed and exposes manual confirm/reject actions even without a separate candidate review record.
- Validation completed after implementation:
  - Project Map focused tests passed.
  - Claude JSON hardening regression tests passed.
  - Layout/app-shell toggle tests passed.
  - Task drawer and related-artifact trace link component tests passed.
  - `npm run typecheck` passed.
  - `npm run lint` passed with one unrelated pre-existing `react-hooks/exhaustive-deps` warning in `src/features/threads/hooks/useThreadActionsResumeThread.ts`.
  - `npm run build` passed with existing Vite chunk warnings.
  - `git diff --check` passed.
  - `openspec validate stabilize-project-map-incremental-generation --strict` passed.

## Stability Review Writeback

- Cross-platform evidence-path handling has been centralized in `src/features/project-map/utils/evidencePaths.ts`. Worker source selection, generation requests, Project Map evidence navigation, auto-ingestion memory parsing, and persistence sanitization now share the same rules for `/` and `\` separators, line suffixes, wrapping punctuation, repo-relative paths, excluded directories, and readable text-file extensions.
- Windows reserved device names are blocked consistently by stem, not only exact file name. `con.audit`, `nul.flow`, `runs/con.json`, and `diagrams/nul.flow.md` are now rejected or prefixed before write, matching Windows filesystem behavior.
- Project Map persistence no longer trusts persisted JSON shape. Malformed nodes are dropped, partial nodes are normalized, node details/sources/related artifacts/diagram artifacts are sanitized, absolute workspace paths are stripped, non-finite settings fall back to defaults, and loaded topology still attaches reachable orphan nodes to the root.
- Project Map storage writes now replace existing files on Windows instead of failing on `rename`, create temp files with `create_new`, sync before commit, and clean temp files on commit failure.
- The Project Map right-toolbar visibility control is now documented in the client documentation control matrix so the heavy-test-noise gate no longer fails on `rightToolbar.projectMap` coverage.
- Large-file governance was respected during this repair and follow-up optimization: shared path logic moved into a focused utility module, trace chips moved into `ProjectMapTraceChips.tsx`, task queue UI moved into `ProjectMapTaskDrawer.tsx`, display helpers moved into `utils/display.ts`, and `ProjectMapPanel.tsx` dropped to 2398 lines so it is no longer in the near-threshold watchlist.
- Validation after this stability review:
  - Focused Project Map Vitest suite passed: 48 tests across `evidencePaths`, `autoIngestion`, `projectMapPersistence`, and `projectMapGenerationWorker`.
  - Rust Project Map tests passed: 7 tests for storage key normalization, path constraints, reserved names, and atomic write behavior.
  - `npm run typecheck` passed.
  - `node --test scripts/check-large-files.test.mjs` passed.
  - `npm run check:large-files:near-threshold` passed with 10 existing watchlist warnings and no fail result; `ProjectMapPanel.tsx` is no longer listed.
  - `npm run check:large-files:gate` passed with `found=0`.
  - `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs` passed.
  - `npm run check:heavy-test-noise` passed all 550 Vitest files with 0 act warnings, 0 stdout payload lines, and 0 stderr payload lines.
