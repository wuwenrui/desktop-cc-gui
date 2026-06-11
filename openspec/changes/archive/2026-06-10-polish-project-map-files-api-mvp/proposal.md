## Why

Project Map relationship surfaces already expose file navigation, graph navigation, read path, and API contracts, but the first-screen UX still feels dense: Files can over-hide governance sources, Graph panes have fixed proportions, Read Path can look like a raw relation dump instead of a file anatomy surface, API controls compete for attention, and evidence/confidence cues are not prominent enough for users to judge trust quickly.

This change polishes the existing Files, Graph, Read Path, and API modules so the current surfaces become easier to read, easier to trust, and less noisy before deeper feature expansion.

## 目标与边界

- Improve user perception of the existing Project Map Files, Graph, Read Path, and API tabs.
- Keep file relationship snapshots, API contract graph, and semantic Project Map graph separated.
- Refine default filtering, copy, visual hierarchy, and confidence/evidence cues.
- Avoid Tauri payload/schema changes, new parser adapters, and new product workflows.

## 非目标

- Do not add a new Project Map tab.
- Do not change Tauri command payload contracts or scanner output schemas.
- Do not create a new API adapter or parser.
- Do not archive or sync unrelated OpenSpec changes.

## What Changes

- Files view treats low-signal files as a UI filtering concern instead of hiding governance/documentation roots by path alone.
- Files copy changes from “noise files” to “low-signal files” to better reflect the intent.
- API view reduces first-screen control pressure by separating primary and advanced filters.
- API inspector and export affordances surface confidence/evidence/fallback caveats more clearly.
- API inspector supports a detail-focused mode when opening source files from endpoint evidence or method chains.
- API response details render status/schema/fields as a structured response block instead of narrow-column text.
- API Method chain renders endpoint-scoped Java/Spring calls as a layered tree with source and target file anchors.
- Graph view supports user-resizable Files and Inspector panes while preserving the existing canvas layout.
- Graph node filename rendering treats the basename as primary information and can show it without truncating the node title.
- Read Path is redesigned from raw relation/context lists into a selected-file anatomy graph that shows incoming callers/dependencies, the current file, outgoing calls/dependencies, and verification material.
- Read Path adds a Method Chain Explorer that derives method entries from scanned symbols/call-site evidence and displays bounded call-chain closure with file/evidence open actions.
- Java file relationship `calls` are tightened from global fuzzy symbol matching to receiver/import/field-based resolution with target method existence checks.
- Relationship workspace no longer shows the global bottom `Repair / Read issues` strip across tabs; repair/read-error data remains available to future diagnostics surfaces.
- Empty states distinguish missing scan, no endpoints, and filtered-out endpoints more explicitly.
- UI/UX polish improves hierarchy, secondary action weight, and scan-derived contract disclaimers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-map-api-contract-view`: API contract view MUST communicate scan-derived confidence, evidence, fallback, and export caveats in the UI.
- `project-map-relationship-graph-view`: Relationship Graph view MUST support adjustable left/right pane widths and readable node filename presentation.
- `project-map-relationship-read-path-view`: Relationship Read Path view MUST present selected-file anatomy and method-chain closure instead of dumping raw relationship groups and context-pack lists.
- `project-map-relationship-storage`: Relationship Files view MUST support low-signal filtering without treating governance/documentation roots as unconditional noise.

## Impact

- Frontend feature slice: `src/features/project-map/**`.
- Backend relationship scanner: `src-tauri/src/project_map_relations.rs`, `src-tauri/src/project_map_relations/relation_resolution.rs`.
- Project Map styles: `src/styles/project-map.relationship-graph.css`, `src/styles/project-map.relationship-workspace.css`, `src/styles/project-map.api-contract.css`.
- i18n copy: `src/i18n/locales/zh.part5.ts`, `src/i18n/locales/en.part5.ts`.
- No new dependencies.
- No backend API or storage migration.

## 技术方案对比

| Option | Description | Trade-off |
|---|---|---|
| A | Add new dedicated “Governance / API Quality” panels | More explicit, but adds surface area and delays the MVP polish. |
| B | Refine existing Files/API surfaces in place | Lower risk, preserves current mental model, improves perception quickly. |

Chosen option: B. The current issue is density and trust signaling, not missing capability.

## 验收标准

- Files tab no longer labels governance/documentation roots as unconditional noise.
- Files UI copy says low-signal instead of noise.
- API toolbar presents primary filters separately from advanced filters, with scan/export actions under advanced controls.
- API empty/export/inspector copy makes scan-derived confidence clear.
- API inspector can restore the list panes after detail focus.
- API Responses render status, content type, schema summary, and fields without narrow-column wrapping artifacts.
- Method chain displays a layered call tree and source/target file-line links for resolved Java calls.
- Graph Files and Inspector panes can be resized beyond the default widths without breaking canvas layout.
- Graph node filename presentation does not hide the primary basename behind avoidable ellipsis.
- Read Path explains the selected file through incoming/current/outgoing/verification anatomy lanes and includes source/evidence open actions.
- Read Path exposes method-level chain closure for the selected file when scanned symbols or call-site evidence are available.
- Java relationship Graph no longer treats untyped Java call candidates such as constructor annotations, DTO getters, or local variable method calls as cross-file `calls`.
- Relationship workspace does not render the bottom repair/read-error chip strip in Graph, Files, Read, or API tabs.
- Existing Project Map relationship/API data flow remains unchanged.
