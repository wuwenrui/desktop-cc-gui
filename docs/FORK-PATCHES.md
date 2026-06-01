# Fork 定制改动记录 (FORK-PATCHES)

> 本文件记录所有对 upstream(`desktop-cc-gui`) **已有文件**的修改。
> 每次 `git fetch upstream && git merge upstream/main` 后，按此清单核对/重放被覆盖的定制。
>
> **fork-friendly 原则**：能新增文件就不改上游；本表只记"不得不改"的上游文件，越少越好。

## 一、修改的上游文件（merge 后需逐条核对）

| 文件 | 改动摘要 | 原因 | merge 后检查点 |
|---|---|---|---|
| `src-tauri/src/command_registry.rs` | `:360-364` generate_handler! 列表加 `skill_installer::install_bundled_skills`、`mcp_writer::write_court_crawler_mcp` | 注册律师助理命令 | 确认两命令仍在 handler 列表内 |
| `src-tauri/src/lib.rs` | `:44` 加 `mod mcp_writer;`、`:57` 加 `mod skill_installer;` | 声明新模块 | 确认两 mod 声明在 |
| `src-tauri/tauri.conf.json` | `:40` bundle.resources 加 `"../skills/**/*": "skills/"` | 打包律师 skill 到 app 资源 | 确认 resources 含该 glob |
| `src/app/app-shell.tsx` | +66 行：import + `ONBOARDED_STORAGE_KEY` + `isTauriRuntime()` + 首启 onboarded 门禁(未配置则渲染 OnboardingWizard) | 首启引导配置 new-api/skill/MCP | 上游若改 app-shell 启动渲染需重应用门禁 |

## 二、纯新增文件（与 upstream 不冲突，无需在上表跟踪）

| 文件 | 用途 |
|---|---|
| `skills/*` | 8 个律师专业 skill(尽调/合同/劳动/破产/制度/律师函/法律意见) |
| `scripts/clean-skill.mjs` | skill 硬编码(路径/客户名)清理脚本 |
| `src-tauri/src/skill_installer.rs` | 首启把 skill 安装到 ~/.claude/skills |
| `src-tauri/src/mcp_writer.rs` | 写 court-crawler SSE MCP 到 ~/.claude.json |
| `src/features/onboarding/OnboardingWizard.tsx` | 首启向导(new-api provider 运行时注入 + 装 skill + 写 MCP) |

## 三、运行时注入(不改任何上游代码)

- **new-api provider**：首启向导调用上游已有命令 `vendor_add_claude_provider` + `vendor_switch_claude_provider` 写入 `~/.claude/settings.json`，**不改** `src/features/vendors/types.ts` 的预设数组。
- **court-crawler MCP**：写入 `~/.claude.json` 的 `mcpServers`(上游对此只读、且在 PROTECTED_SYSTEM_FIELDS，切 provider 不会动它)。
