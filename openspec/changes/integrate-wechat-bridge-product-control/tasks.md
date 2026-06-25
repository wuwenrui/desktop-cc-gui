## 1. 规范与计划

- [x] 1.1 [P0][Dep:none][I: 现有 handoff + settings/web_service patterns][O: proposal/design/tasks/spec delta][V: `OPENSPEC_TELEMETRY=0 npm exec --yes --package @fission-ai/openspec -- openspec validate integrate-wechat-bridge-product-control --strict --no-interactive`] 固定产品形态与边界。
- [x] 1.2 [P0][Dep:1.1][I: `wx_bridge` / daemon / WeClaw 实测][O: contract notes in docs][V: 单账号 smoke path 可复述] 固定操作路径。

## 2. Rust 后端控制面

- [x] 2.1 [P0][Dep:1.1][I: Tauri backend command rules][O: `wechat_bridge_control` module + DTO][V: cargo unit tests cover status phase mapping] 新增状态模型。
- [x] 2.2 [P0][Dep:2.1][I: local binaries + app data][O: binary discovery + pid/log paths][V: cargo tests cover found/missing/stale pid] 组件发现与进程痕迹。
- [x] 2.3 [P0][Dep:2.1][I: `~/.weclaw/config.json`][O: config merge helper][V: cargo tests preserve unrelated config and set HTTP agent] WeClaw 配置托管。
- [x] 2.4 [P0][Dep:2.1][I: daemon bootstrap + `wx_bridge`][O: start/stop/status commands][V: cargo tests for idempotent stop and recoverable errors] 生命周期命令。
- [x] 2.5 [P0][Dep:2.4][I: WeClaw process output][O: QR/log parser][V: cargo tests cover URL/data/unknown output] 二维码状态解析。
- [x] 2.6 [P0][Dep:2.2][I: Tauri bundle externalBin + WeClaw release checksum][O: `cc_gui_daemon` + `wx_bridge` + `weclaw` sidecars][V: bundle inspect confirms `LawyerCopilot.app/Contents/MacOS/wx_bridge` and `weclaw`] 发布包内置桥接二进制。
- [x] 2.7 [P0][Dep:2.3][I: WeClaw v0.7.1 source][O: static local identity header + full-body fallback dedup + docs boundary][V: `cargo test --bin wx_bridge request_identity --manifest-path src-tauri/Cargo.toml` + `cargo test wechat_bridge_control::tests::merge_weclaw_agent_config_preserves_unrelated_agents --lib --manifest-path src-tauri/Cargo.toml`] 固定真实 WeClaw HTTP 字段契约。
- [x] 2.8 [P0][Dep:2.4][I: Finder/open app startup][O: bounded PATH sync + startup show/focus][V: `cargo test path_env_sync --lib --manifest-path src-tauri/Cargo.toml` + target `LawyerCopilot.app` CGWindow visible] 打包版可见启动。
- [x] 2.9 [P1][Dep:2.4][I: wx_bridge outbound safety][O: per-wxid reply rate limiter + product startup params][V: `cargo test same_lawyer_messages_inside_reply_window_are_rate_limited --bin wx_bridge --manifest-path src-tauri/Cargo.toml` + `cargo test parses_reply_rate_limit_flags --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] 出站回复限流。
- [x] 2.10 [P0][Dep:4.8][I: 真微信 HTTP timeout][O: daemon sync 100s deadline + timeout error audit][V: `cargo test silent_daemon_sync_times_out_with_friendly_error_and_audit --bin wx_bridge --manifest-path src-tauri/Cargo.toml` + 本地 18012 chat 返回 `OK`] 桥接等待超时受控。
- [x] 2.11 [P1][Dep:4.8][I: 真微信回复文案][O: 微信 prompt 隐藏桌面内部模式][V: `cargo test wechat_daemon_prompt_hides_desktop_internal_modes --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] 律师端回复约束。
- [x] 2.12 [P0][Dep:2.10][I: daemon timeout residue][O: timeout 后主动 `engine_interrupt` 清理挂起 Claude 子进程][V: `cargo test silent_daemon_sync_times_out_with_friendly_error_and_audit --bin wx_bridge --manifest-path src-tauri/Cargo.toml` + `ps` 无残留 `claude -p`] 超时后清理运行残留。
- [x] 2.13 [P0][Dep:4.8][I: 真微信连续消息][O: 首轮稳定 sessionId + 同 wxid 串行续聊][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml wechat` + `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] 避免每条微信消息新建对话和并发卡死。

