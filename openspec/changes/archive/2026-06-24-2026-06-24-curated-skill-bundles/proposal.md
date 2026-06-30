# Proposal: 内嵌精选 skill 库 + 对话框 quick-load (curated-skill-bundles)

## Archive Reconciliation — 2026-06-25

本 archived change 是 curated skill 能力的**第一版底座提案**。它的底座目标已经落地：
客户端内置 `lazy-senior-dev` 资源、`skills-lock.json kind: curated`、编译期校验、Settings
Curated section、`enabledCuratedSkillIds` 持久化、Codex / Claude prompt 注入、onboarding 文档。

但原提案中的 composer **chip row / picker / per-message quick-load** 方向已经被后续 change 明确废弃：

- `2026-06-24-curated-skill-always-on-simplification`：把模型改成 Settings-only always-on，移除 per-message picker / chip row。
- `2026-06-25-composer-readiness-bar-indicator-layout`：把 composer 里的用户可见反馈收敛为 read-only `CuratedSkillIndicator`，通过 `ComposerReadinessBar.rightAccessory` 挂在 readiness bar 右侧。

因此本 archive 的任务状态以 `tasks.md` 的 reconciliation 表为准：底座已完成；chip row / picker 相关任务标记为 superseded；最终行为以主 spec
`openspec/specs/curated-skill-bundles/spec.md` 和上述两个后续 change 为准。

## Historical Proposal Below

以下内容保留第一版提案原文用于审计。凡涉及 composer chip row / picker、`--append-system-prompt-file`、或“toggle 不触发 Codex restart”的描述，均已被本节上方的 archive reconciliation 与后续 change supersede。

## Why

mossx 客户端当前的 skill 来源链路有 3 类(`src-tauri/src/skills.rs` 现状):

- `project_managed` / `project_claude` / `project_codex` / `project_agents` / `project_gemini` — 扫描项目内 `.agents/skills/` `/.claude/skills/` `/.codex/skills/` 等
- `global_claude` / `global_claude_plugin` / `global_codex` / `global_agents` / `global_gemini` — 扫描 `~/.claude/skills/` `~/.codex/skills/` 等
- `custom` — 扫描用户在设置里添加的自定义目录(走 `AppSettings.custom_skill_directories: Vec<String>`)

三类都依赖**用户自己去找、自己装、自己启用**。对一个新用户来说:

- GitHub 仓库要自己 clone(huashu-design、vercel-react-best-practices 这些)
- 插件 marketplace 流程要自己走(`codex plugin marketplace add ...`)
- 装完后还要去 `Settings → Skills` 找到对应条目开 toggle,**多数用户根本不知道 SkillsSection 在哪**
- `skills-lock.json` 里 9 个内置 skill(`vercel-labs/agent-skills` 系列)虽然客户端有,但**这些资产并没有真的落到客户端资源目录里** — 只是个待落盘的占位清单
- ponytail 这类"想塞进 prompt 风格但又不属于 plugin marketplace"的能力,**没有通路给到 CodeMoss 用户**

参考数据(均来自 mossx v0.5.13 真实 skill 扫描):

| 来源 | 数量(v0.5.13) | 用户发现路径 |
|---|---:|---|
| `global_claude_plugin` 扫描到 | 0 个 | 用户得自己装 plugin |
| `global_codex` 扫描到 | 0 个 | 用户得自己装 plugin |
| `project_managed` 扫描到 | 0 个(用户项目) | 用户得自己创建 |
| `custom` 扫描到 | 0 个 | 用户得自己加目录 |
| `skills-lock.json` 内置 9 个 | 9 个(占位) | 资产没真落盘 |

由此产生 3 个具体问题(在 v0.5.13 release run 真实用户对话里复现):

- 用户"想要 React 性能优化指引" → 客户端没有暴露任何路径告诉他可以开 `vercel-react-best-practices`,他得自己 Google → 自己读 skills-lock.json → 自己加目录
- 用户想要"更聪明的代码生成" → 客户端不暴露 `huashu-design`(`huashuDesign` 评分 `e0c29db9...`),他装不上
- 用户想要"lazy 风格" → 当前必须跑 `codex plugin marketplace add DietrichGebert/ponytail`,**没有 Ponytail 渠道给 CodeMoss 用户**

