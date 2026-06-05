## Why

当前客户端的 AI 对话无法稳定、精准地获得用户正在查看的网页状态。用户需要把网页内容手动转述给 AI，或者依赖外部 Browser / Computer Use 工具做临时观察，导致 vibecoding 操作室里的网页证据、任务上下文、AI 推理与执行链路割裂。

本变更要把“网页运行态”升级为客户端 AI 的一等上下文：先让 AI 看懂客户端内嵌网页，再在用户授权下逐步让 AI 操作网页，最终形成可审计、可回放、可绑定任务的 full browser agent。

## 目标与边界

- 在客户端内提供面向 vibecoding / Agent Task Orchestration Center 的 Browser Dock，让用户能从顶部全局 toolbar icon 打开网页，而不是跳转到系统浏览器。
- 建立 Browser Session model，把网页 URL、标题、加载状态、可见文本、语义 landmarks、链接、按钮、表单、截图引用、console/network 摘要等信息结构化为 AI 可消费的 Browser Context Snapshot。
- 让客户端对话能够显式引用当前 browser session 的网页信息，减少用户手动描述页面的成本，并提高 AI 对页面内容、错误、文档和操作目标的理解精度。
- 按阶段推进 browser agent：MVP 只读理解；后续再开放 navigate / scroll / click / type / submit 等用户授权操作；最终支持全自动网页代理任务。
- 浏览器能力必须绑定 workspace / session / TaskRun / orchestration task 中至少一种上下文，避免出现无归属、不可追踪的网页状态。
- 所有 AI 可见的网页信息必须经过 bounded snapshot、敏感字段脱敏和来源标记，不允许把完整无边界 DOM、cookie、token 或隐私字段直接塞进对话上下文。
- Browser Agent 是通用客户端能力，MUST NOT 绑定到 Codex、Claude、Gemini、OpenCode 或任一具体 engine；不同 engine 只能通过同一 Browser Context Attachment contract 消费网页上下文。
- MVP 完成并启用后，客户端内 AI 浏览器理解与浏览器操作 MUST 默认优先使用内置 Browser Agent；只有当用户明确禁用、当前平台不支持、当前能力降级，或用户明确指定不使用该模块时，才允许回退到 Browser skill、Computer Use 或外部浏览器 provider。
- Browser Agent MVP SHOULD 默认启用；客户端 MUST 仍提供启用/禁用设置。关闭后不得自动注入 browser snapshot，也不得把 AI browser operation 路由到该模块。
- 客户端 MUST 在顶部全局工具条提供 Browser Dock 入口；点击入口后 Browser Dock MUST 打开在主内容区右侧，与对话形成左右分屏。左侧 sidebar / icon rail、Workspace Home、orchestration surface、composer attachment 只能作为补充入口，不能成为唯一打开方式。
- Browser Dock MUST NOT 作为常驻遮罩浮层打开；它应像文件系统/编辑器 companion panel 一样成为 workspace 主区域的一部分。
- Browser Dock MUST 在头部提供 tab strip；用户可通过 tab 运行多个页面，内部 BrowserSession 只能作为 tab 的承载实现细节，不应暴露“当前会话数”这类内部计数。
- Browser Dock MVP MUST 采用“多 BrowserSession tab + 单 native WebView renderer”的兼容性模型。UI 可以展示多个页面 tab，但底层只维护一个 Browser Dock native renderer，并在 active tab 切换时重新绑定到当前 tab URL，避免 macOS WKWebView、Windows WebView2、Linux WebKitGTK 在同一区域多 child WebView 叠层、hide/show、z-order 行为不一致。
- Browser Dock native renderer MUST NOT break the existing Composer external file/folder drag-drop contract. The client MUST forward all Tauri WebView drag/drop payloads, including payloads captured by the main WebView and Browser Dock child WebView, back to the main Composer drag-drop service; duplicate main drop payloads MUST be deduplicated in the frontend service rather than by skipping main forwarding.
- Browser Dock 与 conversation 之间的主内容区分隔线 MUST 支持左右拖拽调整宽度，并在拖拽时保持对话和 Browser Dock 可见。
- 兼容性设计 MUST 显式覆盖 macOS、Windows、Linux，并将不支持/降级状态暴露给用户和 AI runtime。

## 非目标

- 不手搓浏览器内核；MVP 依赖 Tauri system WebView，而不是实现 Chromium / WebKit 引擎。
- MVP 不要求达到 Playwright / Chrome DevTools Protocol 的完整自动化能力。
- MVP 不默认依赖用户安装 Chrome，也不把外部浏览器作为产品主路径。
- 不允许 AI 在无用户可见页面、无授权、无审计记录的情况下静默操作网页。
- 不把 Browser Dock 变成通用文件下载器、密码管理器、cookie 管理器或代理抓包工具。
- 不替代现有 Computer Use Bridge；Computer Use 仍适合跨 App 的视觉/坐标级操作，Browser Agent 专注网页结构化理解和网页内动作。

