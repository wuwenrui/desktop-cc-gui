## Why

Windows Claude Code can leave a raw stream-json stdin payload in Claude history after a failed wrapper invocation. Existing Claude history filters remove JSON-RPC/Codex control-plane pollution, but they do not recognize this Claude-specific protocol payload, so the sidebar title and restored user bubble can show `{"message":...}` instead of the real prompt.

## 目标与边界

- Treat leaked Claude stream-json stdin payloads as control-plane pollution during backend history scan/load and frontend loader fallback.
- Keep real user messages that merely paste or discuss JSON unless they match the high-confidence Claude stdin protocol shape.
- Keep this change scoped to already-persisted Claude history cleanup; source transport fixes live in `fix-codex-app-server-curated-skill-transport`.

## 非目标

- 不改写用户本地 JSONL 文件，不做历史数据迁移。
- 不修改 Claude CLI launch contract；`-p --input-format stream-json` 的发送路径保持不变。
- 不重写 conversation renderer 或 sidebar list projection。
- 不处理 Windows packaging warnings。

## What Changes

- Extend Claude history contamination detection to hide raw JSON text that decodes to the Claude stream-json stdin user-message envelope.
- Quarantine assistant-side echo rows after a leaked payload until the next real user row.
- Add backend and frontend regression tests so polluted rows cannot become `firstMessage`, sidebar title, or visible user messages.

## 技术方案对比

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 在 backend/frontend history ingestion 识别 stream-json stdin envelope | 在既有 control-plane sanitizer 中补一个高置信 JSON predicate | 推荐。修复污染展示和标题事实，兼容旧历史与 frontend fallback |
| B. 只在 UI 标题处隐藏 `{"message"` 前缀 | 只修 sidebar/tab name，不修 transcript restore | 不采用。会继续在会话正文显示协议 payload |
| C. 启动时清理/重写 Claude JSONL | 物理删除污染行 | 不采用。破坏用户本地历史，风险高且不可逆 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-history-transcript-visibility`: Claude history control-plane filtering must include leaked stream-json stdin payload text.

## Impact

- Backend: `src-tauri/src/engine/claude_history_entries.rs`
- Backend tests: `src-tauri/src/engine/claude_history_inline_tests.rs` / `src-tauri/src/engine/claude_history_filter_tests.rs`
- Frontend: `src/features/threads/loaders/claudeHistoryLoader.ts`
- Frontend tests: `src/features/threads/loaders/claudeHistoryLoader.test.ts`

## 验收标准

- Raw text shaped like `{"message":{"role":"user","content":[{"type":"text","text":"你好"}]},"type":"user"}` is hidden from Claude history summaries and restored messages.
- Mixed transcripts still show the first real user message after polluted rows.
- Polluted assistant echo rows after leaked stream-json stdin payloads are hidden until the next real user row.
- Normal user text discussing JSON, `app-server`, or `codex app-server` remains visible unless it matches the exact protocol envelope.