## 目标与边界

### 目标

- 在 mossx 客户端内置**精选 skill 库**(Curated Bundle),**与客户端版本绑定**,**发版打包**,**不依赖网络**,**不依赖 marketplace**。
- 在 `Settings → Skills` 顶部新增一个 **Curated** 桶,与现有的 Project / Custom 桶并列,每个 curated skill 一个 toggle,默认全部 **off**(不污染用户首次启动体验)。
- 在**输入框下方**新增一个常驻 **"🧩 已加载" chip 行**(Composer 下方),实时显示当前对话启用的 curated skill,**点 `+` 弹 picker 选/关**,所见即所得。
- 当用户在任何 curated skill 上切换 toggle 时,**下一次 LLM 调用的 system prompt 重新拼装**,chip 行实时反映状态,**不重启会话**(不触发 `app_settings_change_requires_codex_restart`)。
- 提供 curated skill **资产供应链**:新增 `src-tauri/resources/curated-skills/<name>/SKILL.md` 资产 + 在现有 `skills-lock.json` 里加 `kind: "curated"` 区分,`src-tauri/build.rs` 在 `cargo build` 时校验 hash 失败则硬错误。
- 提供 curated skill **准入规则**:`docs/curated-skill-onboarding.md` 写明 token 上限、依赖、icon 规范、命名冲突规则,后续 PR 加新 skill 必须按此规则。
- ponytail 作为**首条** curated skill 落地,验证整条链路可用。
- 行为契约 OpenSpec 化,新增 `curated-skill-bundles` capability,后续可被 `openspec validate --strict` 校验。

### 边界

