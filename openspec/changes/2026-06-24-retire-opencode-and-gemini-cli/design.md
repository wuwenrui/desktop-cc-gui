# Design: 客户端下线 OpenCode / Gemini CLI 引擎 (retire-opencode-and-gemini-cli)

## Context

`mossx` v0.5.13 桌面客户端 (`ccgui@0.5.13`) 当前的 engine 矩阵是 4 路:
`codex` (走 `app-server` 子进程) / `claude` (走 `--print` 子进程) /
`opencode` (走独立 engine module) / `gemini` (走独立 engine module +
`vendors/commands.rs` 内 gemini-only proxy/settings 子段)。

**关键架构事实** (基于真实代码证据):

- **`EngineType` 枚举** 在 `src-tauri/src/engine/mod.rs`, 当前 4 个变体
  `Codex` / `Claude` / `OpenCode` / `Gemini`, 通过 `serde(rename_all = "...")`
  序列化到 `.jsonl` 历史。
- **`AppSettings`** 在 `src-tauri/src/types.rs`, 字段:
  - `opencode_enabled: bool` (line 909, `#[serde(default = "default_opencode_enabled", rename = "opencodeEnabled")]`)
  - `gemini_enabled: bool` (类比)
  - 这两个字段是 `useEngineController` / `useAppSettings` 派生 `enabledEngines`
    的输入, 进而控制 `EngineSelector` UI 可见性与 `app-shell.tsx:559` 的
    `enabled: appSettings.opencodeEnabled !== false` map。
- **`capability_matrix.rs`** 集中描述每个 engine 的 capability (supports_code_mode,
  supports_session_fork, ...), 配套测试在
  `src/features/engine/engineCapabilityMatrix.test.ts` 和
  `scripts/check-engine-capability-matrix.mjs`, 包含 4 个 engine 的 fixtures。
- **Thread 加载链路**:
  - `opencodeHistoryLoader.ts` 真实读盘, 跟 `claudeHistoryLoader` /
    `codexHistoryLoader` 并列
  - `useThreadActions.historyLoaderFactory.ts` 根据 `engine` 字段 dispatch
  - thread ID 前缀: `claude-*` / `codex-*` / `opencode:*` / `opencode-pending-*` /
    `gemini:*`, 在 `selectedAgentSession.resolveThreadEngine` 里硬编码 switch
- **后端历史会话管理**:
  - `src-tauri/src/local_usage/gemini_sessions.rs` 读
    `~/.ccgui/<provider>/threads/gemini-*.jsonl` 真实数据
  - `src-tauri/src/session_management.rs` + `_types.rs` 中
    `SessionKind::OpenCode` / `SessionKind::Gemini` 走独立路径
  - `src-tauri/src/session_management_catalog_projection.rs` 在
    catalog 里给每个 engine 一个 source tag
- **Vendors proxy/settings 子段**:
  - `src-tauri/src/vendors/commands.rs` 同时承载 Claude/Codex provider 管理与
    gemini-only proxy/settings; 本变更只删除 gemini-only 子段
  - gemini-only 子段与 `app_server_cli.rs` (Codex) / `claude.rs` (Claude)
    完全异构, 是 gemini 删起来最重的共享文件部分
- **Daemon**:
  - `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:1090` 还在写
    `opencode:<session_id>` threadId
  - `src-tauri/src/bin/cc_gui_daemon/engine_bridge.rs` 4 路 engine 启动
  - `src-tauri/src/bin/cc_gui_daemon.rs:753` 中 `opencode` 分支
- **CSS 隔离**:
  - `src/styles/opencode-panel.css` 整文件 915 行
  - `src/styles/composer.part1.css` 中 `.composer-opencode-model-*` / `.is-opencode-model-picker`
- **i18n 隔离**:
  - `src/i18n/locales/{en,zh}.part{1..6}.ts` 中 `opencode.*` / `gemini.*` 整段
  - `canvasCopy.snapshot.test.ts` 锁住 i18n snapshot
- **Settings 隔离**:
  - `src/features/settings/components/settings-view/sections/CodexSection.tsx:1297-1301`
    `opencodeEnabled` toggle
  - `src/features/settings/hooks/useAppSettings.ts:141, 321` 字段默认值 + setter