## 3. 前端产品体验

- [x] 3.1 [P0][Dep:2.*][I: `src/services/tauri.ts`][O: typed service API][V: TypeScript compile] 前端 bridge API。
- [x] 3.2 [P0][Dep:3.1][I: settings runtime tabs][O: `微信连接` tab + `WeChatBridgeSettings`][V: vitest renders stopped/missing/waiting/running/error states] 设置页入口。
- [x] 3.3 [P0][Dep:3.2][I: i18n + CSS][O: copy/style/accessibility][V: vitest button accessible names + no hardcoded visible copy] 文案和交互抛光。
- [x] 3.4 [P0][Dep:3.2][I: missing WeClaw status][O: install-guide recovery action][V: vitest verifies missing state opens official install guide] 缺组件恢复入口。
- [x] 3.5 [P0][Dep:3.2][I: in-app diagnostics command][O: `连接自检` action + per-check results][V: vitest renders diagnostics and cargo test covers bridge-probe failure] 应用内自检入口。
- [x] 3.6 [P0][Dep:3.2][I: app menu + menu event bus][O: App menu `微信连接…` opens runtime WeChat tab][V: `npx vitest run src/services/events.test.ts src/features/app/hooks/useAppMenuEvents.test.tsx` + `cargo test menu::tests --lib --manifest-path src-tauri/Cargo.toml`] 产品级直达入口。
- [x] 3.7 [P0][Dep:3.6][I: app menu + `startWechatBridge`][O: App menu `启动微信连接…` opens panel and starts active workspace bridge][V: `npx vitest run src/services/events.test.ts src/features/app/hooks/useAppMenuEvents.test.tsx src/features/app/utils/wechatBridgeMenuActions.test.ts`] 产品级直接启动入口。
- [x] 3.8 [P1][Dep:3.7][I: `WeChatBridgeSettings`][O: waiting-scan/starting status auto-refresh][V: `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx`] 扫码等待态自动刷新。
- [x] 3.9 [P1][Dep:3.8][I: 真机验收路径][O: 面板内测试消息与复制入口][V: `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx`] 真微信验收引导产品化。
- [x] 3.10 [P1][Dep:3.8][I: WeClaw login URL][O: app 内可扫二维码渲染][V: `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx`] 扫码区产品化。
- [x] 3.11 [P1][Dep:3.5][I: wx_bridge audit.log][O: 面板内最近微信消息证据卡][V: `cargo test parse_latest_activity_uses_last_audit_line_without_body --lib --manifest-path src-tauri/Cargo.toml` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx`] 真机入站证据产品化。
- [x] 3.12 [P1][Dep:3.9][I: WeClaw v0.7.1 media boundary + privacy risk][O: 面板内使用边界提示][V: `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "shows product boundaries"`] 真微信验收边界产品化。
- [x] 3.13 [P1][Dep:3.11][I: local smoke audit entries][O: 最近微信消息过滤 `local-*-smoke` 自检记录][V: `cargo test parse_latest_activity_skips_local_smoke_entries --lib --manifest-path src-tauri/Cargo.toml`] 真机证据防污染。
- [x] 3.14 [P1][Dep:3.13][I: smoke-only audit state][O: 面板区分“本地自检已通过”和“真微信已回复”][V: `cargo test parse_activity_snapshot_reports_smoke_only_logs --lib --manifest-path src-tauri/Cargo.toml` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "local self-check"`] 自检空态产品化。
- [x] 3.15 [P1][Dep:3.14][I: 真微信验收状态][O: 面板内 `真微信验收` verdict][V: `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "explicit real WeChat verification"`] 真微信验收结论产品化。
- [x] 3.16 [P1][Dep:3.15][I: WeClaw media logs][O: 面板内 `最近媒体` 状态 + CLI `app-real-wechat-media`][V: `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests::parse_media_activity_reports_saved_failed_and_legacy_skipped_images --lib` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "latest real WeChat media"` + `node --test scripts/check-wechat-bridge-app-state.test.mjs`] 真微信图片到达证据产品化。
- [x] 3.17 [P1][Dep:3.16][I: WeClaw quote logs][O: 面板内 `最近引用` 状态 + CLI `app-real-wechat-quote`][V: `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests::parse_quote_activity --lib` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "quoted WeChat"` + `node --test scripts/check-wechat-bridge-app-state.test.mjs`] 真微信引用消息到达证据产品化。

