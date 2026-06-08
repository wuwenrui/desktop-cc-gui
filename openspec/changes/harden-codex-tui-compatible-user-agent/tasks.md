## 1. Implementation

- [x] Limit the compatibility change to the Codex app-server conversation path.
- [x] Set terminal host environment hints for the Codex app-server child process.
- [x] Preserve existing `TERM_PROGRAM` / `TERM_PROGRAM_VERSION` values when available.
- [x] Fall back to `Apple_Terminal/470.2` when terminal host values are unavailable.
- [x] Change Codex app-server `initialize.clientInfo.name/title` to `codex-tui`.
- [x] Resolve `initialize.clientInfo.version` from Codex CLI version output.
- [x] Fall back to `0.137.0` when Codex CLI version parsing fails.
- [x] Keep internal GUI control-plane filtering compatible with legacy `ccgui`.
- [x] Add `codex-tui` as an accepted GUI control-plane identity.

## 2. Tests

- [x] Add focused test coverage for Codex CLI version parsing.
- [x] Add focused test coverage for `codex-tui + experimentalApi` control-plane classification.
- [x] Run `cargo test --manifest-path src-tauri/Cargo.toml parse_codex_cli_version_accepts_common_outputs`.
- [x] Run `cargo test --manifest-path src-tauri/Cargo.toml codex_tui_client_info_with_experimental_api_is_control_plane`.

## 3. Deferred / Not Done

- [ ] Verify relay-side request logs after launching the updated client against the target relay.
- [ ] Run broader Rust regression for `backend::app_server` and `engine::claude_history` if closure requires wider confidence.
- [ ] Sync into mainline OpenSpec specs only after runtime relay evidence is confirmed.