- **Context ledger pricing**:
  - `src/features/context-ledger/pricing/fixtures/opencode.ts` 整文件
  - `pricingRegistry.ts` 循环注册 4 engine

## Goals / Non-Goals

**Goals**:

- **后端 8 个 engine 文件**整模块拆出 `src-tauri/src/engine/`, `mod.rs` 中
  8 行 `pub mod` 声明同步删
- **前端 `src/features/opencode/**`** 整 folder 拆出 (1525+74+333+44 = 1976 行
  生产代码 + 257 行 test)
- **CSS 整文件删** `opencode-panel.css`, 收敛 `composer.part1.css` /
  `sidebar.css` 中相关选择器
- **i18n** 整段删 `opencode.*` / `gemini.*` key, 更新 snapshot
- **Settings** 移除 OpenCode / Gemini toggle UI, 保留 settings 字段兼容老
  config
- **App shell / Composer / Thread / Sidebar / Spec hub / Commands / Context
  ledger** 全链路分支收敛到 `codex` / `claude` 二元
- **`EngineType` 枚举** 收敛到 2 个变体, 自定义 `Deserialize` 兜底未知
  engine 字符串 → `Codex`
- **历史会话软下线**: `opencodeHistoryLoader` + `gemini_sessions` 函数体
  no-op, 磁盘文件保留
- **OpenSpec 化**: 新增 `engine-deprecation` capability, 写清 REMOVED
  Requirements + 新约束 (双引擎契约)

**Non-Goals**:

- 不删 `~/.ccgui/<provider>/threads/opencode-*.jsonl` / `gemini-*.jsonl`
  磁盘文件
- 不删 `AppSettings.opencodeEnabled` / `gemini_enabled` 字段 (兼容老 config)
- 不改 `CHANGELOG.md` (release commit 时再写)
- 不重写 Codex / Claude engine 任何代码
- 不动 daemon `skills_list` 4 个 source 行为
- 不动 `app_server_cli.rs` / `claude.rs` 子进程 args 拼装
- 不改 `EngineType` 序列化名 (Codex / Claude 保留, 移除 OpenCode / Gemini)
- 不实现"恢复"机制 (软下线文件保留 = 隐性回滚, 不显式提供 toggle)
- v0.5.14 不删 `selectedAgentSession` 中 `opencode-pending-*` 兜底分支
  (v0.5.15 再删)

## Decisions

### Decision 1: 后端 engine 模块采用"整模块拆出"而非"逐函数拆出"

`src-tauri/src/engine/opencode.rs` (1809 行) /
`commands_opencode.rs` (931 行) /
`commands_opencode_helpers.rs` (140 行) /
`gemini.rs` (1412 行) /
`gemini_event_parsing.rs` (911 行) /
`gemini_history.rs` (1695 行) /
`gemini_proxy_guard.rs` (139 行) /
`gemini_tests.rs` (856 行) 整文件 `git rm`, 同时 `mod.rs` 删 8 行 `pub mod`
声明。

**原因**: 这 8 个文件之间互相 import, 任何"留 1 个文件拆出 N 行"策略都会
留下 forward declaration 死代码 + 编译期 cfg flag, 维护成本高于一次清空。
**回滚**: 软下线特性保证可以 git revert 这 8 个文件 + mod.rs 8 行即可恢复。

**备选**:

- A. 留 `pub mod opencode;` 但函数体改 `unimplemented!()`: 留下死代码 +
  panic 风险 → reject
- B. 走 `#[cfg(feature = "opencode")]` feature flag: 增加 release pipeline
  复杂度, 客户端不需要动态切换 → reject
- C. 拆到 `src-tauri/src/_deprecated_engines/` 子目录: 给后续考古留余地,
  但增加 workspace 噪音 → reject, 采用整文件删

### Decision 2: 前端 `src/features/opencode/**` 整 folder `git rm`

包含 `components/` (6 文件 1525 行) / `store/` (2 文件 74 行) /
`hooks/useOpenCodeControlPanel.ts` (333 行) / `types/index.ts` (44 行) /
2 个 test 文件。**不留 alias 文件**, 直接 `git rm -r src/features/opencode`。

