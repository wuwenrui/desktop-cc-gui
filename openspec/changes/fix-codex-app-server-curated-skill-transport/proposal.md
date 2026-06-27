## Why

Windows Codex sessions still fail when the built-in `lazy-senior-dev` curated skill is enabled, even after the previous wrapper fallback change. The earlier design only moved the failure to fallback, but the primary launch still passed large ccgui-generated `developer_instructions` through Windows process argv. Direct CLI verification also shows `codex --profile <name> app-server` is invalid because `--profile` does not apply to the `app-server` command.

This needs a follow-up because the failure is not a skill-content problem. The broken part is Windows transport: launch-time argv is the wrong boundary for bundled skill bodies. Codex can receive the same developer instructions through the existing JSON-RPC `turn/start.collaborationMode.settings.developer_instructions` path, which avoids shell/wrapper argv entirely.

## Goals And Boundaries

- Make Windows Codex app-server launch avoid ccgui-generated `developer_instructions` argv on the primary path, not only fallback.
- Inject Windows Codex curated skills through `turn/start.collaborationMode.settings.developer_instructions` so enabled built-in skills remain usable.
- Make Windows Claude recognize enabled curated skills through the effective Claude native skills directory instead of process argv.
- Activate Windows Claude curated skills with a short ccgui-managed `--append-system-prompt-file` hint that points Claude to the native Skill, without putting skill bodies in argv.
- Preserve enabled curated skills for Codex app-server sessions instead of disabling `lazy-senior-dev` or silently dropping skill bodies.
- Keep launch-time curated skill injection behavior unchanged for macOS and Linux.
- Keep diagnostics explicit when primary and fallback both fail, including the original initialize failure and the retry failure.
- Keep user-authored `developer_instructions` / `instructions` overrides authoritative.

## Non-Goals

- Do not remove the built-in `lazy-senior-dev` skill or change its content.
- Do not add frontend retry UI, a new Settings switch, or a per-workspace curated skill scope.
- Do not mutate the user's base `config.toml`.
- Do not rely on `--profile` for `codex app-server` unless Codex CLI later documents and supports that command shape.
- Do not change macOS/Linux curated skill injection behavior.

## What Changes

- Replace the invalid generated-profile fallback for Codex app-server wrapper retry with an app-server-compatible retry that omits ccgui-generated instruction argv.
- Ensure Windows primary and retry launch do not pass the internal external-spec hint or curated skill body through argv.
- Ensure enabled curated skill instructions are either:
  - passed through the supported `-c developer_instructions=...` app-server argument on macOS/Linux; or
  - passed through Codex JSON-RPC `turn/start.collaborationMode.settings.developer_instructions` on Windows.
- Update backend tests so `--profile ccgui-generated-instructions app-server` is rejected as an invalid fallback expectation.
- Add coverage for the user-reported sequence: disable built-in skill, re-enable it on Windows, then create a Codex session without initialize failure.
- Preserve rollback behavior in `set_curated_skill_enabled`: if restarting existing Codex runtimes fails, settings must restore the previous `enabledCuratedSkillIds`.
- Apply the same Windows transport boundary to Claude curated skill injection by skipping large `--append-system-prompt` argv on Windows while preserving macOS/Linux behavior.
- On Windows Claude, mirror enabled curated skills into the effective `CLAUDE_HOME/skills/<skill-id>/SKILL.md` location before launch so Claude's native skill discovery can see them without argv transport.
- On Windows Claude, write a small ccgui-managed activation hint file and pass only its path through `--append-system-prompt-file`.
- Do not hard-code Claude home paths: use configured Claude home first, then `CLAUDE_HOME`, then the platform default Claude home.
- Treat the native skill mirror as ccgui-managed storage only; do not overwrite or delete user-owned Claude skill directories.
- Fix the existing Settings `MCP / Skills` curated-skill switch so it reads from the caller-owned `SettingsView` `appSettings` snapshot and writes back through `onUpdateAppSettings`; the UI must reflect the backend-returned `AppSettings` immediately instead of requiring a tab/module remount.

## Technical Options

