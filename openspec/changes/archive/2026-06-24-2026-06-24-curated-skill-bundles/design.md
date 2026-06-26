# Design: 内嵌精选 skill 库 + 对话框 quick-load

## Archive Reconciliation — 2026-06-25

本 design 记录的是第一版方案。最终实现保留了 curated skill asset / lock / Settings / engine injection 底座，但不再采用
composer chip row / picker。最终用户模型是：Settings > Skills 中开启 curated skill，之后所有新 engine launch 默认注入；composer
只显示 read-only `CuratedSkillIndicator`，并通过 `ComposerReadinessBar.rightAccessory` 挂在 readiness bar 右侧。

另外，当前代码为了避免 Codex app-server 长生命周期持有旧 `developer_instructions` 快照，已经把
`enabled_curated_skill_ids` 纳入 restart 判定；这 supersedes 本 design 早期“不触发 restart”的假设。

## Historical Design Below

以下内容保留第一版 design 原文用于审计。凡涉及 composer chip row / picker、`--append-system-prompt-file`、或“toggle 不触发 Codex restart”的描述，均已被本节上方的 archive reconciliation 与后续 change supersede。

## Context

`desktop-cc-gui` (mossx) 是 Tauri 2.9.6 + React 19 + Vite 7 的桌面客户端,承载 Codex CLI 与 Claude Code CLI 双引擎。**关键架构事实**(基于真实代码证据):

- **Codex 引擎走子进程 + `codex app-server`**:进程参数在 `src-tauri/src/backend/app_server_cli.rs:631` 的 `build_codex_app_server_args` 拼,system prompt 通过 `-c developer_instructions="..."` 子进程 args 注入(看 `src-tauri/src/codex/collaboration_policy.rs:171` 的 `merge_developer_instructions`)
- **Claude 引擎走 `claude -p` print mode**:args 在 `src-tauri/src/engine/claude.rs:814` 的 `build_command` 拼,user prompt 走 stdin(`--input-format stream-json`),system prompt 由 Claude CLI 自身从 `CLAUDE.md` / 自身配置读
- **客户端没有 `buildSystemPrompt` 函数** — system prompt **不是客户端拼的**;`AGENTS.md` 走 `src-tauri/src/files/io.rs` 的 `read_text_file_within` 是给 UI 文件预览用,不是 prompt 注入
- **Skill list 走 `skills_list_local_core`**(`src-tauri/src/skills.rs:447`):12 个 source 扫描,被 Tauri command path 和 daemon binary path 共用
- **双 binary 架构**:`src-tauri/src/bin/cc_gui_daemon.rs` 是独立 daemon 进程,有自己的 `skills_list` handler(`daemon_state.rs:2618-2660`),daemon 模式无 webview,只服务 remote backend 场景
- **`AppSettings` 持久化在 `~/.ccgui/<provider-home>/config.json`**,有 60+ 字段
- **`app_settings_change_requires_codex_restart`**(`src-tauri/src/shared/settings_core.rs:299-321`):变更某些字段会强制重启 Codex session(当前判定 4 个字段:proxy / unified_exec / auto_compaction × 2),`enabled_curated_skill_ids` **不能**进入这个函数
- **`bundle.resources` 是对象 schema**(`tauri.conf.json:36-40`),不是数组 — `{ "glob": "dest" }`
- **Composer 主组件在 `src/features/composer/components/ChatInputBox/index.tsx`**,输入框与发送按钮之间有 `ChatInputBoxFooter` / `MessageQueue` 等子组件,新增 chip 行要在它们之间插
- **`SkillsSection.tsx` 1289 行**,已支持 `embedded` 双模式 + tree pane resize + file editor + custom dirs 管理 + engine 切换,**没有"桶"概念**,`engineSkills` 是一个扁平 filter 结果 — 不能"加一个桶"就完事
- **没有 `app-settings-changed` 事件**,settings 变更通过 `updateAppSettings` invoke 返回新 `AppSettings` + 前端 `useAppSettings` hook state 同步;**新字段沿用此 pattern,不新增事件**
- **`lucide-react` import 路径是 `lucide-react/dist/esm/icons/<name-kebab-case>`**(`SkillsSection.tsx:13-22`),不是 `from "lucide-react"`,提案里 metadata `icon` 字段用 kebab-case
- **`skills-lock.json` 现有 9 个 `vercel-labs/agent-skills` + `huashu-design` entry**是占位,资产**没真落盘**;`build.rs` 校验只针对 `kind == "curated"` entry,`kind == "bundled"` 或无 `kind` 字段的 entry 跳过