**原因**: 整 feature folder 没有外部依赖 (无 plugin, 无 IPC 必填),
Web 端 / Tauri 端都没有第三方 import 它 (用 `rg -n "from.*features/opencode"`
会确认, 见 task 0.3)。

**备选**:

- A. 留 `index.ts` 导出空 type, 兼容老 import: 加 future dead code → reject
- B. 拆到 `src/features/_deprecated_engines/opencode/`: 同 Decision 1 C, 噪
  音大于价值 → reject

### Decision 3: `AppSettings.opencodeEnabled` / `geminiEnabled` 字段**保留但冻结**

```rust
// src-tauri/src/types.rs
#[serde(default = "default_opencode_enabled", rename = "opencodeEnabled")]
#[allow(dead_code)] // deprecated since v0.5.14, always false
pub opencode_enabled: bool,
```

`useAppSettings.ts` 的 default 改成 `false` (原本是 `false`, 已是),
setter 路径里 `opencodeEnabled: settings.opencodeEnabled === true` 改成
`opencodeEnabled: false` (硬编码 false, 永远不写 true)。
Rust 端读 config 反序列化时如果遇到 `opencodeEnabled: true`, 写一行
`tracing::warn!` 但不报错。

**原因**: 老用户 `~/.ccgui/<provider>/config.json` 里的 `opencodeEnabled: true`
必须能正常反序列化, 不能 panic; 但 UI 不再暴露 toggle, 用户没法"打开"。

**回滚**: 删字段 + 加 `#[serde(default)]` 兜底默认值是 v0.5.15 的清理
目标, 这次不动。

### Decision 4: `EngineType` 枚举收敛到 2 变体, 自定义 `Deserialize` 兜底

```rust
// src-tauri/src/engine/mod.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineType {
    Codex,
    Claude,
    // OpenCode, Gemini removed in v0.5.14
}

// 兼容老 JSONL: 遇到 "opencode" / "gemini" 字符串时 fallback 到 Codex
impl<'de> Deserialize<'de> for EngineType {
    // ... custom, 未知字符串 -> Codex + tracing::warn!
}
```

注意: 这里不能同时 derive `Deserialize` 与手写 `impl Deserialize`。也不使用
`#[serde(other)]` enum variant,因为本轮目标是保持 public enum 只有 `Codex` /
`Claude` 两个业务变体,并在 fallback 时记录原始 legacy string。

**原因**: 老用户的 opencode / gemini .jsonl 文件保留在磁盘, 反序列化时
不能让客户端启动 panic。

**回滚**: 反序列化兜底逻辑 v0.5.15 仍可保留 (防御老 .jsonl 文件),
v0.5.16 视情况删。

### Decision 5: 软下线 `opencodeHistoryLoader` + `gemini_sessions` 走 no-op + warn

```ts
// src/features/threads/loaders/opencodeHistoryLoader.ts
export async function loadOpencodeHistory(): Promise<Thread[]> {
  if (import.meta.env.DEV) {
    console.warn("opencodeHistoryLoader: deprecated since v0.5.14, returning empty");
  }
  return [];
}
```

```rust
// src-tauri/src/local_usage/gemini_sessions.rs
pub fn list_local_gemini_sessions(_root: &Path) -> Vec<LocalSessionMeta> {
  tracing::warn!("gemini_sessions: deprecated since v0.5.14, returning empty");
  Vec::new()
}
```

**原因**: 文件**保留** (不 git rm), 签名**保留** (让 historyLoaderFactory /
session_delete 仍可 import), 函数体 no-op, 启动时记一行 warn, 后续 release
(>= v0.5.15) 真删时一次性清空。

**回滚**: 软下线状态下, 把 no-op 改回真实读盘逻辑 = 1-2 行代码即可,
比"删了再 git revert"成本低。

### Decision 6: `selectedAgentSession.resolveThreadEngine` 保留 `opencode-pending-*` 兜底

