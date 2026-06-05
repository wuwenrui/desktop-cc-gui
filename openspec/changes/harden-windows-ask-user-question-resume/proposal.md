## Why

Issue #658 reports that users can receive an interactive AskUserQuestion / requestUserInput card but cannot reliably send the answer. Local macOS reproduction succeeds, while user reports point to Windows, so the likely failure boundary is not the React submit control but the Windows Claude CLI resume path after the answer is accepted by the app.

Current evidence from `v0.5.3` / `v0.5.4` / `v0.5.5` comparison shows the AskUserQuestion main flow did not change: it still stores the answer, terminates the current Claude process, and starts `claude --resume <session_id>` with the answer. The fix must therefore harden and observe that Windows-specific process lifecycle instead of reworking the frontend card blindly.

## 目标与边界

- Goal: make Windows AskUserQuestion answer submission either resume Claude reliably or produce explicit, actionable diagnostics.
- Goal: distinguish frontend submit success from backend/runtime resume success, so the UI does not imply completion when Windows resume failed.
- Goal: record the actual Windows Claude launch wrapper type (`.cmd`, `.bat`, `.ps1`, `.exe`, or direct), resolved binary path, and resume spawn outcome.
- Goal: protect the kill-and-resume path from Windows wrapper drift, including `.ps1` selection and process-tree termination ambiguity.
- Goal: keep macOS/Linux behavior unchanged except for harmless diagnostics where shared code paths are touched.
- Boundary: this change targets Claude AskUserQuestion / requestUserInput answer submission and resume on Windows.
- Boundary: this change does not redesign requestUserInput UI, approval dialogs, Codex plan-mode local prompts, or the entire runtime lifecycle system.

## What Changes

- Add Windows-focused diagnostics around AskUserQuestion response handling:
  - accepted response by request id
  - matched turn id
  - captured Claude session id used for `--resume`
  - old process termination result
  - resolved Claude binary and wrapper kind
  - resume process spawn and first stdout event outcome
- Harden Windows launch selection for Claude resume:
  - prefer stable `.cmd` / `.exe` candidates over `.ps1` when both are available
  - explicitly record when `.ps1` is used so field reports can be correlated
- Harden Windows process lifecycle around AskUserQuestion resume:
  - keep or improve process-tree termination semantics before starting resume
  - surface `taskkill` failure instead of silently treating the UI submit as enough
  - avoid leaving the thread in an ambiguous processing state when resume spawn fails
- Add regression coverage for the AskUserQuestion Windows resume contract using command construction / process lifecycle seams where direct Windows execution is not available in CI.
- No breaking API changes and no new dependency are expected.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`: submitted AskUserQuestion answers must distinguish local submit settlement from runtime resume failure and keep a recoverable surface when resume fails.
- `claude-runtime-termination-hardening`: Windows Claude process termination during AskUserQuestion resume must be observable and must not silently lose the submitted answer.
- `engine-environment-doctor`: Claude binary resolution diagnostics must expose Windows wrapper kind and path selection relevant to requestUserInput resume.
- `windows-runtime-churn-diagnostics`: Windows runtime diagnostics must include AskUserQuestion resume churn signals, including terminate/spawn/resume-pending outcomes.

## 技术方案选项与取舍

| Option | Summary | Trade-off |
|---|---|---|
| A | Patch frontend submit handling only | Low effort, but contradicted by macOS success and does not explain Windows-only reports. Rejected. |
| B | Add diagnostics only around current kill+resume flow | Fastest to confirm root cause, but users may still hit the bug until a follow-up hardening lands. Partial solution only. |
| C | Harden Windows kill+resume and add diagnostics in the same change | Best balance: addresses the highest-risk boundary while producing evidence for unresolved environment-specific cases. Chosen. |
| D | Replace kill+resume with a direct in-process answer channel | Cleaner architecture, but likely requires Claude CLI protocol support that is not currently available. Too broad for this bug fix. |

Chosen: Option C. The code history shows `0.5.3` through `0.5.5` share the same AskUserQuestion main flow, so the safest fix is to harden the platform-dependent lifecycle while making failures explicit.

## 非目标

- Do not redesign the `RequestUserInputMessage` / `UserInputQuestionCard` layout.
- Do not change normal macOS/Linux Claude resume behavior unless shared helper code requires a no-op diagnostic addition.
- Do not introduce a new requestUserInput protocol shape.
- Do not archive or close issue #658 solely from code inspection; closure requires Windows evidence.
- Do not add broad process-manager abstractions unless needed to preserve the AskUserQuestion resume contract.

## 验收标准

- Given a Windows AskUserQuestion card, when the user submits an answer, the backend must log or emit a diagnostic that includes request id, turn id, wrapper kind, resolved Claude binary, and whether a session id was available for `--resume`.
- Given the old Claude process cannot be terminated on Windows, the app must surface a recoverable runtime error or diagnostic instead of silently removing all evidence of the pending resume.
- Given resume process spawn fails on Windows, the app must record `Failed to spawn AskUserQuestion resume process` with wrapper/path details and must not present the answer as fully resumed.
- Given `.cmd` / `.exe` and `.ps1` candidates are both present, the resolver must prefer the stable non-`.ps1` path for Claude runtime execution unless the user explicitly configured `.ps1`.
- Given `.ps1` is the only available or explicitly configured Claude binary, the app must run it through the PowerShell wrapper and include `ps1-wrapper` in diagnostics.
- Given macOS AskUserQuestion submit still succeeds, the change must not regress current macOS behavior.
- Given focused backend tests, command construction and Windows wrapper classification must cover `.cmd`, `.bat`, `.exe`, `.ps1`, and direct binary cases.
- Given focused frontend/hook tests, submitted answers must remain visible or recoverable when backend resume fails.

## Impact

- Backend / Rust:
  - `src-tauri/src/engine/claude/user_input.rs`
  - `src-tauri/src/engine/claude.rs`
  - `src-tauri/src/backend/app_server_cli.rs`
  - `src-tauri/src/codex/mod.rs`
  - `src-tauri/src/runtime/process_diagnostics.rs` or nearby runtime diagnostics helpers if needed
- Frontend / TypeScript:
  - `src/features/app/components/RequestUserInputMessage.tsx` only if recoverable resume failure state needs to be surfaced differently
  - `src/features/threads/hooks/useThreadUserInput.ts` if backend failures need clearer state handling
  - `src/services/tauri.ts` only if a new diagnostic payload or command response shape is required
- Specs:
  - `openspec/specs/codex-chat-canvas-user-input-elicitation/spec.md`
  - `openspec/specs/claude-runtime-termination-hardening/spec.md`
  - `openspec/specs/engine-environment-doctor/spec.md`
  - `openspec/specs/windows-runtime-churn-diagnostics/spec.md`
- Validation:
  - `openspec validate harden-windows-ask-user-question-resume --strict --no-interactive`
  - focused Rust tests for Claude command construction, wrapper classification, and AskUserQuestion answer formatting / routing
  - focused Vitest only if frontend recoverability behavior changes
  - Windows manual verification or user-provided runtime diagnostics before marking the issue fixed
