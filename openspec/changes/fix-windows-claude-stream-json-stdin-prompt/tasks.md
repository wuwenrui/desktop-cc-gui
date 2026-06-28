## 1. Claude CLI Invocation Contract

- [x] 1.1 [P0][Input: `ClaudeSession::build_command` stream-json branch][Output: no empty positional prompt after `-p`][Validation: focused Rust command-args test] Remove the empty prompt placeholder from Claude stream-json stdin command construction.
- [x] 1.2 [P0][Depends: 1.1][Input: single-line, multiline, and special-character Claude prompts][Output: prompt content remains outside argv][Validation: existing and updated `tests_stream` assertions] Preserve stdin prompt safety for all prompt shapes.

## 2. Regression Coverage

- [x] 2.1 [P0][Depends: 1.1][Input: stream-json command args][Output: test fails if `-p` is followed by an empty placeholder before `--input-format`][Validation: `cargo test --manifest-path src-tauri/Cargo.toml build_command_uses_stream_json_for_single_line_text`] Add explicit no-placeholder argv regression coverage.
- [x] 2.2 [P1][Depends: 1.1][Input: resume command args][Output: resume path uses same no-placeholder stream-json contract][Validation: focused resume command test] Extend resume command coverage.

## 3. Verification

- [x] 3.1 [P0][Depends: 1,2][Input: OpenSpec artifacts][Output: strict change validation passes][Validation: `openspec validate fix-windows-claude-stream-json-stdin-prompt --strict --no-interactive`] Validate the OpenSpec change.
- [x] 3.2 [P0][Depends: 1,2][Input: touched Rust tests][Output: focused backend tests pass][Validation: focused `cargo test` commands] Run focused Rust verification for Claude stream command behavior.
