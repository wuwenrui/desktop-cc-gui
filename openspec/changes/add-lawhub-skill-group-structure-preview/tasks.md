## 1. 规范与契约

- [ ] 1.1 [P0][Dep:none][I: 设计稿 + 现有 lawhub 菜单/市场/注入链路][O: spec delta][V: `openspec validate add-lawhub-skill-group-structure-preview --strict --no-interactive`] 完成行为规范。
- [x] 1.2 [P0][Dep:1.1][I: skill_market.rs][O: `market_skill_tree` / `market_skill_file` / `installed_at` 契约定稿][V: 前后端签名一致] 固定 Rust 命令契约。

## 2. Rust 数据与命令

- [x] 2.1 [P0][Dep:1.2][I: `InstalledEntry`][O: `installed_at: Option<u64>` + `market_add_skill` 写时间戳][V: cargo test 覆盖新装带时间戳、旧索引反序列化兼容] 安装时间戳。
- [x] 2.2 [P0][Dep:1.2][I: `~/.claude/skills/<name>/`][O: `market_skill_tree` 命令][V: cargo test 覆盖树正确、非法 name 拒绝] 本地文件树。
- [x] 2.3 [P0][Dep:2.2][I: 同上][O: `market_skill_file` 命令][V: cargo test 覆盖内容、路径逃逸拒绝、512KB 截断、非 UTF-8 报错] 本地文件内容。

## 3. 侧栏分组与注入

- [x] 3.1 [P0][Dep:2.1][I: `LawhubNavSection`][O: PPT 组 / 技能组分组渲染 + installed 列表（installed_at 排序）+「添加技能」][V: vitest 覆盖分组、排序、空态；既有 PPT/HTML 行为回归] 分组重构。
- [x] 3.2 [P0][Dep:3.1][I: `dispatchSelectSkill`][O: 技能名称点击注入 chip][V: vitest 断言事件 payload] 注入接线。
- [x] 3.3 [P0][Dep:3.1][I: SkillMarketNavItem 弹窗状态][O: 共享打开触发器][V: vitest：两个入口打开同一弹窗] 市场入口同源。

## 4. 结构面板与装前预览

- [x] 4.1 [P0][Dep:2.3][I: Rust 命令][O: 结构抽屉组件（树 + 内容 + 子技能「用」）][V: vitest 覆盖树渲染、文件选择、注入动作] 本地结构查看。
- [x] 4.2 [P0][Dep:1.2][I: lawhub 预览 API][O: SkillMarketPanel 装前预览区][V: vitest mock fetch 覆盖预览渲染与 API 错误态] 装前预览。
- [x] 4.3 [P1][Dep:4.1,4.2][I: sidebar.css token][O: 新增样式][V: `npm run typecheck` + `npm run lint`] 样式对齐设计稿。

## 5. 验证

- [x] 5.1 [P0][Dep:4.*][V: focused vitest 全绿] 新增单元/组件测试执行。
- [x] 5.2 [P0][Dep:5.1][V: `npm run typecheck`、`npm run lint`、`cargo test` 相关模块] 静态检查与 Rust 测试。
- [ ] 5.3 [P0][Dep:5.2][V: 桌面手动验收：分组/注入/查看/预览/安装后刷新] 端到端走查。

## 6. PPT 产物列表修缮（增量）

- [x] 6.1 [P0][Dep:none][I: JS openPath 被 opener:default 拒绝（不含 allow-open-path；且 scope glob 不匹配点目录）][O: Rust 命令 open_workspace_path_default（工作区根校验 + opener 插件 Rust 侧打开），preview 改走该命令][V: 真机点击 html 拉起系统默认程序] 打开失败 bug 修复。
- [x] 6.2 [P0][Dep:none][I: 新命令 workspace_file_times（创建时间，越界守卫，created 回退 modified）][O: 产物按创建时间倒序][V: vitest 倒序用例 + cargo check] 倒序展示。
- [x] 6.3 [P0][Dep:6.2][I: 侧栏 primary-nav 无滚动容器][O: PPT 组头可折叠（数量徽标 + localStorage）+ 默认 5 条「显示全部」+ 列表 38vh 内滚][V: vitest 折叠/截断用例 + 真机滚动验证] 折叠与滚动。

## 7. 技能概览化与补装（增量）

- [x] 7.1 [P0][Dep:none][I: bundled skill 只在 onboarding 安装，老用户点新增技能无 chip][O: skill_installer install_missing_skills + lib.rs 启动 sync（只补缺不覆盖）][V: cargo test 5/5 + 真机 chip 注入] 启动补装。
- [x] 7.2 [P0][Dep:none][I: 文件树抽屉对律师无意义][O: skillMeta.ts（description 解析/能力清单/子技能介绍/示例说法）+ 抽屉概览化（什么时候用/能做什么/怎么用），能力卡点击展开子技能介绍，文件树彻底移除][V: vitest 概览/能力卡用例 + 真机点击介绍实测] 概览抽屉。
- [x] 7.5 [P1][Dep:none][I: macOS 预定义菜单项默认用包名 cc-gui][O: hide/quit 显式传「隐藏/退出 LawyerCopilot」、services/hide_others 中文化][V: cargo test menu 4/4] 菜单品牌名。
- [x] 7.3 [P1][Dep:7.2][I: 已装技能行 title 无简介][O: 懒取 SKILL.md description 做悬浮提示][V: 真机 title 含简介] 悬浮简介。
- [x] 7.4 [P0][Dep:7.1][I: superpowers:writing-skills 精髓][O: bundled skill skills/制作技能.md + 侧栏「制作技能」入口][V: vitest 事件用例 + 真机 chip 注入] 制作技能。
- [x] 7.6 [P0][Dep:7.2][I: 已装索引 display_name + `$` completion + lawhub 点击事件][O: 侧栏、chip、`$` 下拉统一显示中文名；点击中文名仍解析为真实 skill token][V: vitest 覆盖 displayName 映射、事件解析、下拉展示] 中文名统一。
- [x] 7.7 [P0][Dep:7.6][I: bundled top-level `~/.claude/skills/<name>.md`][O: `market_skill_tree/file` 支持单文件 skill，PPT/文件转 Markdown/视觉 OCR/制作技能均有眼睛查看入口][V: cargo test 单文件 skill + vitest 内置眼睛入口] 内置技能查看。
