## 1. Metadata Model And Storage

- [x] 1.1 Define shared automatic session metadata types for `sessionPurpose`, `visibility`, `ownerFeature`, `createdBy`, and `autoArchive`; input: proposal/design contract; output: typed frontend/backend payloads; validation: typecheck and Rust compile.
- [x] 1.2 Implement durable metadata overlay read/write helpers keyed by engine + owner workspace + canonical session id; depends on 1.1; output: reusable storage APIs; validation: Rust unit tests for create/read/update.
- [x] 1.3 Normalize legacy Codex `backgroundThread hide` events into `visibility=hidden`; depends on 1.2; output: compatibility bridge; validation: focused event/catalog tests.

## 2. Automatic Session Creation Call Sites

- [x] 2.1 Mark Prompt Enhancer, title generation, commit message, run metadata, and Project Map organizer sessions as hidden; depends on 1.1 and 1.2; output: hidden helper metadata at creation or canonical id resolution; validation: focused Vitest/Rust tests per entry family.
- [x] 2.2 Mark Spec Hub apply, Project Map generation, review fallback, and PR question sessions as system-auto; depends on 1.1 and 1.2; output: traceable automatic metadata; validation: focused tests assert metadata purpose and visibility.
- [x] 2.3 Preserve ordinary user-created sessions as user-visible or unclassified default; depends on 2.1 and 2.2; output: no regression for normal send, new session, `/new`, and `/clear`; validation: existing thread/session tests plus focused regression tests.
- [x] 2.4 Add remote/shared backend compatibility handling so metadata can be recorded after receiving session/thread id when payload support is absent; depends on 1.2; output: additive fallback path; validation: mocked remote response test.
- [x] 2.5 Record automatic metadata for sync engine runs once a stable identity is known, even if the run later fails; depends on 1.2 and 2.2; output: Claude sync failure paths do not leak failed automatic sessions to workspace root; validation: focused Rust regression for known session id + failed turn.

## 3. Catalog Projection And System Group

- [x] 3.1 Apply automatic visibility metadata in backend workspace session catalog projection before root/folder membership is returned; depends on 1.2; output: hidden rows filtered and system-auto rows separated; validation: Rust catalog projection tests.
- [x] 3.2 Add reserved `system-auto` grouping projection that preserves true owner workspace and stable session key; depends on 3.1; output: system group rows available to frontend; validation: Rust and Vitest projection tests.
- [x] 3.3 Update Sidebar, Workspace Home, and Session Management consumers to avoid re-adding hidden/system-auto rows from native lists or runtime overlays; depends on 3.1 and 3.2; output: consistent user-facing membership; validation: focused frontend tests.
- [x] 3.4 Preserve pending-to-real identity migration for automatic session metadata; depends on 1.2 and 3.1; output: no duplicate root rows after promotion; validation: pending rename regression tests.

## 4. Verification And Documentation

- [x] 4.1 Add test coverage for hidden helper scenarios: Prompt Enhancer, title generation, commit message, run metadata, Project Map organizer; depends on 2.1 and 3.1; output: assertions that helpers do not appear in normal workspace lists; validation: focused test suite passes.
- [x] 4.2 Add test coverage for system-auto traceable scenarios: Spec Hub apply, Project Map generation, review fallback, PR question; depends on 2.2 and 3.2; output: assertions that sessions appear under system-auto and not root; validation: focused test suite passes.
- [x] 4.3 Run contract and quality gates; depends on all implementation tasks; output: validation evidence; validation: `openspec validate classify-auto-session-visibility --strict --no-interactive`, `npm run typecheck`, focused Vitest, and relevant `cargo test --manifest-path src-tauri/Cargo.toml` suites.
- [x] 4.4 Update relevant Trellis/code-level specs if implementation introduces reusable contracts outside OpenSpec; depends on implementation outcome; output: synchronized `.trellis/spec/**` guidance when required; validation: review changed spec docs.
- [x] 4.5 Add review regression coverage for failed automatic sessions with known canonical identity; depends on 2.5; output: test proves metadata is persisted before success-only return boundary; validation: focused Rust test plus `openspec validate classify-auto-session-visibility --strict --no-interactive`.
