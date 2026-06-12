## Context

- `LawhubNavSection.tsx` 是侧栏内联展开菜单，现有子项：制作 PPT / 文件转 Markdown / 视觉 OCR / 工作区 `*.html` 列表（点名称 `openPath` 系统默认打开，点 lawhub 上传协作查看器）。
- skill 注入链路已存在：`pptSkill.ts` 的 `dispatchSelectSkill(name)` 发 `ccgui:select-skill` 事件，`Composer.tsx` 监听后挂 skill chip（按名称匹配本地已发现 skill）。
- 市场链路已存在：`SkillMarketNavItem` 打开弹窗 → `SkillMarketPanel` 搜索公开 skill → Tauri `market_add_skill` 下载 zip 解压到 `~/.claude/skills/<name>/` 并写 `.skillhub-installed.json` 索引 → `market_list_installed` 读索引。
- lawhub 服务端同步新增装前预览 API（独立仓库变更）：
  - `GET /api/skills/{id}/versions/{v}/files` → `{ files: [{ path, size, is_dir }] }`
  - `GET /api/skills/{id}/versions/{v}/files/{path}` → `{ path, content, size, truncated }`（512KB 截断；二进制 415）
  - 权限同 download（公开匿名可读，私有仅属主/管理员）。

设计稿（用户已确认）：`icu/docs/2026-06-12-skill-hosting-prototype/lawhub技能托管交互原型.html`。

## Decisions

### Decision 1: 已装技能数据源 = `.skillhub-installed.json` 索引，不扫全量本地 skill

技能组只列 lawhub 市场安装的 skill（索引天然区分来源），不混入 project/plugin 等其他来源的 skill——其他来源在 `/` 斜杠补全中仍可用。索引条目结构：

```rust
struct InstalledEntry {
  skill_id: i64,
  version: i64,
  #[serde(default)]
  installed_at: Option<u64>, // epoch ms；旧索引缺字段 → None
  #[serde(default)]
  display_name: Option<String>, // 平台 display_name；侧栏展示用，缺失回落 name
}
```

排序：`installed_at` 升序（先装在前），`None` 条目排前并按名称序兜底。旧客户端读新索引忽略未知字段（serde 默认行为），向后兼容。`market_add_skill` 增加可选 `display_name` 参数：新装与升级时如提供则写入；侧栏展示 `display_name ?? name`。

### Decision 2: 结构查看分两路——已装走本地，未装走服务端

- 已装（侧栏「查看」）：Rust 命令直读本地目录，离线可用、无网络依赖。
  - `market_skill_tree(name) -> Vec<SkillTreeEntry { path, size, is_dir }>`（相对路径，递归，按路径排序）
  - `market_skill_file(name, rel_path) -> SkillFileContent { path, content, size, truncated }`
  - 安全：`name` 与 `rel_path` 拒绝绝对路径 / `..` / 盘符（复用 `safe_relative_path` 同级校验）；最终路径必须落在 `~/.claude/skills/<name>/` 之下；文本上限 512KB，非 UTF-8 报错。
- 未装（市场装前预览）：前端直接 fetch lawhub 预览 API（与 `fetchPublicSkills` 同源 baseUrl），不经 Rust，不落盘。

两路返回结构对齐（path/size/is_dir 与 path/content/size/truncated），结构面板组件一份渲染两处复用。

### Decision 3: 注入复用 `ccgui:select-skill`，子技能注入 = chip + 预填文本

- 点技能名称：`dispatchSelectSkill(displayName)`——零新协议。chip 匹配依赖本地 skill 发现（`skills_list` 已扫 `~/.claude/skills/`），故「查看/注入」仅对已装技能开放，语义自洽。
- 子技能「用」：先 `dispatchSelectSkill(主技能名)`，再通过现有 Composer 插入事件预填「使用 <子技能编号名称> 处理 」文本（若插入事件不可复用则仅注入 chip，文本由用户输入——以实现时既有事件桥为准，不为此新增协议）。

### Decision 4: 市场弹窗状态上移，「添加技能」与顶部入口同源

`SkillMarketNavItem` 当前自持弹窗开关。改为开关状态由共享 hook/事件承载（最小改动：导出 `openSkillMarket()` 触发器），`LawhubNavSection` 的「添加技能」与顶部按钮调用同一触发器。安装成功后广播刷新，`LawhubNavSection` 重拉 `market_list_installed`。

### Decision 5: UI 组织

- 组标签为非交互行（`PPT` / `技能`），样式随 `sidebar.css` 既有 token；技能组顺序：文件转 Markdown、视觉 OCR（bundled，无查看）→ 已装 skill（installed_at 序，名称 + 眼睛「查看」）→ 「+ 添加技能」。
- 结构面板用主区右侧抽屉（遮罩 + 滑入动画），树位于左、内容居右；树中 `sub-skills/*_SKILL.md` 悬停出「用」。
- 装前预览嵌入市场弹窗右侧（左列表 372px / 右预览），空态提示「点击左侧技能查看装前预览」。

## Risks / Trade-offs

- `market_skill_file` 渲染 markdown 为纯文本样式（不引入新 markdown 渲染依赖时，优先复用应用内既有 markdown 渲染组件；没有则降级 `<pre>` 文本，不阻塞本变更）。
- lawhub 预览 API 未上线时，市场预览区展示错误态（「平台暂不支持在线预览」），不影响安装主链路。
- 安装目录名 = 平台 `name` 字段；中文 name 历史数据仍可工作（目录名兼容），新发布约定 ASCII name 属平台侧规范，不在本变更强校验。
