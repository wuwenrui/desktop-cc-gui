## Why

lawyer-copilot 当前是开发者工作台形态：63 个 feature 约 85% 开发者向，组织单位是 workspace，没有「案件」概念。按 `icu/docs/2026-06-10-icu-lawyer-fullcycle-rebuild-plan.html` §4.1 第一刀，需要一个「律师模式壳」（feature: lawyer-shell），让不懂代码的律师以「案件」为入口使用本应用：案件列表首页、隐藏开发者向导航、新建案件即建工作区与标准目录骨架、案件快捷动作直达 skill。

## 目标与边界

- Goal：`uiMode` 设置（`"developer" | "lawyer"`），持久化在 AppSettings；设置页提供「界面模式」切换（律师模式 / 开发者模式）。**本期默认 `"developer"`**，保持 CI 与存量行为零破坏；默认值翻转留到 Gate A 验证后。
- Goal：律师模式下侧栏导航按白名单过滤——隐藏开发者向入口（快速新会话首页、自动化看板、全局搜索、Spec Hub、项目记忆、Git 日志等），保留并置顶：我的案件（新）、Skill 市场、lawhub、设置（含锁屏、环境依赖、发行说明等非开发者项）。
- Goal：「我的案件」首页：本地案件登记表（卡片列表：标题/当事人/阶段徽章/最近打开）+ 新建案件向导（案件名/我方/对方/案由/存放目录 → 建工作区 + 标准目录骨架 → 写注册表 → 打开工作区）。
- Goal：案件卡片快捷动作 [梳理卷宗] [起草文书] [整理证据]——打开工作区并通过既有 `SELECT_SKILL_EVENT` 桥（`src/features/lawhub/pptSkill.ts`）预填 skill chip，skill 名分别为「卷宗梳理」「民事起诉状」「证据清单」（skill 文件由另一分支提供，按名引用）。
- Boundary：不重构既有代码；全部增量改动，开发者模式行为不变。
- Boundary：案件元数据仅本地（client store JSON），不接 lawhub case_id（P0 再绑）。
- Boundary：目录骨架使用既有 `ensure_workspace_path_dir`（`create_dir_all`，递归），不新增 Rust 文件系统命令。
- Boundary：不改 onboarding（§4.1 的三步 onboarding 留到下一刀）。

## What Changes

- AppSettings 增加 `uiMode`（TS `src/types.ts` + Rust `src-tauri/src/types.rs` serde default + `settings_core` sanitize），默认 `"developer"`。
- 设置页「基础-外观」新增「界面模式」单选（律师模式 / 开发者模式，中文文案）。
- 新增 `src/features/lawyer-shell/`：
  - `navVisibility.ts`：`LAWYER_VISIBLE_NAV` 白名单 + `isNavVisible()`，单测覆盖。
  - `caseRegistry.ts`：案件登记表类型与纯函数 + client store（`app` store，key `lawyerCases`）读写。
  - `caseActions.ts`：阶段枚举中文标签、目录骨架常量、快捷动作 → skill 名映射与延迟派发。
  - `CaseNavItem.tsx`：侧栏「我的案件」入口 + overlay（沿用 SkillMarketNavItem 自包含范式）。
  - `CaseHomePage.tsx` / `NewCaseDialog.tsx`：案件卡片列表与新建向导。
- `Sidebar.tsx`：按 `uiMode` 过滤主导航与设置下拉项；插入 `CaseNavItem`（律师模式置顶）。
- `useLayoutNodes.tsx` / `useAppShellLayoutNodesSection.tsx`：把 `uiMode` 与 `onOpenCaseWorkspacePath`（复用 `addWorkspaceFromPath`）传入 Sidebar。
- 无破坏性改动；不新增运行时依赖。

## Capabilities

### New Capabilities

- `lawyer-mode-shell`：律师模式壳——uiMode 设置、导航白名单过滤、本地案件登记表、案件工作区目录骨架与 skill 快捷动作。
