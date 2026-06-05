## 1. Data model and pure services

- [x] 1.1 [P0] Add optional Project Map relation/context/impact types. Input: existing `types.ts`. Output: backwards-compatible optional types for relations, context packs, explain packs, impact results, and ignore summaries. Verification: existing dataset shapes remain valid by type compatibility.
- [x] 1.2 [P0] Implement Project Map ignore policy utility. Input: file paths and repository/project-map defaults. Output: filtered paths plus ignored summary. Verification: dependency, generated, runtime, binary paths are excluded; source/spec paths are retained.
- [x] 1.3 [P0] Implement Project Map context builder. Input: dataset plus selected node or query. Output: context pack with selected/matched nodes, related nodes, evidence, risk flags, related artifacts, and relation fallback. Verification: works with and without `relations`.
- [x] 1.4 [P1] Implement Project Map impact analyzer. Input: dataset plus changed file paths. Output: changed nodes, affected nodes, affected lenses, unmapped files, ignored files, and risk summary. Verification: file source matches become changed nodes; unrelated files become unmapped unless ignored.

## 2. Project Map panel integration

- [x] 2.1 [P0] Wire Explain Pack into Project Map node inspector. Input: selected node and dataset. Output: inspector section/action showing evidence, related nodes, risk indicators, and related artifacts. Verification: selecting a node displays explain context without regenerating the map.
- [x] 2.2 [P1] Add minimal impact overlay state and rendering. Input: changed file paths supplied by local panel state or future bridge. Output: changed/affected visual state and unmapped/ignored summary in the panel. Verification: impact state does not trigger layout recomputation.
- [x] 2.3 [P0] Keep legacy dataset behavior intact. Input: persisted datasets without relations/context fields. Output: Project Map still loads and renders. Verification: relation-dependent UI falls back to parent/children/sources/artifacts.

## 3. OpenSpec tracking

- [x] 3.1 [P0] Mark completed tasks as implementation lands. Input: completed code changes. Output: updated `tasks.md` checkboxes. Verification: OpenSpec apply status reflects progress.
- [x] 3.2 [P1] Document any implementation constraint discovered during wiring. Input: code-level constraints. Output: design/spec update if behavior scope changes. Verification: no hidden behavior drift from proposal/spec.