- **仅修改以下文件**(或新增)不动其他:
  - 新增 `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md`(ponytail 内容,MIT 协议,带 attribution)
  - 新增 `src-tauri/resources/curated-skills/lazy-senior-dev/metadata.json`(name/description/icon/category/tokenEstimate/source/license)
  - 改 `skills-lock.json` 顶层,新增 `kind: "curated"` 字段区分现有的 `kind: "bundled"`(兼容老 entry,默认 `kind: "bundled"`)
  - 改 `src-tauri/Cargo.toml` + 新增/改 `src-tauri/build.rs`(添加 `validate_curated_skills_lock` step,读 `skills-lock.json` 里 `kind == "curated"` 的 entry,重算 sha256,不一致则 `compile_error!`)
  - 改 `tauri.conf.json` 的 `bundle.resources`(对象 schema,加 `resources/curated-skills/**/*` 映射)
  - 新增 `src-tauri/src/curated_skills.rs`(扫描 curated 资产 + IPC handler + read body + list enabled bodies)
  - 改 `src-tauri/src/types.rs`(`AppSettings` 增 `enabled_curated_skill_ids: Vec<String>`,**不进** `app_settings_change_requires_codex_restart` 字段集合)
  - 改 `src-tauri/src/skills.rs`(`SkillEntry` 增 `enabled: bool` 字段(默认 true),`skills_list_local_core` 合并 curated 桶 + 对 `enabled_curated_skill_ids` 内 skill 设 `enabled = true`,其它 curated 设 `enabled = false`)
  - 改 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:2618-2660`(daemon 路径同步以上 enabled 过滤,行为与 Tauri 命令路径一致)
  - 改 `src-tauri/src/backend/app_server_cli.rs`(Codex 注入:在 `build_codex_app_server_args` 阶段读 `enabled_curated_skill_ids`,追加 `-c developer_instructions="<merged>"`,与 `collaboration_policy::merge_developer_instructions` 复用同模式;若用户 `codex_args` 已含 `developer_instructions=` 则**不覆盖**走 `codex_args_contain_instruction_override` 已有的 fail-soft 行为)
  - 改 `src-tauri/src/engine/claude.rs` 的 `build_command`(Claude 注入:在 `claude -p` 之前,把 enabled curated bodies 拼成一段 system prompt 文本,走 `--append-system-prompt-file <temp_path>` 传给子进程;temp_path 走 `std::env::temp_dir()` + 唯一命名,子进程退出后 best-effort 清理)
  - 改 `src-tauri/src/command_registry.rs`(注册 4 个新 IPC:`get_curated_skills` / `set_curated_skill_enabled` / `get_enabled_curated_skill_ids` / `get_curated_skill_bodies`;`set_curated_skill_enabled` 写 `AppSettings` 后**直接 return 新 `AppSettings`**,不新增事件 — 复用前端已有 `useAppSettings` hook 的 state 同步 pattern)
  - 改 `src/features/skills/components/CuratedSection.tsx`(new,与 `SkillsSection.tsx` 并列渲染在 SettingsView 的 skills 主 section 内,不复用 SkillsSection 内部 1100+ 行逻辑)
  - 改 `src/features/composer/components/ChatInputBox/index.tsx`(输入框下方插入 `<CuratedSkillChipRow />`)
  - 新增 `src/features/curated-skills/`(hook / chip 行 / picker)
- **不修改**现有 `useSkills` hook 的对外契约(返回的 `SkillOption[]` 多 1 个可选 `enabled: boolean` 字段是 additive change,旧代码忽略即可)
- **不修改** `Project` / `Custom` 桶的扫描逻辑,不动 `skills-lock.json` 已有的 9 个 `bundled` entry
- **不修改**输入框现有 `@` 文件引用、`/` 命令解析、slash menu
- **不引入新依赖**(无 React 新库、无 Tauri 新 plugin)
- **不修改** `src-tauri/Cargo.toml` 已有的 dependencies
- **MVP 仅上 1 个 curated skill**(ponytail / lazy-senior-dev),其他技能走后续 change

## 非目标

- 不实现 `/ponytail lite | full | ultra` 强度档切换(MVP 只暴露 on/off,强度档走 V1.1)
- 不实现 5 个 `/ponytail-*` slash 命令(`/ponytail-review` 等)— 不在 mossx 客户端暴露
- 不实现 curated skill **用户反馈 / 评分 / 自动更新** — 走客户端发版
- 不做 curated skill **第三方投稿 UI** — 通过 PR 流程
- 不重做 `AGENTS.md` / `CLAUDE.md` 自动读取链路 — 现有 `src-tauri/src/files/io.rs` 和 `src-tauri/src/shared/files_core.rs` 行为不变
- 不动 `BatchedTauriEventSink` / `app-server-event-batching` 等性能 capability
- 不在 `agent.json` 里硬编码 curated skill — 走资源文件 + lock 清单
- 不支持运行时下载 curated skill(零网络是设计目标)
- 不支持 curated skill 按 workspace 隔离(全局开关,跨 workspace 共用)
- 不实现 `Skills → Curated` 桶的拖拽排序 / 分组
- 不在 MVP 重做 `lucide-react` icon 名称白名单(仅在 build.rs 做"含非 ASCII 即 reject"的粗校验,完整 icon 名清单走 V1.1)

## What Changes

### 1. 资产层 — Curated 资产 + 扩展 `skills-lock.json` + build.rs 校验

- `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md`: 内嵌 ponytail `AGENTS.md` 内容(MIT license,顶部加 `<!-- Upstream: ... | License: MIT -->` attribution 注释)
- `src-tauri/resources/curated-skills/lazy-senior-dev/metadata.json`:
  ```json
  { "name": "lazy-senior-dev", "displayName": "Lazy senior dev", "version": "4.8.1",
    "description": "把 Codex/Claude 切到 lazy senior dev 模式: 7 级 Ladder 强制 YAGNI、stdlib 优先、最小实现", "icon": "sparkles",
    "category": "code-style", "tokenEstimate": 1100, "source": "upstream: DietrichGebert/ponytail v4.8.1",
    "license": "MIT" }
  ```
- `skills-lock.json`(已有顶层)扩展,新增 `kind` 字段:
  ```json
  { "version": 2, "skills": {
    "deploy-to-vercel": { "kind": "bundled", ... },  // 现有 9 个,加 kind: "bundled"
    "lazy-senior-dev": {
      "kind": "curated",                                // 新增
      "assetPath": "src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md",
      "metadataPath": "src-tauri/resources/curated-skills/lazy-senior-dev/metadata.json",
      "computedHash": "<sha256>",
      "tokenEstimate": 1100, "minClientVersion": "0.5.14"
    }
  }}
  ```
  - 老 entry 没 `kind` 字段时,build.rs 与解析代码都 fallback `"bundled"`(兼容现有 9 个)
- `src-tauri/build.rs` 新增 `validate_curated_skills_lock()` step:
  - 读 `skills-lock.json`,只对 `kind == "curated"` 的 entry 做 sha256 校验
  - `kind == "bundled"` 或无 `kind` 字段的 entry **跳过校验**(老 entry 占位资产不存在,等下一个 change 处理)
  - 重算 `assetPath` 的 sha256,与 `computedHash` 不一致 → `compile_error!("curated skill lock hash mismatch for {}: expected {}, got {}", name, lock_hash, actual_hash)`
  - 检查 `metadata.json` 的 `name` / `version` / `license` 字段非空,`license` 必须在白名单
  - 检查 `assetPath` 不含 `..` 或绝对路径
  - **零运行时下载**, 编译时校验
  - `cargo:rerun-if-changed=src-tauri/resources/curated-skills` + `rerun-if-changed=skills-lock.json` 限定监听范围

### 2. 后端层 — Tauri 扫描 + IPC + Codex/Claude 注入

- `src-tauri/src/curated_skills.rs`(new):
  - `pub(crate) const SKILL_SOURCE_CURATED_BUNDLED: &str = "curated_bundled"`
  - `pub(crate) struct CuratedSkillEntry { name, path, description, icon, category, token_estimate, version, license }`
  - `pub(crate) fn load_curated_skills(lock_path: &Path) -> Result<Vec<CuratedSkillEntry>, String>` — 读 `skills-lock.json` 里 `kind == "curated"` 的 entry
  - `pub(crate) fn get_curated_skill_body(name: &str) -> Result<String, String>` — 读 `assetPath` 全文
  - `pub(crate) fn list_enabled_curated_skill_bodies(app_settings: &AppSettings) -> Vec<(String, String)>` — 给 prompt 注入用,按 `enabled_curated_skill_ids` 顺序返回 (id, body) pairs
  - `pub(crate) fn validate_token_estimate(body: &str) -> usize` — chars/3 经验值
- `src-tauri/src/skills.rs` 改:
  - `SkillEntry` 增 `pub(crate) enabled: bool` 字段(serde rename `enabled`, 默认 `true` via `#[serde(default = "default_true")]`)
  - `skills_list_local_core` 合并 curated 桶后,遍历 `app_settings.enabled_curated_skill_ids` 集合,对 curated entry 设 `enabled = true`;其它 curated 设 `enabled = false`;**非 curated entry 保持 `enabled = true`**
  - `default_skills_dir_for_workspace` 不动
