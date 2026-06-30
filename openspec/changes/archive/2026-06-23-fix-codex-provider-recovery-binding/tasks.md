## Tasks

- [x] Update backend provider binding lookup to prefer canonical catalog metadata key while preserving legacy key compatibility.
- [x] Preserve provider binding through Codex stale recovery fresh continuation.
- [x] Preserve provider binding through Codex stale recovery fork continuation.
- [x] Normalize blank provider ids at frontend recovery/start boundaries.
- [x] Add Rust lookup tests for canonical, legacy, trimmed, empty, and prefixed thread ids.
- [x] Add Vitest coverage for provider-bound and blank-provider Codex recovery.
- [x] Keep provider metadata resolver identity stable so AppShell does not enter a context update loop when thread metadata changes.
- [x] Remove focused `FileMarkdownPreviewFast` act warning by awaiting async rich outline state.
- [x] Validate focused frontend/Rust tests, typecheck, lint, runtime contract, large-file gate, and focused heavy-test-noise scan.
