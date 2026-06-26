# Tasks: 2026-06-24-infer-thread-rename-from-claude-codex-jsonl

## 1. Rust: Claude rename alias 提取

- [ ] **1.1** 在 `claude_history.rs` 新增 `fn extract_claude_rename_alias_from_message(message: &Value) -> Option<String>`，识别 `<command-name>/rename</command-name>` 后的 `<command-args>...</command-args>` 内容并 trim。content 是 string 或 array of text blocks 形态都要覆盖。（验证：cargo build 编译通过；本地 unit test 至少 2 条：命中 + 不存在）
- [ ] **1.2** 在 `ClaudeSessionSourceFact` / `ClaudeSessionSummary` 上加 `cli_rename_alias: Option<String>`（serde skip_if_none），不影响现有序列化。
- [ ] **1.3** `scan_session_source_file` 在现有逐行循环中维护 `latest_rename_alias`，命中即覆盖，循环结束写入 fact。`to_summary` 透传。
- [ ] **1.4** `scan_subagent_session_file` / `scan_subagent_source_file` 保持现状（不被 alias 覆盖 description），写测试断言。
- [ ] **1.5** `claude_history_inline_tests.rs` / 新增 `claude_history_rename_alias_tests.rs`：覆盖命中、不存在、最后一条胜出、args 为空、出现在 `isMeta` 内部记录时不计入、content array 形态。
- [ ] **1.6** `cargo test --manifest-path src-tauri/Cargo.toml` 全绿。

## 2. Rust: Codex rename alias 提取

- [ ] **2.1** 在 `local_usage.rs` 新增 `fn extract_codex_rename_alias_from_payload(payload: &Value) -> Option<String>`，覆盖 `role=user` 的 `input_text` 两种形态（`/rename foo` 与 `<command-name>/rename</command-name>...<command-args>foo</command-args>`）。
- [ ] **2.2** `LocalUsageSessionSummary` 加 `cli_rename_alias: Option<String>`（serde skip_if_none）。
- [ ] **2.3** `parse_codex_session_summary` 维护 `latest_rename_alias` 并写入 summary。Codex 无显式 mtime cache 层，alias 跟随单次解析，不引入额外 IO。
- [ ] **2.4** 新增 `local_usage_codex_rename_alias_tests.rs`（与现有 `local_usage_inline_tests.rs` 风格一致），覆盖命中、不存在、最后一条胜出、args 为空。
- [ ] **2.5** `cargo test --manifest-path src-tauri/Cargo.toml` 全绿。

## 3. Catalog 透传（与 `title` 平行的独立字段）

- [ ] **3.1** `WorkspaceSessionCatalogEntry` 加 `cli_rename_alias: Option<String>`（serde skip_if_none），保证向后兼容。该字段**不**替换 `title`、不参与 catalog 内部 precedence。
- [ ] **3.2** `session_management.rs` 的 Claude / Codex 分支把 alias 字段填上；Gemini / OpenCode 显式 `None`。
- [ ] **3.3** 现有 `session_management_*_tests.rs` 跑通；不破坏 dedupe / 投影 / title 口径。
- [ ] **3.4** 写一条 catalog unit test：catalog entry 的 `title` 与 `cli_rename_alias` 是两个独立字段，alias 不替换 title。

## 4. Frontend precedence 调整

- [ ] **4.1** `useThreadActions.ts` 在 Claude（`:794`）、Codex（`:671`）两个合并点按 `customName || mappedTitle || cliRenameAlias || preview` 顺序取 title。
- [ ] **4.2** OpenCode 路径（`:884`）**不引入 alias**，保持现状 `mappedTitles[id] || getCustomName(...) || preview`。统一 OpenCode precedence 属于另一个 follow-up。
- [ ] **4.3** `ThreadSummary` 类型本身**不**新增字段（rename alias 不进 store）。仅在合并时消费 catalog payload 的 `cliRenameAlias` 字段。
- [ ] **4.4** Vitest：`useThreadActions.*.test.tsx` 增补用例覆盖 alias 优先级（alias 单独 / alias < customName / alias < mappedTitle / alias < autoName via mappedTitle / OpenCode 不消费 alias）。
- [ ] **4.5** `npm run typecheck` 与 `npm run test -- src/features/threads` 全绿。

## 5. Spec delta 与 sync

- [ ] **5.1** `openspec/changes/2026-06-24-infer-thread-rename-from-claude-codex-jsonl/specs/claude-session-sidebar-state-parity/spec.md`：新增 "Requirement: Claude Sidebar Title SHALL Reuse JSONL `/rename` Alias When No Stronger Source Exists"，含至少五个 Scenario（命中、GUI rename 覆盖、autoName 覆盖、最后一条胜出、legacy 无 rename、isMeta 不计入）。
- [ ] **5.2** `openspec/changes/2026-06-24-infer-thread-rename-from-claude-codex-jsonl/specs/codex-session-sidebar-state-parity/spec.md` 同上，对齐 Codex 形态。
- [ ] **5.3** `openspec validate --all --strict --no-interactive` 通过。
- [ ] **5.4** archive 前 sync 到 `openspec/specs/...`，保持 main spec 与代码同步。

## 6. Verify & Archive

- [ ] **6.1** `npm run typecheck`
- [ ] **6.2** `npm run test`
- [ ] **6.3** `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] **6.4** `npm run check:runtime-contracts` / `npm run check:branding`（视 spec gate 要求）
- [ ] **6.5** 跑一次本地 sidebar smoke：构造 mock jsonl / rollout，验证 alias 显示、autoName 覆盖、OpenCode 不消费。
- [ ] **6.6** `python3 .claude/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full`
- [ ] **6.7** archive 流程按 openspec 1.3.x 标准走。