| Option | Summary | Decision |
| --- | --- | --- |
| Disable `lazy-senior-dev` on Windows | Avoid the long generated instruction body by platform-disabling the default built-in skill. | Rejected. It hides the bug and makes built-in skills unavailable on Windows. |
| Keep generated profile fallback | Write `$CODEX_HOME/ccgui-generated-instructions.config.toml` and pass `--profile ccgui-generated-instructions app-server`. | Rejected. Direct CLI verification shows `--profile` is not valid for `app-server`, so this fallback cannot be the contract. |
| Use supported `-c developer_instructions=...` for Windows app-server launch | Keep all generated instructions in launch argv. | Rejected for Windows. The user report shows Windows launch argv remains the failure source even before fallback. |
| Inject Codex generated instructions through `turn/start.collaborationMode.settings` on Windows | Keep launch argv small and use app-server JSON-RPC settings per turn. | Chosen. It keeps built-in skills enabled and usable without relying on fragile Windows argv. |
| Drop all ccgui-generated instructions only on wrapper retry | Start the retry with no ccgui-generated developer instructions while preserving user-authored args. | Insufficient. It still lets the primary Windows launch fail before retry and does not make the skill usable. |
| Mirror enabled curated skills into effective Claude native skills directory on Windows | Avoid `--append-system-prompt` while letting Claude discover the bundled skill as a normal native skill. | Chosen. User testing proved argv skipping fixed stream pollution but did not inject the skill. Native skill discovery is the safe non-argv point. |
| Use `--append-system-prompt-file` for a short activation hint on Windows Claude | Keep skill body out of argv while telling Claude to invoke enabled native Skills for matching tasks. | Chosen. Windows CLI testing confirmed the file form is supported with stream-json, and stdin cannot carry system/developer instructions. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-app-server-wrapper-launch`: Windows launch and retry must not use generated `developer_instructions` argv; retry must not use `--profile` for `app-server`.
- `curated-skill-bundles`: Windows Codex curated skill injection must remain effective through `turn/start` settings when users toggle built-in skills.
- `claude-code-realtime-stream-visibility`: Claude Windows launch must preserve stream-json stdin while avoiding large curated skill body argv.

## Impact

- Rust backend launch arg construction in `src-tauri/src/backend/app_server_cli.rs`.
- Rust backend session spawn/restart path in `src-tauri/src/backend/app_server.rs` and curated skill setting restart behavior in `src-tauri/src/curated_skills.rs`.
- Frontend curated skill settings wiring in `src/features/curated-skills/components/CuratedSection.tsx`, `src/features/curated-skills/hooks/useCuratedSkillToggle.ts`, and the `SettingsView` call sites.
- Focused Rust tests around Codex app-server args, Windows wrapper retry planning, and curated skill toggle restart rollback.
- Focused frontend tests for immediate curated switch UI convergence and failed-toggle rollback.
- Existing OpenSpec main specs for `codex-app-server-wrapper-launch` and `curated-skill-bundles`.
- No new dependencies, storage migrations, or frontend API changes.

## Acceptance Criteria

- `codex --profile ccgui-generated-instructions app-server` is no longer treated as a valid fallback design in tests or specs.
- With `lazy-senior-dev` enabled, Codex session creation on Windows no longer fails at initialize because ccgui-generated instructions are not sent through launch argv.
- With `lazy-senior-dev` enabled, Codex turns on Windows include the curated skill body in `turn/start.collaborationMode.settings.developer_instructions`.
- With `lazy-senior-dev` enabled, Claude session creation on Windows no longer passes the curated skill body through `--append-system-prompt` argv.
- With `lazy-senior-dev` enabled, Claude turns on Windows make `lazy-senior-dev` available through the effective Claude native skills directory.
- With `lazy-senior-dev` enabled, Claude launch on Windows passes `--append-system-prompt-file <ccgui hint file>` and does not pass the skill body through argv.
- Existing user-owned `CLAUDE_HOME/skills/lazy-senior-dev` content is not overwritten by the built-in mirror.
- Wrapper retry preserves user-authored Codex args and does not inject a competing `developer_instructions` value when the user already supplied one.
- Turning the built-in skill off and then on again must either restart Codex runtimes successfully with the new enabled set or roll settings back with a visible error.
- In Settings `MCP / Skills`, toggling the built-in curated skill must update the visible switch from the authoritative backend-returned `enabledCuratedSkillIds` without switching away and back.
- If the curated-skill toggle write fails, the Settings UI must keep the previous switch state and surface the error instead of showing a false successful toggle.
- Focused backend tests cover primary launch, wrapper retry launch planning, user override behavior, and the invalid `--profile ... app-server` regression.
- Focused frontend tests cover successful immediate UI convergence and failed-toggle rollback for `CuratedSection`.
- `openspec validate fix-codex-app-server-curated-skill-transport --strict --no-interactive` passes.
