## Why

lawhub 平台已托管律师业务 skill（zip 多文件结构，含 sub-skills/、references/）。当前桌面端的问题：

1. 左侧 `lawhub` 菜单只挂固定能力（制作 PPT / 文件转 Markdown / 视觉 OCR）与 HTML 产物，市场安装的 skill 在侧栏不可见，用户无入口点击使用。
2. 全应用没有任何 skill 结构查看界面：安装前看不到内容（市场面板只有元数据），安装后也无法浏览 SKILL.md / 子技能。
3. 市场入口只有顶部「Skill 市场」按钮，与 lawhub 菜单割裂；安装顺序信息缺失（`.skillhub-installed.json` 按名称排序）。

本变更让 lawhub 菜单成为技能的统一入口：分组展示（PPT 组 / 技能组）、点击注入对话框、本地结构查看、市场装前预览、安装后实时出现在侧栏。

## 目标与边界

- Goal：lawhub 菜单分为「PPT」「技能」两组；PPT 组保留现有制作 PPT + HTML 产物行为不变。
- Goal：技能组顺序展示内置 prompt 技能（文件转 Markdown / 视觉 OCR）与 lawhub 市场安装的 skill（按安装时间排序），尾部提供「添加技能」直达市场弹窗。
- Goal：点击技能名称复用现有 `ccgui:select-skill` 事件注入 Composer skill chip，不新增触发协议。
- Goal：市场安装的 skill 提供「查看」入口，打开结构面板：本地读取 `~/.claude/skills/<name>/` 文件树与文本内容；`sub-skills/*_SKILL.md` 行提供一键注入。
- Goal：市场面板点击条目展示装前预览（文件树 + SKILL.md 内容），数据来自 lawhub 服务端在线解析 zip 的新 API，未安装不落盘。
- Goal：`.skillhub-installed.json` 的条目增加 `installed_at` 时间戳，旧索引缺字段时回落名称排序。
- Boundary：不实现「skill 不落盘使用」；使用仍以本地安装为前提（已评估：子技能运行时 Read 与 scripts 执行均依赖本地文件）。
- Boundary：不改 lawhub 既有发布/下载/鉴权行为；本变更只消费其新增预览 API。
- Boundary：内置 bundled 技能（制作 PPT 等）无本地目录，不提供「查看」。

## What Changes

- 重构 `LawhubNavSection`：新增组标签与技能组渲染；接入 `market_list_installed` 数据源；保留既有 PPT/HTML/登录发布逻辑。
- 新增技能结构面板 feature（`skill-structure` 视图）：文件树 + 文件内容渲染（markdown 文本展示），子技能行注入动作。
- Rust `skill_market.rs`：`InstalledEntry` 增加 `installed_at`（serde default 向后兼容）；新增 `market_skill_tree` / `market_skill_file` 命令（路径安全校验，512KB 上限）。
- `SkillMarketPanel`：新增装前预览区（调 lawhub `GET /api/skills/{id}/versions/{v}/files[/{path}]`）；安装成功后侧栏技能组刷新。
- 市场弹窗可由 lawhub 菜单「添加技能」打开（与顶部入口同源）。

## Capabilities

### New Capabilities

- `lawhub-skill-group-structure-preview`：lawhub 菜单分组展示已装技能，支持点击注入、本地结构查看、市场装前预览与安装顺序排序。

### Modified Capabilities

- 无（`ccgui:select-skill` 事件、market 安装链路语义不变，仅新增消费者）。