- [x] 3.18 [P1][Dep:3.15][I: polling fresh but no real handler activity][O: 面板内 `重新绑定微信` 恢复入口，清理 WeClaw 登录态后重新出二维码][V: `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests::clear_weclaw_account_state_removes_credentials_and_sync_without_touching_config --lib` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "rebind WeChat"`] 账号不匹配/扫错后的恢复闭环。
- [x] 3.19 [P1][Dep:3.18][I: bound WeClaw account credentials][O: 面板内 `发送验证到微信` 入口，主动推送验收消息到当前绑定聊天][V: `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests --lib` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "verification message"` + `npx vitest run src/services/tauri.test.ts -t "WeChat verification prompts"`] 真实绑定聊天确认闭环。
- [x] 3.20 [P1][Dep:3.19][I: bound WeClaw account credentials + app state checker][O: 面板和 CLI 区分已绑定态与等待扫码态，且不输出微信账号标识][V: `node --test scripts/check-wechat-bridge-app-state.test.mjs` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx -t "bound-account"` + `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests::diagnostics_reports_bound_wechat_without_exposing_identifier --lib`] 已绑定但无二维码时不误导用户重新扫码。
- [x] 3.21 [P1][Dep:3.17][I: 真微信引用 UI 未被 WeClaw 顶层字段解析][O: WeClaw 递归引用解析 + 安全消息结构诊断，CLI 和面板只展示字段名不展示正文][V: `go test ./messaging -run 'TestExtractQuotedMessageFromNestedPayload|TestSummarizeQuoteCandidateShapeOmitsRawContent|TestSummarizeInterestingMessageShapeOmitsRawContent' -count=1` + `go test ./...` + `node --test scripts/check-wechat-bridge-app-state.test.mjs` + `npx vitest run src/features/settings/components/settings-view/sections/WeChatBridgeSettings.test.tsx` + `cargo test --manifest-path src-tauri/Cargo.toml wechat_bridge_control::tests::parse_quote_activity --lib`] 引用消息解析缺口可诊断。

## 4. 验证

- [x] 4.1 [P0][Dep:2.*][V: `cd src-tauri && cargo test wechat_bridge_control --lib`] Rust focused tests。
- [x] 4.2 [P0][Dep:3.*][V: `npx vitest run src/features/settings/components/...`] React focused tests。
- [x] 4.3 [P0][Dep:4.1,4.2][V: `npm run typecheck`] 类型检查。
- [x] 4.4 [P0][Dep:2.6][V: `node --test scripts/prepare-tauri-sidecars.test.mjs scripts/build-platform.test.mjs` + `TAURI_ENV_TARGET_TRIPLE=aarch64-apple-darwin node scripts/prepare-tauri-sidecars.mjs` + `npm run tauri -- build --bundles app --no-sign`] 发布打包验证。
- [x] 4.5 [P0][Dep:4.1][V: `node scripts/smoke-wechat-bridge.mjs`] 进程级 smoke：daemon + `wx_bridge` health/chat + WeClaw 扫码输出。
- [x] 4.6 [P0][Dep:4.5][V: `node scripts/smoke-wechat-bridge-real-claude.mjs --workspace-id cad1df73-fc81-4fb7-8e58-df10fb913a3a`] 真实桌面数据目录 + Claude 短回复 smoke。
- [x] 4.7 [P0][Dep:4.5][V: app 内菜单「启动微信连接…」后 `node scripts/check-wechat-bridge-app-state.mjs` 输出 health ok + bridge/weclaw running + scan ready 或 bound] app 内本机 smoke。
- [x] 4.9 [P1][Dep:2.9][V: `cargo test --bin wx_bridge --manifest-path src-tauri/Cargo.toml`] 桥接限流回归。
- [x] 4.8 [P0][Dep:4.7][V: 用户扫码小号后发文字、图片、引用消息，再跑 `node scripts/check-wechat-bridge-app-state.mjs --require-real-activity --require-real-media --require-real-quote` 输出 `app-real-wechat-reply: replied`、`app-real-wechat-media: saved`、`app-real-wechat-quote: parsed`] 真微信验收；2026-06-24 复验通过：文字 replied、图片 saved、引用 parsed。