`useSkills` hook 当前接 `startupOrchestrator`,通过 `idle-prewarm` + `on-demand` 双阶段拉取,`src/features/skills/hooks/useSkills.ts:108-145` 是核心。`useCuratedSkills` 复用相同模式但走 `global` scope(因为 curated 是 workspace 无关)。

## Goals / Non-Goals

**Goals:**

- 资产层用 `src-tauri/resources/curated-skills/<name>/` + 在 `skills-lock.json` 扩展 `kind: "curated"` 字段模式,**编译时校验** hash
- 后端扫描时把 curated 桶合并进 `SkillEntry` 列表,`source = "curated_bundled"`,`enabled` 字段由 `enabled_curated_skill_ids` 算出
- `AppSettings.enabled_curated_skill_ids` 持久化跨 workspace / 跨会话,**不触发 Codex restart**
- Composer 下方新增 chip 行,实时反映启用状态
- **Codex 注入**:走 `-c developer_instructions="<merged>"` 子进程 args,与 `collaboration_policy::merge_developer_instructions` 复用 merge 逻辑 + `app_server_cli.rs:614` 的 `encode_toml_string` TOML escape
- **Claude 注入**:走 `--append-system-prompt <body>`(直接传字符串,不写 temp file;真实 Claude CLI 默认模式不支持 `--append-system-prompt-file` 已在 `claude --help` 验证)
- 行为契约 OpenSpec 化

**Non-Goals:**

- 不实现强度档 / slash 命令
- 不做用户反馈 / 自动更新
- 不做实时 token 计费(经验值 chars/3 偏差)
- 不支持运行时下载
- 不支持按 workspace 隔离
- 不重做 `useSkills` 对外契约(只 additive 加 `enabled: boolean` 可选字段)
- 不重做 `SkillsSection` 1100+ 行逻辑(新加 `CuratedSection` 并列渲染)
- 不在 MVP 重做 `lucide-react` icon 白名单
- 不动 `BatchedTauriEventSink` / `app-server-event-batching`

## Decisions

### Decision 1: 资产放 `src-tauri/resources/curated-skills/`,通过 Tauri `bundle.resources` 打包(对象 schema)

`tauri.conf.json` 的 `bundle.resources` 数组新增(实际是对象,key=glob,value=destination dir):

```json
"resources": {
  "infoplist/**/*": "./",
  "../dist/*": "dist/",
  "../dist/assets/**/*": "dist/assets/",
  "resources/curated-skills/**/*": "curated-skills/",
  "../skills-lock.json": "."
}
```

**原因**: Tauri 标准资源路径,`tauri build` 自动打进 `.app.tar.gz` / `.msi` / `.deb` / `.AppImage`,运行时 `app.path().resource_dir()` 拿到绝对路径。**比 `vendor/curated-skills/` 优势**: 跟应用包一体,卸载客户端自动清,不会残留。

**备选**:

- 放 `vendor/curated-skills/`,运行时用 `CARGO_MANIFEST_DIR` 找:开发模式可工作,生产模式路径错乱 → reject
- 放用户家目录 `~/.mossx/curated-skills/`:违反"客户端自带"语义 → reject
- 走 `include_bytes!` 嵌入二进制:失去 SKILL.md 可读性,无法做 hash 校验 → reject

### Decision 2: `src-tauri/build.rs` 编译时校验 hash,只对 `kind == "curated"` 校验

`build.rs` 新增 step:

1. 读 `skills-lock.json`
2. 对每个 `kind == "curated"` 的 entry 重算 `assetPath` 的 sha256
3. 与 `computedHash` 不一致 → `compile_error!("curated skill lock hash mismatch for {}: expected {}, got {}", name, lock_hash, actual_hash)`
4. 检查 `metadata.json` 的 schema 完整性(`name` / `version` / `license` 非空,`license` 在白名单)
5. 检查 `assetPath` 不含 `..` 或绝对路径
6. **`kind == "bundled"` 或无 `kind` 字段的 entry 跳过校验**(老 entry 占位资产不存在,等下一个 change 处理)
7. 用 `println!("cargo:rerun-if-changed=src-tauri/resources/curated-skills")` + `rerun-if-changed=skills-lock.json` 限定监听范围

