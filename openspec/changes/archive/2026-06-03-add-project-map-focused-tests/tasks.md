## 1. Artifacts

- [x] 1.1 Create proposal, design, tasks, and spec delta for Project Map focused regression tests.

## 2. Fixture Foundation

- [x] 2.1 [P0][depends:1.1][I: ProjectMapDataset/ProjectMapNode/ProjectMapRelation types][O: compact Project Map test fixture helpers][V: fixture helper smoke test compiles and produces stable ids] Add compact test fixtures.
- [x] 2.2 [P0][depends:2.1][I: workspace-relative path samples][O: fixture path conventions without personal absolute paths][V: tests assert generated fixtures avoid user-local roots] Keep fixtures portable.

## 3. Utility Regression Tests

- [x] 3.1 [P0][depends:2.1][I: `navigation.ts`][O: tests for guided tour, search, shortest path, hierarchy fallback, no-path][V: focused Vitest suite passes] Add navigation utility tests.
- [x] 3.2 [P0][depends:2.1][I: `impactAnalysis.ts` and `impactSources.ts`][O: tests for git-status changed file matching, impact score, no-impact fallback][V: focused Vitest suite passes] Add impact tests.
- [x] 3.3 [P0][depends:2.1][I: `governanceGraph.ts` and context pack helpers][O: tests for OpenSpec metadata, Trellis metadata, AgentTask context refs][V: focused Vitest suite passes] Add governance graph tests.
- [x] 3.4 [P0][depends:2.1][I: `refreshClassifier.ts`][O: tests for fresh/stale/missing evidence/changed source classifications][V: focused Vitest suite passes] Add refresh classifier tests.
- [x] 3.5 [P0][depends:2.1][I: `graphIntegrity.ts`][O: tests for missing endpoint, duplicate relation id, repair summary][V: focused Vitest suite passes] Add graph integrity tests.
- [x] 3.6 [P1][depends:2.1][I: relation serialization/normalization seams][O: tests for relation payload roundtrip and legacy missing relations][V: focused Vitest or targeted persistence unit tests pass] Add relation persistence tests where practical.

## 4. Upcoming Feature Test Hooks

- [x] 4.1 [P1][depends:2.1][I: Evidence Files explorer implementation][O: tests for file grouping, non-file bucket, file -> node focus data][V: focused suite added when evidence explorer is implemented] Add Evidence Explorer helper tests.
- [x] 4.2 [P1][depends:2.1][I: Relation UX implementation][O: tests for incoming/outgoing relation index, filters, legend counts][V: focused suite added when relation UX is implemented] Add Relation UX helper tests.

## 5. Verification

- [x] 5.1 [P0][depends:3][I: new focused test suites][O: focused Vitest pass][V: targeted `vitest run` command for new suites] Run focused Project Map tests during implementation.
- [x] 5.2 [P0][depends:3][I: changed TypeScript modules][O: type safety pass][V: `npm run typecheck`] Run typecheck during implementation.
- [x] 5.3 [P0][depends:1.1][I: OpenSpec change][O: strict validation pass][V: `openspec validate add-project-map-focused-tests --strict --no-interactive`] Validate OpenSpec artifact before archive.
