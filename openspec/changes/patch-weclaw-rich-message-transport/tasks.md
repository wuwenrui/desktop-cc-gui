## 1. Spec

- [x] 1.1 [P0][V: `openspec validate patch-weclaw-rich-message-transport --strict --no-interactive`] Define rich message transport.

## 2. Patched WeClaw

- [x] 2.1 [P0][V: `go test ./agent -run Rich`] Add HTTPAgent rich content request/response tests and implementation.
- [x] 2.2 [P0][V: `go test ./messaging -run Rich`] Add handler rich image/file/quote payload tests and implementation.
- [x] 2.3 [P1][V: `go test ./messaging -run TestExtractQuotedMessageFromCamelCaseRawItem -count=1`] Parse common camelCase quote fields and preserve quoted file names.
- [x] 2.4 [P0][V: `go test ./...`] Full patched WeClaw Go tests.

## 3. Sidecar Build

- [x] 3.1 [P0][V: `node --test scripts/prepare-tauri-sidecars.test.mjs`] Build patched WeClaw from `sidecars/weclaw`.
- [x] 3.2 [P0][V: `TAURI_ENV_TARGET_TRIPLE=aarch64-apple-darwin node scripts/prepare-tauri-sidecars.mjs`] Produce local patched WeClaw sidecar.

## 4. Bridge / App Verification

- [x] 4.1 [P0][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] Preserve bridge rich payload contract.
- [x] 4.2 [P0][V: `node scripts/check-wechat-bridge-app-state.mjs`] App bridge still healthy after replacing sidecar.
- [x] 4.4 [P1][V: `node --test scripts/check-wechat-bridge-app-state.test.mjs` + `node scripts/check-wechat-bridge-app-state.mjs --require-real-media`] Add a strict final verifier that fails until real WeChat media is saved.
- [x] 4.5 [P1][V: `node --test scripts/check-wechat-bridge-app-state.test.mjs` + `go test ./messaging -run TestHandleMessageSendsImageAndQuoteToRichDefaultAgent -count=1`] Add a strict final verifier that fails until real WeChat quote context is parsed.
- [x] 4.3 [P1][V: manual WeChat send image + quoted message + `node scripts/check-wechat-bridge-app-state.mjs --require-real-activity --require-real-media --require-real-quote`] Real WeChat media and quote smoke.
