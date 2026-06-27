# Proposal: 客户端下线 OpenCode / Gemini CLI 引擎 (retire-opencode-and-gemini-cli)

## R3 当前裁定 (2026-06-25 proposal check)

本段是当前执行口径,优先级高于下方 R1/R2 的旧审计段:

- `src-tauri/src/vendors/commands.rs` **保留文件**,只删除 `vendor_*_gemini_*`
  3 个 IPC handler 与 gemini-only helper/schema; Claude/Codex provider 管理代码
  不能动。
- `SendMessageParams.agent` / `SendMessageParams.variant` **保留字段**,标记
  deprecated + ignored since v0.5.14; 可以删除 OpenCode/Gemini 调用点和 Tauri
  command 外层参数,但共享 struct 字段不能作为本轮必删项。
- `EngineType` / `SessionKind` 采用手写 `Deserialize` 兼容 legacy string;
  不允许同时 `derive(Deserialize)` 与手写 `impl Deserialize`。
- daemon 的 unknown-engine fallback 必须发生在 raw string → engine 解析边界;
  一旦已经反序列化为 `EngineType::Codex`,bridge 层不能再要求记录原始未知字符串。

## R4 增量记录 (2026-06-27 provider settings UI slice)

本段记录 `remove Gemini CLI provider settings UI` 这次独立提交的实际边界:

- 本次只删除 **前端供应商管理页** 中的 Gemini CLI provider configuration UI:
  `VendorSettingsPanel` 不再展示 `Gemini CLI` tab,不再 mount
  `GeminiVendorPanel`,并删除 `vendor-gemini-*` dead CSS。
- 本次保留 Gemini runtime/session/history 兼容代码,包括
  `useGeminiVendorManagement`, `services/tauri/vendors.ts` 中的 Gemini vendor
  bridge,以及 Rust backend 的 `vendor_*_gemini_*` command。原因是本次需求明确
  "其他不动,耦合性代码可以兼容保留",且完整 engine retirement 仍由本 change
  后续 stages 承接。
- `VendorTab` 在供应商页收敛到 `claude | codex`; 若 legacy model-manager request
  仍传入 `target: "gemini"`,当前 UI 会兼容折回 Claude,避免进入不存在的 tab。
- 验证证据:
  - `node node_modules/vitest/vitest.mjs run --maxWorkers 1 --minWorkers 1 src/features/vendors/components/VendorSettingsPanel.test.tsx`
  - `npm run typecheck`
  - `npm run check:large-files`
  - `git diff --check`

## R1 修订说明 (2026-06-24 二次 review)

第一版 proposal 用 `rg "opencode|gemini_cli|..."` 关键字扫源码,漏列了
**共享后端 / 共享 IPC / 共享测试** 层的若干交叉点。本次 review 通过逐文件精读
`engine/{mod,manager,status,commands,events,commands_tests,commands_parse_helpers,
claude_forwarder}.rs` + `bin/cc_gui_daemon/{engine_bridge,daemon_state}.rs` +
`command_registry.rs` + `app_server_cli.rs` + `app_server_auto_compaction.rs` +
`workspaces/commands.rs` + `session_management*.rs` + 前端 `useWorkspaceActions` /
`useSidebarMenus` / `runtimeMode.ts` / `services/tauri/session.ts` 等关键枢纽,
发现以下**必须补列**的删除面 (按"是否影响 Codex/Claude 行为"分类):

### 影响面 A — 仅 opencode/gemini 自己,删了 Codex/Claude 不动

- **后端 engine 整模块拆出** (`src-tauri/src/engine/{opencode.rs,
  commands_opencode.rs, commands_opencode_helpers.rs, gemini.rs,
  gemini_event_parsing.rs, gemini_history.rs, gemini_proxy_guard.rs,
  gemini_tests.rs}`, 共 10138 行, 8 文件)
- **后端共享解析/删除/路由助手** 混在 commands 周边,不是独立文件:
  - `src-tauri/src/engine/commands_parse_helpers.rs` (585 行, 其中 ~450 行
    是 `parse_opencode_help_commands` / `parse_opencode_agent_list` /
    `parse_opencode_debug_config_agents` / `merge_opencode_agents` /
    `parse_opencode_auth_providers` / `parse_opencode_mcp_servers` /
    `parse_opencode_date_token` / `parse_opencode_time_token` /
    `parse_opencode_updated_at` / `parse_opencode_session_list`,
    还有 `OpenCodeCommandEntry` / `OpenCodeAgentEntry` /
    `OpenCodeMcpServerState` / `OpenCodeSessionEntry` / `OpenCodeProviderOption`
    5 个 type) — 删 opencode 之后这个文件**几乎变空**,应直接 `git rm`
  - `src-tauri/src/engine/commands.rs` (2528 行) 内嵌的 `commands_opencode*`
    段 — 实际是 `commands_opencode.rs` 931 行 + `commands.rs` 中 1100+ 行
    混在主调度里的 opencode 处理,提案中只列了前者,后者是 **commands.rs
    里的 match 分支 + `next_gemini_routed_item_id` / `is_likely_foreign_model_for_gemini`
    / `build_opencode_command` / `resolve_opencode_bin` / `delete_opencode_session_files`
    / `delete_opencode_session_from_datastore` / `opencode_data_candidate_roots` /
    `opencode_session_candidate_paths` / `load_opencode_models` / `fallback_opencode_provider_catalog`
    / `fetch_opencode_provider_catalog_*` / `merge_opencode_agents` 等 ~20 个
    opencode/gemini-specific 函数 (估计 700+ 行)**
- **前端 feature folder** (`src/features/opencode/**`, 1976 行生产 + 257 测试)
- **CSS 整文件** (`src/styles/opencode-panel.css` 915 行 + 散落选择器)
- **i18n 段** (`opencode:` / `gemini:` 段删)
- **Vendors gemini proxy 子段** (`src-tauri/src/vendors/commands.rs` 内
  gemini-only handler/helper; 文件本身还承载 Claude/Codex provider 管理,不得整删)
- **前端 thread loaders**:
  - `src/features/threads/loaders/opencodeHistoryLoader.ts` (软下线)
  - `src/features/threads/loaders/geminiHistoryLoader.ts` (整文件删, 提案漏列)
  - `src/features/threads/loaders/geminiHistoryParser.ts` (整文件删, 提案漏列)
  - `src/features/threads/loaders/historyLoaders.test.ts` 中 ~5 个 gemini
    用例 + `historyLoaders.fallbacks.test.ts` 中 ~1 个 opencode 用例
- **前端 service 层 IPC 包装**:
  - `src/services/tauri/session.ts` 里 `deleteOpenCodeSession` /
    `listGeminiSessions` / `loadGeminiSession` / `deleteGeminiSession` 4 个
    client IPC 包装 (提案漏列)
  - `src/services/tauri/vendors.ts` 里 `vendor_get_gemini_settings` /
    `vendor_save_gemini_settings` / `vendor_gemini_preflight` 3 个 client IPC
    包装 (提案漏列)
  - `src/services/tauri/runtimeMode.ts:69` 的 `webServiceCodexOnlyStatuses`
    把 `["claude", "codex", "gemini", "opencode"]` 全返回, web service
    模式 UI 兜底 — 删 opencode/gemini 后数组收敛到 `["claude", "codex"]`,
    且 `webServiceEngineFeatures` 的 fallback 分支 (`imageInput: false`) 要
    改成 `true` 否则 web service 模式 Codex 的 image_input capability 会错
- **Tauri IPC handler 注册** (`src-tauri/src/command_registry.rs:96-114`
  列了 **19 个 `opencode_*` IPC handler** + `:126-128` 列了 3 个 gemini IPC +
  `:376-378` 列了 3 个 vendor gemini IPC,共 25 个,提案漏列全数)
- **前端 hook 层漏列**:
  - `src/features/app/hooks/useWorkspaceActions.ts:50-51, 132-134`
    (含 `failed to execute opencode/gemini` 错误信息匹配 + `case "opencode"`
    / `case "gemini"` 错误处理)
  - `src/features/app/hooks/useSidebarMenus.ts:33-34, 141-143, 263, 382,
    462, 500-501, 605-631` 整段 opencode/gemini 菜单项
  - `src/features/threads/hooks/useThreadActionsSessionRuntime.ts:111, 153,
    323-324, 345-346` 整段 opencode/gemini engine 判断
- **共享类型字段** (提案漏列):
  - `src/types.ts:759-760` `geminiEnabled` / `opencodeEnabled` 字段 (提案
    漏列前端 types.ts)
  - `src/types.ts:1060, 1071, 2108` 4 个 `EngineType` 联合类型
  - `src/types.ts:211` `engineSource` / `selectedEngine` 联合类型
  - `src/features/composer/components/ChatInputBox/types.ts:345`
    `ProviderId` 联合类型 + `:356-357` 2 个 provider 列表条目
  - `src/features/composer/components/ChatInputBox/types.ts` 还有
    `geminiEnabled` / `opencodeEnabled` 引用 (提案漏列)
  - `src/lib/spec-core/types.ts:105` `SpecApplyExecutor = "codex" | "claude"
    | "opencode"` (提案漏列, 虽不含 gemini 但 opencode 在 spec apply 路径上
    真存在)

### 影响面 B — 共享后端 API,删 opencode/gemini 必须改签名,会触及 Codex/Claude

- **`EngineManager` 字段** (`src-tauri/src/engine/manager.rs`):
  - `opencode_sessions: Mutex<HashMap<...>>` / `gemini_sessions: Mutex<...>`
    两个字段删, **构造器 `new()` 同步简化** (不影响 codex/claude manager
    子字段)
  - **`detect_single_engine_with_gates(gemini_enabled, opencode_enabled)`
    → 收敛为 `detect_single_engine()` 不带参数** (proposal Risk 1 已提, 漏
    写"函数签名变更")
  - **`refresh_engine_status_with_gates` / `detect_engines_with_gates` 同
    上** — 这两个函数被 **Codex/Claude 也调用** (`workspaces/commands.rs:
    1295, 1328, daemons/daemon_state.rs:726, 747, 773` 等), 删
    opencode/gemini 后**调用点要同步改** (不传 gemini_enabled / opencode_enabled
    参数)
  - 单元测试 `gated_refresh_returns_disabled_status_for_disabled_optional_engine`
    删, 但**需要新增 `refresh_returns_installed_status_for_codex_and_claude`**
    守门
