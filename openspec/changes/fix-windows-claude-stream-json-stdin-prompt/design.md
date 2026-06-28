## Context

Claude Code sends are launched from Rust backend through `ClaudeSession::build_command()`. Recent hardening moved normal prompts into `--input-format stream-json` stdin so Windows shell metacharacters no longer pass through argv. The implementation still appends an empty positional prompt after `-p`, producing `claude -p "" --input-format stream-json`.

macOS currently tolerates this invocation. Windows usually launches npm CLI wrappers through `cmd /c claude.cmd`, and that extra empty positional argument can change how the wrapper or Claude CLI interprets stdin. The observed failure is exact protocol drift: the raw JSON stdin payload appears as the user message/title, then backend cannot parse any valid stream-json stdout event.

## Goals / Non-Goals

**Goals:**

- Use Claude stream-json stdin without any positional prompt placeholder.
- Preserve existing stdin prompt safety for Windows special characters, multiline prompts, images, and resume flows.
- Add a regression test that locks the argv shape, not only the absence of user prompt text.

**Non-Goals:**

- No cleanup or migration for already polluted Claude JSONL sessions.
- No frontend rendering changes.
- No Codex runtime changes.

## Decisions

1. Remove the empty positional prompt in stream-json stdin mode.

   Rationale: Claude CLI supports `-p --input-format stream-json` with stdin input. The empty positional argument is not needed and is the likely Windows wrapper trigger. This is more robust than a Windows-only branch because it makes the command contract correct on macOS, Linux, and Windows.

   Alternatives considered:
   - Windows-only removal: leaves a malformed-but-tolerated contract on Unix.
   - argv fallback on Windows: reintroduces shell metacharacter risk and breaks image/multiline uniformity.

2. Keep `build_message_content()` unchanged.

   Rationale: The payload shape is already used for images and multiline prompts. The bug is not JSON shape construction; it is that the JSON is interpreted as prompt text by the launched CLI path.

3. Test command construction directly.

   Rationale: The production failure depends on Windows wrapper behavior that is difficult to reproduce on macOS CI. A focused argv-shape test prevents reintroducing the empty positional prompt and still runs cross-platform.

## Risks / Trade-offs

- [Risk] An older Claude CLI build may require a positional prompt after `-p`.  
  Mitigation: stream-json stdin examples do not require it; existing tests still cover normal stream output parsing. If a legacy build fails, the fallback should be version-gated rather than restoring a global empty placeholder.

- [Risk] Existing polluted sessions remain in the sidebar.  
  Mitigation: out of scope for this hotfix; a separate cleanup/import repair change can filter or rename historical JSON payload titles.

- [Risk] Codex Windows wrapper could have a different issue.  
  Mitigation: this change is Claude-specific; Codex app-server launch should be investigated separately if reproduced.

## Migration Plan

1. Update `ClaudeSession::build_command()` so stdin mode adds `--input-format stream-json` without `cmd.arg("")`.
2. Extend focused Rust tests to assert no empty positional prompt is present after `-p`.
3. Validate the OpenSpec change and focused Claude engine tests.
4. Rollback is a one-line restoration of the empty arg, but should be avoided unless paired with a version/platform-specific capability probe.

## Open Questions

- Whether polluted historical Windows Claude sessions should be cleaned or hidden by a separate history/title sanitization change.