```ts
function resolveThreadEngine(threadId: string): "claude" | "codex" | null {
  if (threadId.startsWith("claude-")) return "claude";
  if (threadId.startsWith("codex-")) return "codex";
  // Legacy fallback: opencode / gemini threadId 视为 codex (since v0.5.14)
  // 软启动后老 thread 不 panic, scheduled removal v0.5.15
  if (threadId.startsWith("opencode-pending-") || threadId.startsWith("opencode:") ||
      threadId.startsWith("gemini:")) {
    return "codex";
  }
  return null;
}
```

**原因**: 老用户磁盘上的 `opencode-*.jsonl` 文件在 daemon 启动 /
thread 列表加载 / 手动恢复等路径上还会被读到, 一旦 `resolveThreadEngine`
返回 `null` → 上游会 fall through, 行为不一定是 crash, 但 "显示"
或 "send" 行为可能不预期。兜底为 `codex` 至少不 panic。

**回滚**: 兜底分支在 v0.5.14 显式保留, v0.5.15 跟软下线文件一起删。

### Decision 7: `vendors/commands.rs` 仅拆出 gemini-only 子段

`src-tauri/src/vendors/commands.rs` 保留文件,只删除 gemini-only 段:
`vendor_get_gemini_settings` / `vendor_save_gemini_settings` /
`vendor_gemini_preflight` 3 个 IPC handler,对应 `GeminiVendor*` schema,
以及 `normalize_gemini_auth_mode` / `default_gemini_auth_mode` 等 helper。
Claude/Codex provider 管理 IPC 必须保持不变。

**前提验证** (task 0.4): `rg -n "vendor_.*gemini|GeminiVendor|gemini_preflight" src-tauri/src src/services`
列出所有 gemini-only 调用点; 不允许用整文件删除替代逐段删除。

**回滚**: 恢复 gemini-only 段 = git revert `vendors/commands.rs` 相关 hunk
+ `command_registry.rs` / `src/services/tauri/vendors.ts` 对应 hunk。

### Decision 8: CSS 收敛方案

- `src/styles/opencode-panel.css` 整文件 `git rm` (915 行)
- `src/styles/composer.part1.css` 中 `.composer-opencode-model-*` / `.is-opencode-model-picker`
  5 段选择器删除 (~30 行)
- `src/styles/sidebar.css` 中 opencode 相关选择器删除 (具体行数见 task 0.5
  扫描结果, 预估 ~20 行)

**回滚**: 整文件 + 选择器段恢复 = git revert 3 files。

### Decision 9: i18n 段整段删 + snapshot 同步

`src/i18n/locales/en.part{1..6}.ts` / `zh.part{1..6}.ts` 中所有
`opencode:` / `gemini:` 段删, 跑 `canvasCopy.snapshot.test.ts` 自动
regenerate snapshot。

**原因**: snapshot 锁住 i18n 不变, 删 key 后必然需要 update snapshot。

### Decision 10: capability_matrix 与 scan-engine-name-branches 同步收敛

- `src-tauri/src/engine/capability_matrix.rs` 删 `OpenCode` / `Gemini`
  2 个 engine 的 capability 描述
- `src/features/engine/engineCapabilityMatrix.test.ts` 删对应 test 用例
- `scripts/check-engine-capability-matrix.mjs` 删对应 fixture 行
- `scripts/scan-engine-name-branches.{mjs,test.mjs}` 收敛到 2 engine
  扫描 (硬编码数组 `["codex", "claude"]`)

**注意**: `scripts/scan-engine-name-branches` 是 release pipeline 必跑,
不能整文件删, 只能收敛逻辑。

## 实施顺序 (Stage Order)

按"依赖最小 → 风险最大"反序排列:

1. **Stage 0 — Baseline (前置证据)**: 落 `docs/retire/v0.5.14-baseline.md`,
   记录 (1) 当前 4 engine 调用图 (2) 老 .jsonl 数量 (3) settings 字段
   出现位置清单 (4) `rg -n` vendors 唯一调用点 (5) CSS 选中器行数

2. **Stage 1 — 类型层先动 (低风险)**: 改 `EngineType` 自定义 `Deserialize`
   + 删 OpenCode / Gemini 变体; 改 `AppSettings.opencodeEnabled` /
   `geminiEnabled` setter 永远返回 false