**原因**: 编译时校验 = "stale curated lock 不可能发版"。

**备选**:

- CI check:增加 CI 时间,本地 `cargo check` 不会触发 → reject
- `cargo test` 校验:不进 release 二进制 → reject
- 校验所有 9 个老 entry:它们资产没落盘,`compile_error!` 会让当前 release 不可行 → reject,改只校验 curated

### Decision 3: 扩展 `skills-lock.json` 用 `kind` 字段区分,不复用 `skills-curated-lock.json`

`skills-lock.json` 顶层加 `version: 2`,每个 entry 加 `kind` 字段(老 entry 默认 `"bundled"`):

```json
{ "version": 2, "skills": {
  "deploy-to-vercel": { "kind": "bundled", ... },
  "lazy-senior-dev": { "kind": "curated", ... }
}}
```

**原因**: 单 lock 文件 = 单一事实源。命名冲突(`skills-curated-lock.json` vs `skills-lock.json`)会让 PR review 混乱。前端 `useCuratedSkills` 按 `kind == "curated"` 过滤,后端 `build.rs` 同理。

**备选**:

- 新建 `skills-curated-lock.json`: 重复事实源,PR review 容易漏改 → reject
- 复用现有 entry 不加 `kind`: `build.rs` 无法区分"已落盘" vs "占位" → reject

### Decision 4: `AppSettings.enabled_curated_skill_ids` 不进 `app_settings_change_requires_codex_restart` 字段集合

`src-tauri/src/shared/settings_core.rs:299-321` 现有判定 4 个字段(proxy / unified_exec / auto_compaction × 2)。**新字段 `enabled_curated_skill_ids` 不进入此函数** — 用户 toggle curated skill 不应该触发 Codex session 重启(system prompt 在子进程下次 spawn 时拼,无 restart 必要)。

**关键测试守门**:在 `src-tauri/src/shared/settings_core.rs` 现有 test 段加一个 case:
```rust
#[test]
fn enabled_curated_skill_ids_change_does_not_trigger_codex_restart() {
    let mut previous = AppSettings::default();
    let mut updated = AppSettings::default();
    updated.enabled_curated_skill_ids = vec!["lazy-senior-dev".to_string()];
    assert!(!app_settings_change_requires_codex_restart(&previous, &updated));
}
```

**原因**: Codex session 重启 = 用户等待 + 上下文丢失,**绝对不能让 toggle curated skill 触发**。

### Decision 5: Codex 注入走 `-c developer_instructions` 完整 merge 流程,Claude 注入走 `--append-system-prompt <body>`

**Codex 路径**(完整调用流程,基于真实代码指针):

1. **新工具函数**(放 `src-tauri/src/backend/app_server_cli.rs`,与 `codex_args_contain_instruction_override` 同级):
   - `extract_existing_developer_instructions(args: &[String]) -> Option<String>` — 解析已传入的 `-c developer_instructions="..."` / `--config developer_instructions=...` / `-c instructions="..."` 形式,返回 existing value 的 unescaped 字符串。无 override 时返回 `None`
   - `codex_curated_skills_config_arg(app_settings: &AppSettings, existing: Option<&str>) -> Option<String>` — 主拼装函数,见下方伪代码

2. **完整调用伪代码**(集成到 `build_codex_app_server_args` 末尾、`args.push("app-server".to_string())` 之前):
   ```rust
   // 1. 解析 user codex_args, 拿已有 developer_instructions
   let existing_dev_instr = extract_existing_developer_instructions(&args);

   // 2. 把 enabled curated skill bodies 转成 directives: Vec<String>
   let curated_directives: Vec<String> =
       curated_skills::list_enabled_curated_skill_bodies(&app_settings)
           .into_iter()
           .map(|(id, body)| {
               format!("<skill id=\"{id}\">\n{body}\n</skill>")
           })
           .collect();

   // 3. 复用 merge_developer_instructions (在 src-tauri/src/codex/collaboration_policy.rs:171)
   let merged = collaboration_policy::merge_developer_instructions(
       existing_dev_instr.as_deref(),
       &curated_directives,
   );

   // 4. 若 merged 变化, 追加 -c developer_instructions=<encoded>
   if let Some(merged) = merged {
       args.push("-c".to_string());
       args.push(format!(
           "developer_instructions={}",
           encode_toml_string(&merged)
       ));
   }
   ```
   - `merge_developer_instructions` 的 `directives: &[String]` 接收 Vec,我们的 `curated_directives` 直接适配(无需单段)
   - `encode_toml_string` 是已有 helper(`app_server_cli.rs:616`),TOML 转义
   - `codex_args_contain_instruction_override(&args)` 仍作为前置 fail-soft 守卫 — 若用户已有 override,上面 `extract_existing_developer_instructions` 会拿到 existing,merge 自然不覆盖
   - **0 个 enabled curated → curated_directives 空 → merge 返回 existing_trimmed(若空返回 None)→ 不追加 -c 参数**

