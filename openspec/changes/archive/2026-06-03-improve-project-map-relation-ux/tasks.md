## 1. Artifacts

- [x] 1.1 Create proposal, design, tasks, and spec delta for Project Map relation UX.

## 2. Relation Index

- [x] 2.1 [P0][depends:1.1][I: ProjectMap nodes and persisted relations][O: relation index grouped by node/type/source kind][V: focused unit tests cover incoming/outgoing, missing endpoints, duplicate relation ids] Add relation index utility.
- [x] 2.2 [P0][depends:2.1][I: sparse/legacy datasets][O: safe empty/degraded relation states][V: tests cover no relations and malformed endpoint refs] Handle legacy and degraded relation input.

## 3. Relation Inspector

- [x] 3.1 [P0][depends:2.1][I: selected Project Map node][O: incoming/outgoing relation panel][V: focused render tests cover both directions and empty state] Add selected-node relation inspector.
- [x] 3.2 [P0][depends:3.1][I: relation row action][O: focus source/target node and highlight relation][V: tests cover endpoint focus and missing endpoint fallback] Add relation row navigation.
- [x] 3.3 [P1][depends:3.1][I: relation evidence/source metadata][O: relation detail/explain summary][V: tests cover evidence-backed and degraded relation detail] Add relation detail view.

## 4. Graph Controls

- [x] 4.1 [P0][depends:2.1][I: relation type/source kind counts][O: edge legend with visible counts][V: component test or state test covers count rendering] Add relation legend.
- [x] 4.2 [P0][depends:4.1][I: relation filters][O: type/source/direction filter state applied to graph rendering/highlighting only][V: tests prove filters do not mutate dataset relations] Add relation filters.
- [x] 4.3 [P1][depends:4.2][I: search/tour/path/impact highlight states][O: deterministic highlight priority and reset affordances][V: focused UI state tests or manual QA matrix] Resolve highlight-state interactions.

## 5. Path Finder Integration

- [x] 5.1 [P1][depends:2.1][I: path finder relation-backed segments][O: path segment labels for relation type/source kind and hierarchy fallback][V: navigation tests cover relation path and hierarchy path] Add relation metadata to path output.

## 6. Verification

- [x] 6.1 [P0][depends:2-5][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run typecheck during implementation.
- [x] 6.2 [P0][depends:1.1][I: OpenSpec change][O: strict validation pass][V: `openspec validate improve-project-map-relation-ux --strict --no-interactive`] Validate OpenSpec artifact before archive.
