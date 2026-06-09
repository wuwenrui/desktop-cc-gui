## Why

用户需要在 lawyer-copilot 里「制作 PPT」：点击携带默认提示词让引擎用 HTML 生成 PPT，生成的 HTML 在「ppt」菜单下列出，点击预览在系统浏览器打开；预览时可对内容做批注，且批注要支持多律师协作（参考 casepilot 的方案预览）。

经讨论确定（设计见 lawhub `docs/2026-06-08-schemes-ppt-preview-annotation-design.md`）：
- 方案存储 + 协作批注落 **lawhub 服务端**（新 `schemes` 模块，已实现并通过测试）。
- 批注查看器是 **lawhub web `/schemes/:id`**（已实现），用系统浏览器打开。
- 分享范围仅内部律师，复用 lawhub 现有「用户名/密码 → JWT」鉴权（owner_id = owner_id_for_username），保证桌面端发布的方案与 web 端同一 owner_id、跨设备可见。

lawyer-copilot 当前**没有 lawhub 登录态**（`skill_market.rs` 只匿名下载公开 skill）。本变更为桌面端补齐：lawhub 登录 + 方案发布 + PPT 面板 + 系统浏览器预览。

## 目标与边界

- Goal：PPT 菜单点击携带默认提示词，引擎生成的 HTML 落 workspace 并在 ppt 面板列出。
- Goal：本地 HTML 可用系统浏览器直接预览（`open_workspace_in`）。
- Goal：可「发布到 lawhub」——上传 HTML 得 scheme_id，用系统浏览器打开 lawhub 查看器 URL 进行协作批注。
- Goal：lawhub 登录（用户名/密码，与 lawhub web 同凭据），token 本地存储，owner_id 与 web 一致。
- Boundary：批注 UI / 存储 / 协作全部在 lawhub（web 查看器 + schemes 模块），本仓不实现批注渲染。
- Boundary：不改 new-api，不引入匿名分享 token（仅内部律师）。
- Boundary：不动既有 skill-market 的 `loginPlatform`（其契约是旧 skillhub `{newapi_key}`，与当前 lawhub `{username,password}` 不同），新增独立 `scheme-publish` 客户端。

## What Changes

- 新增 `src/features/scheme-publish/`：lawhub 发布客户端（登录 / 发布方案 / 查看器 URL / token 存储），纯 fetch，单测覆盖。
- 新增「ppt」侧栏面板：列 workspace 下 `*.html`，提供 本地预览 / 发布到 lawhub / 打开协作 URL。
- 新增默认 PPT 提示词模板，点击注入 ChatInputBox。
- 复用 `getPlatformBaseUrl()`（`skill-market/platformConfig.ts`）作为 lawhub 基址。
- 无破坏性改动；不新增运行时依赖（仅浏览器 fetch + 既有 Tauri 命令 `open_workspace_in`）。

## Capabilities

### New Capabilities

- `ppt-scheme-publish`：桌面端把本地 PPT HTML 发布到 lawhub 并打开协作查看器。
