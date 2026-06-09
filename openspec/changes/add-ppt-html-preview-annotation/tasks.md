## 1. lawhub 发布客户端（scheme-publish）

- [x] 1.1 [P0][Dep:none][I: lawhub `/api/auth/login {username,password}→{token,user}`、`/api/schemes`][O: `src/features/scheme-publish/api.ts` 提供 loginLawhub / publishScheme / schemeViewerUrl / token 存取][V: `npx vitest run src/features/scheme-publish/api.test.ts` 全通过] 实现并单测发布客户端（mock fetch，断言 URL/method/body/Bearer）。
- [x] 1.2 [P0][Dep:1.1][I: lawhub 基址][O: 复用 `getPlatformBaseUrl()` 作为默认基址][V: 单测覆盖 URL 拼接] 基址复用 skill-market 配置，不另造。

## 2a. lawhub 左侧父菜单（按用户反馈：右侧 tab 不够直观）

- [x] 2a.1 [P0][Dep:2.2][I: `SkillMarketNavItem` 自包含 nav+overlay 范式 + Sidebar `workspaces`/`activeWorkspaceId`][O: 左侧主菜单（Skill 市场 下方）加「lawhub」父入口，overlay 内挂 PptPanel；`LawhubNavItem.tsx` + Sidebar:2159 插入][V: `LawhubNavItem.test.tsx` 4 passed；Sidebar 既有测试 13 passed；起 app 截图确认 lawhub 出现在左侧] 加 lawhub 父菜单。overlay 内「制作 PPT」走剪贴板复制+提示（overlay 无 composer 实例）。

## 2. PPT 侧栏面板（右侧 tab，保留）

- [x] 2.1 [P0][Dep:none][I: `PanelTabs.tsx` 的 `PanelTabId` 联合类型][O: 新增 `"ppt"` tab + Presentation 图标 + i18n（zh/en panels.ppt）][V: tsc 干净 + PanelTabs/DesktopLayout/visibility 测试 26 passed] 注册 ppt 菜单。已同步 `useLayoutNodes` 的 filePanelMode 联合。
- [x] 2.2 [P0][Dep:2.1][I: `getWorkspaceFiles`/`readWorkspaceFile`/`openWorkspaceIn` 服务封装][O: `src/features/ppt/components/PptPanel.tsx` 列本地 `*.html`，行内：本地预览 / 发布到 lawhub（含内联登录）][V: `PptPanel.test.tsx` 6 passed] 实现面板组件。
- [x] 2.3 [P0][Dep:2.2][I: `useLayoutNodes.tsx` 挂载逻辑][O: `filePanelMode === "ppt"` 时挂 PptPanel][V: tsc 干净 + layout 测试不破] 挂载到布局。
- [x] 2.4 [P1][Dep:2.2][I: `openWorkspaceIn`（`open_workspace_in`）][O: 本地预览开本地文件 / 发布后开 lawhub 查看器 URL][V: 单测断言 openWorkspaceIn 被以正确 path/URL 调用；实际浏览器弹出需起 app] 接系统浏览器预览。

## 3. 默认提示词

- [x] 3.1 [P1][Dep:none][I: `onInsertComposerText` 注入流][O: 面板「制作 PPT」按钮注入 `DEFAULT_PPT_PROMPT`][V: `PptPanel.test.tsx` 断言 onInsertText 被调用] 加默认 PPT 提示词。

## 4. 验证

- [x] 4.1 [P0][Dep:1.1][V: 发布客户端单测通过] scheme-publish 客户端测试（6 passed）。
- [x] 4.2 [P0][Dep:2.*,3.*][V: `npm run typecheck` 干净、`eslint` 干净、`npx vitest run`（ppt+scheme-publish 12 + layout 26）全通过] 静态 + 单元验证。
- [ ] 4.3 [P0][Dep:4.2][V: 起 `npm run tauri:dev` 走通 生成→列出→本地预览→发布→浏览器协作批注] 端到端手动验证（需桌面 app，无头环境不可做）。