## What Changes

- 新增 Browser Dock 产品能力：在客户端操作室内承载一个或多个 browser sessions，支持 URL 输入、导航状态、页面展示和 session 归属；MVP 使用单 native WebView renderer 承载 active tab，避免多 native WebView 同区叠层造成跨平台渲染不一致。
- 新增 Browser Context Snapshot contract：定义 AI 可以读取的网页关键信息、大小限制、脱敏策略、刷新时机和来源证据。
- 新增 AI Browser Context Bridge：让对话 / TaskRun / orchestration 能请求当前网页 snapshot，并把 snapshot 作为可引用上下文提供给 AI。
- 新增 Browser Agent action gate：为后续 navigate、scroll、click、type、submit 等网页操作定义用户授权、动作审计、失败反馈和回放证据边界。
- 新增 browser evidence model：将截图、选中内容、页面摘要、关键 DOM landmarks、操作历史与 task/session 关联，支持后续验收和复盘。
- 扩展顶部全局工具条 / sidebar / vibecoding / orchestration surface：在顶部全局 toolbar icon group 提供 Browser Dock opener，并在主内容区以 conversation-left / browser-right 的分屏方式显示 Browser Dock 状态，允许用户选择是否把当前页面注入 AI 上下文。
- 新增 Browser Agent settings：提供总开关、AI browser operation 默认优先级开关或等价策略，以及平台降级说明。
- 新增 engine-agnostic routing contract：所有 engine 的对话与任务执行均使用同一 Browser Context Attachment，不得引入 engine-specific browser context payload。
- 新增 cross-platform compatibility contract：macOS / Windows / Linux 的 WebView runtime、snapshot capture、action support 必须以 capability matrix 表达。
- 新增 implementation governance constraint：Browser Agent 模块拆分和文件体量必须遵守 `.github/workflows/large-file-governance.yml` 对应的 large-file governance gate。
- 不引入 breaking changes；现有聊天、Task Center、Computer Use、外部链接打开逻辑应保持可用。

## 技术方案选项与取舍

| 选项 | 方案 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A | React iframe 嵌入网页 | 前端改动小，视觉上最快 | 跨域 DOM 不可读，CSP/X-Frame-Options 经常阻断，AI 难以获取可靠结构化信息 | 不采用 |
| B | Tauri WebView Browser Dock + Browser Context Bridge | 原生集成客户端，用户可见，能绑定 workspace/task/session，适合产品化和审计 | 需要定义跨层 contract；自动化能力弱于 Chrome CDP；跨平台 WebView 有差异 | 采用为主路径 |
| C | 外部 Chrome/Chromium + CDP/Playwright | 自动化能力最强，DOM/network/screenshot 完整 | 分发重，依赖外部 runtime，用户信任和权限边界更复杂，不像客户端内嵌能力 | 作为后续高级 provider，不作为 MVP |
| D | Computer Use / Browser skill 操作浏览器 | 可快速验证自动化场景，跨 App 泛化能力强 | 状态不属于客户端产品；更多依赖截图/坐标或外部工具，难以成为长期 workspace/task 证据源 | 作为互补能力，不替代 Browser Dock |

主路径选择 B：先用 Tauri WebView 建立客户端内的浏览器运行态和 AI 可读 snapshot，再按需引入 C 作为高级自动化 provider。这样能先解决“AI 看不懂用户正在看的网页”的核心问题，同时为 full browser agent 留出扩展口。

MVP 的 B 方案进一步收敛为单 native renderer：BrowserSession/tab 是产品与 AI 上下文模型，native WebView 是平台渲染资源。这样牺牲 inactive tab 的 live DOM 常驻能力，换取 macOS / Windows / Linux 上更稳定的 Browser Dock 渲染与更清晰的 active tab 上下文归属。

## Capabilities

### New Capabilities

- `vibecoding-browser-agent`: 定义客户端 Browser Dock、Browser Session、Browser Context Snapshot、AI bridge、授权操作和 browser evidence 的产品行为。

### Modified Capabilities

- `agent-task-orchestration-center`: Orchestration surface 需要能关联 browser session / browser evidence，并允许 task dispatch 使用网页上下文作为输入证据。
- `agent-task-center`: TaskRun 详情需要能展示 browser evidence、browser action history 或 linked browser session，以便执行结果可审计。
- `conversation-lifecycle-contract`: 对话上下文需要支持显式附加 bounded browser snapshot，并保证页面上下文不会破坏 streaming、恢复和已有 conversation lifecycle。

