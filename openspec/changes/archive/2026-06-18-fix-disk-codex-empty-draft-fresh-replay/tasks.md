## 1. Implementation

- [x] 1.1 Adjust Codex send fallback so disposable first-turn drafts fresh replay before stale fork fallback.
- [x] 1.2 Preserve durable stale thread behavior through existing rebind/fork semantics.
- [x] 1.3 Rename disk provider visible copy to `codex-tui/default-config` across frontend/backend constants and tests.
- [x] 1.4 Update Trellis contract notes for the new provider copy and fallback ordering.

## 2. Validation

- [x] 2.1 Add or update Vitest coverage for first-turn draft fresh replay before fork.
- [x] 2.2 Run focused frontend tests for Codex messaging and provider copy surfaces.
- [x] 2.3 Run strict OpenSpec validation for this change.
