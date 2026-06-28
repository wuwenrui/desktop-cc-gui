## 1. Contract And Regression Coverage

- [x] 1.1 Add or update Codex app-server arg construction tests proving primary launch with `lazy-senior-dev` enabled still injects merged internal spec hint plus curated skill body through existing primary behavior. Validation: focused `app_server_cli` Rust test.
- [x] 1.2 Add a wrapper compatibility retry test with `lazy-senior-dev` enabled proving retry argv omits generated `developer_instructions`, `writableRoots`, `## Curated Skills`, and `lazy-senior-dev`. Validation: focused `app_server_cli` Rust test.
- [x] 1.3 Add coverage that wrapper retry writes a ccgui-generated profile under the supplied effective `CODEX_HOME` and that the profile contains `writableRoots`, `## Curated Skills`, and `lazy-senior-dev`. Validation: focused `app_server_cli` Rust test.
- [x] 1.4 Add coverage that wrapper retry preserves valid user-authored `codexArgs` such as `--profile work --sandbox read-only`. Validation: focused `app_server_cli` Rust test.
- [x] 1.5 Add coverage that user-authored `developer_instructions` / `instructions` overrides do not create a competing generated profile. Validation: focused `app_server_cli` Rust test.

## 2. Minimal Implementation

- [x] 2.1 Add a ccgui-generated Codex profile projection helper for launch-time generated `developer_instructions`.
- [x] 2.2 Update wrapper compatibility retry arg construction so generated instructions move from argv to `--profile <generated-profile-name>`.
- [x] 2.3 Pass the effective `CODEX_HOME` into spawn-time arg application, using provider-scoped homes for managed providers and disk/default homes for disk profile.
- [x] 2.4 Keep primary launch and session-hooks-disabled primary behavior unchanged.
- [x] 2.5 Preserve user override behavior: if user `codexArgs` contain `developer_instructions` or `instructions`, do not generate a ccgui profile for that launch.

## 3. Verification

- [x] 3.1 Run `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli --lib`.
- [x] 3.2 Run any existing focused app-server tests impacted by the arg construction helpers.
- [x] 3.3 Run `openspec validate fix-windows-codex-wrapper-curated-instructions --strict --no-interactive`.
