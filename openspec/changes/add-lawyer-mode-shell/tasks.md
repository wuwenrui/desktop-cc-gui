## 1. uiMode 设置

- [ ] 1.1 [P0][Dep:none][I: `AppSettings`（`src/types.ts:739`、`src-tauri/src/types.rs`）][O: TS `uiMode?: UiMode` + Rust `ui_mode` serde default + `settings_core` sanitize][V: `cargo test`（src-tauri）含 sanitize 用例；`npx vitest run src/features/settings/hooks/useAppSettings.test.ts`] 双侧增加 uiMode，默认 developer，非法值回退。
- [ ] 1.2 [P0][Dep:1.1][I: `BasicAppearanceSection.tsx` layoutMode 单选范式][O: 设置页「界面模式」单选（律师模式/开发者模式，中文）][V: typecheck + 既有 settings 测试不破] 设置页切换开关。

## 2. 导航白名单过滤

- [ ] 2.1 [P0][Dep:1.1][I: Sidebar 主导航与设置下拉结构][O: `src/features/lawyer-shell/navVisibility.ts`（`LAWYER_VISIBLE_NAV` + `isNavVisible`）][V: `npx vitest run src/features/lawyer-shell/navVisibility.test.ts`] 可测试的过滤配置。
- [ ] 2.2 [P0][Dep:2.1][I: `Sidebar.tsx` + `useLayoutNodes.tsx` + `useAppShellLayoutNodesSection.tsx`][O: Sidebar 接收 `uiMode`，按白名单条件渲染；律师模式「我的案件」置顶][V: Sidebar 既有测试 + typecheck] 接线过滤。

## 3. 案件登记表与首页

- [ ] 3.1 [P0][Dep:none][I: `clientStorage.ts`（`app` store）][O: `caseRegistry.ts` 类型 + 纯函数 + 读写][V: `npx vitest run src/features/lawyer-shell/caseRegistry.test.ts`] 案件登记表。
- [ ] 3.2 [P0][Dep:3.1][I: `SkillMarketNavItem` 自包含 nav+overlay 范式][O: `CaseNavItem.tsx` + `CaseHomePage.tsx`（卡片列表/阶段徽章/最近打开/新建按钮）][V: `npx vitest run src/features/lawyer-shell/CaseHomePage.test.tsx`] 我的案件首页。
- [ ] 3.3 [P0][Dep:3.1][I: `@tauri-apps/plugin-dialog open` + `ensureWorkspacePathDir` + `addWorkspaceFromPath`][O: `NewCaseDialog.tsx` 向导：建目录骨架 → 写注册表 → 打开工作区][V: CaseHomePage 测试覆盖向导提交（mock tauri invoke）] 新建案件向导。

## 4. 快捷动作

- [ ] 4.1 [P1][Dep:3.2][I: `pptSkill.ts` 的 `dispatchSelectSkill`（Composer 监听 `SELECT_SKILL_EVENT`）][O: `caseActions.ts` 三动作 → skill 名映射 + 延迟派发；卡片三按钮][V: CaseHomePage 测试断言事件派发] [梳理卷宗][起草文书][整理证据]。

## 5. 验证

- [ ] 5.1 [P0][Dep:1-4][V: `npm run typecheck`、`npm run lint`、新增测试全过、`cargo check`（src-tauri）、`check:runtime-contracts`/`check:large-files` 通过] 静态 + 单元验证。
- [ ] 5.2 [P0][Dep:5.1][V: 起 `npm run tauri:dev`：切律师模式 → 新建案件 → 目录骨架生成 → 快捷动作打开工作区且 composer 出现 skill chip] 端到端手动验证（需桌面 app，本变更内不可做）。
