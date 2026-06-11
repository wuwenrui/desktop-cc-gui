## 1. Files MVP polish

- [x] 1.1 [P0][Depends: specs] Adjust `isProjectMapRelationshipNoiseFile` to stop treating governance/documentation roots as unconditional noise; input: scanned file projection; output: low-signal predicate; validation: focused reasoning/manual UI smoke.
- [x] 1.2 [P0][Depends: 1.1] Update Files view copy from noise to low-signal and keep existing toggle behavior; input: i18n keys; output: clearer user-facing labels; validation: no raw i18n key in UI.

## 2. API MVP polish

- [x] 2.1 [P0][Depends: specs] Separate API primary filters from advanced filters in the toolbar; input: existing filter props; output: clearer first-screen hierarchy; validation: API smoke/manual UI smoke.
- [x] 2.2 [P0][Depends: 2.1] Add scan-derived trust/caveat copy to API export and inspector surfaces; input: normalized API contracts; output: visible confidence/evidence/fallback caveats; validation: API smoke/manual UI smoke.
- [x] 2.3 [P0][Depends: 2.2] Refine Java method-chain extraction from fallback proximity scan to handler-body static call resolution; input: Java controller/service scanned files; output: endpoint-scoped call chains with target source anchors; validation: focused Rust unit test.
- [x] 2.4 [P0][Depends: 2.1] Move scan/export actions behind advanced API controls and compress toolbar height; input: existing API toolbar actions; output: lower first-screen control noise; validation: manual API toolbar smoke.
- [x] 2.5 [P0][Depends: 2.3] Render Method chain as a bounded layered tree with call/definition anchors; input: normalized call-chain edges; output: hierarchical endpoint chain view; validation: manual endpoint detail smoke.
- [x] 2.6 [P1][Depends: 2.2] Add API inspector detail focus and restore behavior when opening evidence/method-chain files; input: file anchor click events; output: list panes collapse during source reading and can be restored; validation: manual file-open smoke.
- [x] 2.7 [P1][Depends: 2.2] Reformat API response blocks so fields do not wrap in narrow status columns; input: endpoint response fields; output: status/schema/field rows are visually separated; validation: manual response rendering smoke.

## 3. Graph MVP polish

- [x] 3.1 [P0][Depends: specs] Add left Files and right Inspector pane resize behavior to the Graph workspace without changing graph projection; input: existing Graph dashboard grid; output: draggable pane widths via CSS variables; validation: manual Graph resize smoke.
- [x] 3.2 [P0][Depends: 3.1] Ensure focused relationship Graph layout overrides also use the resize variables; input: focused Graph CSS rules; output: dragging remains effective in the active file-relations layout; validation: manual Graph resize smoke.
- [x] 3.3 [P1][Depends: 3.1] Allow Graph node file basenames to display as primary readable content while keeping metadata compact; input: Graph node title styles; output: title can wrap without expanding all node metadata; validation: manual Graph node smoke.
- [x] 3.4 [P0][Depends: 3.1] Tighten Java file relationship calls to receiver/import/field-backed resolution and target method existence; input: Java scanned files and symbols; output: fewer false-positive Graph call edges; validation: manual rescan smoke on Java service/controller nodes.
- [x] 3.5 [P1][Depends: 3.4] Remove global bottom repair/read issue strip from relationship workspaces; input: repair/read-error artifacts; output: artifacts are not rendered as persistent bottom tab noise; validation: manual tab-switch smoke.

## 4. Read Path MVP polish

- [x] 4.1 [P0][Depends: specs] Rebuild Read Path as a layered reading route instead of raw relation/context lists; input: selected file, relations, context-pack; output: entry/current/dependency/verification route steps; validation: manual Read tab smoke.
- [x] 4.2 [P1][Depends: 4.1] Add comprehension checklist and compact route signals; input: route projection and impact/context data; output: user-facing questions and low-noise summary; validation: manual Read tab smoke.
- [x] 4.3 [P0][Depends: 4.1] Rebuild Read Path again as selected-file anatomy graph; input: selected file, incoming/outgoing/verification relations; output: incoming/current/outgoing visual graph with file/evidence open actions; validation: manual Read tab smoke.
- [x] 4.4 [P0][Depends: 4.3] Add method-chain explorer; input: scanned symbols, call relations, evidence lines; output: selectable methods with upstream triggers, direct calls, and bounded second-level call chains; validation: manual Read tab smoke.
- [x] 4.5 [P0][Depends: 4.4] Reduce Read Path noise and redraw method explorer as method-body flow; input: selected file calls, method symbols, evidence lines; output: no right-side checklist, no import anatomy nodes, minimal link-only anatomy cards, and method start/call/end flowchart; validation: manual Read tab smoke.
- [x] 4.6 [P0][Depends: 4.5] Fix method-body flow ownership; input: method symbols and call-site evidence lines; output: call-expression symbols are excluded from the method index and same-method calls are grouped under the nearest declaration method in source-line order; validation: manual Read tab smoke.
- [x] 4.7 [P0][Depends: 4.6] Prefer source-derived method parsing for Method Chain; input: selected file preview content; output: method index from source declarations, method-body call flow in source-line order, and method code snippet fallback; validation: manual Read tab smoke.

## 5. Closure

- [x] 5.1 [P1][Depends: 1-4] Update Chinese and English i18n copy for Files/API/Graph/Read polish; input: changed keys; output: localized copy; validation: focused UI smoke.
- [x] 5.2 [P1][Depends: implementation] Record this MVP implementation in tasks; input: completed changes; output: checked tasks; validation: OpenSpec status shows apply-ready/complete tasks.