- `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:2618-2660` 改:
  - `skills_list` 调 `skills_list_local_core` 时传入 `app_settings` 引用(看现有 `skills::skills_list_local_core` 签名,需要小幅扩),让 curated entry 的 `enabled` 字段也由 daemon 端的 `AppSettings` 算出
  - 行为与 Tauri 路径完全一致(走同一 `skills_list_local_core` 函数,行为锁定)
- `src-tauri/src/types.rs` 改:
  - `AppSettings` 增字段 `#[serde(default, rename = "enabledCuratedSkillIds")] enabled_curated_skill_ids: Vec<String>`
  - `Default` 为空 `vec![]`
  - **不修改** `app_settings_change_requires_codex_restart`(`src-tauri/src/shared/settings_core.rs:299-321`) — 该函数当前只检查 proxy / unified_exec / auto_compaction 4 个字段,新字段不进入检查范围,**toggle curated 永远不触发 Codex session 重启**
- `src-tauri/src/command_registry.rs` 改: 注册 4 个 IPC
  - `get_curated_skills() -> Vec<CuratedSkillInfo>` — 返回 `metadata.json` + `enabled` 字段
  - `set_curated_skill_enabled(skill_id: String, enabled: bool) -> Result<AppSettings, String>` — 写 `AppSettings.enabled_curated_skill_ids` 后**返回新 `AppSettings`**(前端 `updateAppSettings` 已有的同步 pattern,无新事件)
  - `get_enabled_curated_skill_ids() -> Vec<String>` — 给前端 chip 行 mount 时拉
  - `get_curated_skill_bodies() -> Vec<(String, String)>` — 给 Codex/Claude 注入用
