## 1. Canonical Model Foundation

- [x] 1.1 [P0, depends: proposal/spec/design] Define the canonical Git change entry type and source flags in a focused frontend utility module; input: status and diff payload shapes; output: typed projection primitives; validation: TypeScript compile and unit fixture import.
- [x] 1.2 [P0, depends: 1.1] Implement repository-relative path normalization without OS-specific path APIs; input: slash paths, backslash paths, duplicate separators, paths with spaces; output: stable normalized identity; validation: pure unit tests on Windows-style and POSIX-style fixtures.
- [x] 1.3 [P0, depends: 1.1] Implement status+diff merge preserving status-derived entries as authoritative; input: `files`, `stagedFiles`, `unstagedFiles`, `diffs`; output: section-scoped canonical entries; validation: tests for existing added/modified/deleted status entries.
- [x] 1.4 [P0, depends: 1.3] Implement diff-only fallback entry synthesis; input: diff entries missing from status lists; output: renderable added/deleted/modified fallback entries; validation: tests for `new file mode`, `deleted file mode`, `/dev/null`, and no-header fallback.
- [x] 1.5 [P0, depends: 1.4] Enforce preview-only behavior for diff-only fallback entries; input: fallback rows without status-confirmed section; output: no stage/unstage/discard/commit inclusion controls; validation: component test asserts mutation controls are absent.
- [x] 1.6 [P1, depends: 1.4] Infer rename display status from `rename from` / `rename to` headers; input: diff-only rename fixture; output: fallback status `R`; validation: pure unit test.

## 2. Cross-Platform, Web, and Compatibility Guards

- [x] 2.1 [P0, depends: 1.4] Add LF and CRLF diff-header/status-inference fixtures; input: equivalent diffs with different line endings; output: identical inferred status and best-effort stats; validation: unit tests.
- [x] 2.2 [P0, depends: 1.4] Add optional `GitFileDiff.status?: string` TypeScript compatibility without making it required; input: old payload and enriched payload; output: both accepted by projection; validation: tests for absent and present status.
- [x] 2.3 [P1, depends: 2.2] Decide whether to add Rust optional status in local and daemon `GitFileDiff`; input: frontend fallback already complete; output: additive backend field or explicit deferral note; validation: if implemented, Rust compile and daemon/local parity tests or review checklist.
- [x] 2.4 [P0, depends: 1.4] Ensure Web Service, remote daemon, and local desktop Git panel inputs route through the same projection helper; input: existing data preparation paths; output: no parallel Web-only merge logic; validation: targeted tests or adapter-level fixture coverage.
- [x] 2.5 [P0, depends: 2.4] Add minimum Web-facing payload guards; input: missing `path`, missing `status`, missing `diff`, missing media metadata fixtures; output: safe discard/tolerate/no-fallback behavior; validation: pure unit tests and diagnostic assertion where available.
- [x] 2.6 [P0, depends: 1.3] Separate identity keys by responsibility; input: same path across staged/unstaged/viewer/action flows; output: section-scoped list/action keys and path-scoped viewer keys; validation: dual-state selection/action tests.

## 3. Git Panel Wiring

- [x] 3.1 [P0, depends: 1.4] Wire `useGitDiffs` or adjacent Git panel data preparation through canonical projection while preserving existing returned field names; input: current status and diff hook state; output: backward-compatible list/viewer data; validation: existing GitDiffPanel tests still compile.
- [x] 3.2 [P0, depends: 3.1] Preserve staged and unstaged same-path dual entries; input: same path in both status sections; output: both rows remain section-scoped; validation: component or hook test for stage/unstage/discard target semantics.
- [x] 3.3 [P1, depends: 3.1] Preserve image and binary diff metadata through canonical projection; input: image/binary diff entries; output: viewer still receives media metadata; validation: unit test for metadata passthrough.
- [x] 3.4 [P1, depends: 3.1] Keep full-context diff loading keyed by logical Git path; input: selected fallback or status-derived file; output: `getGitFileFullDiff` path behavior unchanged; validation: focused viewer/hook test.

## 4. Deleted-State Presentation

- [x] 4.1 [P1, depends: 3.1] Add deleted-state class/data usage for file rows without changing role, tab index, or action rendering; input: status `D`; output: row exposes stable styling hook; validation: component test asserts marker/class/data state.
- [x] 4.2 [P1, depends: 4.1] Add CSS for deleted file name treatment such as line-through/subdued text while preserving selected/active/focus contrast; input: existing `.diff-row[data-status="D"]`; output: explicit deleted visual semantics; validation: visual review checklist and test marker.
- [x] 4.3 [P1, depends: 4.2] Confirm deleted row actions remain visible and accessible; input: deleted staged and unstaged rows; output: preview/context/stage/unstage/discard availability unchanged; validation: focused component tests.

## 5. Regression and Governance Validation

- [x] 5.1 [P0, depends: 1.6,2.5,2.6] Add pure projection tests for status-authoritative merge, diff-only added fallback, diff-only deleted fallback, preview-only fallback controls, rename fallback, same-path staged/unstaged preservation, Web payload minimum guards, optional status absence, and optional status presence; output: deterministic test suite; validation: focused Vitest command.
- [x] 5.2 [P1, depends: 3.4] Add Git panel integration tests covering added-file fallback visibility and deleted-file visual marker in flat and tree modes; output: UI-level regression coverage; validation: focused GitDiffPanel/GitHistoryWorktree tests as applicable.
- [x] 5.3 [P1, depends: 5.1] Run large-file governance checks defined by `.github/workflows/large-file-governance.yml`; input: final implementation; output: parser tests, near-threshold watch, and hard-debt gate pass; validation: `node --test scripts/check-large-files.test.mjs`, `npm run check:large-files:near-threshold`, `npm run check:large-files:gate`.
- [x] 5.4 [P1, depends: 5.2] Run cross-platform-safe validation commands that avoid OS-specific shell assumptions; input: implementation branch; output: typecheck and focused tests pass locally and remain suitable for GitHub Actions matrix; validation: `npm run typecheck` and focused Vitest suites.
- [x] 5.5 [P2, depends: 5.4] Record manual review notes for local desktop, remote daemon, and Web Service consistency; input: available runtime modes; output: documented evidence or explicit untested caveat; validation: review note attached before archive.
