## 1. Spec

- [x] 1.1 [P0][V: `openspec validate expand-wechat-bridge-remote-control --strict --no-interactive`] Define remote-control capability, permission tiers, direct execution, commands, media boundary.

## 2. wx_bridge core

- [x] 2.1 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml remote_control`] Add permission tier classifier and access-mode resolver.
- [x] 2.2 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml remote_control`] Directly map permission tiers to `read-only` / `default` / `full-access`.
- [x] 2.3 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml command`] Add `帮助` / `新开会话` / `会话压缩` / `取消` command parser.
- [x] 2.4 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml pipeline`] Route commands and tiered direct actions through pipeline.
- [x] 2.5 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml command`] Call daemon `thread_compact` for current Claude session.
- [x] 2.6 [P1][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml media`] Preserve outgoing image refs in chat completion payload for patched WeClaw.
- [x] 2.7 [P1][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml` + `go test ./...`] Preserve outgoing file refs and let WeClaw relay local/remote attachments.

## 3. Validation

- [x] 3.1 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] Full wx_bridge Rust tests.
- [x] 3.2 [P0][V: `OPENSPEC_TELEMETRY=0 npm exec --yes --package @fission-ai/openspec -- openspec validate expand-wechat-bridge-remote-control --strict --no-interactive`] OpenSpec strict validation.
- [x] 3.3 [P1][V: `node scripts/check-wechat-bridge-app-state.mjs`] App bridge health smoke after rebuilding sidecar.