3. **不破坏 user prompt 字节**:Codex 注入只动 `-c developer_instructions` 段,user prompt 走 `--prompt` / stdin 现有路径不动

**Claude 路径**(走真实 CLI flag,基于 `claude --help` 验证):

- Claude CLI 在 `claude --help` 真实支持的 flag 是 `--append-system-prompt <prompt>`(直接传字符串, 不是 file path)。`--append-system-prompt-file` 在默认模式 `--help` 不出现(只在 `--bare` 描述里用方括号暗示 `[-file]`), 不能依赖
- **新 helper** `build_curated_skill_append_args(app_settings: &AppSettings) -> Option<String>`:
  - 0 个 enabled → `None`
  - N 个 enabled → 拼 `## Curated Skills\n<skill id=\"...\">\nbody\n</skill>...` 段, 返回 `Some(prompt_body)`
- `build_command` 里在 `cmd.arg("-p")` 之后,如果 `append_args.is_some()` 则:
  ```rust
  cmd.arg("--append-system-prompt");
  cmd.arg(append_args.unwrap());  // 直接传字符串
  ```
- **不写 temp file**(N3 修复: 避免 argv 长度限制 + 跨平台 temp file 路径问题)
- **不覆盖 user prompt 字节**:user prompt 继续走 stdin(`--input-format stream-json`,看 `claude.rs:386-392` 注释),curated skill 走独立 `--append-system-prompt` flag
- **已知限制**:Claude CLI argv 有 OS-level 长度限制(典型 128KB-2MB),如果 curated bodies 拼接后超 100KB, MVP 截断到 100KB 并在 metadata 加 `claude-injection-truncated: true` 标记, 用户 picker 顶部 status bar 提示

**备选**(两引擎共用一条路径):
- 客户端拼 system prompt 整段走 stdin: 破坏现有 launch profile;Codex CLI 没这能力 → reject
- 走 Codex `skills/list` JSON-RPC 推 body: 推 body 不在协议,只支持 file path → reject
- 写 CLAUDE.md 到 workspace: 跟 mossx 现有 `files_core.rs:42-90` 的 CLAUDE.md 写路径耦合,会污染用户项目 → reject
- 走 `--append-system-prompt-file <temp_path>`(原 N3 提案): 真实 Claude CLI 默认模式不支持此 flag, 必须改 → 已用 N3 修正版

### Decision 6: 不新增事件,handler 走 `update_app_settings_core` 绕开 restart 判定 + 窗口副作用

`src-tauri/src/command_registry.rs` 注册 4 个 IPC:
- `get_curated_skills() -> Vec<CuratedSkillInfo>`
- `set_curated_skill_enabled(skill_id: String, enabled: bool) -> Result<AppSettings, String>` — handler 内部**必须**调 `update_app_settings_core(new_settings, &state.app_settings, &state.settings_path)` 走核心, **不调** `update_app_settings` 整 IPC。理由: `update_app_settings`(在 `src-tauri/src/settings/mod.rs:113`)内部会 (1) 走 `app_settings_change_requires_codex_restart` 判定 — 我们的新字段不在该函数判定集合里(设计如此), 但走它会**间接增加"未来误加判定字段"的回归风险**; (2) 调 `apply_window_appearance` 副作用(看 `settings/mod.rs:108-110`)— toggle curated skill 不应触发窗口 appearance 重新应用。daemon 端 handler 同样调 core, 不调 daemon `update_app_settings`(`daemon_state.rs:594`)
- `get_enabled_curated_skill_ids() -> Vec<String>`
- `get_curated_skill_bodies() -> Vec<(String, String)>`