- **`engine/mod.rs` 共享工具** (提案漏列):
  - `pub(crate) const GEMINI_DISABLED_DIAGNOSTIC: &str` / `OPENCODE_DISABLED_DIAGNOSTIC: &str`
    两个常量 (被 `disabled_engine_status` 用, `manager.rs` test 引用)
  - `pub(crate) fn engine_enabled_in_settings(settings, engine_type)` —
    删 opencode/gemini 后函数体只剩 `match engine_type { Claude | Codex
    => true }` 一行, 函数意义不大, 改写成 `pub(crate) const fn engine_always_enabled(_: EngineType) -> bool { true }`
  - `pub(crate) fn engine_disabled_diagnostic(engine_type)` — 删 opencode/gemini
    后永远返回 `None`, 改写成 `_` (保留签名给 Codex 路径上 `if let Some(diag)
    = engine_disabled_diagnostic(...)` 调用编译通过, 实际永远是 None)
  - `pub(crate) fn disabled_engine_status(engine_type)` — 删 opencode/gemini
    后永远走不到, **整函数删**
- **`SendMessageParams` 共享 IPC 字段** (`src-tauri/src/engine/mod.rs:238-239`):
  - `agent: Option<String>` (注释 "for OpenCode")
  - `variant: Option<String>` (注释 "for OpenCode")
  - 删 opencode 后这 2 个字段是**死字段**, 删了破坏 IPC 兼容性 (前端
    `usePromptEnhancer` 仍可能传这俩字段); 保守做法是字段保留 + 注释
    "deprecated since v0.5.14, always None, ignored", v0.5.15 再删
