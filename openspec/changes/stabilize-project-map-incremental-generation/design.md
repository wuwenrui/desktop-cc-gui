## Context

Project Map generation is currently snapshot-oriented. `runProjectMapGenerationWorker()` parses model output and `applyAiPayload()` converts it into normalized lenses/nodes. For global runs, `nextNodes` is set to the generated node list. For node runs, existing scoped nodes are replaced by generated whole-node objects.

That design is brittle because a model response is incomplete by nature. The model can omit valid nodes, forget children, rename lenses, or output a smaller map after seeing a narrower evidence window. The user-visible result is destructive drift: repeated "Collect profile", "Complete node", or "Calibrate node" can make the map worse.

The correct contract is: AI output is evidence-backed patch material. The existing dataset is the durable truth until a deterministic merge or explicit human action changes it.

## Goals / Non-Goals

**Goals:**

- Make Project Map generation incremental and repeat-safe.
- Preserve existing nodes/lenses unless explicitly updated or manually deleted.
- Separate global, complete-node, and calibrate-node prompt responsibilities.
- Add explicit manual pruning for invalid/stale nodes.
- Keep merge rules feature-local and testable as pure helpers.

**Non-Goals:**

- No new Rust/Tauri command; snapshot persistence remains unchanged.
- No automatic AI-driven deletion.
- No full conflict UI/diff review in this change.
- No schema migration unless a small optional action metadata field becomes necessary.

## Decisions

### Decision 1: Treat AI output as merge input, not replacement state

`applyAiPayload()` will call feature-local merge helpers. Existing `profile`, `lenses`, and `nodes` stay as the base. Generated data can fill unknown/empty fields, union arrays, update summaries/details, and append new children, but absence from output never means deletion.

Alternative A: Keep replacement semantics and make prompts say "include everything". Rejected because it relies on the model being complete every time.

Alternative B: Always turn AI output into candidates only. Safer, but too slow for this workflow and not what "收集画像/补全/校准" currently promises.

### Decision 2: Merge fields by stability and evidence strength

Stable identity fields (`id`, `parentId`, `lensId`, `nodeKind`) are preserved unless the generated node is new. Content fields are merged:

- `summary` / `coreDescription`: replace only when generated value is non-empty and backed by sources.
- arrays (`keyFacts`, `keyLogic`, `riskSignals`, `sources`, `relatedArtifacts`, `children`): stable union with dedupe.
- `confidence`: do not blindly upgrade; higher confidence requires sources, calibration may lower confidence.
- `candidate` / `stale`: generated truth can mark candidate/stale; existing manual/confirmed facts are not cleared without evidence-backed generation.

Alternative: Store full historical versions and compute view at render time. More complete, but much larger than current need.

### Decision 3: Scope node actions hard

Complete node and calibrate node must use the selected node as write boundary. Complete may append source-backed descendants under the selected node when `includeDescendants=true`. Calibrate may update the selected node and direct descendants only when requested; it must not add unrelated nodes or rebuild lenses.

Calibration completion is an execution state, not an acceptance state. If evidence remains weak and the generated correction keeps `candidate=true`, the UI must say "calibrated but unresolved" instead of implying calibration should clear the candidate badge. Manual confirm/reject actions clear the candidate workflow state; Delete node remains the destructive prune path.

### Decision 4: Manual delete is the only destructive path

Invalid/stale nodes need pruning, but deletion must be user-authored. Add `deleteNode(nodeId)` in the dataset controller and an inspector button for every selected node. Non-root deletion removes descendants, parent child references, and candidates targeting deleted nodes. Root/overview deletion physically clears the map node set after explicit confirmation.

### Decision 5: Prompts should request delta semantics

Prompts must say "merge patch / delta" in plain language:

- Global: discover missing/changed high-signal structure; keep compact; do not restate the whole map.
- Complete node: enrich missing facts and children for selected node only.
- Calibrate node: verify/correct selected node; lower confidence or mark stale when evidence is weak.

### Decision 6: Project Map evidence links keep Project Map as editor companion

Evidence file navigation needs a distinct source marker. Generic file opens keep the existing editor + chat split. Project Map evidence opens pass `editorSplitCompanion: "projectMap"` through the file-open pipeline so `DesktopLayout` renders the editor and Project Map side by side. The editor tab, line navigation, and file monitoring behavior stay shared with normal file opens.

Related artifacts can arrive from older or noisy AI output as plain labels instead of typed evidence objects. The UI therefore infers workspace file targets only for clearly path-like values (`src/...`, `README.md`, `pom.xml`, and similar extension-bearing filenames). Non-file refs remain inert chips, preserving the no-fake-link contract.

### Decision 7: Harden model JSON as an untrusted boundary

Project Map generation treats every engine response as untrusted text. Claude Code can prepend explanations, emit multiple JSON-looking snippets, or copy schema placeholders from the prompt. The parser therefore scans balanced object candidates, prefers objects shaped like a Project Map payload, skips unrelated JSON, and applies narrowly scoped lenient repairs before normalization.

The prompt also avoids invalid examples. The previous `"profile": {...}` schema hint was itself not JSON and could be copied by stricter engines. It is replaced by a valid skeleton, and evidence is wrapped in explicit block markers with an instruction that file contents, including `AGENTS.md` and README policy text, are project evidence rather than response instructions.