**handler 写完后返回新 `AppSettings`**。

**前端 `useCuratedSkillToggle.setEnabled` 内部**:
```ts
async function setEnabled(skillId, enabled) {
  const newSettings = await invoke<AppSettings>("set_curated_skill_enabled", { skillId, enabled });
  setSettings(newSettings); // 已有 useAppSettings hook 的 setter
}
```

**原因**: 不新增事件 = 不增加 IPC channel 数量,不出 `app-settings-changed` 这种跨 binary 同步问题(daemon 模式无 webview 接收者)。handler 走 core 而非 full IPC = 不污染未来 restart 判定集合, 不触发窗口副作用。

### Decision 7: `CuratedSection` 不复用 `SkillsSection.tsx`,并列渲染

`src/features/skills/components/CuratedSection.tsx`(new)与 `SkillsSection.tsx` 并列:
- `SettingsView.tsx:2314-2317` 在 `SkillsSection` 之前插 `<CuratedSection ... />`
- `CuratedSection` 内部: ~150 行,只负责 curated skill 列表渲染 + toggle,不复用 `SkillsSection` 的 tree / file editor / custom dirs 逻辑
- **同时**保留 `useSkills` 的输出: `CuratedSection` 也从 `useSkills` 拿 `source === "curated_bundled"` 的 entry(后端在 `skills_list_local_core` 已合并),不再单独调 `get_curated_skills`(避免重复 IPC)
- 单一数据源 = `useSkills().skills.filter(s => s.source === "curated_bundled")`,不引入新的 hook

**原因**: `SkillsSection` 1100+ 行,设计目标是"扫项目 / 自定义目录 + 编辑 + tree 视图",curated 桶跟它职责不同。强行复用 = 内部加 if-else 分支,复杂度爆炸。

### Decision 8: Composer chip 行用 `useAppSettings` 已有 pattern

`<CuratedSkillChipRow />` 挂在 `ChatInputBox/index.tsx`:
- 读 `useAppSettings().settings.enabledCuratedSkillIds` 作为 `enabled: Set<string>`
- 切换 toggle → 调 `set_curated_skill_enabled` IPC → 收到新 `AppSettings` → 自动触发 React 重渲染
- **不订阅**后端 LLM 流事件(与决策 6 一致)

### Decision 9: icon 字段用 kebab-case,`build.rs` 只做"含非 ASCII 即 reject"粗校验

`metadata.json` 的 `icon: "sparkles"`(kebab-case)对应 `import Sparkles from "lucide-react/dist/esm/icons/sparkles"`(看 `SkillsSection.tsx:13-22`)。

`build.rs` 校验:
```rust
fn validate_icon_name(icon: &str) -> Result<(), String> {
    if icon.is_empty() { return Err("icon cannot be empty".to_string()); }
    if !icon.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(format!("icon '{}' must be kebab-case ASCII (e.g. 'sparkles', 'file-text')", icon));
    }
    Ok(())
}
```

**完整 lucide icon 名白名单走 V1.1**(V0.5.14 PR review 人工 verify icon name 是否真实存在)。

### Decision 10: token 估算用经验值 chars/3,不引 `tiktoken-rs`

`validate_token_estimate` 用 `body.chars().count() / 3`(粗估,英文主导时偏差 < 15%,中文 1 char ≈ 1 token 偏差 50%+)。**MVP 仅上 ponytail(英文)**;未来上中文 skill 时再升级 `tiktoken-rs`(V1.1)。

## Data Flow