3. **Stage 2 — 后端 engine 整模块拆出 (中风险)**: `git rm` 8 个 engine
   文件 + `mod.rs` 8 行; `vendors/commands.rs` 仅删 gemini-only 段;
   改 daemon / daemon_state / engine_bridge 4 → 2

4. **Stage 3 — 后端 session / local_usage 软下线 (低风险)**: 改
   `gemini_sessions.rs` 函数体 no-op; 改 `session_management_types.rs`
   删 SessionKind 变体 (带 Deserialize 兜底)

5. **Stage 4 — 前端 feature folder 整拆出 (中风险)**: `git rm -r
   src/features/opencode/**`

6. **Stage 5 — App shell / Composer / Settings / i18n / CSS (中风险)**:
   收敛 `app-shell.tsx` / `app-shell-parts/` / `composer/` /
   `chat-input-box/` / `settings/` / `i18n/locales/` /
   `styles/composer.part1.css` / `styles/sidebar.css`

7. **Stage 6 — Thread / Sidebar / Spec hub / Commands / Context ledger
   (高风险)**: 收敛 `features/threads/` / `features/app/` /
   `features/spec/` / `features/commands/` / `features/context-ledger/`

8. **Stage 7 — 兜底 + 反序列化测试 (低风险)**: 加 `selectedAgentSession`
   兜底分支 + EngineType 自定义 Deserialize 单测; 跑 `npm run test` 验证
   反序列化

9. **Stage 8 — 不回归 gate (高风险)**: 跑 Codex / Claude e2e +
   capability matrix 6 个 + scan-engine-name-branches 0 命中 opencode/gemini

10. **Stage 9 — Archive (低风险)**: `openspec validate` 通过 →
    `openspec archive` 同步 spec delta + 更新 `openspec/project.md`

## 验证 / 风险守门

### 验证 Gate (重提 proposal §验收 Gate, 列出关键)

- `npm run typecheck && npm run lint && npm run test` 全 0
- `cargo check && cargo build --release && cargo test` 全 0
- `npm run check:engine-capability-matrix` 0 (matrix 2 engine)
- `scripts/scan-engine-name-branches.mjs` 0 (除 codex / claude 外无
  active engine 引用)
- `rg -n "\bopencode\b|\bgemini_cli\b|\bgemini-cli\b|\bgeminiCli\b" src/ src-tauri/src/ --type ts --type tsx --type rust`
  命中 0 (docs / archive / openspec/changes/archive 除外)

### 风险守门 (开发期间持续跑)

- 任何 `git rm` 一个 engine 文件后, 立刻跑 `cargo check` 看 break
- 任何 `git rm` 一个 feature folder 后, 立刻跑 `npm run typecheck` 看
  dangling import
- 任何 i18n key 删了, 立刻跑 `npm run test -- canvasCopy.snapshot`
  看 snapshot diff
- 兜底分支 `selectedAgentSession.resolveThreadEngine` 必须有
  Vitest case: 输入 `"opencode:session-1"` → 输出 `"codex"`, 验证兜底
  行为
- `EngineType::legacy_from_str("opencode")` 单测: 返回 `Codex` +
  `tracing::warn!` 至少被 mock 触发 1 次

## 关联 spec delta

新增 capability: `engine-deprecation`, 写清 REMOVED Requirements
(opencode-engine, gemini-cli-engine, opencode-history, gemini-history)
+ ADDED Requirements (legacy-fallback, deserialization-compat,
disk-preservation, dual-engine-onboarding)。

## 后续清理 (out of scope of v0.5.14)

- v0.5.15: 删 `opencodeHistoryLoader.ts` / `gemini_sessions.rs` 软下线
  文件
- v0.5.15: 删 `AppSettings.opencodeEnabled` / `geminiEnabled` 字段
  (v0.5.14 留兼容层)
- v0.5.15: 删 `selectedAgentSession.resolveThreadEngine` 中
  `opencode-pending-*` / `gemini:*` 兜底分支
- v0.5.16: 删 daemon / engine_bridge 兜底分支
- v0.5.17: 提供一次性"清理历史 .jsonl"用户操作 (Settings 里有
  "Purge legacy data" 按钮, 调用 `rm -rf opencode-*.jsonl gemini-*.jsonl`)