- `src-tauri/src/backend/app_server_cli.rs` 改(**Codex 注入路径**):
  - 新增 `pub(crate) fn codex_curated_skills_config_arg(app_settings: &AppSettings) -> Option<String>`,行为:
    - 调 `curated_skills::list_enabled_curated_skill_bodies(app_settings)`
    - 0 个 → 返回 `None`
    - N 个 → 拼 `developer_instructions="<existing_instructions>\\n\\n## Curated Skills\\n<skill id=\\\"...\\\" ...> body </skill>..."`,**走 `merge_developer_instructions` 已有的 merge 模式**(看 `src-tauri/src/codex/collaboration_policy.rs:171`)+ `encode_toml_string` 走 `app_server_cli.rs:614` 已有的 TOML escape
    - 返回 `Some(format!("developer_instructions={}", encode_toml_string(&merged)))`
  - `build_codex_app_server_args` 末尾、`args.push("app-server".to_string())` 之前,如果 `codex_args_contain_instruction_override(&args)` 返回 `false`,则 `args.push(codex_curated_skills_config_arg(...)?)` 注入 curated skills config arg
  - **已有 `developer_instructions=` 的用户 `codex_args` 不被覆盖**(沿用 `codex_args_contain_instruction_override` 已有的语义)
  - **空 enabled 集合不追加**(返回 None → 不 push)
- `src-tauri/src/engine/claude.rs` 改(**Claude 注入路径**):
  - 在 `build_command` 之前新增 helper `fn build_curated_skill_temp_file(app_settings: &AppSettings) -> Option<PathBuf>`:
    - 调 `curated_skills::list_enabled_curated_skill_bodies(app_settings)`
    - 0 个 → 返回 `None`
    - N 个 → 拼一段 system prompt 文本,写 `std::env::temp_dir().join(format!("ccgui-curated-{}-{}.md", workspace_id, unix_timestamp_ms()))`,**写入前用 `OpenOptions::new().create_new(true)` 拒绝覆盖已有文件**;返回 path
  - `build_command` 里在 `cmd.arg("-p")` 之后,如果 `temp_file.is_some()` 则 `cmd.arg("--append-system-prompt-file").arg(temp_file)`
  - **已知限制**:Claude CLI 是否原生支持 `--append-system-prompt-file` 需要验证(在 v0.5.14 任务 3.x 真实启动 e2e 验证一次,失败则 fallback 到走 stdin 把 prompt 拼在用户消息前面,但这会破坏 LLM 调用语义,故 v0.5.14 必须先验证 CLI 支持,不支持则**curated skill 在 Claude engine 下走 warning 模式不注入**并在 metadata 标记 "claude-injection-unsupported")
- `src-tauri/src/lib.rs` 改: 在 `tauri::Builder` `invoke_handler` 注册 4 个新 IPC
- **不修改**任何 prompt 拼装的"已有 system prompt 部分",**只在末尾追加** curated skills 段
- **不修改**现有 `updateAppSettings` IPC,新 IPC `set_curated_skill_enabled` 走自己的命令体,返回新 `AppSettings` 即可

### 3. 前端层 — Settings UI + Composer chip 行 + Picker

- `src/features/curated-skills/`(new):
  - `hooks/useCuratedSkills.ts` — 调 `get_curated_skills`,返回 `CuratedSkillOption[]`(含 `enabled: boolean`)
  - `hooks/useEnabledCuratedSkillIds.ts` — 读 `AppSettings.enabled_curated_skill_ids` 字段(从 `useAppSettings` hook 拿,不新增事件订阅)
  - `hooks/useCuratedSkillToggle.ts` — 封装 `set_curated_skill_enabled` IPC,返回 `{ enabled: boolean, setEnabled: (id, enabled) => Promise<void> }`
  - `components/CuratedSkillChipRow.tsx` — Composer 下方常驻一行,显示已启用的 curated skill chip,右侧 `+` 按钮弹 picker
  - `components/CuratedSkillPicker.tsx` — **复用现有 `ComposerContextMenuPopover`**(在 `src/features/composer/components/ComposerContextMenuPopover.tsx`),每行一个 skill,带 toggle + icon + tokenEstimate tooltip
