# Fork 定制改动记录 (FORK-PATCHES)

> 本文件记录所有对 upstream(`desktop-cc-gui`) **已有文件**的修改。
> 每次 `git fetch upstream && git merge upstream/main` 后，按此清单核对/重放被覆盖的定制。
>
> **fork-friendly 原则**：能新增文件就不改上游；本表只记"不得不改"的上游文件，越少越好。

## 一、修改的上游文件（merge 后需逐条核对）

| 文件 | 改动摘要 | 原因 | merge 后检查点 |
|---|---|---|---|
| `src-tauri/src/command_registry.rs` | generate_handler! 列表加 `skill_installer::install_bundled_skills`、`mcp_writer::write_court_crawler_mcp`、`newapi_usage::get_newapi_usage`、`claude_installer::check_claude_cli`、`claude_installer::install_claude_cli` | 注册律师助理命令 | 确认五命令仍在 handler 列表内 |
| `src-tauri/src/lib.rs` | 加 `mod mcp_writer;`、`mod skill_installer;`、`mod newapi_usage;`、`mod claude_installer;` | 声明新模块 | 确认四 mod 声明在 |
| `src-tauri/tauri.conf.json` | `:40` bundle.resources 加 `"../skills/**/*": "skills/"`；`:3` `productName` 改 `LawyerCopilot`(不动 `identifier`) | 打包律师 skill 到 app 资源；换品牌 | 确认 resources 含该 glob；productName 仍为 LawyerCopilot |
| `src/app-shell.tsx` | import + `ONBOARDED_STORAGE_KEY` + `isTauriRuntime()` + 首启 onboarded 门禁；门禁渲染 `<DependencyGate>` 包裹 `<OnboardingWizard>`(先自检 claude CLI 再进向导)；`:2064-2066` 窗口标题 `ccgui` → `律师助理` | 首启引导配置 new-api/skill/MCP + claude CLI 自检/自动安装；换品牌 | 上游若改 app-shell 启动渲染需重应用门禁与 DependencyGate 包裹；确认窗口标题为律师助理 |
| `src/features/app/components/MainTopbar.tsx` | +5 行：import `UsageBadge` + 在 `.actions` 槽内渲染 `<UsageBadge />`(置于 `actionsNode` 前) | 顶栏常驻展示 new-api 余额/用量 | 上游若改 MainTopbar 结构需重新插入 `<UsageBadge />` |
| `src/i18n/locales/en.part1.base.ts` / `zh.part1.ts` | `app.title` `ccgui` → `LawyerCopilot` / `律师助理` | 换品牌(应用标题) | 确认 app.title 两语言已换 |
| `src/i18n/locales/en.part1.ts` / `zh.part1.ts` | 首页 slogan `ccgui Agent...` → `LawyerCopilot · make legal work easier` / `律师助理 · 让法律工作更简单`；设置页 securityNotice 去掉"本项目100%开源/This project is 100% open source" | 换品牌 + 去开源标语 | 确认 slogan 已换、securityNotice 无开源句 |
| `src/i18n/locales/en.part2.ts` / `zh.part2.ts` | `chat.openSourceBanner` 文案改空字符串 `""` | 去开源标语 | 确认 openSourceBanner 为空 |
| `src/features/composer/components/ChatInputBox/ChatInputBoxHeader.tsx` | 新增 `hasOpenSourceBanner = showOpenSourceBanner && t('chat.openSourceBanner')`，banner 文案为空则不渲染该条 + 不计入 `hasContent` | 文案清空后避免留空白条 | 上游若改 banner 渲染逻辑需重应用空文案守卫 |

## 二、纯新增文件（与 upstream 不冲突，无需在上表跟踪）

| 文件 | 用途 |
|---|---|
| `skills/*` | 8 个律师专业 skill(尽调/合同/劳动/破产/制度/律师函/法律意见) |
| `scripts/clean-skill.mjs` | skill 硬编码(路径/客户名)清理脚本 |
| `src-tauri/src/skill_installer.rs` | 首启把 skill 安装到 ~/.claude/skills |
| `src-tauri/src/mcp_writer.rs` | 写 court-crawler SSE MCP 到 ~/.claude.json |
| `src/features/onboarding/OnboardingWizard.tsx` | 首启向导(new-api provider 运行时注入 + 装 skill + 写 MCP) |
| `src-tauri/src/newapi_usage.rs` | `get_newapi_usage` 命令：读 settings.json 的 ANTHROPIC_BASE_URL/AUTH_TOKEN，调 new-api `/api/usage/token`，quota→CNY 换算 |
| `src/features/usage/UsageBadge.tsx` | 顶栏余额/用量徽标(invoke get_newapi_usage，60s 刷新) |
| `src/features/usage/UsageBadge.test.tsx` | UsageBadge 组件测试(mock invoke) |
| `src-tauri/src/claude_installer.rs` | `check_claude_cli` / `install_claude_cli` 命令：自检 claude CLI(PATH + ~/.local/bin)，缺失则跑官方 native installer 自动安装并校验 |
| `src/features/setup/DependencyGate.tsx` | 启动门禁：自检 claude CLI，缺失则提供一键官方安装/重启提示，安装好后渲染 children |
| `src/features/setup/__tests__/DependencyGate.test.tsx` | DependencyGate 组件测试(mock invoke) |

## 三、运行时注入(不改任何上游代码)

- **new-api provider**：首启向导调用上游已有命令 `vendor_add_claude_provider` + `vendor_switch_claude_provider` 写入 `~/.claude/settings.json`，**不改** `src/features/vendors/types.ts` 的预设数组。
- **court-crawler MCP**：写入 `~/.claude.json` 的 `mcpServers`(上游对此只读、且在 PROTECTED_SYSTEM_FIELDS，切 provider 不会动它)。
