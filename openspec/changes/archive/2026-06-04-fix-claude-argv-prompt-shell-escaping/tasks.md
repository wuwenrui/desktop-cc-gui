## 1. OpenSpec Contract

- [x] 1.1 [P0][depends:none][I: issue #653 clues, current Claude runtime launch code][O: proposal/design/spec delta for prompt stdin contract][V: `openspec validate fix-claude-argv-prompt-shell-escaping --strict --no-interactive`] Record the behavior change and compatibility boundary before implementation.

## 2. Claude Runtime Implementation

- [x] 2.1 [P0][depends:1.1][I:`src-tauri/src/engine/claude.rs`][O: Claude message sends default to stream-json stdin][V: focused Rust command construction tests] Change Claude prompt input selection so single-line text no longer uses argv.
- [x] 2.2 [P0][depends:2.1][I:`src-tauri/src/engine/claude.rs`][O: access mode/session/model/custom flag mappings preserved][V: existing and updated Rust tests] Keep runtime control flags unchanged while moving prompt content to stdin.

## 3. Regression Coverage

- [x] 3.1 [P0][depends:2.1][I:`src-tauri/src/engine/claude/tests_stream.rs`][O: updated single-line/multiline command tests][V: tests assert `--input-format stream-json` and prompt absent from argv] Update existing tests for the new default stdin contract.
- [x] 3.2 [P0][depends:2.1][I:`src-tauri/src/engine/claude/tests_stream.rs`][O: special-character regression test][V: test uses shell metacharacters and asserts no prompt argv leakage] Add coverage for special-character prompt safety.

## 4. Validation

- [x] 4.1 [P0][depends:3.2][I: touched Rust backend tests][O: focused test result][V: `cargo test --manifest-path src-tauri/Cargo.toml claude`] Run focused Claude Rust tests.
- [x] 4.2 [P0][depends:4.1][I: OpenSpec change artifacts][O: strict validation result][V: `openspec validate fix-claude-argv-prompt-shell-escaping --strict --no-interactive`] Validate OpenSpec change strict mode.