```
用户操作流(开 toggle):
  Composer <CuratedSkillChipRow>
    or <CuratedSection> toggle UI
        │  点 toggle
        ▼
  useCuratedSkillToggle.setEnabled(skillId, true)
        │  invoke tauri command
        ▼
  set_curated_skill_enabled IPC
        │  Rust 后端处理
        ▼
  AppSettings.enabled_curated_skill_ids.push(skillId)
  persist to ~/.ccgui/<provider-home>/config.json
  return new AppSettings
        │
        ▼
  前端 setSettings(newSettings) // useAppSettings hook
        │
        ├──► CuratedSkillChipRow 状态变化 → chip 出现
        ├──► CuratedSection toggle UI 同步
        └──► useSkills 重新拉? 不需要 (SkillsSection 的 skills 列表是 mount 时拉的)
            ⚠️ 但是 SkillsSection 内的 curated entry 的 enabled 字段需要后端
            重新计算 → 解决: 不在 SkillsSection 内做 curated 渲染,
            CuratedSection 自己从 useAppSettings 拿 enabled_curated_skill_ids

下次 LLM 调用流 (Codex):
  用户在 composer 输入文本 → 点发送
        │
        ▼
  CodexEngine.launch(...)
        │  resolve_codex_launch_context 拼 args
        ▼
  build_codex_app_server_args(codex_args, options)
        │  内部追加 -c developer_instructions=...
        ▼
  codex_curated_skills_config_arg(app_settings)
        │  0 个 enabled → None → 不追加
        │  N 个 enabled → Some("developer_instructions=\"<merged>\"")
        ▼
  if !codex_args_contain_instruction_override(&args):
      args.push(codex_curated_skills_config_arg(...)?)
        │
        ▼
  args.push("app-server")
        │
        ▼
  Command::new("codex").args(args).spawn()
        │
        ▼
  Codex 子进程把 developer_instructions 作为 system prompt 一部分读

下次 LLM 调用流 (Claude):
  用户在 composer 输入文本 → 点发送
        │
        ▼
  ClaudeEngine.send_message(...)
        │
        ▼
  build_curated_skill_append_args(app_settings)
        │  0 个 enabled → None
        │  N 个 enabled → 拼 body 字符串 → return Some(body)
        ▼
  build_command(&params, ...)
        │  cmd.arg("-p") 之后 if append_args.is_some():
        │      cmd.arg("--append-system-prompt").arg(append_args)
        ▼
  Command::new("claude").args(...).spawn()
```

## 模块拆分与文件清单

### 新增文件

| 路径 | 作用 |
|---|---|
| `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md` | ponytail AGENTS.md 内容(MIT 协议,带 attribution) |
| `src-tauri/resources/curated-skills/lazy-senior-dev/metadata.json` | name/displayName/version/description/icon/category/tokenEstimate/source/license |
| `src-tauri/src/curated_skills.rs` | Rust 模块: load_curated_skills / get_curated_skill_body / list_enabled_curated_skill_bodies / validate_token_estimate |
| `src-tauri/src/backend/app_server_cli.rs` | 新增 `extract_existing_developer_instructions` + `codex_curated_skills_config_arg`; `build_codex_app_server_args` 末尾调 N7 完整 merge 流程 |
| `src-tauri/src/curated_skills/loader.rs` | 资源路径解析(开发模式 / 生产模式差异,走 `app.path().resource_dir()`) |
| `src-tauri/src/curated_skills/ipc.rs` | IPC handler 实现 |
| `src/features/skills/components/CuratedSection.tsx` | Settings 内的 Curated 桶(并列于 `SkillsSection.tsx`,不复用其 1100 行) |
| `src/features/curated-skills/hooks/useCuratedSkills.ts` | 从 `useSkills` 过滤 curated entry,不新调 IPC |
| `src/features/curated-skills/hooks/useCuratedSkillToggle.ts` | 封装 `set_curated_skill_enabled` IPC + 同步 AppSettings |
| `src/features/curated-skills/components/CuratedSkillChipRow.tsx` | Composer 下方 chip 行 |
| `src/features/curated-skills/components/CuratedSkillPicker.tsx` | `+` 弹出的 picker popover,**复用 ComposerContextMenuPopover** |
| `src/features/curated-skills/index.ts` | barrel export |
| `docs/curated-skill-onboarding.md` | 准入规则文档 + 真实回退路径 (a)(b)(c) |
| `tests/curated-skills.test.tsx` | 前端 Vitest |
| `openspec/changes/2026-06-24-curated-skill-bundles/docs/onboarding-checklist.md` | PR review checklist(archive 时迁到 docs/) |

### 修改文件

