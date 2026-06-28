## Context

Claude Code and Codex use different runtime paths:

- Claude Code launches the CLI directly and reads stdout stream-json lines in `src-tauri/src/engine/claude.rs`.
- Codex launches `codex app-server` and forwards newline-delimited JSON-RPC events through `src-tauri/src/backend/app_server_runtime_lifecycle.rs`.

The previous Claude Windows fix removed an empty positional prompt after `-p` so `.cmd/.bat` wrappers no longer interpreted stream-json stdin as shell input. That fix is still present. The current risk is different: future refactors can accidentally buffer until EOF or fail to identify text ingress, making the UI look like one-shot final output.

## Goals / Non-Goals

**Goals:**

- Lock the Claude runtime contract: valid stdout text deltas are forwarded while the process is still running.
- Preserve macOS/Linux immediate delta behavior and Windows-only coalescing.
- Make Codex timing diagnostics detect all supported app-server text-delta method aliases.
- Keep terminal-only Codex completion distinguishable from real streamed text.

**Non-Goals:**

- No frontend rewrite.
- No new compatibility retry that restarts a healthy Codex app-server after initialize.
- No global Windows console/process flag change.

## Decisions

### Decision 1: Test the real process boundary for Claude

Add a fake CLI script that prints one text delta, waits, then prints a second delta and terminal event. The test waits for `ClaudeEvent::TextDelta` before the delayed tail can finish.

Alternative considered: unit-test only `parse_claude_stream_json_line`. That protects parser shapes but not stdout reader flush behavior, which is the symptom being reported.

### Decision 2: Preserve existing platform pacing

Keep `CLAUDE_TEXT_DELTA_COALESCE_WINDOW_MS` on Windows and `Duration::ZERO` elsewhere.

Alternative considered: remove Windows coalescing. That may improve perceived immediacy for tiny outputs but reopens the Windows per-character slowdown the current code intentionally mitigates.

### Decision 3: Align Codex backend timing with event aliases

Codex frontend adapters already tolerate legacy text-delta aliases. Backend `ccguiTiming.firstTextDeltaReceivedAtMs` should use the same method family so diagnostics do not falsely label streaming as final-only.

Alternative considered: treat only canonical `item/agentMessage/delta` as first text. That is stricter but fragile during Codex app-server version skew, especially on Windows wrapper installs.

### Decision 4: Terminal completion is not first text delta

Do not set first-text timing from `turn/completed` result text. A terminal-only answer can be visible to users, but it is not proof that streaming worked.

Alternative considered: count any final assistant content as first text. That would mask the exact regression under investigation.

## Risks / Trade-offs

- Windows script quoting can be fragile in tests -> use existing fake CLI helper patterns and keep assertions platform-neutral.
- Timing alias expansion could over-count non-assistant text -> gate on known text-delta method names and non-empty `delta`/`text` fields only.
- Tests on macOS cannot reproduce Windows wrapper behavior -> keep platform-specific assertions explicit and preserve Windows-only test branches for CI/users.

## Migration Plan

1. Add regression tests and helper updates.
2. Run focused Rust suites.
3. Validate OpenSpec strictly.

Rollback is simple: revert the change files and the narrow Rust test/helper edits. No data migration is involved.

## Open Questions

- If a future Codex app-server emits only cumulative `item/updated` snapshots without delta methods, should backend timing count growing snapshots as text ingress? This change does not do that because it would broaden semantics beyond the current delta contract.
