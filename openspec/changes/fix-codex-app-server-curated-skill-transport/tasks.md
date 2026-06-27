## 1. OpenSpec Contract

- [x] 1.1 Add delta specs for Codex wrapper retry, curated skill transport, and Claude Windows wrapper argv safety.
- [x] 1.2 Add design documenting rejected `--profile ... app-server`, degraded fallback, and mac-safe boundaries.

## 2. Codex Wrapper Transport

- [x] 2.1 Replace generated-profile wrapper retry with app-server-compatible degraded omission of ccgui-generated instructions.
- [x] 2.2 Preserve primary Codex launch behavior and user-authored instruction override handling.
- [x] 2.3 Update Codex backend tests to reject `--profile ccgui-generated-instructions app-server` and cover degraded diagnostics.

## 3. Claude Wrapper Transport

- [x] 3.1 Skip `--append-system-prompt` curated skill argv on Windows command wrappers.
- [x] 3.2 Keep macOS/Linux Claude curated skill injection unchanged.
- [x] 3.3 Add focused Claude command-args tests for wrapper skip and direct-path preservation.

## 4. History Compatibility Cleanup

- [x] 4.1 Keep high-confidence leaked stream-json history filtering for old polluted transcripts.
- [x] 4.2 Remove symptom-level Claude pending retry override added during the earlier history-focused pass.

## 5. Verification

- [x] 5.1 Run focused Codex app-server CLI tests.
- [x] 5.2 Run focused Claude stream/command tests and Claude history tests.
- [x] 5.3 Run frontend tests only for touched history loader if retained.
- [x] 5.4 Run `cargo check --manifest-path src-tauri/Cargo.toml --release`, `npm run typecheck`, `git diff --check`, and strict OpenSpec validation.

## 6. Windows primary transport correction

- [x] 6.1 Make Codex Windows primary app-server launch avoid ccgui-generated `developer_instructions` argv instead of waiting for wrapper fallback.
- [x] 6.2 Inject Windows Codex curated skills through `turn/start.collaborationMode.settings.developer_instructions` so enabled built-in skills remain usable without CLI argv transport.
- [x] 6.3 Disable Claude curated skill `--append-system-prompt` argv transport on Windows while preserving macOS/Linux behavior.
- [x] 6.4 Add focused regression tests for Windows Codex argv omission, Codex turn payload injection, and Windows Claude argv omission.
- [x] 6.5 Re-run focused Rust tests, release check, and strict OpenSpec validation.

## 7. Claude Windows native skill injection

- [x] 7.1 Record the validated Codex turn-level injection point and the Claude Windows native skill mirror point in proposal/design/specs.
- [x] 7.2 Mirror enabled curated skills into the effective Claude native skills directory before Windows Claude sends.
- [x] 7.3 Protect user-owned Claude skill directories from overwrite/delete with a ccgui ownership marker.
- [x] 7.4 Keep macOS/Linux Claude `--append-system-prompt` behavior unchanged.
- [x] 7.5 Add focused regression tests for Windows mirror creation, disabled cleanup, user-owned collision, and non-Windows no-op.
- [x] 7.6 Re-run focused Rust tests, release check, diff check, and strict OpenSpec validation.
- [x] 7.7 Make Claude Windows mirror sync content-aware so unchanged managed skill files are not rewritten on every send.

## 8. Claude Windows curated skill activation

- [x] 8.1 Record Windows CLI findings: native skills are visible but not auto-loaded, stdin stream-json cannot carry system/developer instructions, and `--append-system-prompt-file` is the supported activation channel.
- [x] 8.2 Write a ccgui-managed activation hint file under the effective Claude home when curated skills are enabled.
- [x] 8.3 Pass `--append-system-prompt-file <hint-file-path>` on Windows Claude sends without putting skill bodies in argv.
- [x] 8.4 Remove the managed activation hint when no curated skills are enabled.
- [x] 8.5 Add focused tests for hint file creation/removal and command args.
- [x] 8.6 Re-run focused Rust tests, release check, diff check, and strict OpenSpec validation.

## 8. Settings curated toggle UI convergence

- [x] 8.1 Make `CuratedSection` read `enabledCuratedSkillIds` from the caller-owned `SettingsView` `appSettings` snapshot instead of opening a duplicate `useAppSettings()` state slot.
- [x] 8.2 Route successful `set_curated_skill_enabled` results through `onUpdateAppSettings` so the current Settings UI updates immediately.
- [x] 8.3 Keep failed toggle writes non-optimistic: preserve the previous visible switch state and show the error.
- [x] 8.4 Add focused frontend regression tests for immediate switch convergence and failed-toggle rollback.
- [x] 8.5 Run focused frontend tests, TypeScript typecheck, and targeted ESLint for the touched frontend files.
