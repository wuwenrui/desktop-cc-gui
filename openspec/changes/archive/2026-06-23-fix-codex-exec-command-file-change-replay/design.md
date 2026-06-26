## Overview

This fix narrows the mismatch between Codex local history replay and the real workspace mutation stream. Codex history already reconstructs `exec_command` calls as `commandExecution` items. The missing piece was that `buildConversationItemFromThreadItem()` only upgraded command executions to `fileChange` when the command looked like `apply_patch`.

MiniMax-backed Codex sessions often write files using shell commands (`cat > file <<'EOF'`, `sed -i`, small Python rewrite scripts). The target fix is to recognize the safe subset of shell commands that already has mutation semantics encoded in the command text.

## Root Cause

The local session file recorded the following shape:

1. `response_item.function_call` with `name = "exec_command"`
2. command text containing `cat > /path/to/File.java <<'EOF' ...`
3. `response_item.function_call_output` with normal successful output

`parseCodexSessionHistory()` correctly rebuilt this as a `commandExecution`. However, the converter only called `inferFileChangesFromCommandExecutionArtifacts()` for `apply_patch` commands. Because the command did not contain `apply_patch`, the curtain rendered it as an ordinary command card even though the right-side Git panel showed the files as changed.

## Design Decisions

### Decision 1: Infer only from command text for non-apply-patch shell mutations

For non-`apply_patch` commands, the replay path calls `inferMutatingFileChangesFromCommand(command)`. This helper uses existing shell tokenization and only recognizes mutation-intent tokens:

- redirection write targets
- append redirection targets
- delete command targets
- existing narrow create command targets

It does not read `git status` output, test output, or arbitrary stdout/stderr as mutation evidence.

### Decision 2: Keep apply_patch on the existing richer path

`apply_patch` still uses `inferFileChangesFromCommandExecutionArtifacts(command, output)` so it can combine patch text, success marker output, path kind, and richer diff content.

### Decision 3: Filter temporary patch artifacts outside apply_patch

Commands that only create a temporary `.diff` / `.patch` file are not equivalent to changing the target source file. The non-`apply_patch` mutation helper filters temporary patch artifacts so existing safety behavior remains intact.

## Risk Review

### Open Surface

The open surface is intentionally small:

- Source: `commandExecution` items only.
- Status gate: command must be successful, or `apply_patch` output must contain the established success marker.
- Evidence gate for non-`apply_patch`: mutation must be visible in command text itself.
- No output-only promotion for Git status, tests, logs, or arbitrary summaries.

### Residual Risks

- Some real mutations remain invisible if they are performed through complex scripts whose target paths are not present as shell redirection/delete/create tokens. This is accepted because broad script interpretation would increase false positives.
- A successful command that writes a generated file with shell redirection will now show a `File changes` card even if the command later rewrites it again in the same shell. The path-level fact is still correct for history replay.
- The current helper classifies `>` as `add` and `>>` as `modified`; it does not inspect prior file existence. Git panel remains the authority for exact final Git status.

## Alternatives Considered

| Option | Summary | Trade-off |
|---|---|---|
| Only fix the observed MiniMax session via Git status fallback | Could reconcile final state, but would turn history replay into a Git snapshot and lose per-tool causality. |
| Parse arbitrary command output | More changes might appear, but read-only commands could become false file changes. |
| Reuse existing command text mutation parser | Smallest controlled fix; misses opaque script writes but avoids output false positives. |

Chosen option: reuse existing command text mutation parser and keep output-only inference out of the non-`apply_patch` path.

## Test Plan

- Converter unit test: successful heredoc shell write becomes `fileChange`.
- Existing regression: patch text written to a temp `.diff` without `apply_patch` remains `commandExecution`.
- Codex replay regression: `response_item.function_call(exec_command)` + output replays as a `fileChange` card.
- Existing file-change parser tests continue to cover `git status --short` and read-only payload filtering.

## Rollback

Rollback is frontend-only:

- Remove `inferMutatingFileChangesFromCommand()` export.
- Restore `commandExecution` conversion to only upgrade `apply_patch` commands.
- Keep Git panel behavior unchanged.