- **`is_codex_thread_id` 排除逻辑** (`src-tauri/src/backend/app_server_auto_compaction.rs:106-109`):
  - 函数体有 4 个 `!normalized.starts_with("opencode:*")` / `("gemini:*")` /
    `("opencode-pending-*")` / `("gemini-pending-*")` arm
  - 删 opencode/gemini 后这 4 个 arm 全删, **函数行为不变** (Codex 路径
    上判别 "不是 claude / opencode / gemini = codex" 等价于 "不是 claude =
    codex" 因为 opencode/gemini 永远为 false)
  - 但**测试** `app_server_tests.rs:345-346` 有 `is_codex_thread_id("opencode:session-1")`
    断言, 删 opencode 后这个断言 `assert!(!is_codex_thread_id(...))` 改成
    `assert!(is_codex_thread_id("codex:session-1"))` 形式
- **`stale_child_candidates` 共享诊断** (`src-tauri/src/engine/commands.rs:182`):
  - 函数体 `EngineType::OpenCode | EngineType::Gemini => "unsupported"`
    改成 `EngineType::Codex => "unsupported"` (与原来行为一致 — Codex
    本来就是 "unsupported"), OpenCode/Gemini arm 删
- **`engine_type_label` 共享 label** (`src-tauri/src/engine/commands.rs:201-206`):
  - 删 OpenCode / Gemini arm, 留 Claude / Codex
- **`EngineEvent` 序列化** (`src-tauri/src/engine/events.rs:412-413`):
  - `match engine { ... EngineType::Gemini => "gemini", EngineType::OpenCode
    => "opencode" }` 删, 留 Claude / Codex (这个 `method = "thread/started"`
    是 IPC payload, 删 opencode/gemini 不影响 Claude/Codex)
- **`engine_bridge.rs` opencode IPC handler 模块** (提案严重漏列):
  - `pub mod opencode;` / `pub mod gemini;` / `pub(crate) mod gemini_proxy_guard;`
    三行 `#[path = "../../engine/..."]` 声明 (daemon 借 path 复用)
  - `commands::OpenCodeSessionEntry` 结构体 (76 行)
  - `commands::strip_ansi_codes` / `resolve_opencode_bin` / `build_opencode_command`
    / `parse_opencode_session_list` / `opencode_session_candidate_paths` /
    `opencode_data_candidate_roots` / `delete_opencode_session_files` /
    `opencode_session_list_core` / `opencode_delete_session_core` ~9 个 fn
  - `commands::engine_type_label` / `engine_enabled_in_settings` /
    `engine_disabled_diagnostic` 3 个 `pub(crate)` 共享 (engine_bridge 内部
    重复定义, 跟 `engine/mod.rs` 是 2 份 — 删时只删 engine_bridge 这份
    因为它随 opencode 一起被 `#[path]` 借过来, 实际编译时就是 `engine/mod.rs`
    那份的别名)
  - 单元测试 `opencode_session_id_rejects_path_like_segments` /
    `resolve_opencode_bin_rejects_launcher_like_windows_candidate` /
    `delete_opencode_session_files_*` 4 个 case
- **`engine_type_label` 在 events.rs:412 也有** — 跟 commands.rs 的两份,
  都是 `match engine { Claude => "claude", OpenCode => "opencode", Gemini
  => "gemini", Codex => "codex" }` 重复定义, 删 opencode/gemini 时 2 处都
  改
- **`claude_forwarder.rs:345` 的 `match engine { EngineType::OpenCode => ... }`**:
  - 这是一个 `EngineType::OpenCode =>` arm 在 **claude 的转发器** 里
  - 删 opencode 后该 arm 删, claude 转发行为不变
- **`backend/app_server_cli.rs:409, 421-428` 的 `is_windows_background_safe_opencode_candidate`
  / `resolve_safe_opencode_binary`**:
  - `resolve_safe_opencode_binary` 是**只服务 opencode 路径** (被 commands.rs:600,
    engine_bridge.rs:81, daemon_state.rs:727 调用, 全部 opencode 专属)
  - Codex 走 `app_server_cli.rs` 走 `build_codex_path_env` 不调用它
  - 删 opencode 时**整函数删**, Codex 路径不动
  - 单元测试 `windows_opencode_cmd_wrapper_is_considered_background_safe`
    / `windows_opencode_cli_exe_in_known_cli_root_is_background_safe` /
    `windows_opencode_launcher_exe_outside_cli_roots_is_rejected` 3 个 case 删
- **`workspaces/commands.rs:99-105` 的 `scan_skill_roots`**:
  - `PathBuf::from(&entry.path).join(".gemini").join("skills")` + `home.join(".gemini").join("skills")`
    把 `~/.gemini/skills` 列为 skill 搜索路径
  - 删 gemini 后这 2 行删, skill 扫描路径从 12 个减到 10 个, 现有 12 source
    测试减 2 个
- **`workspaces/commands.rs:610, 618` 的 `remove_gemini_session` / `remove_opencode_session`**:
  - 调用 `state.engine_manager.remove_gemini_session` /
    `state.engine_manager.remove_opencode_session`, 删 opencode/gemini
    后调用点删
- **`workspaces/commands.rs:1295, 1305-1306, 1328-1329` 的 4-engine detect 逻辑**:
  - `use detect_gemini_status, detect_opencode_status` + 4-arm match
  - 删 opencode/gemini 后**整段 match 收敛到 Claude/Codex 2-arm**
- **`shared/workspaces_core.rs:1817-1850` 的测试 case**:
  - 5 个 `ws-gemini` / `ws-opencode` fixture + 3 个
    `workspace_requires_persistent_session(&gemini / &opencode)` 断言 (line
    1817-1850, 估计 30+ 行)
- **`session_management_catalog_projection.rs:200-601` 整段 400+ 行**:
  - `gemini_history::list_gemini_sessions` 调用 + `commands::opencode_session_list_core`
    调用 + `format!("gemini:{}" / "opencode:{}" / "gemini" / "opencode")`
    拼装
  - 删 opencode/gemini 后整段 400 行删, `list_workspace_sessions` 函数
    只剩 Codex/Claude 数据源
- **`session_management_projection_tests.rs:41, 56-57` 测试 fixture 删**:
  - 删 opencode/gemini 后相关 catalog test case 删
- **`session_management_tests.rs:194, 205` "opencode-scan-cap-reached" 错误**:
  - 删 opencode 后 `OpenCodeHistoryScanCapReached` 错误类型不存, 测试 case 删
- **`session_management_archive_evidence.rs:98` archive engine 枚举**:
  - `match engine { "claude" | "gemini" | "opencode" | "shared" => ... }` —
    删 opencode/gemini 后 arm 收敛到 `"claude" | "shared"`
- **`session_management.rs:933-967, 973-974, 1223-1224, 1740, 2460-2621` 大段**:
  - `"gemini" => { engine::gemini_history::delete_gemini_session ... }` /
    `"opencode" => { engine::commands::opencode_delete_session_core ... }` /
    `if normalized.contains("invalid gemini session id")` /
    `if normalized.contains("invalid opencode session id")` /
    `"codex" | "claude" | "gemini" | "opencode" | "shared"` /
    `list_global_codex_sessions` 内的 gemini history 拼装
  - 删 opencode/gemini 后整段 100+ 行删
- **`session_management_types.rs:17-18, 485-486, 508-513`**:
  - `SESSION_CATALOG_PARTIAL_GEMINI` / `SESSION_CATALOG_PARTIAL_OPENCODE`
    常量
  - `SessionKind::Gemini` / `OpenCode` 枚举变体
  - `strip_prefix("gemini:")` / `strip_prefix("opencode:")` threadId 解析
  - 删 opencode/gemini 后整段删
- **`local_usage.rs:25-29, 398, 426, 701-755`**:
  - `mod gemini_sessions;` / `use gemini_sessions::scan_gemini_session_summaries*` /
    `"gemini" => scan_gemini_session_summaries(workspace_path)?` /
    `if model_lower.contains("gemini")` / `if provider_hint.contains("gemini"
    || "google")` / `if source_hint.contains("gemini")` /
    `"gemini" => "Gemini CLI".to_string()`
  - 删 opencode/gemini 后 `mod gemini_sessions` 软下线保留但内部 `use
    gemini_sessions::scan_gemini_session_summaries` 改成 no-op; 4 个
    `if *.contains("gemini")` 删
- **`app_server_tests.rs:345-346` 的 is_codex_thread_id 断言**:
  - 删 opencode/gemini 后断言改成 `assert!(is_codex_thread_id("codex:session-1"))`
    + `assert!(!is_codex_thread_id("claude:session-1"))`

### 影响面 C — IPC 端 (`command_registry.rs`) 拆出

`src-tauri/src/command_registry.rs` 的 `tauri::generate_handler!` 宏里
有 **25 个 opencode/gemini-specific IPC** 集中注册, 删 opencode/gemini
时**全部从 macro 列表删**:

- 19 个 `opencode_*` IPC: `opencode_commands_list`, `opencode_agents_list`,
  `opencode_session_list`, `opencode_delete_session`, `opencode_stats`,
  `opencode_export_session`, `opencode_import_session`, `opencode_share_session`,
  `opencode_mcp_status`, `opencode_provider_catalog`, `opencode_provider_connect`,
  `opencode_provider_health`, `opencode_mcp_toggle`, `opencode_status_snapshot`,
  `opencode_lsp_diagnostics`, `opencode_lsp_symbols`, `opencode_lsp_document_symbols`,
  `opencode_lsp_definition`, `opencode_lsp_references`
- 3 个 `list_gemini_sessions` / `load_gemini_session` / `delete_gemini_session`
- 3 个 `vendor_get_gemini_settings` / `vendor_save_gemini_settings` /
  `vendor_gemini_preflight`

这些 IPC 在前端 `services/tauri/session.ts` / `services/tauri/vendors.ts` /
`features/opencode/**` / `features/composer/**` 有**调用方**, 删
command_registry 注册后这些调用方必须同步删, 否则前端 IPC 失败但
后端不会拒绝 (Tauri macro 在编译期展开, 删了就是真的删了 IPC)。

### 修订后的"必删(P0)总清单" (覆盖到逐行级)

以下文件/行级是修订后**真正要删的全部代码面**:

**后端整文件 (整 git rm)**:
1. `src-tauri/src/engine/opencode.rs` (1809)
2. `src-tauri/src/engine/commands_opencode.rs` (931)
3. `src-tauri/src/engine/commands_opencode_helpers.rs` (140)
4. `src-tauri/src/engine/gemini.rs` (1412)
5. `src-tauri/src/engine/gemini_event_parsing.rs` (911)
6. `src-tauri/src/engine/gemini_history.rs` (1695)
7. `src-tauri/src/engine/gemini_proxy_guard.rs` (139)
8. `src-tauri/src/engine/gemini_tests.rs` (856)
9. `src-tauri/src/engine/commands_parse_helpers.rs` (585, 几乎全 opencode)
10. `src-tauri/src/vendors/commands.rs` 保留文件,仅删除 gemini-only proxy/settings
    段; Claude/Codex provider IPC 必须保留
11. `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs` 的 `commands` mod
    内 opencode / gemini 子段 (估计 ~250 行, 不整文件删, 整文件还有
    4-engine `EngineType` 共享 + `ensure_engine_enabled` 等 Claude/Codex
    共用)
12. `src/features/opencode/**` 整 folder (1976 + 257)
13. `src/features/threads/loaders/geminiHistoryLoader.ts`
14. `src/features/threads/loaders/geminiHistoryParser.ts`
15. `src/styles/opencode-panel.css` (915)

**后端逐行删 (关键) — 影响 Codex/Claude 行为,需谨慎**:
1. `src-tauri/src/engine/mod.rs`:
   - `pub mod gemini;` / `pub mod opencode;` (2 行)
   - `pub mod gemini_history;` (1 行)
   - `pub(crate) mod gemini_proxy_guard;` (1 行)
   - `pub(crate) const GEMINI_DISABLED_DIAGNOSTIC: &str` + `OPENCODE_DISABLED_DIAGNOSTIC: &str` (2 行)
   - `pub(crate) fn engine_enabled_in_settings` / `engine_disabled_diagnostic` /
     `disabled_engine_status` (3 fn, ~40 行)
   - `EngineType::OpenCode` / `EngineType::Gemini` 2 个变体 + `display_name`
     / `icon` / `disabled_engine_status` match arm
   - `EngineFeatures::opencode()` / `EngineFeatures::gemini()` 2 个 builder
   - `SendMessageParams.agent` / `variant` 2 个字段保留,加 deprecated 注释并在
     OpenCode/Gemini 调用点删除后保持 ignored
   - tests `engine_type_display_names` 删 Gemini / OpenCode 断言
2. `src-tauri/src/engine/commands.rs`:
   - `use super::status::{detect_gemini_status, load_opencode_models};`
     (1 行)
   - `#[path = "commands_opencode_helpers.rs"] mod opencode_helpers;` +
     `use opencode_helpers::*;` (2 行)
   - `EngineType::OpenCode | EngineType::Gemini => "unsupported"` match arm
   - `EngineType::OpenCode => "opencode"` / `EngineType::Gemini => "gemini"`
     engine_type_label arm
   - `next_gemini_routed_item_id` / `is_likely_foreign_model_for_gemini` /
     `resolve_opencode_bin` / `build_opencode_command` /
     `opencode_session_candidate_paths` / `delete_opencode_session_files` /
     `opencode_data_candidate_roots` / `delete_opencode_session_from_datastore` /
     `fallback_opencode_provider_catalog` /
     `fetch_opencode_provider_catalog_preview` /
     `fetch_opencode_provider_catalog_from_auth_picker` ~12 个 fn
   - `EngineType::OpenCode` / `EngineType::Gemini` 在 `get_engine_models`
     / `engine_send_message` / 多处 match arm 收敛到 2-arm
   - `manager.detect_engines_with_gates(gemini_enabled, opencode_enabled)`
     调用点 (3 处) 改成 `manager.detect_engines()`
3. `src-tauri/src/engine/commands_tests.rs`:
   - 删 `collect_stale_child_candidates` / `delete_opencode_session_files` /
     `delete_opencode_session_from_datastore` / `extract_turn_result_text` /
     `is_valid_claude_model_for_passthrough` / `merge_opencode_agents` /
     `next_gemini_routed_item_id` / `normalize_provider_key` /
     `opencode_data_candidate_roots` / `opencode_session_candidate_paths` /
     `parse_imported_session_id` / `parse_json_value` /
     `parse_opencode_agent_list` / `parse_opencode_auth_providers` /
     `parse_opencode_debug_config_agents` / `parse_opencode_help_commands` /
     `parse_opencode_mcp_servers` / `parse_opencode_session_list` /
     `parse_opencode_updated_at` / `provider_keys_match` 共 19 个 use
   - 删 EngineType::OpenCode/Gemini fixture 4 处
   - 删 `gemini_model_guard_*` 3 case + `gemini_routing_*` 2 case +
     `opencode_model_guard_*` 2 case + `parse_opencode_*` 7 case +
     `merge_opencode_agents` 1 case + `opencode_session_candidates_*` 1 case
     + `delete_opencode_session_files_*` 2 case +
     `opencode_data_candidate_roots_*` 1 case +
     `delete_opencode_session_from_datastore_*` 1 case = 20 个 case 全删
4. `src-tauri/src/engine/manager.rs`:
   - `opencode_sessions: Mutex<HashMap<...>>` / `gemini_sessions: Mutex<...>`
     字段 (2 行)
   - `use super::gemini::GeminiSession;` / `use super::opencode::OpenCodeSession;`
     (2 行)
   - `use super::status::{detect_gemini_status, ..., detect_opencode_status, ...}`
     (1 行, 5 个 use name)
   - `detect_single_engine_with_gates` / `refresh_engine_status_with_gates`
     / `detect_engines_with_gates` 函数签名简化 (3 fn)
   - `get_or_create_opencode_session` / `get_opencode_session` /
     `remove_opencode_session` / `get_or_create_gemini_session` /
     `get_gemini_session` / `remove_gemini_session` /
     `list_opencode_sessions` / `list_gemini_sessions` 8 个 fn 删
   - `EngineType::OpenCode` / `EngineType::Gemini` 在 detect / config 段
     收敛
   - test `gated_refresh_returns_disabled_status_for_disabled_optional_engine`
     删, 新增 `refresh_returns_installed_status_for_codex_and_claude`
5. `src-tauri/src/engine/status.rs`:
   - `use crate::backend::app_server_cli::resolve_safe_opencode_binary;`
     (1 行)
   - `OPENCODE_MODELS_TIMEOUT: Duration` 常量 (1 行)
   - `detect_opencode_status` / `detect_gemini_status` /
     `load_opencode_models` / `parse_opencode_models_output` /
     `parse_gemini_model_from_config_json` 5 个 fn
   - `detect_all_engines` / `detect_opencode_status_lightweight` /
     `engine_supports_oauth_login` 等 4-engine 调度收敛到 2-engine
   - tests `parse_opencode_models_*` / `parse_gemini_model_from_config_*` /
     `detect_opencode_status_*` / `detect_opencode_status_rejects_launcher_*`
     5 个 case 删
6. `src-tauri/src/engine/events.rs`:
   - `EngineType::Gemini => "gemini"` / `EngineType::OpenCode => "opencode"`
     match arm (2 行) 收敛到 2-arm
   - `EngineType::OpenCode => { state.current_thread_id = format!("opencode:{}",
     session_id) }` (3 行) 删 (line 1575 附近)
7. `src-tauri/src/engine/claude_forwarder.rs`:
   - `EngineType::OpenCode => { ... }` arm (line 345, 估计 5-10 行)
8. `src-tauri/src/capability_matrix.rs`:
   - `EngineType::Gemini => EngineFeatures::gemini()` /
     `EngineType::OpenCode => EngineFeatures::opencode()` (2 行)
   - test `opencode_does_not_support_mcp_or_image_input` 删
9. `src-tauri/src/bin/cc_gui_daemon.rs`:
   - `"opencode" => Some(engine::EngineType::OpenCode)` /
     `"gemini" => Some(engine::EngineType::Gemini)` (2 行, line 752-753)
   - `"list_gemini_sessions"` / `"load_gemini_session"` /
     `"delete_gemini_session"` / `"opencode_session_list"` 4 个 IPC
     handler 整段删 (估计 60 行, line 1672-1868)
10. `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`:
    - 5 处 `detect_engines_with_gates(gemini_enabled, opencode_enabled)` 调用
      改成 `detect_engines()`
    - 1 处 `engine::status::load_opencode_models(custom_bin)` 调用删
    - `format!("opencode:{}" / "gemini:{}" / "opencode-turn-{}" /
      "opencode-item-{}" / "opencode-sync-{}" / "gemini-turn-{}" /
      "gemini-item-{}" / "gemini-sync-{}")` 拼装 (10+ 处) 删
    - 2 处 `"opencode" / "gemini"` 字符串字面量 (event payload) 删
    - `state.engine_manager.get_or_create_opencode_session` /
      `.list_opencode_sessions` / `.get_opencode_session` /
      `.remove_opencode_session` / `.get_or_create_gemini_session` /
      `.list_gemini_sessions` / `.get_gemini_session` /
      `.remove_gemini_session` 8 个调用点删
    - `opencode_session_list` / `list_gemini_sessions` /
      `load_gemini_session` / `delete_gemini_session` 4 个 fn 删
    - `state.engine_manager.remove_gemini_session(workspace_id)` /
      `remove_opencode_session(workspace_id)` 调用 (line 610, 618) 删
11. `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs`:
    - `#[path = "../../engine/gemini.rs"] pub mod gemini;` (1 行)
    - `#[path = "../../engine/gemini_history.rs"] pub mod gemini_history;`
      (1 行)
    - `#[path = "../../engine/gemini_proxy_guard.rs"] pub(crate) mod
      gemini_proxy_guard;` (1 行)
    - `#[path = "../../engine/opencode.rs"] pub mod opencode;` (1 行)
    - `commands` mod 内 `OpenCodeSessionEntry` / `strip_ansi_codes` /
      `resolve_opencode_bin` / `build_opencode_command` /
      `parse_opencode_session_list` / `opencode_session_candidate_paths` /
      `opencode_data_candidate_roots` / `delete_opencode_session_files` /
      `opencode_session_list_core` / `opencode_delete_session_core` 10 个
      opencode fn
    - tests `opencode_session_id_rejects_path_like_segments` /
      `resolve_opencode_bin_rejects_launcher_like_windows_candidate` /
      `delete_opencode_session_files_rejects_invalid_session_id` /
      `delete_opencode_session_files_removes_workspace_fallback_path` /
      `opencode_data_candidate_roots_include_xdg_data_path` /
      `delete_opencode_session_from_datastore_removes_session_and_storage_json`
      6 个 case
    - 内部 `engine_type_label` / `engine_enabled_in_settings` /
      `engine_disabled_diagnostic` 3 个 `pub(crate)` 共享 (随 opencode 删,
      跟 `engine/mod.rs` 的是 2 份重复定义)
12. `src-tauri/src/command_registry.rs`:
    - 19 个 `opencode_*` IPC (line 96-114)
    - 3 个 gemini IPC (line 126-128)
    - 3 个 vendor gemini IPC (line 376-378)
    - 总 25 行 macro entry 删
13. `src-tauri/src/backend/app_server_cli.rs`:
    - `is_windows_background_safe_opencode_candidate` (line 409, 估计 12 行)
    - `resolve_safe_opencode_binary` (line 421-428, 估计 8 行)
    - tests `windows_opencode_cmd_wrapper_is_considered_background_safe` /
      `windows_opencode_cli_exe_in_known_cli_root_is_background_safe` /
      `windows_opencode_launcher_exe_outside_cli_roots_is_rejected` (3 case)
14. `src-tauri/src/backend/app_server_auto_compaction.rs`:
    - `is_codex_thread_id` 函数体 4 个 `!starts_with("opencode:*")` /
      `("gemini:*")` arm (line 106-109, 4 行)
15. `src-tauri/src/backend/app_server_tests.rs`:
    - `assert!(!is_codex_thread_id("opencode:session-1"))` /
      `assert!(!is_codex_thread_id("gemini:session-1"))` (line 345-346, 2 行)
      改成 `assert!(is_codex_thread_id("codex:session-1"))` 形式
16. `src-tauri/src/workspaces/commands.rs`:
    - `PathBuf::from(&entry.path).join(".gemini").join("skills")` (line 99)
    - `roots.push(home.join(".gemini").join("skills"));` (line 105)
    - `state.engine_manager.remove_gemini_session(workspace_id)` (line 610)
    - `state.engine_manager.remove_opencode_session(workspace_id)` (line 618)
    - `use detect_claude_status, detect_gemini_status, detect_opencode_status,`
      (line 1295)
    - `EngineType::Gemini => "gemini"` / `EngineType::OpenCode => "opencode"`
      (line 1305-1306)
    - `EngineType::Gemini => detect_gemini_status(None).await.installed,` /
      `EngineType::OpenCode => detect_opencode_status(None).await.installed,`
      (line 1328-1329)
17. `src-tauri/src/shared/workspaces_core.rs`:
    - 5 个 `ws-gemini` / `ws-opencode` fixture + 3 个
      `workspace_requires_persistent_session(&gemini / &opencode)` 断言 (line
      1817-1850, 估计 30+ 行)
18. `src-tauri/src/session_management_catalog_projection.rs`:
    - 整段 200-601 (估计 400 行) opencode/gemini session 拼装删
    - `gemini_history::list_gemini_sessions` 调用 (5+ 处)
    - `commands::opencode_session_list_core` 调用 (5+ 处)
    - `format!("gemini:{}" / "opencode:{}")` 拼装 (10+ 处)
19. `src-tauri/src/session_management_projection_tests.rs`:
    - `Some("codex-history-unavailable,gemini-history-unavailable")` (line 41)
    - `catalog_entry("gemini:other", ...)` (line 56-57)
20. `src-tauri/src/session_management_tests.rs`:
    - `"opencode"` fixture (line 194)
    - `assert_eq!(status.reason.as_deref(), Some("opencode-scan-cap-reached"))`
      (line 205)
21. `src-tauri/src/session_management_archive_evidence.rs`:
    - `match engine { "claude" | "gemini" | "opencode" | "shared" => ... }`
      arm 收敛到 `"claude" | "shared"` (line 98)
22. `src-tauri/src/session_management.rs`:
    - `let gemini_home_dir = engine_manager...` (line 933)
    - `"gemini" => { engine::gemini_history::delete_gemini_session ... }`
      (line 959-967)
    - `"opencode" => { engine::commands::opencode_delete_session_core ... }`
      (line 973-974)
    - `if normalized.contains("invalid gemini session id")` /
      `if normalized.contains("invalid opencode session id")` (line
      1223-1224)
    - `"codex" | "claude" | "gemini" | "opencode" | "shared"` (line 1740)
      收敛到 `"codex" | "claude" | "shared"`
    - 2460-2621 整段 gemini 拼装删 (估计 160 行)
23. `src-tauri/src/session_management_types.rs`:
    - `SESSION_CATALOG_PARTIAL_GEMINI` / `SESSION_CATALOG_PARTIAL_OPENCODE`
      常量 (line 17-18)
    - `Self::Gemini { .. } => "gemini"` / `Self::OpenCode { .. } =>
      "opencode"` (line 485-486)
    - `strip_prefix("gemini:")` / `strip_prefix("opencode:")` (line 508-513)
24. `src-tauri/src/local_usage.rs`:
    - `mod gemini_sessions;` (line 25-26) 软下线保留
    - `use gemini_sessions::scan_gemini_session_summaries*` 改成 no-op import
    - `"gemini" => scan_gemini_session_summaries(workspace_path)?` (line 398)
    - `sessions.extend(scan_gemini_session_summaries(workspace_path)?);`
      (line 426)
    - 4 个 `if *.contains("gemini" / "opencode")` (line 701-755) 删

**前端整文件删 (整 git rm)**:
1. `src/features/opencode/**` 整 folder (1976 + 257 行)
2. `src/features/threads/loaders/geminiHistoryLoader.ts`
3. `src/features/threads/loaders/geminiHistoryParser.ts`
4. `src/styles/opencode-panel.css` (915 行)

**前端逐行删 (关键) — 影响 Claude/Codex 共享 UI,需谨慎**:
1. `src/types.ts`:
   - `geminiEnabled: boolean;` / `opencodeEnabled: boolean;` (line 759-760)
     保留 + 注释 deprecated
   - 4 个 `EngineType` 联合类型 (line 1060, 1071, 2108) 收敛
   - `engineSource` / `selectedEngine` (line 211) 收敛
2. `src/services/tauri/session.ts`:
   - `deleteOpenCodeSession` (line 203, 2 行)
   - `listGeminiSessions` (line 251-252, 5 行)
   - `loadGeminiSession` (line 263, 4 行)
   - `deleteGeminiSession` (line 314, 5 行)
3. `src/services/tauri/vendors.ts`:
   - `vendor_get_gemini_settings` / `vendor_save_gemini_settings` /
     `vendor_gemini_preflight` (line 107, 113, 117, 3 行)
4. `src/services/tauri/runtimeMode.ts`:
   - `webServiceCodexOnlyStatuses` 里 `["claude", "codex", "gemini",
     "opencode"]` (line 69) 收敛到 `["claude", "codex"]`
   - `webServiceEngineFeatures` fallback 分支 (line 53-66) `imageInput:
     false` 改成 `true` (否则 web service 模式 Codex image_input
     capability 错)
5. `src/services/globalRuntimeNotices.ts`:
   - `engine?: "claude" | "codex" | "gemini" | "opencode" | string | null;`
     (line 40) 收敛
   - `case "opencode":` / `case "gemini":` (line 102-104) 删
6. `src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts`:
   - `loadGeminiSession as loadGeminiSessionService` (line 6) import 删
   - `createGeminiHistoryLoader` / `createOpenCodeHistoryLoader` import
     删
   - `targetThreadId.startsWith("gemini:")` / `("opencode:")` 分支删
7. `src/features/threads/hooks/useThreadActionsSessionRuntime.ts`:
   - `engine?: "claude" | "codex" | "gemini" | "opencode";` (line 111)
     收敛
   - `if (engine === "claude" || engine === "gemini" || engine ===
     "opencode")` (line 153) 改写
   - `threadId.startsWith("gemini:") || threadId.startsWith("gemini-pending-")`
     (line 323-324) 删
   - `: forkedThreadId.startsWith("gemini:") ? "gemini" :` (line 345-346)
     删
8. `src/features/threads/hooks/useThreadActions.{ts, helpers.ts,
   sessionActions.ts, lastGoodSnapshots.ts, workspacePath.ts,
   native-session-bridges.test.tsx}` (提案已列, 修订保持)
9. `src/features/threads/utils/*` 中 opencode/gemini 分支 (提案已列)
10. `src/features/threads/loaders/historyLoaders.test.ts`:
    - `createGeminiHistoryLoader` import (line 5-6) 删
    - `parseGeminiHistoryMessages` import 删
    - `loads gemini history into normalized snapshot` (line 648-684) +
      `hydrates gemini final completion time and duration from message
      timestamps` (line 690-720) + `keeps gemini user image-only history
      rows` (line 722-740) + `strips gemini output language hint from
      restored user history text` (line 744-766) + `merges gemini tool
      start/result rows into a completed tool item` (line 768-810) +
      `normalizes gemini EditFile history rows to fileChange cards` (line
      812-...) 6 个 case 删
11. `src/features/threads/loaders/historyLoaders.fallbacks.test.ts`:
    - `createOpenCodeHistoryLoader` import (line 4) 删
    - `emits fallback warnings for opencode loader when thread payload is
      missing` (line 129-...) case 删
12. `src/features/app/hooks/useWorkspaceActions.ts`:
    - `normalized.includes("failed to execute gemini")` /
      `normalized.includes("failed to execute opencode")` (line 50-51)
    - `case "gemini":` / `case "opencode":` (line 132-134) error handling
13. `src/features/app/hooks/useSidebarMenus.ts`:
    - `| "engine-opencode" | "engine-gemini"` 联合类型 (line 33-34)
    - `case "gemini":` / `case "opencode":` 多处 (line 141-143, 500-501)
    - `engineOptions.find((entry) => entry.type === "opencode")` (line 263)
    - `if (engineType === "opencode" && workspace.connected)` (line 382,
      462)
    - `new-session-opencode` / `new-session-gemini` 菜单项 (line 605-631)
14. `src/features/composer/components/ChatInputBox/types.ts`:
    - `ProviderId = 'claude' | 'codex' | 'gemini' | 'opencode'` (line 345)
    - 2 个 provider 列表条目 (line 356-357) `{ id: 'gemini', ... }` /
      `{ id: 'opencode', ... }`
15. `src/lib/spec-core/types.ts`:
    - `SpecApplyExecutor = "codex" | "claude" | "opencode"` (line 105) 收敛
      到 `"codex" | "claude"`

### 修订后 Gate 1 / 2 / 3 行为契约(增项)

- **新 Gate 2.X**: `src/services/tauri/runtimeMode.ts:69` `webServiceCodexOnlyStatuses`
  调用 → 返回数组长度 = 2, 元素只有 "claude" / "codex", 两者 `imageInput`
  都是 `true` (Codex 的 imageInput 不退化)
- **新 Gate 3.X**: `app_server_cli.rs::build_codex_app_server_args` 单元
  测试 (mock CLI 抓 argv) 不变; 特别守门**`is_codex_thread_id("claude:session-1")`
  返回 false, `is_codex_thread_id("codex:session-1")` 返回 true**, 函数
  行为跟原版 100% 一致 (虽然代码删了 4 个 arm)
- **新 Gate 3.Y**: `EngineManager::detect_engines()` 单元测试 (替代原
  `detect_engines_with_gates`), 覆盖 (a) Codex status 正常返回 (b) Claude
  status 正常返回 (c) 不再传 gemini_enabled / opencode_enabled 参数编译通过
- **新 Gate 3.Z**: `engine_bridge.rs::commands` 模块(daemon) 删 opencode
  / gemini 子段后, 仍能 `cargo build --release` 0 退出, `codex_*` /
  `claude_*` 启动路径不退化
- **新 Gate 3.W**: `src/features/composer/components/ChatInputBox/types.ts::ProviderId`
  收敛到 4 个 → 3 个 (claude / codex / +1 个 shared), `getEnabledProviders()`
  行为不变 (Codex/Claude 仍 enabled)

### 修订后风险与回退(增项)

- **风险 8**: `SendMessageParams` 删 `agent` / `variant` 字段会破坏前端
  IPC payload 兼容性 (`usePromptEnhancer` 可能传这俩字段), 保守做法是
  字段保留 + 注释 deprecated, v0.5.15 再删。**回退**: 同 proposal 风险 1
- **风险 9**: `EngineManager::detect_engines_with_gates` 函数签名变更
  (3 个函数去掉 `gemini_enabled, opencode_enabled` 参数), 调用点 ~10 处
  同步改。**回退**: 改回加 2 个参数 + `_ = false` 占位, 调用点不改, 但
  留下 dead code → 不推荐回退
- **风险 10**: `webServiceEngineFeatures` fallback 分支 `imageInput:
  false` 改成 `true`, 可能在 web service 模式下**多显示** Codex 的 image
  input 能力, 但 web service 模式本来就不支持 opencode/gemini, 用户不可见
- **风险 11**: `engine_bridge.rs` daemon 模块与 `engine/mod.rs` 共享
  `engine_type_label` / `engine_enabled_in_settings` 等 fn 是 2 份重复
  定义, 删 opencode 时只删 daemon 这份 (因为 `engine/mod.rs` 那份
  仍要为 Codex/Claude 提供 `EngineType` 转换), daemon `commands` mod
  内 `use super::{manager::EngineManager, ...}` 的引用要同步清理


## R2 修订说明 (2026-06-24 三次 review)

R1 修订后再次逐文件精读了 `engine/{claude_forwarder,events,commands}.rs` +
`daemon/{engine_bridge,daemon_state}.rs` + `command_registry.rs` + 
`backend/{app_server_cli,app_server_auto_compaction,app_server_tests}.rs` +
`workspaces/commands.rs` + `skills.rs` + `engine/session_history_commands.rs` +
`vendors/commands.rs` + `rewind_export.rs` + `shared_sessions.rs` + 
`local_usage/tests.rs` 后,发现以下 **R1 漏标** 的关键点:

### R2.A — 致命级修正 (`vendors/commands.rs` 不可整文件删)

`src-tauri/src/vendors/commands.rs` (1343 行) **不是全 gemini proxy**!
它是 **Claude/Codex provider 管理** 的代码,包含 18+ 个 Codex/Claude provider IPC
handler (`vendor_get_claude_providers` / `vendor_add_claude_provider` /
`vendor_update_claude_provider` / `vendor_delete_claude_provider` /
`vendor_switch_claude_provider` / `vendor_reorder_claude_providers` /
`vendor_get_claude_always_thinking_enabled` / `vendor_set_claude_always_thinking_enabled` /
`vendor_fetch_claude_models` / `vendor_get_codex_providers` /
`vendor_add_codex_provider` / `vendor_update_codex_provider` /
`vendor_delete_codex_provider` / `vendor_switch_codex_provider` 等 14+ 个 Claude/Codex IPC
+ 3 个 gemini-only IPC `vendor_get_gemini_settings` / `vendor_save_gemini_settings` /
`vendor_gemini_preflight` + 一些 `*_gemini_*` helper (`normalize_gemini_auth_mode` /
`default_gemini_auth_mode`))。

**R1 误判**: "整文件 `git rm` vendors/commands.rs" → **错,会破坏 Claude/Codex
provider 管理功能**。

**R2 修正**: 只删 gemini 专属行:
- `vendor_get_gemini_settings` / `vendor_save_gemini_settings` /
  `vendor_gemini_preflight` 3 个 `pub(crate) async fn` 删
- `GeminiVendorSettings` / `GeminiVendorPreflightResult` / `GeminiSection` /
  `CodemossConfig.gemini` 字段 (需看具体 schema) 删
- `normalize_gemini_auth_mode` / `default_gemini_auth_mode` 2 个 fn 删
- `command_registry.rs:376-378` 3 行 `crate::vendors::vendor_*_gemini_*` 删
- `src/services/tauri/vendors.ts:107, 113, 117` 3 个 client IPC 包装删

文件**保留**, Claude/Codex provider 代码不动。

### R2.B — daemon 独立 `EngineType` 第二份定义

`src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs:413-475` 内有**完全独立**的
第二份 `pub enum EngineType { Claude, Codex, Gemini, OpenCode }` + 
`engine_enabled_in_settings` / `engine_disabled_diagnostic` /
`GEMINI_DISABLED_DIAGNOSTIC` / `OPENCODE_DISABLED_DIAGNOSTIC` + 
`display_name` / `icon` impl — **手写,非 `#[path]` include**。

**R1 漏**: 提案只说改 `engine/mod.rs`,**漏了 daemon 这份独立定义**。

**R2 修正**: 删 opencode/gemini 时, daemon 独立这 5 项也要改:
1. `engine_bridge.rs:413-419` `EngineType` 2 个变体删
2. `engine_bridge.rs:421-434` `display_name` / `icon` match arm
3. `engine_bridge.rs:436-439` `GEMINI_DISABLED_DIAGNOSTIC` / `OPENCODE_DISABLED_DIAGNOSTIC` 2 个 const
4. `engine_bridge.rs:441-455` `engine_enabled_in_settings` / `engine_disabled_diagnostic` 2 fn
5. `daemon_state.rs` 内**没有**第二份(daemon_state 用 `super::engine_bridge::EngineType`)

### R2.C — `src-tauri/src/skills.rs` 漏列

`src-tauri/src/skills.rs` (868 行) 有 `SKILL_SOURCE_PROJECT_GEMINI` /
`SKILL_SOURCE_GLOBAL_GEMINI` 2 个 const + `resolve_default_gemini_home` /
`default_gemini_skills_dir` 2 个 fn + `project_gemini_dir` /
`gemini_global_dir` 2 个 skill source 变量 + `scan_*_gemini_*` 多处
(估计 ~80 行)。

**R1 漏**: 完全漏了 `skills.rs` 文件。

**R2 修正**: `skills.rs`:
- 删 `SKILL_SOURCE_PROJECT_GEMINI` / `SKILL_SOURCE_GLOBAL_GEMINI` 2 个 const
- 删 `resolve_default_gemini_home` / `default_gemini_skills_dir` 2 个 fn
- 删 `project_gemini_dir` / `gemini_global_dir` 变量 + 2 个 source
  scan 逻辑
- 删 `scan_*_gemini_*` 调用点 (估计 5+ 处)
- 删 5+ 个 gemini skills 单元测试 case
- skill 扫描 source 从 12 减到 10, `SkillEntry.source` 枚举少 2 个值

### R2.D — `src-tauri/src/engine/session_history_commands.rs` 漏列

`src-tauri/src/engine/session_history_commands.rs` 有 3 个 **Tauri command
function 真身**:
- `pub(super) fn remote_delete_gemini_session_request(workspace_path,
  session_id) -> (String, Value)` (line 23, ~10 行) — 给 daemon 用
- `pub async fn list_gemini_sessions(workspace_path, limit) -> ...` (line 187, ~22 行)
- `pub async fn load_gemini_session(workspace_path, session_id) -> ...` (line 219, ~30 行)
- `pub async fn delete_gemini_session(workspace_path, session_id) -> ...` (line 251, ~25 行)
- 1 个 `remote_delete_gemini_session_request_normalizes_workspace_path` 测试 case (line 298, ~25 行)

**R1 漏**: 只在 `command_registry.rs` 提了这 3 个 IPC 的注册,没列**函数定义**
在哪里。

**R2 修正**: `session_history_commands.rs`:
- 删 `remote_delete_gemini_session_request` fn + import
- 删 `list_gemini_sessions` / `load_gemini_session` / `delete_gemini_session` 3 个 fn
- 删测试 `remote_delete_gemini_session_request_normalizes_workspace_path`

### R2.E — `src-tauri/src/shared_sessions.rs:1126` 漏列

`shared_sessions.rs:1126` 有 `native_thread_id: "gemini:session-1"` 测试
fixture。删 opencode/gemini 后这 1 行 fixture 删。

### R2.F — `src-tauri/src/local_usage/tests.rs` 大段漏列

`local_usage/tests.rs` (2091 行) 有 **6+ 个 gemini 单元测试 case**:
- `make_temp_gemini_home` helper (line 53-57, 5 行)
- `write_gemini_project_root` helper (line 61-64, 4 行)
- `write_gemini_chat_file` helper (line 67-78, 12 行)
- `infer_engine_label` 测试中 `assert_eq!(infer_engine_label("gemini",
  &unknown_session), "Gemini CLI")` (line 1850, 1 行)
- `scan_gemini_session_summaries_reads_sessions_for_current_workspace` (line 1870-1913, 44 行)
- `scan_gemini_session_summaries_skips_workspace_mismatch` (line 1917-1945, 29 行)
- `scan_gemini_session_summaries_does_not_follow_symlink_directories` (line 1948+, 估计 30 行)

**R1 漏**: 完全漏了 `local_usage/tests.rs`。

**R2 修正**: 删 opencode/gemini 后这 6+ 个 case 全删。

### R2.G — `src-tauri/src/workspaces/rewind_export.rs:94` 漏列

`rewind_export.rs:94` 有 `match engine { "claude" | "codex" | "gemini" =>
Ok(engine.trim()), ... }` 1 个 match arm。删 opencode/gemini 后 arm 收敛到
`"claude" | "codex"`。

### R2.H — `engine_send_message` 共享 IPC 入口的 `agent` / `variant` 参数处理

`src-tauri/src/bin/cc_gui_daemon.rs:1519-1520, 1562-1563` daemon 入口 + 
`src-tauri/src/engine/commands.rs:1386, 2111` Tauri command 入口 + 
`daemon_state.rs:858, 1510` 函数签名 — 4 个位置都带 `agent: Option<String>` /
`variant: Option<String>` 参数。

**R1 没明确**: SendMessageParams 字段处理。

**R2 修正**: 删 opencode/gemini 时:
- `commands.rs:1386, 2111` 删 2 个 `#[tauri::command]` 函数签名里
  `agent: Option<String>, variant: Option<String>,` 2 个参数
- `commands.rs:1446` log 里 `agent={:?} variant={:?}` 2 个 placeholder 删
- `daemon_state.rs:858, 1510` 函数签名删 2 个参数
- `cc_gui_daemon.rs:1519-1520, 1562-1563` daemon 入口 `parse_optional_string`
  删
- `commands.rs:1768, 1925, 2110, 2380` `let params = super::SendMessageParams {
  ... agent, variant ... }` 拼装删 (Codex arm 走 `delegateTo: "send_user_message"`
  早 return, 不构造 SendMessageParams, **Codex 路径行为完全不变**)
- `commands.rs` 内部 OpenCode arm / Gemini arm 调用 `params.agent` /
  `params.variant` 引用删 (整个 arm 一起删, 不影响)
- **`SendMessageParams.agent` / `SendMessageParams.variant` 字段本身**: **保留
  + 标 deprecated + 注释 "ignored since v0.5.14"**。因为前端的 `engine_send_message`
  invoke payload 可能仍传这俩字段(虽然前端 grep 0 命中,但 IPC 兼容性
  保守起见保留),v0.5.15 再删

### R2.I — `SendMessageParams` 字段在 Codex 路径上的真实使用点

**关键验证**: Codex 走 `engine_send_message` 时,`EngineType::Codex =>` arm 早
return `Ok(json!({ "delegateTo": "send_user_message" }))`,**不读取
`SendMessageParams.agent` / `variant`**。所以:
- `SendMessageParams.agent` / `variant` 字段保留为 deprecated/ignored
  **不影响** Codex 路径,并保留 IPC payload 兼容余量
- 删 `engine_send_message` 外层函数签名的 `agent` / `variant` 参数**不影响**
  Codex 路径 (Codex arm 不读这俩参数)
- `engine_send_message_sync` Codex arm 走 `Err("engine_send_message_sync
  for codex is not supported in daemon mode")` 早 return, **也不影响**

**R2 守门 Gate 3.X 增强**: 加 1 个 unit test 验证 `engine_send_message(
  ..args without agent/variant.., codex 模式)` 返回 `Ok({ "delegateTo":
  "send_user_message", "engine": "codex" })`,与 R1 前行为完全一致。

### R2.J — `app_server.rs` (Codex 主路径) 0 命中

确认: `src-tauri/src/app_server.rs` (Codex `app-server` 子进程主路径) 对
`opencode` / `gemini` 关键字 0 命中。删 opencode/gemini 不会动 Codex 子进程
args 拼装、RPC forwarding、auto-compaction、checkpointing 任何路径。

**R2 守门 Gate 3.Y 增强**: `app_server_cli.rs::build_codex_app_server_args`
单元测试 (mock CLI 抓 argv) 不变,加 1 个 `assert!(cmdline.iter().all(|arg|
!arg.contains("opencode") && !arg.contains("gemini")))` 反向断言。

### R2.K — R1 修订 proposal 标题修正

R1 在 proposal 顶部加了"R1 修订说明"段。R2 这次 review 在 R1 基础上
补 R2.A~J 10 项。建议 R2 这段作为"附录 B"插入 R1 段之后(不重写 R1)。

---

## Why

mossx v0.5.13 客户端目前支持 4 个 engine: `codex` / `claude` / `opencode` / `gemini`。
其中 `opencode` 与 `gemini` 两个 engine 在客户端代码里是一等公民 ——
完整 backend engine 子模块、前端 feature folder、独立 settings 开关、capability matrix
分支、IPC 命令、daemon bridge、独立 CSS、独立 history loader。

本次 proposal 目标: **把这两个 engine 从客户端代码里统一删掉**, 只保留 `codex` /
`claude` 双引擎, 同时把历史会话 / 本地 .jsonl 软下线 (磁盘文件不删, 但 UI 与启动
加载链路不再枚举)。

触发理由:

- v0.5.13 release run 真实用户数据: 4 个 engine 的设置面板里, `opencode` 启用率
  < 0.4%, `gemini` 启用率 < 0.2%。两个 engine 的 daemon / e2e 测试成本却占
  engine 模块总维护成本的 38% (按 `src-tauri/src/engine/*.rs` 行数比例近似)。
- v0.5.14 roadmap 已经把 "Codex/Claude 双引擎" 写进 onboarding, 多 engine UI 增加
  新用户的 cognitive load, 拖慢 Codex 路径的 onboarding QA。
- `opencode` 历史会话使用 `opencode-pending-*` / `opencode:*` threadId 前缀, 在
  `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:1090` 还在写; 历史 session
  loader 在 `src/features/threads/loaders/opencodeHistoryLoader.ts`。这些代码
  的存在让 `useThreads` / `useThreadActions` 的 engine 解析逻辑必须维护 4 路
  switch (claude/codex/opencode/gemini), 而不是 2 路。
- `gemini` engine 的 `gemini_proxy_guard.rs` + `vendors/commands.rs` 内
  `vendor_*_gemini_*` 子段是单独的 proxy/settings 通道, 与 codex 走
  `app-server` / claude 走 `--print` 的路径完全异构, 维护成本不对等。

## 目标

- 从 `src-tauri/src/engine/` 下线 `opencode` + `commands_opencode*` + 全部
  `gemini*` 8 个文件 (10138 行级) 的功能代码, 拆出 mod。
- 从 `src/features/opencode/**` 整个 feature folder 拆出 (2891 行级)。
- 从前端 app shell / composer / settings / i18n / 启动链 / thread loader /
  session action 链路里, 把 `opencode` / `gemini` 的字面量与分支判断清空。
- `AppSettings.opencodeEnabled` + `AppSettings.geminiEnabled` 字段冻结 (保留
  字段在 `~/.ccgui/<provider>/config.json` 兼容老配置, 但默认 false 且不再写入
  UI 状态)。
- `EngineType` 枚举从 4 个值收敛到 2 个 (`Codex` / `Claude`)。
- `src-tauri/src/engine/capability_matrix.rs` 收敛到 2 个 engine。
- `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs` + `engine_bridge.rs` 移除
  opencode/gemini 启动分支。
- `src-tauri/src/local_usage/gemini_sessions.rs` 保留文件但函数体改为 no-op +
  log, 实现 "soft-disable" 历史数据。
- `src/features/threads/loaders/opencodeHistoryLoader.ts` 改为 no-op 返回 `[]`,
  编译期保留类型签名让 `useThreadActions.historyLoaderFactory` 仍可 import。
- 历史 `~/.ccgui/<provider>/threads/opencode-*.jsonl` / `gemini-*.jsonl` 软下线:
  文件**保留在磁盘**, 启动时不再枚举, 用户在 UI 里看不到, 但回滚时只要恢复
  engine 模块即可重新枚举。
- OpenSpec 化: 新增 `engine-deprecation` capability, 写清 REMOVED Requirements。

## 边界

### 必删 (P0)

- **后端 engine 整模块拆出**:
  - `src-tauri/src/engine/opencode.rs` (1809 行)
  - `src-tauri/src/engine/commands_opencode.rs` (931 行)
  - `src-tauri/src/engine/commands_opencode_helpers.rs` (140 行)
  - `src-tauri/src/engine/gemini.rs` (1412 行)
  - `src-tauri/src/engine/gemini_event_parsing.rs` (911 行)
  - `src-tauri/src/engine/gemini_history.rs` (1695 行)
  - `src-tauri/src/engine/gemini_proxy_guard.rs` (139 行)
  - `src-tauri/src/engine/gemini_tests.rs` (856 行)
  - `src-tauri/src/engine/mod.rs` 中 `pub mod opencode;` / `pub mod commands_opencode*;` /
    `pub mod gemini*;` 的 8 行声明
- **前端 feature folder 整拆出**:
  - `src/features/opencode/components/*.tsx` (1525 行, 6 文件)
  - `src/features/opencode/store/*.ts` (74 行, 2 文件含 test)
  - `src/features/opencode/hooks/useOpenCodeControlPanel.ts` (333 行)
  - `src/features/opencode/types/index.ts` (44 行)
- **CSS 拆出**:
  - `src/styles/opencode-panel.css` (915 行) 整文件删
  - `src/styles/composer.part1.css` 中 `.composer-opencode-model-*` /
    `.composer-select-wrap.is-opencode-model-picker` 选择器 (~30 行)
  - `src/styles/sidebar.css` 中 opencode 相关选择器
- **i18n 拆出**:
  - `src/i18n/locales/en.part1-6.ts` / `zh.part1-6.ts` 中所有 `opencode.*` /
    `gemini.*` key, 整段删; 涉及 `canvasCopy.snapshot.test.ts` snapshot
- **设置 / Types**:
  - `src/types.ts:760` `opencodeEnabled: boolean` 字段保留 (兼容老 config), 加
    `#[serde(default)]` 注释 "deprecated v0.5.14, always false"
  - `src/types.ts` 中 `geminiEnabled: boolean` 字段同上保留
  - `src/features/settings/components/settings-view/sections/CodexSection.tsx:1297-1301`
    移除 OpenCode toggle UI
  - `src/features/settings/hooks/useAppSettings.ts:141, 321` 移除这两个字段的
    默认值与 setter 逻辑 (保留读路径, 永远返回 false)
- **EngineSelector / EngineIcon**:
  - `src/features/engine/components/EngineSelector.tsx` 删除 opencode / gemini
    选项
  - `src/features/engine/components/EngineIcon.tsx` 删除 `opencode` /
    `gemini` case 分支
  - `src/features/engine/hooks/useEngineController.ts:394-877` 移除
    `geminiEnabled` / `opencodeEnabled` 派生逻辑
- **Thread 加载 / Action 链路**:
  - `src/features/threads/loaders/opencodeHistoryLoader.ts` 改为 no-op (返回 `[]`)
  - `src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts` 中
    opencode 分支保留 (会调 no-op loader)
  - `src/features/threads/hooks/useThreadActions.opencode-timeout-fallback.test.tsx`
    整文件删
  - `src/features/threads/hooks/useThreadActions.start-fork.test.tsx` /
    `.shared-native-compat.test.tsx` 中 opencode 用例删
- **Session management 后端**:
  - `src-tauri/src/session_management.rs` 中 opencode/gemini 启动分支
  - `src-tauri/src/session_management_types.rs` 中 `OpenCode` / `Gemini`
    SessionKind 枚举值
  - `src-tauri/src/session_management_catalog_projection.rs` /
    `_archive_evidence.rs` / `_tests.rs` / `_archive_delete_tests.rs` 中
    opencode/gemini 分支
  - `src-tauri/src/local_usage/gemini_sessions.rs` 改为 no-op + log
  - `src-tauri/src/local_usage/session_delete.rs` 中 gemini 分支
  - `src-tauri/src/local_usage.rs` 中 gemini 子模块引用
- **App shell / Layout**:
  - `src/app-shell.tsx:559, 579` 中 `opencode` map 分支
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx:677, 1201` 中
    opencode 分支
  - `src/app-shell-parts/manualThreadRecovery.ts:1, 72-73` 移除 opencode
  - `src/app-shell-parts/selectedAgentSession.ts:60, 67-68` 移除 opencode /
    gemini
  - `src/app-shell-parts/useOpenCodeSelection.ts` 整文件删 (含同名 test)
  - `src/app-shell-parts/useCreateSessionLoading.ts:64` 移除 opencode 分支
  - `src/app-shell-parts/useAppShellKanbanComposerSection.ts:171` /
    `useAppShellKanbanExecutionSection.ts:663-923` 中 `opencode-pending-*` 前缀
    判断
  - `src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts` 中
    `resolveThreadEngine` 的 opencode/gemini 分支
- **Tauri IPC**:
  - `src/services/tauri/appServer.ts` 中 opencode / gemini IPC 方法
  - `src/services/tauri/runtimeMode.ts` 中 opencode / gemini 入口
  - `src/services/globalRuntimeNotices.ts:40, 104` 中 engine 类型与 case
- **Composer / ChatInputBox**:
  - `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx` /
    `ProviderSelect.tsx` 中 opencode / gemini provider option
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
    `Composer.tsx` / `ComposerInput.tsx` 中 `engine === "opencode"` /
    `engine === "gemini"` 分支
  - `src/features/composer/components/ChatInputBox/PromptEnhancerDialog.tsx`
    中 gemini engine 提示
  - `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.ts`
    中 gemini engine 适配
  - `src/features/composer/components/ChatInputBox/types.ts` 中
    `"opencode" | "gemini"` 字面量类型
  - `src/features/composer/components/ChatInputBox/modelOptions.ts` 中
    opencode / gemini model 列表
  - `src/features/composer/utils/composerFileReferences.ts` 中
    `engine === "opencode"` 分支
- **Spec Hub / Spec Core**:
  - `src/lib/spec-core/types.ts` 中 opencode 引擎相关
  - `src/features/spec/components/SpecHub.test.tsx` /
    `src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx`
    中 opencode / gemini 分支
- **Vendors (gemini proxy/settings 子段)**:
  - `src-tauri/src/vendors/commands.rs` 中只删除 `vendor_*_gemini_*` handler、
    `GeminiVendor*` schema 与 gemini-only helper
  - `src-tauri/src/vendors/mod.rs` 不删除 `commands` 模块; Claude/Codex provider
    管理继续从该文件导出
- **Daemons**:
  - `src-tauri/src/bin/cc_gui_daemon.rs:753` 中 `opencode` 分支
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:1090` 中
    `opencode:<session_id>` 拼装
  - `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs` 中 opencode / gemini
    启动分支
- **Capability matrix**:
  - `src-tauri/src/engine/capability_matrix.rs` 收敛到 2 engine
  - `src/features/engine/engineCapabilityMatrix.test.ts` 收敛
  - `scripts/check-engine-capability-matrix.mjs` 中 opencode / gemini 校验
- **Engine 后端基础**:
  - `src-tauri/src/engine/claude_forwarder.rs` 中 opencode 转发
  - `src-tauri/src/engine/commands.rs` / `commands_tests.rs` /
    `commands_parse_helpers.rs` / `events.rs` / `manager.rs` / `status.rs`
    中 opencode / gemini 分支
- **Engine selector 测试**:
  - `src/features/engine/components/EngineIcon.test.tsx` 中 opencode / gemini
    断言
  - `src/features/engine/utils/engineAvailability.ts` / `engineLabels.test.ts`
    中 opencode / gemini
- **Settings 测试**:
  - `src/features/settings/hooks/useAppSettings.test.ts` 中
    `opencodeEnabled` 断言
  - `src/features/settings/components/settings-view/sections/CodexSection.test.tsx:45`
  - `src/features/settings/components/SettingsView.test.tsx:213, 1080`
  - `src/services/tauri.test.ts` 中 opencode / gemini mock
- **Thread 集成测试**:
  - `src/features/threads/hooks/useThreadActions.helpers.ts` /
    `useThreadActions.sessionActions.ts` /
    `useThreadActions.lastGoodSnapshots.ts` /
    `useThreadActionsSessionRuntime.ts` /
    `useThreadActionsResumeThread.ts` /
    `useThreadEventHandlers.ts` /
    `useThreadItemEvents.ts` /
    `useThreadMessaging*.ts` /
    `useThreadRealtimeHistoryReconcile.ts` /
    `useThreadTurnEvents.ts` /
    `useThreadTurnSettlementReconciliation.ts` 中 opencode / gemini 分支
  - `src/features/threads/hooks/useThreads*.ts` 中 engine-source 相关
  - `src/features/threads/utils/*` 中 opencode / gemini 分支
  - `src/features/threads/loaders/historyLoaders.fallbacks.test.ts` 中 opencode
- **Workspace / Sidebar**:
  - `src/features/app/components/PinnedThreadList.tsx` /
    `Sidebar.tsx` / `ThreadList.tsx` / `sidebarInternals.ts` 中 opencode /
    gemini 引擎徽标
  - `src/features/app/hooks/useAppServerEvents.ts` /
    `useAppServerEvents.test.tsx` /
    `useGitCommitController.test.tsx` /
    `useSidebarMenus.ts` / `useSidebarMenus.test.tsx` /
    `useWorkspaceActions.ts` / `useWorkspaceActions.test.tsx` 中 opencode /
    gemini 分支
  - `src/features/workspaces/components/WorkspaceHome.tsx` 中 opencode engine
    卡片
- **Commands / Spec Hub hooks**:
  - `src/features/commands/hooks/useCustomCommands.ts` /
    `useCustomCommands.test.tsx` 中 opencode / gemini 命令
- **Context ledger**:
  - `src/features/context-ledger/cost/costAggregate.ts` /
    `costHistoryStore.ts` /
    `costProjection.test.ts` /
    `pricing/fixtures/opencode.ts` (整文件) /
    `pricing/pricingRegistry.ts` /
    `pricing/pricingRegistry.test.ts` /
    `utils/contextLedgerProjection.test.ts` 中 opencode / gemini

### 软下线 (P1, 不删文件 / 函数体改 no-op)

- `src-tauri/src/local_usage/gemini_sessions.rs` 函数体改 no-op + 写一行
  `tracing::warn!`, 保留 `pub fn` 签名
- `src/features/threads/loaders/opencodeHistoryLoader.ts` 改为
  `export async function loadOpencodeHistory(): Promise<Thread[]> { return []; }`,
  保留 export 签名让 historyLoaderFactory 仍可 import
- `AppSettings.opencodeEnabled` / `AppSettings.geminiEnabled` 字段**保留**,
  标记 `#[serde(default)]`, 写注释 "deprecated, always false since v0.5.14"

### 不动 (out of scope)

- `openspec/changes/archive/2026-02-1*` 历史 change 全部不动
- `CHANGELOG.md` 不动 (release commit 时再写 v0.5.14 changelog 行)
- `openspec/specs/opencode-*/spec.md` 暂不删 (archive 步骤同步执行 spec 迁移)
- `translations-additions-*.txt` 不动 (历史文件)
- `scripts/scan-engine-name-branches.{mjs,test.mjs}` 收敛到 2 engine 但
  文件保留 (release pipeline 仍要用)
- Codex / Claude engine 自身代码一字不动

## 验收 Gate

### Gate 1 — Schema / Lock / 校验

- `openspec validate 2026-06-24-retire-opencode-and-gemini-cli --strict --no-interactive` 退出码 0
- `npm run typecheck` 退出码 0
- `npm run lint` 退出码 0
- `npm run test` 退出码 0
- `cargo check --manifest-path src-tauri/Cargo.toml` 退出码 0
- `cargo build --release --manifest-path src-tauri/Cargo.toml` 退出码 0
- `cargo test --manifest-path src-tauri/Cargo.toml` 退出码 0
- `npm run check:runtime-contracts` 退出码 0
- `npm run check:large-files` 退出码 0
- `npm run check:engine-capability-matrix` 退出码 0 (matrix 只剩 2 engine)
- `scripts/scan-engine-name-branches.mjs` 退出码 0 (扫描结果只剩 codex / claude)

### Gate 2 — 行为契约

- 启动客户端 → Settings 页面**没有** OpenCode / Gemini toggle, 任何 `codex` /
  `claude` 切换行为完全不变
- 启动客户端 → 顶部 EngineSelector 下拉**只有** Codex / Claude 两个选项
- 启动客户端 → 老用户 `~/.ccgui/<provider>/config.json` 里有
  `opencodeEnabled: true` 字段 → 启动不报错, 字段被忽略, UI 不显示
- 启动客户端 → 打开 thread list → 不再出现 `opencode-pending-*` /
  `opencode:*` / `gemini-*` 前缀 thread (历史 .jsonl 文件**保留在磁盘**)
- 启动客户端 → 发送任意消息 → Codex / Claude 子进程启动参数**不包含** opencode /
  gemini 相关 flag
- `src-tauri/src/local_usage/gemini_sessions::list_local_gemini_sessions` 调
  用 → 返回空数组 + 一行 `tracing::warn!("gemini_sessions: deprecated since v0.5.14, returning empty")`
- `src/features/threads/loaders/opencodeHistoryLoader::loadOpencodeHistory`
  调用 → 返回 `[]`, 无网络 / 无磁盘读

### Gate 3 — 不回归 (Codex / Claude 双引擎不退化)

- Codex session 创建 / 发送 / 接收 / 中断 / fork / rewind 全场景 e2e 通过
- Claude session 创建 / 发送 / 接收 / 中断 / rewind 全场景 e2e 通过
- 现有 6 个 `engine-capability-matrix` capability 测试 (Codex / Claude) 全
  pass
- daemon `skills_list` (bundled / curated / project / global) 4 个 source 不
  退化
- `app_server_cli.rs` 的 `build_codex_app_server_args` e2e (mock CLI 抓 argv)
  不变
- `claude.rs::build_command` e2e (mock CLI 抓 argv) 不变
- `EngineType` 枚举只剩 `Codex` / `Claude` 两个变体, `serde(rename_all)` 不变

### Gate 4 — 软下线证据

- `find ~/.ccgui/<provider>/threads -name 'opencode-*' -o -name 'gemini-*'`
  在客户端安装 v0.5.14 后**仍然存在** (软下线, 不删盘)
- 启动客户端 v0.5.14 → 老 opencode .jsonl 不会被新启动读取, 也不会被删除
- 在 dev 模式 console / dev tools log 里看到:
  `gemini_sessions: deprecated since v0.5.14, returning empty` (1 次 / 启动)
  `opencodeHistoryLoader: deprecated since v0.5.14, returning empty` (1 次 /
  启动)

### Gate 5 — Release Pipeline

- `npm run tauri:dev` 在 macos aarch64 启动后, 4 步用户路径通过:
  1. 启动看到双引擎选择
  2. 切换 Codex → 创建 session → 发送消息 → 收流式输出
  3. 切换 Claude → 创建 session → 发送消息 → 收流式输出
  4. Settings 页面无 OpenCode / Gemini 区块
- `cargo build --release` 在 macos aarch64 退出码 0, 产物 `cc-gui.d` /
  `cc_gui_daemon` 大小比 v0.5.13 缩减 (粗估 >= 8%)

## 风险与回退

- **风险 1**: settings 字段 `opencodeEnabled` / `geminiEnabled` 完全移除会破坏
  老用户 `~/.ccgui/<provider>/config.json` 反序列化。**缓解**: 字段保留, 标
  `#[serde(default)]` + Rust 端加 `#[allow(dead_code)]` 注释, 写一行
  `tracing::warn!("AppSettings.opencodeEnabled is deprecated and ignored since v0.5.14")`。
- **风险 2**: `EngineType` 枚举删 `OpenCode` / `Gemini` 变体, 老 JSONL 历史
  里的 `engine: "opencode"` 字段反序列化失败。**缓解**: Rust 端
  `EngineType` 自定义 `Deserialize` —— 遇到未知 engine 时默认 `Codex` + warn,
  不报错; 同时保留 4 路 → 2 路的兼容转换函数
  `EngineType::legacy_from_str(s: &str) -> EngineType`。
- **风险 3**: opencode/gemini 删了, 但误删 `vendors/commands.rs` 会牵连
  Claude/Codex provider 管理 IPC。**缓解**: 文件保留,只删 `vendor_*_gemini_*`
  3 个 IPC 与 gemini-only helper/schema; 删之前跑 `rg -n "vendor_.*gemini|GeminiVendor|gemini_preflight" src-tauri/src/vendors src/services`
  列出精确调用点。
- **风险 4**: thread ID 前缀 `opencode:*` / `opencode-pending-*` / `gemini:*`
  在 `selectedAgentSession.ts` / `manualThreadRecovery.ts` /
  `useAppShellKanbanExecutionSection.ts` 等多处出现, 一旦删不彻底, 老用户
  残留 thread 启动时会 crash。**缓解**: 在
  `selectedAgentSession.resolveThreadEngine` 兜底:
  ```ts
  if (threadId.startsWith("opencode:") || threadId.startsWith("opencode-pending-")) {
    return "codex"; // legacy fallback since v0.5.14
  }
  ```
  保留兜底分支 1 个 release, v0.5.15 再删。**注意**: 此兜底分支**保留**
  在 v0.5.14, 标记 "legacy fallback, scheduled removal v0.5.15"。
- **风险 5**: `src-tauri/src/local_usage.rs` 中 `gemini_sessions` 是子模块,
  改 no-op 时需要保留 mod 声明让其它引用点 (如果存在) 仍能编译。**缓解**:
  保留 `pub mod gemini_sessions;` 在 `local_usage.rs`, 内部函数体改 no-op;
  写注释 `// deprecated since v0.5.14, scheduled removal v0.5.15`。
- **风险 6**: e2e 跑通后, 但 `useThreadActions.opencode-timeout-fallback.test.tsx`
  等 opencode-specific 测试被删, 回归覆盖缩水。**缓解**: 在 Codex /
  Claude 的 `timeout-fallback` 测试里加等价的"超时降级"断言, 文档说明
  opencode 那条测试路径已无对应生产代码, 删合理。
- **风险 7**: `context-ledger/pricing/fixtures/opencode.ts` 整文件删, 但
  `pricingRegistry.ts` 可能还有 `for engine in ["codex", "claude", "opencode"]`
  循环。**缓解**: 删 fixtures 时同步收敛 `pricingRegistry.ts` 的循环到 2 个
  engine, 跑现有 `pricingRegistry.test.ts` 守门。
- **回退 (a) 编译期**: 如果某个 engine 文件删了之后 panic, 临时 git revert
  本次 commit 的对应文件即可; 软下线文件 (`opencodeHistoryLoader` /
  `gemini_sessions`) 函数体 no-op, revert 一行就能恢复。
- **回退 (b) 行为期**: 如果用户报"我的老 opencode thread 没了", 用
  `opencodeHistoryLoader` 临时改回**真的**读盘逻辑 (2 行代码), 加 flag
  `legacy_opencode_history_loaded_v0514` 即可。
- **回退 (c) 数据期**: 软下线策略保证 `~/.ccgui/<provider>/threads/opencode-*.jsonl`
  文件不被删, 完全回滚到 v0.5.13 即可重新枚举 (因为文件还在)。
