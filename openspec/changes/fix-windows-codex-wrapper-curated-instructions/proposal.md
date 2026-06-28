## Why

Windows Codex session creation can fail with `Codex app-server did not respond to initialize` while macOS remains healthy. User verification shows that temporarily disabling the default `lazy-senior-dev` curated skill makes Windows Codex session creation succeed, which points to the Windows `.cmd/.bat` wrapper path choking on large generated `developer_instructions` argv content rather than a missing Codex install.

The final goal is stricter than "session can start": Windows fallback sessions must still receive enabled built-in skills.

## Goals And Boundaries

- Preserve healthy primary launch behavior on macOS, Linux, Windows direct executables, and Windows wrapper launches that initialize successfully.
- Keep curated skills enabled by default for normal Codex launches.
- Keep Windows wrapper compatibility retry from passing large generated `developer_instructions` through argv.
- Preserve generated internal instructions and enabled curated skill bodies for fallback sessions by projecting them into a ccgui-generated Codex profile file under the effective `CODEX_HOME`.
- Strictly separate disk and managed provider environments: generated profiles must be written only into the runtime's selected `CODEX_HOME`.
- Keep diagnostics explicit when both primary and fallback fail.

## Non-Goals

- Do not remove or disable `lazy-senior-dev` globally.
- Do not change Claude curated skill injection.
- Do not add a new Codex transport, shell, dependency, or frontend recovery flow.
- Do not write or mutate the user's base `config.toml`.
- Do not treat user-provided `developer_instructions` as disposable; explicit user `codexArgs` remain user-owned.

## What Changes

- Update Codex app-server launch planning so wrapper compatibility retry stores ccgui-generated `developer_instructions` in a generated Codex profile file instead of argv.
- Keep primary Codex launch behavior unchanged: internal spec hint and curated skill bodies continue to merge into one `developer_instructions` config argument when no user override exists.
- Add backend tests proving wrapper retry:
  - keeps skill content out of argv;
  - writes a generated profile containing enabled curated skill bodies;
  - preserves user args;
  - uses the effective `CODEX_HOME` rather than a global hard-coded path.
- Extend OpenSpec contracts for `codex-app-server-wrapper-launch` and `curated-skill-bundles`.

## Technical Options

| Option | Summary | Decision |
| --- | --- | --- |
| Disable `lazy-senior-dev` on Windows | Avoid the broken argument by platform-disabling the default curated skill. | Rejected: fixes startup but fails the product goal; enabled built-in skills would not work on Windows fallback sessions. |
| Suppress generated instructions on fallback | Launch retry with no generated `developer_instructions`. | Rejected: starts the session but loses enabled curated skills for that runtime. |
| Use a generated Codex profile for wrapper fallback | Write generated `developer_instructions` into `$CODEX_HOME/<profile>.config.toml` and pass short `--profile <profile>` argv. | Chosen: avoids fragile Windows argv while preserving enabled skills and environment isolation. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-app-server-wrapper-launch`: compatibility retry must avoid large generated instruction argv but preserve generated instructions via an effective-`CODEX_HOME` profile file.
- `curated-skill-bundles`: Codex curated-skill injection remains required for normal launches and must remain effective in Windows wrapper fallback via generated profile projection.

## Impact

- Rust backend launch arg construction in `src-tauri/src/backend/app_server_cli.rs`.
- Rust backend spawn setup in `src-tauri/src/backend/app_server.rs` so the effective `CODEX_HOME` can be used for generated profile writes.
- Focused backend tests around Codex app-server args, generated profile content, and wrapper retry planning.
- OpenSpec contracts for Codex wrapper launch and curated skill injection.
- No new dependencies, storage migrations, or frontend API changes.

## Acceptance Criteria

- With `lazy-senior-dev` enabled, Windows `.cmd/.bat` wrapper compatibility retry does not place `lazy-senior-dev` or large generated `developer_instructions` text in argv.
- The same fallback writes a ccgui-owned profile file under the selected runtime `CODEX_HOME` containing merged generated `developer_instructions`, including `lazy-senior-dev`.
- Fallback argv includes `--profile <ccgui-generated-profile>` before `app-server`.
- Disk and managed provider runtimes write generated profiles to their own effective `CODEX_HOME`; no global hard-coded path is used.
- Primary launch args still include merged internal spec hint and curated skill bodies through existing argv behavior when curated skills are enabled and the user has not supplied an instructions override.
- User-provided `developer_instructions` / `instructions` overrides are not duplicated or overwritten.
- Focused Rust tests and `openspec validate fix-windows-codex-wrapper-curated-instructions --strict --no-interactive` pass.
