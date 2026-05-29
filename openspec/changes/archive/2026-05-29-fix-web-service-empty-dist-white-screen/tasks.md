## 1. Asset Root Validation

- [x] 1.1 Require candidate `index.html` to include a React root and module/asset entry before accepting it.
- [x] 1.2 Continue probing later candidates when an earlier directory contains an invalid shell index.

## 2. Regression Tests

- [x] 2.1 Add a test proving empty shell index files are rejected.
- [x] 2.2 Add a test proving valid later dist candidates are selected.
- [x] 2.3 Run focused web service runtime tests.

## 3. Validation

- [x] 3.1 Run `cargo test --manifest-path src-tauri/Cargo.toml web_assets_root`.
- [x] 3.2 Run `cargo test --manifest-path src-tauri/Cargo.toml web_service_runtime`.
- [x] 3.3 Run `openspec validate fix-web-service-empty-dist-white-screen --strict --no-interactive`.
