## 1. Artifacts

- [x] 1.1 Create proposal, design, tasks, and spec delta for Evidence Files explorer.

## 2. Evidence Index

- [x] 2.1 [P0][depends:1.1][I: ProjectMapDataset node sources, related artifacts, relations, governance links][O: derived ProjectMap evidence file index types and utility][V: focused unit tests cover grouping by workspace-relative path] Add file-backed evidence index utility.
- [x] 2.2 [P0][depends:2.1][I: ambiguous evidence refs][O: conservative non-file evidence bucket][V: tests cover hashes, conversations, spec ids, task ids, package names, and path-like refs] Keep non-file evidence explainable without fake links.
- [x] 2.3 [P0][depends:2.1][I: stale/confidence/source-kind metadata][O: file entry counts and markers][V: tests cover stale, low-confidence, degraded, and mixed source kinds] Add evidence marker aggregation.

## 3. UI

- [x] 3.1 [P0][depends:2.1][I: ProjectMapPanel loaded dataset][O: Evidence Files tab or section with empty/degraded/populated states][V: focused render test or component-level state test] Add Evidence Files explorer UI.
- [x] 3.2 [P0][depends:3.1][I: file entry selection][O: file detail panel listing related nodes, line refs, relation/governance refs][V: tests cover selected file detail and missing refs] Add selected file detail view.
- [x] 3.3 [P0][depends:3.2][I: related node link][O: focus/highlight Project Map node from file detail][V: tests cover existing node focus and missing node degraded state] Add file -> node reverse navigation.
- [x] 3.4 [P0][depends:3.2][I: file-backed evidence path][O: open file through existing editor navigation path][V: tests or manual QA cover line target and Project Map companion behavior] Preserve open-file evidence flow.
- [x] 3.5 [P1][depends:3.1][I: source kind/stale/search filters][O: deterministic file filters and sorting][V: tests cover filter combinations without mutating dataset] Add filters and ordering.

## 4. Polish And Verification

- [x] 4.1 [P1][depends:3.1][I: zh/en Project Map copy][O: localized labels and accessible names][V: focused UI/i18n check] Add copy and accessibility labels.
- [x] 4.2 [P0][depends:2-3][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run typecheck during implementation.
- [x] 4.3 [P0][depends:1.1][I: OpenSpec change][O: strict validation pass][V: `openspec validate add-project-map-evidence-file-explorer --strict --no-interactive`] Validate OpenSpec artifact before archive.