## Impact

- Frontend：预计新增 `src/features/browser-agent/**` 或等价 feature slice；在顶部全局工具条提供 Browser Dock opener，左侧 sidebar 可提供辅助入口，并在主内容区右侧 companion panel 挂载 Browser Dock；新增 Browser Snapshot hook、UI 状态、i18n copy 和安全提示。
- Service bridge：预计新增 `src/services/tauri/browserAgent.ts` 并从 `src/services/tauri.ts` 统一导出，不允许 component 直接散落 `invoke()`。
- Backend：预计新增 `src-tauri/src/browser_agent/**` 或等价模块，负责 browser session command、snapshot extraction、evidence persistence、action gate 与 platform 分流；MVP 后端维护单 Browser Dock renderer 与 active session binding，确保 load/title/error 事件写回当前 active tab。
- Tauri capability / window policy：需要为 Browser Dock renderer label 增加必要 permissions，并与主窗口当前外部 URL 拦截策略分离，避免 Browser Dock 被错误转到系统浏览器。MVP 不依赖多个 child WebView 同时叠放在同一区域。
- Desktop drag-drop policy：所有 Tauri WebView drag/drop payload 必须通过 main-window forwarded drag-drop bridge 保护 Composer 外部文件/文件夹拖入能力；frontend service 负责幂等去重。不得通过跳过 main WebView forwarding、禁用 Browser Dock、牺牲透明窗口能力或绕过 Composer file-reference pipeline 来规避。
- Storage：需要 workspace-scoped browser session metadata / evidence store；敏感数据不应持久化，截图和 snapshot 需有大小、TTL 和清理策略。
- AI runtime：需要定义 browser context 注入路径和 token budget，避免每轮对话自动塞入过大的网页内容。
- Engine routing：Claude、Codex、Gemini、OpenCode、custom provider 均应复用同一 browser context attachment 与 operation provider routing，不得复制 engine-specific browser agent 实现。
- Settings：需要新增 Browser Agent enable/disable 与默认 provider preference 设置，并保证设置关闭后所有自动注入和自动操作路由都停止。
- Platform：需要维护 macOS / Windows / Linux compatibility matrix；平台不支持时必须返回结构化 degraded/unsupported 状态。
- Governance：实现拆分必须满足 `.github/workflows/large-file-governance.yml` 覆盖的 `npm run check:large-files:near-threshold` 与 `npm run check:large-files:gate`，避免 Browser Dock / snapshot / action gate 聚合成超大文件。
- Security：需要 URL allow/deny policy、敏感字段脱敏、action audit log、用户授权 gate、origin/source 标记和失败可恢复提示。
- Validation：需要覆盖 snapshot sanitizer、context size budget、service mapping、UI gate、action audit、linked TaskRun evidence 的 focused tests；实现阶段还需补 macOS / Windows / Linux 的 WebView 行为矩阵。

## 验收标准

- 用户能从顶部全局 toolbar icon 打开 Browser Dock，并在对话右侧分屏打开一个客户端内嵌网页，看到当前 URL、title、loading/error 状态。
- 用户能在 Browser Dock 中打开多个 tab，并在 tab 间切换；active tab 的 URL、标题、状态、渲染内容和 AI browser context attachment 必须一致。切换 tab 不应出现空白、被其他 tab 遮挡、循环刷新或必须关闭其他 tab 才能显示的情况。
- 用户能拖拽 conversation 与 Browser Dock 之间的分隔线，调整左右面板宽度。
- 首次使用时 Browser Agent 默认可用；如果本地设置已被关闭，Browser Dock 必须提供用户可见的一键启用路径。
- 用户能选择把当前 browser session 注入客户端 AI 对话上下文；AI 回复中能基于网页 title、可见文本、链接/按钮/表单摘要做准确引用。
- Browser Context Snapshot 必须 bounded、结构化、带来源标记，并默认脱敏 password/token/cookie/authorization/header secret 等敏感信息。
- Snapshot 不能无边界注入对话；必须有 token/字符预算、截断说明和用户可见状态。
- Browser session 必须能绑定 workspace，并能被 task/session/TaskRun 引用为 evidence。
- MVP 不开放无确认写操作；所有 click/type/submit 等网页操作在后续阶段必须经过用户授权 gate 和 action audit。
- 现有外部链接打开、Computer Use Bridge、Task Center、conversation streaming 行为不得被破坏。
- OpenSpec strict validation 通过，后续实现阶段补充前端 focused tests、Rust command tests 和跨平台手测记录。
