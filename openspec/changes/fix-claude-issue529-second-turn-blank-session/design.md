## Context

Issue #529 reports a repeatable Claude-only failure: the first message works, the second message turns the conversation into a blank board, and clicking the sidebar entry cannot restore it. Codex is reported healthy on the same machine. Current code already has parser-level regression coverage for one Issue #529 JSONL shape, but that only proves `load_claude_session_from_base_dir` can return rows. The remaining risk is the cross-layer chain from native Claude session truth to workspace catalog projection to frontend selected thread activation.

## Goals / Non-Goals

**Goals:**

- Manufacture a local Issue #529-style Claude session that exercises second-turn, synthetic continuation, tool-use, and final assistant rows.
- Prove the session is discoverable in the Claude/session catalog surface and reloads into a non-empty conversation.
- Keep existing readable rows visible while late native truth or catalog reconcile is pending.
- Keep Codex behavior unchanged.

**Non-Goals:**

- Replace the shared workspace session catalog.
- Add a new persistent UI state source.
- Treat every Claude session as blanking-prone.
- Rewrite message rendering or Markdown streaming performance code.

## Decisions

### Decision: Test The Full Activation Chain, Not Only JSONL Parsing

Parser-only tests can pass while the user still sees a blank board if the session summary disappears, aliases to a different thread id, or the frontend clears rows during late reconcile. The implementation will add/adjust focused tests around native load, catalog/sidebar projection, and frontend activation where the code boundary exists.

Alternative considered: add only another Rust JSONL parser fixture. This is too weak because the current branch already has `claude_history_issue529_tests.rs`.

### Decision: Prefer Existing Claude Identity Evidence

When a Claude JSONL line lacks explicit `session_id`, the filename/session id, `uuid`, `parentUuid`, timestamp, and `cwd` evidence remain valid. The fix should preserve or strengthen existing source fact resolution rather than introducing a parallel alias table.

Alternative considered: persist a new frontend alias map for failed Claude reopen. This would add drift and would not help first-time restore from disk.

### Decision: Preserve Readable Surface During Reconcile

If history rows have already loaded, late reconcile must either converge to a canonical replacement or show a recoverable failure. It must not clear `itemsByThread` first and hope a later native list returns rows.

Alternative considered: clear the selected thread immediately on mismatch. This matches the observed blanking failure and is explicitly rejected.

## Risks / Trade-offs

- [Risk] Manufactured data may not match the exact user payload. → Mitigation: include the known signals from the issue thread: second turn, synthetic resume/no-response rows, tool_use, missing explicit session_id, mac/Windows-style paths.
- [Risk] A frontend fallback could hide backend membership bugs. → Mitigation: assert backend/session discovery separately before UI activation fallback.
- [Risk] Over-preserving last-good Claude rows could resurrect deleted sessions. → Mitigation: preserve only during incomplete/degraded/late reconcile; authoritative delete/archive/out-of-scope evidence still wins.

## Migration Plan

No data migration is required. The fix is behavioral and test-backed. Rollback is reverting the code/test/spec files in this change; no persisted schema changes are introduced.

## Open Questions

- Whether the failing user payload contains a specific Claude 2.1.138 record shape not covered by the current synthetic fixture. If new evidence arrives, add it as a narrower fixture rather than broadening UI fallback.
