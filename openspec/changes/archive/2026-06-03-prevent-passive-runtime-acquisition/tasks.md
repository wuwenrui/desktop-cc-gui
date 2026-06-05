## 1. Frontend Passive Refresh Boundary

- [x] 1.1 P0 输入：background/idle thread-list hydration callers；输出：这些 callers 调用 `listThreadsForWorkspace` 时显式禁用 runtime reconnect；验证：focused unit/contract test 或 symbol review 能证明 passive source 使用 `allowRuntimeReconnect: false`。
- [x] 1.2 P0 输入：workspace focus refresh callers；输出：非 active/background workspace focus refresh 不触发 runtime reconnect；验证：focused unit/contract test 或 source contract review。
- [x] 1.3 P1 输入：workspace restore callers；输出：passive restore 不批量拉起 runtime，active explicit restore 保留 live reconnect 能力；验证：focused review active/background 分支。

## 2. Backend Helper Read Boundary

- [x] 2.1 P0 输入：daemon `model_list` helper read；输出：无 existing Codex runtime/session 时不调用 `ensure_codex_session_for_workspace`；验证：backend focused test 或 contract review。
- [x] 2.2 P0 输入：daemon `account_rate_limits` helper read；输出：无 existing Codex runtime/session 时不调用 `ensure_codex_session_for_workspace`；验证：backend focused test 或 contract review。
- [x] 2.3 P1 输入：helper read fallback path；输出：返回 cached/static/degraded/empty fallback 且错误信息可诊断；验证：manual code path review。

## 3. Runtime-Required Actions Preservation

- [x] 3.1 P0 输入：send/resume/manual reconnect/fork paths；输出：这些 explicit action 仍可 acquire runtime；验证：source contract review 不改 runtime-required callers。
- [x] 3.2 P1 输入：automatic recovery source names；输出：passive source 不伪装成 user-driven runtime action；验证：source contract review。

## 4. Regression Coverage / Closeout

- [x] 4.1 P1 输入：frontend passive no-reconnect behavior；输出：focused regression test or documented validation gap。
- [x] 4.2 P1 输入：backend helper no-spawn behavior；输出：focused regression test or documented validation gap。
- [x] 4.3 P1 输入：OpenSpec change artifacts；输出：tasks reflect completed implementation status；验证：`openspec status --change prevent-passive-runtime-acquisition` optional.

## Validation Notes

- 已运行 `openspec validate --all --strict --no-interactive`：通过，311 items passed。
- 已运行 `npm run typecheck`：第一轮发现 passive caller option type 缺少 `allowRuntimeReconnect`；补齐类型后第二轮通过。
- 已运行 `cargo check --manifest-path src-tauri/Cargo.toml`：通过。
- 未运行 `npm run test` 或 `cargo test`；本轮验证范围控制在 OpenSpec strict、TS typecheck、Rust compile check。
- Frontend 验证方式记录为 source contract review：passive hydration / focus / restore caller 显式 no-runtime-reconnect。
- Backend 验证方式记录为 source contract review：daemon 与 direct Tauri helper reads 在 `workspace not connected` 时返回 degraded fallback，不再先调用 runtime acquire。
