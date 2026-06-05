## Context

Claude `AskUserQuestion` currently works by converting the tool call into a GUI `requestUserInput` card. When the user answers, the backend stores the formatted answer by turn, wakes the waiting stdout loop, terminates the current Claude CLI child, and spawns a new `claude --resume <session_id>` process carrying the answer.

Local macOS verification succeeds, while issue reports point to Windows. Version comparison across `v0.5.3`, `v0.5.4`, and `v0.5.5` shows that `src-tauri/src/engine/claude/user_input.rs` and the Claude `terminate_child_process` implementation are unchanged. This means the root cause is unlikely to be a new frontend regression or a newly introduced AskUserQuestion main-flow change. The credible boundary is Windows process lifecycle and executable wrapper selection around the existing kill-and-resume mechanism.

Current Windows process handling already uses `taskkill /PID <pid> /T /F`, and runtime command construction already knows about `.cmd` / `.bat` wrappers. `v0.5.4` added `.ps1` wrapper support and broader executable diagnostics. That broadening can change which Claude binary wrapper some Windows hosts resolve to, and wrapper choice affects stdin/stdout forwarding, hidden console behavior, and process-tree ownership.

## Goals / Non-Goals

**Goals:**

- Make Windows AskUserQuestion answer submission diagnosable from acceptance through resume spawn.
- Preserve macOS/Linux behavior while adding Windows-specific evidence where needed.
- Prefer stable Windows Claude execution wrappers for managed runtime/resume paths when multiple candidates exist.
- Ensure a submitted answer is not silently lost when old-process termination, session id capture, or resume spawn fails.
- Keep the repair small enough for focused backend tests and a targeted Windows manual verification pass.

**Non-Goals:**

- Do not redesign the GUI question card.
- Do not replace Claude CLI `--resume` unless the CLI exposes a better direct answer channel.
- Do not treat issue closure as complete without Windows evidence.
- Do not introduce a new requestUserInput protocol payload shape.
- Do not broaden process lifecycle refactors beyond the AskUserQuestion resume boundary unless shared helpers already exist.

## Decisions

### Decision: Keep the kill-and-resume architecture, harden its Windows boundary

The system will continue using `claude --resume <session_id>` to deliver AskUserQuestion answers because that is the existing working architecture and it succeeds on macOS. The change will add explicit diagnostics and Windows hardening around the transition points: request accepted, session id present, parent child termination, resume command construction, resume spawn, and first resume output.

Alternative considered: replace kill-and-resume with direct stdin answer injection into the original process. Rejected because the current Claude CLI interaction is already modeled around print-mode resume, and a direct interactive answer protocol is not established in this codebase.

### Decision: Treat wrapper kind as runtime evidence, not only doctor metadata

The resolved Claude binary path and wrapper kind will be recorded in the AskUserQuestion resume path. This evidence belongs near the runtime event because doctor output alone cannot prove what binary was used for the failing turn.

Alternative considered: only improve `runClaudeDoctor`. Rejected because field failures need correlation with the specific turn and resume attempt, not a separate point-in-time diagnosis.

### Decision: Prefer stable wrappers for implicit Windows Claude resolution

When resolver logic discovers multiple candidates for Claude runtime execution, stable candidates such as `.cmd` and `.exe` should be preferred over `.ps1` unless the user explicitly configured a `.ps1` path. PowerShell scripts remain supported, but implicit selection should avoid increasing wrapper complexity for managed stdin/stdout runtime paths.

Alternative considered: keep current extension ordering and rely on diagnostics. Rejected because `.ps1` adds a distinct wrapper layer and execution policy surface; if `.cmd` or `.exe` exists, it is the safer managed runtime default.

### Decision: Separate accepted answer from resumed runtime state

A successful `respond_to_server_request` call only proves the app accepted the answer. It must not be treated as proof that Claude resumed. If termination or resume spawn fails, the system should surface a recoverable runtime error/diagnostic and retain enough submitted-answer evidence to avoid data loss.

Alternative considered: keep current optimistic submit completion and rely on runtime timeout. Rejected because it hides the most important failure point from Windows users and maintainers.

### Decision: Add focused test seams instead of requiring Windows CI for every assertion

Rust tests should cover command construction, wrapper classification/preference, answer formatting, and request-id routing. Process-tree termination behavior should be unit-tested where practical and manually verified on Windows for the actual `taskkill` behavior.

Alternative considered: require a full Windows integration test harness before implementation. Rejected as too heavy for this bug fix, but manual Windows evidence remains required before issue closure.

## Risks / Trade-offs

- [Risk] `.ps1` may be the only available wrapper on some Windows hosts. → Mitigation: keep explicit `.ps1` support and only deprioritize it when stable alternatives exist.
- [Risk] `taskkill /T /F` can still fail because of permissions or process ownership. → Mitigation: surface taskkill status and PID details in diagnostics instead of silently continuing.
- [Risk] Resume process can spawn but fail before emitting valid stdout. → Mitigation: record resume-pending state and clear it only on first valid resume event or terminal failure.
- [Risk] Additional diagnostics may expose paths. → Mitigation: report paths as executable diagnostics but continue redacting secrets and avoid logging answer text except existing sanitized summaries.
- [Risk] UI changes could overcomplicate a backend issue. → Mitigation: only touch frontend if backend failure state cannot be represented through existing error/retry surfaces.

## Migration Plan

1. Add backend diagnostics and wrapper metadata first, without changing frontend behavior.
2. Adjust Windows resolver preference for implicit Claude runtime execution while preserving explicit user-configured paths.
3. Harden failure propagation around AskUserQuestion parent termination and resume spawn.
4. Add focused Rust tests for command/wrapper behavior and AskUserQuestion routing/formatting.
5. Add focused frontend tests only if the backend response contract changes.
6. Perform Windows manual verification with `.cmd`, `.exe` or `.ps1` cases before marking the issue fixed.

Rollback strategy: revert resolver preference and diagnostics/hardening commits. Because no new persistence schema or dependency is planned, rollback should be limited to runtime behavior and logs.

## Open Questions

- Do affected Windows users resolve Claude to `.cmd`, `.exe`, or `.ps1`?
- Does failure happen before `respond_to_user_input`, during parent termination, during resume spawn, or after spawn before first stdout event?
- Should resume failure keep the live card retryable, or is a submitted-answer audit plus explicit runtime error sufficient?