- `src/features/skills/components/CuratedSection.tsx`(new):
  - **不复用** `SkillsSection.tsx` 1100+ 行的 tree / file editor / custom dirs 逻辑(它没有"桶"概念)
  - **并列渲染**在 `SettingsView.tsx` 的 `activeSection === "skills"` section 内,放在 `SkillsSection` 之前;调用方改 `SettingsView.tsx:2314-2317`,把 `SkillsSection` 之前插一段 `<CuratedSection ... />`
  - 内部:桶头 "📦 Curated" + 来源说明 "客户端内置, 发版打包, 零网络";行用 lucide-react `Sparkles` + displayName + description(2 行截断) + tokenEstimate(灰色 "≈1.1K tokens") + Toggle;toggle 接 `useCuratedSkillToggle.setEnabled`
- `src/features/composer/components/ChatInputBox/index.tsx` 改: 在 `ChatInputBoxFooter` 之前(或者 `MessageQueue` 之后,**位置以 `index.tsx` 现有 DOM 顺序为准**)插入 `<CuratedSkillChipRow />`;chip 行不订阅后端事件,只读 `useAppSettings` 的 `enabled_curated_skill_ids` 字段
- `src/services/tauri.ts` 增 `getCuratedSkills` / `setCuratedSkillEnabled` / `getEnabledCuratedSkillIds` / `getCuratedSkillBodies` 4 个 invoke wrapper
- `src/types/index.ts` 增 `CuratedSkillOption`(name / displayName / icon / category / tokenEstimate / version / license / enabled) + 复用 `AppSettings.enabledCuratedSkillIds: string[]`
- **复用** `useAppSettings` 已有 pattern(返回 `{ settings, updateSettings }`),`useCuratedSkillToggle.setEnabled` 内部直接调 `setCuratedSkillEnabled` IPC + 让 React state 自然更新

### 4. 文档层 — 准入规则 + 真实回退路径

- `docs/curated-skill-onboarding.md`(new): 写明如何加一个新 curated skill
  - 必须包含 `SKILL.md` + `metadata.json`
  - `metadata.json` schema: name / displayName / version / description / icon / category / tokenEstimate / source / license
  - `tokenEstimate` 上限: 3000 tokens(超出会拒收)
  - `license` 必须在白名单:`MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC`(MPL-2.0 走法律评审,V1.1 再加)
  - `icon` 取自 `lucide-react` 已有图标名(V1.1 引入完整白名单;V0.5.14 仅做"含非 ASCII 即 reject"粗校验,`import "lucide-react/dist/esm/icons/<icon>.js"` 路径测试由 PR review 走)
  - category 枚举(MVP 4 个):`code-style / ui-design / review / debug`;其余 4 个(`performance / test / docs / git`)V1.1 再加
  - `skills-lock.json` 里新加 entry 必须 `kind: "curated"`
  - 与已有 `kind: "curated"` entry / `kind: "bundled"` entry 命名不冲突
  - 必须包含"何时不启用 / When NOT to enable"反向说明
- `openspec/changes/2026-06-24-curated-skill-bundle/docs/onboarding-checklist.md`(跟 change 一起 archive 后迁到 `docs/curated-skill-onboarding.md`): PR review checklist
- **真实回退路径**文档化(必须写的 3 条):
  - (a) **编译期回退**:`build.rs` 的 `compile_error!` 临时改为 `compile_warn!`,允许带 stale lock 发版(下个版本必须修)
  - (b) **资产层回退**:`tauri.conf.json` 的 `bundle.resources` 移掉 curated-skills 映射 + 删 `skills-lock.json` 里 `kind: "curated"` entry → 客户端发版不带 curated 资产
  - (c) **运行时回退**:AppSettings 字段保留但 IPC `set_curated_skill_enabled` 临时返回 success 但实际不写(代码一行 flag);前端 toggle UI 还在但永远不生效 → "软下线" 用于快速止血

### 5. 验证与可观测

