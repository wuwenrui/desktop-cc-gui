## Why

Windows Claude Code conversations can store and display the raw stream-json stdin payload as the first user message, then fail with `Claude stream-json ended without a valid stream event`. The failure is platform-visible because Windows `.cmd/.bat` wrappers amplify an already fragile CLI invocation: `claude -p "" --input-format stream-json`.

## 目标与边界

- 修复 Claude Code runtime 在 stream-json stdin 模式下的 CLI argument contract，避免 Windows wrapper 将 stdin protocol payload 当成普通 prompt text。
- 保持 Mac 当前正常路径不回退；Linux/direct wrapper 路径也应继续使用 stdin protocol。
- 保持用户 prompt、图片、session resume/fork、permission mode、model、effort、hook event flags 的既有行为。

## 非目标

- 不重写 Claude history JSONL 或清理已经污染的历史会话。
- 不修改 frontend conversation render pipeline。
- 不改变 Codex app-server runtime contract。
- 不引入新的 Claude CLI dependency 或版本探测。

## What Changes

- Claude stream-json stdin 模式下不再向 `claude -p` 追加空 positional prompt。
- Claude stream-json stdin 回归测试扩展为同时断言 prompt text 和空 prompt placeholder 都不进入 argv。
- AskUserQuestion / approval resume 复用同一 command builder，因此自然获得相同修复。

## 技术方案对比

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 删除 stream-json stdin 模式下的空 positional prompt | 遵循 Claude CLI `--input-format stream-json` 示例，只通过 stdin 提供 user message payload | 推荐。最小改动，修复 Windows wrapper，同时降低 Linux/Mac 潜在漂移 |
| B. 仅对 Windows `.cmd/.bat` 删除空 prompt | 保留 Mac 当前参数形态，只处理 Windows wrapper | 不推荐。继续保留非规范 CLI contract，未来 Claude CLI 收紧时 Mac/Linux 仍可能复现 |
| C. Windows 回退 argv prompt | 避开 stdin protocol，用 argv 发送 prompt | 不采用。会重新暴露 shell metacharacter / multiline / image input 风险，违背既有 spec |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-code-realtime-stream-visibility`: tighten Claude stream-json stdin prompt invocation contract so stdin mode must not include an empty positional prompt placeholder.

## Impact

- Backend: `src-tauri/src/engine/claude.rs`
- Backend tests: `src-tauri/src/engine/claude/tests_stream.rs`
- OpenSpec delta: `openspec/changes/fix-windows-claude-stream-json-stdin-prompt/specs/claude-code-realtime-stream-visibility/spec.md`
- No frontend API or Tauri command payload shape changes.

## 验收标准

- Claude stream-json stdin command args include `--input-format stream-json`.
- Claude stream-json stdin command args do not include the user prompt text as positional argv.
- Claude stream-json stdin command args do not include an empty positional prompt placeholder immediately after `-p`.
- Focused Rust tests for Claude command construction pass.