Codex-backed runs may report the final assistant answer through several event envelopes, including `task_complete`, `turn/completed`, `last_agent_message`, and nested turn/result output fields. The worker treats these as equivalent terminal channels, collects assistant text from known envelope aliases, and only reports a JSON failure after every terminal candidate has been scanned for a shaped Project Map payload.

### Decision 9: Infer evidence file paths generically, never by project name

Calibration depends on reading the same evidence the UI displays. Some legacy or noisy sources carry a readable workspace path in `label` or `ref` while leaving `path` empty. The normalizer and worker therefore infer evidence paths from clearly path-like values using generic rules: explicit paths, extension-bearing filenames, and important root filenames such as `README.md`, `AGENTS.md`, and package/config manifests.

This inference is deliberately not tied to `mossx`, not tied to a specific node id, and not tied to a hardcoded source path. URL-like values, opaque colon identifiers, hashes, and conversation refs stay non-file evidence so the UI and worker do not fabricate unreadable links.

### Decision 8: Task cards should expose action and target before runtime metadata

The background task drawer is an operational queue, not a debug log. Each run card leads with the user action that created it and, for node-scoped runs, the target node title plus id. Engine/model, scope, start time, run id, and path are compressed into a compact metadata grid so users can identify "which button and which node" without scanning oversized cards.

## Risks / Trade-offs

- [Risk] Merge rules may preserve outdated information too long. → Mitigation: calibrate can mark `stale=true`, lower confidence, and user can delete.
- [Risk] Union arrays may accumulate duplicates. → Mitigation: stable dedupe keys per source/artifact/text.
- [Risk] Manual delete can remove a subtree accidentally. → Mitigation: destructive confirmation clearly states pruning behavior.
- [Risk] Project Map evidence navigation could break normal editor split behavior. → Mitigation: the companion marker defaults to `chat`; only Project Map evidence chips opt into `projectMap`.
- [Risk] Lenient JSON repair could accept the wrong snippet from a noisy model answer. → Mitigation: parsed objects must contain `profile`, `lenses`, or `nodes`; unrelated JSON candidates are ignored.
- [Risk] Path inference could turn a symbolic related artifact into a misleading file link. → Mitigation: infer links only for explicit paths or extension-bearing filenames and keep non-file refs inert.
- [Risk] Generic path inference could overfit to one repository's file layout. → Mitigation: recognize only cross-project file-path shapes and important conventional filenames; no project names, node ids, or repo-local paths are embedded.
- [Risk] Large `ProjectMapPanel.tsx` grows further. → Mitigation: destructive data logic lives in feature-local utils, UI only wires action.

## Migration Plan

1. Add pure merge/prune helpers under `src/features/project-map/utils/`.
2. Route `applyAiPayload()` through incremental merge.
3. Add controller action + inspector button for delete node.
4. Update prompts and tests.
5. Add Project Map evidence split companion routing.
6. Run focused Project Map/layout tests, typecheck, lint, large-file guard, and strict OpenSpec validate.

Rollback: revert this change; no storage migration is required because existing snapshot shape remains compatible.

## Implementation Notes

- Merge/prune logic landed in feature-local Project Map utilities so generation, persistence, and UI wiring share deterministic behavior without adding external dependencies.
- The persisted snapshot contract remains compatible. Any persisted dataset that lacks newer optional fields is normalized defensively before UI code reads profile/framework values or merge logic applies payloads.
- Project Map evidence navigation uses the existing editor pipeline with an `editorSplitCompanion` marker. This avoids a second file viewer implementation and keeps normal file opens unchanged.
- Related artifact trace links reuse the same `TraceChip` event path as evidence links. The normalizer infers file targets for path-like legacy artifact values while preserving non-file artifact chips as display-only context.
- The toolbar globe toggle depends on center-mode and editor-companion state crossing from the app-shell adapter into `useLayoutNodes`. Because `useAppShellLayoutNodesSection.tsx` is currently `@ts-nocheck`, a small adapter contract test now guards the required forwarding.
- Task drawer cards were compressed around the user question: action first, target node second, then runtime metadata. This reduces visual whitespace and makes active/recent runs reviewable without expanding a debug-style card.
- The implementation intentionally does not let AI output delete nodes. Destructive changes remain behind the explicit Delete node dialog and dataset prune helper.
- Claude Code JSON compatibility was hardened after local failure evidence showed `AI output did not contain valid JSON. JSON Parse error: Unable to parse JSON string` on node completion. The fix combines prompt-side evidence isolation with parser-side candidate extraction, Project Map payload shape checks, and targeted repair for copied placeholder ellipsis.
- Candidate calibration now reads path-like source labels/refs as workspace evidence through the same generic readable-file filter as explicit paths. This fixes legacy request data without introducing repository-specific allowlists.
- Codex thread extraction now handles final assistant JSON from `last_agent_message` and nested terminal event fields, which prevents valid terminal output from being misreported as missing JSON.
- Calibrated nodes that remain `candidate=true` now get explicit unresolved-candidate copy and node-level confirm/reject actions even when there is no separate candidate review record.
- Follow-up status: the stability review split trace chips, task-drawer UI, and display helpers out of `ProjectMapPanel.tsx`, reducing the panel below the large-file near-threshold watchlist without changing behavioral scope.

## Open Questions

- Whether future versions should expose a visual merge diff before applying global collection.
- Whether stale nodes should have a separate "hide" state instead of hard delete.