- `tests/curated-skills.test.tsx`(前端): 覆盖 toggle 切换 → IPC 调用 → chip 行更新 → AppSettings 同步
- `src-tauri/src/curated_skills.rs` 内 Rust unit test: 覆盖 `load_curated_skills` / `validate_token_estimate` / `list_enabled_curated_skill_bodies` 失败路径
- `src/features/skills/components/CuratedSection.tsx` 的 Vitest: 覆盖 (1) 切换后写 AppSettings; (2) 切换后 chip 行同步; (3) 系统未启动 curated 时 section 不显示
- `npm run typecheck` / `npm run lint` / `npm run test` 全绿
- 一次 release build 验证 `src-tauri/build.rs` 校验通过、产物可启动
- **E2E 真实可观测路径**(因为 system prompt 在子进程里,e2e 不能直接 verify):
  - **Codex 路径**:用 `codex --version` mock(e2e 框架用 vitest + mock `find_cli_binary` 走"echo args" stub),让 e2e 看到 `build_codex_app_server_args` 返回的 `args` 列表里含 `developer_instructions="...ponytail 7 级 Ladder..."`
  - **Claude 路径**:让 e2e 看到 `claude -p --append-system-prompt-file /tmp/ccgui-curated-xxx.md ...` 的 argv,临时文件存在且含 ponytail 关键字(用 `tokio::process::Command` mock 让它 dry-run 把 argv 写到日志,断言日志含 `ccgui-curated-` 前缀 + 临时文件 body 含 `7 级 Ladder` 关键字)

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 走 `codex plugin marketplace` 装 ponytail | 不动客户端代码 | 用户得切到 Codex CLI,UI 完全无入口,违反"内嵌"目标 | reject |
| B. 客户端内置 `~/.codex/skills/lazy-senior-dev` symlink 脚本 | 改动小 | 跨平台不可靠(symlink Windows 权限),需要用户在 Codex CLI 跑 | reject |
| C. 在 `skills-lock.json` 加 entry,客户端按 `bundled` 来源扫描 | 跟现有 9 个内置 skill 一致 | 现有 9 个内置 skill 的 `assetPath` 不存在(占位),`build.rs` 校验会 fail;UI 改造量接近 D | 部分采用 → 升级为 D |
| D. 新增 curated 资产 + 扩展 skills-lock.json (kind: "curated") + UI 桶 + Composer chip | 信息架构清晰,用户可见可选,token 可省,后续扩展性强 | 改动面跨 4 层(资产 / 后端 / 前端 / 文档),MVP 工作量 ~700 行 | **Adopt** |
| E. 改 `AGENTS.md` 路径,塞进 mossx 仓库根 `AGENTS.md` | 客户端已自动读 `AGENTS.md`,零 IPC 改动 | 污染 mossx 项目 `AGENTS.md`;不能按用户开关(永远在);不能多 skill;侵入式 | reject |
| F. 走独立 plugin manifest `~/.codex/plugins/curated/...` | 跟 ponytail 现有 pattern 一致 | 还是 plugin 形态,跟"内嵌"语义冲突 | reject |
| G. 走 `tauri::api::path::resource_dir()` 读取应用内 `resources/curated-skills/*` | 跟 Tauri 标准资源路径对齐,`tauri build` 自动打包,跨平台 | 需要在 `tauri.conf.json` 配 `bundle.resources`(对象 schema) | **D 方案的子步骤,采用** |
| H. 客户端拼 system prompt 后整段走 stdin/args | 一次实现,Codex/Claude 共用 | 真实证据:`buildSystemPrompt` 不存在;Codex 走 `-c developer_instructions="..."`,Claude 走 `--append-system-prompt-file`,两条路径不同;强行共用会破坏现有 launch profile | reject,改走各自原生注入路径 |

## 验收 Gate

### Gate 1 — Schema / Lock 一致性

- `openspec validate 2026-06-24-curated-skill-bundles --strict --no-interactive` 退出码 0
- `npm run typecheck` 退出码 0
- `cargo check --manifest-path src-tauri/Cargo.toml` 退出码 0
- `cargo build --release --manifest-path src-tauri/Cargo.toml` 退出码 0(`src-tauri/build.rs` 的 `validate_curated_skills_lock` 必须通过)