| 路径 | 改动 |
|---|---|
| `tauri.conf.json` | `bundle.resources` 增 `resources/curated-skills/**/*` + `../skills-lock.json` 映射(对象 schema) |
| `skills-lock.json` | 顶层加 `version: 2`,现有 9 个 entry 加 `kind: "bundled"`,新增 `kind: "curated"` entry(lazy-senior-dev) |
| `src-tauri/Cargo.toml` | 不新增 dep;新增 `src-tauri/build.rs` 调用 `validate_curated_skills_lock` |
| `src-tauri/build.rs`(new 或 existing) | 新增 `validate_curated_skills_lock()` step |
| `src-tauri/src/types.rs` | `AppSettings` 增 `enabled_curated_skill_ids: Vec<String>`,Default 空 |
| `src-tauri/src/skills.rs` | `SkillEntry` 增 `enabled: bool` 字段;`skills_list_local_core` 合并 curated 桶 + 设 `enabled` 字段;`default_skills_dir_for_workspace` 不动 |
| `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:2618-2660` | `skills_list` 调 `skills_list_local_core` 时传入 `app_settings` 引用(若需要小幅扩签名);curated entry `enabled` 字段行为与 Tauri 路径一致 |
| `src-tauri/src/shared/settings_core.rs:299-321` | **不修改** `app_settings_change_requires_codex_restart` 函数体;**新增** unit test 守住"新字段不触发 restart" |
| `src-tauri/src/command_registry.rs` | 注册 4 个新 IPC |
| `src-tauri/src/lib.rs` | `tauri::Builder` `invoke_handler` 注册 |
| `src-tauri/src/backend/app_server_cli.rs` | 新增 `codex_curated_skills_config_arg`;`build_codex_app_server_args` 末尾调用 |
| `src-tauri/src/engine/claude.rs:814` | 新增 `build_curated_skill_append_args`;`build_command` 末尾调用 + 加 `--append-system-prompt <body>`(不写 temp file) |
| `src-tauri/src/shared/codex_core.rs` | **不修改**(没 system prompt 拼装逻辑) |
| `src-tauri/src/engine/claude/launch_profile.rs` | **不修改**(此文件不存在) |
| `src/services/tauri.ts` | 增 4 个 invoke wrapper |
| `src/types/index.ts` | 增 `CuratedSkillOption` 类型 |
| `src/features/settings/components/SettingsView.tsx:2314-2317` | 在 `SkillsSection` 之前插 `<CuratedSection ... />` |
| `src/features/composer/components/ChatInputBox/index.tsx` | 在 `ChatInputBoxFooter` 之前插 `<CuratedSkillChipRow />` |
| `src/features/composer/components/ComposerContextMenuPopover.tsx` | **不修改**(复用),如不支持 anchor / 事件关闭则新建 `CuratedSkillPicker` 独立 popover |

## Codex 注入示例(MVP)

启用了 `lazy-senior-dev` 后,`codex_curated_skills_config_arg` 返回的 args 段(伪代码):

```text
developer_instructions="## Curated Skills

The following curated skills are loaded for this conversation.
Each skill is wrapped in <skill id=\"...\"> tags for clarity.

<skill id=\"lazy-senior-dev\" version=\"4.8.1\" source=\"upstream: DietrichGebert/ponytail v4.8.1\">
You are a lazy senior developer. Lazy means efficient, not careless.
The best code is the code never written.
... (ponytail AGENTS.md 全文)
</skill>"
```

## Claude 注入示例(MVP)

启用了 `lazy-senior-dev` 后,`build_curated_skill_append_args` 返回的字符串(伪代码):

```text
## Curated Skills

The following curated skills are loaded for this conversation.
Each skill is wrapped in <skill id="..."> tags for clarity.

<skill id="lazy-senior-dev" version="4.8.1" source="upstream: DietrichGebert/ponytail v4.8.1">
You are a lazy senior developer. Lazy means efficient, not careless.
... (ponytail AGENTS.md 全文)
</skill>
```

子进程 argv 含 `--append-system-prompt "<上面那段文本>"`。**不写 temp file**(N3 修正版)。若 body 超 100KB, 截断到 100KB 并 metadata 标 `claude-injection-truncated: true`。

## 风险与权衡