### Gate 2 — 行为契约

- 启动客户端 → 打开 `Settings → Skills` → 看到 **Curated** section 在 `SkillsSection` 之前,含 1 个条目 **Lazy senior dev**(icon + 描述 + token 估算)
- 默认 toggle 全部 **off**,chip 行不显示任何内容
- 点 Curated section 的 toggle 打开 → chip 行立刻出现 **Lazy senior dev** chip
- 在 composer 输入任意内容 → 发送 → mock CLI 抓 `codex` argv 应含 `developer_instructions="...ponytail 7 级 Ladder..."`(若启用了 curated)或不出现该参数(若禁用)
- 关闭 toggle → 下次发送 → mock CLI 抓的 argv 不含 curated skills 段
- 切到另一个 workspace → toggle 状态全局保持(不重置)
- 重启客户端 → toggle 状态从 `AppSettings.enabled_curated_skill_ids` 恢复
- **toggle curated skill 时 Codex / Claude session 不重启**(`app_settings_change_requires_codex_restart` 永远对新字段返回 false)

### Gate 3 — 安全 / Privacy

- `src-tauri/build.rs` 校验失败时,客户端**编译报错**而非运行时报错
- 资产目录下文件路径**不允许** `..` 越界,`validate_curated_skills_lock` 拒绝 `assetPath` 含 `..` 或绝对路径
- 不发起任何网络请求(打开 Network 面板验证 curated skill 加载期间 0 个外发请求)
- tokenEstimate 与实际 `chars/3` 估算偏差 < 30%(MVP 经验值,不引 tiktoken)
- 用户 `codex_args` 已有 `developer_instructions=` 时,**curated skills 不覆盖用户设置**

### Gate 4 — 不回归

- 现有 `Project` / `Custom` 桶的扫描行为**完全不变**(`src-tauri/src/skills.rs` 单元测试全 pass)
- 现有 9 个 `skills-lock.json` 内置 `bundled` skill **不自动启用**(行为不变,保持默认 off)
- `AGENTS.md` / `CLAUDE.md` 自动读取链路**完全不变**
- `BatchedTauriEventSink` / `app-server-event-batching` 性能 capability **不回归**
- daemon binary 与 Tauri binary 的 skills_list 返回**字段一致**(`enabled` 字段都从 `AppSettings.enabled_curated_skill_ids` 算出)
- `app_settings_change_requires_codex_restart` 在 `enabled_curated_skill_ids` 变化前后行为一致(永远 false),有专门 unit test 守住

## 风险与回退

- **风险 1**:`src-tauri/build.rs` 在开发模式下每次 `cargo check` 都重算 sha256,可能拖慢 `cargo check`。**缓解**:用 `build.rs` 的 `rerun-if-changed` 限定只对 `src-tauri/resources/curated-skills/**` 和 `skills-lock.json` 监听。
- **风险 2**:用户切换 toggle 后,**已经在进行的 LLM 流式响应**的 system prompt 不会回滚(已发出)。**接受**:这是 LLM 调用语义,不是 bug。**说明**在 chip tooltip 上注明"下次发送生效"。
- **风险 3**:`enabled_curated_skill_ids` 累积超过 ~5 个, system prompt 累加可能突破模型 context 窗口。**缓解**:chip picker 顶部显示"已加载总 token: X / 上限 8000",超过 5000 警告。
- **风险 4**:Claude CLI 是否原生支持 `--append-system-prompt-file` 未确认。**缓解**:在任务 3.x 真实启动 e2e 验证,失败则在 `metadata.json` 标记 `claude-injection-unsupported: true`,Claude engine 不注入 curated skill。
- **回退 (a) 编译期**:`build.rs` 的 `compile_error!` 临时改 `compile_warn!`,允许带 stale lock 发版
- **回退 (b) 资产层**:`tauri.conf.json` `bundle.resources` 移掉 curated-skills 映射 + 删 `skills-lock.json` 里 `kind: "curated"` entry → 客户端发版不带 curated 资产
- **回退 (c) 运行时**:AppSettings 字段保留,`set_curated_skill_enabled` 临时返回 success 但不写(flag 一行),前端 toggle UI 还在但永远不生效 → "软下线"