- **风险 1**:`src-tauri/build.rs` 在开发模式下每次 `cargo check` 都重算 sha256,可能拖慢 `cargo check`。**缓解**:用 `build.rs` 的 `rerun-if-changed` 限定只对 `src-tauri/resources/curated-skills/**` 和 `skills-lock.json` 监听。
- **风险 2**:用户切换 toggle 后,**已经在进行的 LLM 流式响应**的 system prompt 不会回滚(已发出)。**接受**:这是 LLM 调用语义,不是 bug。**说明**在 chip tooltip 上注明"下次发送生效"。
- **风险 3**:`enabled_curated_skill_ids` 累积超过 ~5 个, system prompt 累加可能突破模型 context 窗口。**缓解**:chip picker 顶部显示"已加载总 token: X / 上限 8000",>5000 警告。
- **风险 4**:Claude CLI argv 长度限制(典型 128KB-2MB),curated bodies 拼接后可能超限。**缓解**:MVP 截断到 100KB,metadata 标 `claude-injection-truncated: true`,picker 顶部 status bar 提示。
- **风险 5**: 用户 `codex_args` 已有 `developer_instructions=` 时 curated 不注入(用户设置优先)。**接受**:user intent wins,这是已有语义(`codex_args_contain_instruction_override`)。**说明**在 chip picker tooltip 注明 "已有自定义 instructions 时不追加"。
- **权衡 1**: MVP 不上 `@` 触发 curated skill(只走 chip 行 + CuratedSection)。**原因**: `@` 解析逻辑改起来跨多个文件, V1.1 再做。
- **权衡 2**: 不支持按 workspace 隔离。**原因**: 多数用户单一 workspace,隔离反而增加心智负担。
- **权衡 3**: 不做强度档。**原因**: mossx 不暴露 slash 命令,强度档没有 UI 入口。
- **权衡 4**: `SkillsSection` 1100+ 行代码**不重做**,新加 `CuratedSection` 并列。**原因**: 避免引入 if-else 分支污染已有逻辑,职责分离。

## 已知边界 / 后续 V0.5.14 follow-up

本轮 review 标记的 14 处问题中,只修了 N1 / N2 / N3 / N7(高优先级),剩 10 条不进本轮,留作后续单独 change:

### N 类(影响落地但本轮不修)

- **N4** `useAppSettings.normalizeAppSettings` 需要前向兼容新字段: 前端 `defaultSettings` + `normalizeAppSettings` 加 `enabled_curated_skill_ids` 字段(默认 `[]`), 走单独 change 改 frontend `appSettingsDefaults.ts`。
- **N5** `useCuratedSkills` 数据源走 useSkills 过滤(无新 IPC)已在 design.md Decision 7 写明, task 3.2 仍说"走 startupOrchestrator" 是 wording 不齐, 实施时对齐即可, 不开新 change。
- **N6** `task 3.2` 的 `depends` 应该是 `2.2`(后端先合并 curated 桶)而非 `3.1`, 实施时调整依赖即可, 不开新 change。
- **N8** `build.rs` 已存在, task 1.3 写"改/新增"含糊, 实施时改成"改"即可, 不开新 change。
- **N9** chip 行插入点 ChatInputBoxFooter 之前, 任务实施时确认位置, 不开新 change。
- **N10** i18n key 缺失: Curated 桶头 / chip 行 / picker 文案需 i18n 化, 走单独 change 加 en.json / zh.json key。

### L 类(细节但本轮不修)

- **L7** daemon 端 `set_curated_skill_enabled` 同样需调 core 走 N2 同 pattern: 任务 2.4 实施时同步处理, 不开新 change。
- **L8** `kind: "bundled"` 跳过 + 无 `kind` 字段也跳过的 unit test: 任务 5.3 实施时补, 不开新 change。
- **L9** huashu-design 后续加入 curated 时 category 必须是 `ui-design`: spec 已隐含约束, 实施时 PR review 把关, 不开新 change。
- **L10** i18n key 缺失: 同 N10, 走单独 change。

### 原本就在的 5 条 V1.1 follow-up

1. **lucide-react icon 完整白名单**:`build.rs` 仅做 kebab-case ASCII 粗校验,完整 icon 名清单(几百个)V1.1 引入。V0.5.14 走 PR review 人工 verify。
2. **MPL-2.0 license 准入**:白名单 V0.5.14 只含 `MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC`,MPL-2.0 因 file-level copyleft 走法律评审,V1.1 评估后加入。
3. **中文 token 估算精度**:`chars/3` 经验值对中文偏差 50%+,V1.1 引入 `tiktoken-rs` 精算(增量 1 个 native dep,编译时间 +30s)。
4. **完整 category 枚举**:MVP 4 个 (`code-style / ui-design / review / debug`),V1.1 扩到 8 个(`performance / test / docs / git`)。
5. **Composer `@` 触发 curated skill picker**:MVP 只走 chip 行 + SettingsSection,V1.1 改 composer `@` 解析器,把 curated 也加进 picker。
