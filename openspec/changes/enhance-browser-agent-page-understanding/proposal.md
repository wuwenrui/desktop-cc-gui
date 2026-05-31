## Why

Browser Dock Phase 1 已经让网页进入客户端，并能把浅层 browser context 交给 AI；但当前上下文仍偏薄，主要覆盖 URL、title、summary 与少量 metadata。用户真正想要的是：AI 能看懂右侧页面的正文、结构、交互元素和本地页面对应代码，从而让“看页面、描述问题、修改代码、验证效果”变成一条连续链路。

Phase 2 要把 Browser Agent 从“内嵌浏览器 + 浅层上下文提示器”升级为“结构化页面理解器 + 本地页面到代码的桥”，为后续全自动网页代理奠定可审计、可控、跨引擎通用的上下文基础。

## 目标与边界

- Phase 2 MUST 继承 Phase 1 `add-vibecoding-browser-agent` 的 Browser Dock MVP 约束：顶部全局入口、主内容区右侧分屏、conversation / Browser Dock 可拖拽分隔、多 tab UI、单 native WebView renderer、active tab 归属、engine-agnostic attachment、默认优先内置 Browser Agent、可禁用设置、跨 macOS / Windows / Linux capability 降级、large-file governance、隐私默认安全。
- Browser Agent MUST 以 active tab 为唯一默认上下文目标；多 tab 只影响用户可见页面选择，不允许 AI 混用 inactive tab 内容。
- Browser Context Snapshot v2 MUST 提供结构化页面事实，包括 URL、title、viewport、scroll、visible text、headings、links、buttons、forms、main article/content regions、diagnostics、budget 与 redaction metadata。
- Composer MUST 展示 AI 实际将收到的 browser context preview，让用户能判断“AI 看到了什么”，并能移除或刷新该上下文。
- 本地开发页面 SHOULD 建立 page-to-code bridge：从 active URL / route / visible text / DOM landmarks 推导候选 route、component、file path，帮助 AI 更快定位应修改的代码。
- Browser evidence MUST 记录 snapshot 来源、时间、tab、route/code candidates、truncation/redaction 状态，并能被对话、TaskRun、orchestration task 引用。
- Phase 2 MUST 继续保持 engine-agnostic；Claude、Codex、Gemini、OpenCode、custom provider 都只能消费同一个 BrowserContextAttachment v2 contract。
- Phase 2 MUST 延续 Phase 1 的隐私边界：不注入 raw DOM、cookies、headers、password、token、Authorization 或页面密文。
- Phase 2 以“AI 看懂页面”和“AI 更容易根据页面修改本地代码”为主，不默认开放 click/type/submit 等写操作。

## 非目标

- 不实现完整 browser automation runtime，不承诺 Playwright / CDP 等级能力。
- 不在 Phase 2 默认开放无确认网页写操作；click/type/submit 仍属于后续授权操作阶段。
- 不将外部网站内容映射到本地代码；page-to-code bridge 只对 localhost、file/app route 或当前 workspace 可识别页面生效。
- 不抓取或持久化完整 HTML、完整 DOM、cookies、headers、localStorage、sessionStorage 或认证态密文。
- 不替代现有文件搜索、代码索引、Computer Use 或 Browser skill；Phase 2 负责把页面事实转成更好的 AI 上下文与代码定位线索。

## What Changes

- 明确 Phase 2 是 Phase 1 Browser Dock MVP 的增强层，不替换 Phase 1 的入口、布局、tab、renderer、settings、provider routing、privacy 和 cross-platform compatibility 约束。
- 新增 Browser Context Snapshot v2：从 active tab 提取 bounded visible text、semantic headings、links、buttons、forms、article/content regions、viewport/scroll 状态和 capture warnings。
- 新增 Browser Context Preview UI：composer 附件展示 URL、title、正文片段、元素计数、redaction/truncation 状态、刷新时间和“AI 将看到的内容”。
- 新增 Browser Element Landmark model：为按钮、链接、输入框、标题、主要内容区域生成稳定、可审计的 landmark 描述，为后续操作 preview 做准备。
- 新增 Local Page-to-Code Bridge：当 active tab 是本地开发页面时，基于 route、workspace root、visible text 和现有源码搜索能力生成 candidate files/components。
- 扩展 Browser Evidence：保存 snapshot v2 引用、页面结构摘要、候选代码文件、capture budget 和隐私处理状态。
- 扩展 AI Browser Context Attachment：向 AI request 注入 bounded snapshot v2 和可选 code candidates，保持 engine-agnostic payload。
- 扩展 TaskRun / orchestration evidence：允许任务启动和结果详情引用 browser snapshot v2 与 page-to-code candidates。
- 新增 refresh / stale policy：页面滚动、URL 变化、tab 切换或超过 TTL 后，context preview 必须标记 stale，并允许用户刷新。
- 新增 degraded / unsupported diagnostics：当页面受 CSP、WebView API、跨平台能力或脱敏策略限制时，向用户和 AI 明确说明上下文缺口。

## 技术方案选项与取舍

| 选项 | 方案 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A | 只把 URL/title/summary 注入 AI | 实现简单，风险低 | AI 只能粗略理解页面，无法稳定回答“页面哪里有问题”和“该改哪个文件” | 不足以支撑最终目标 |
| B | WebView 内注入只读 capture script，生成 bounded semantic snapshot | 能获得 visible text、roles、forms、links、viewport 等关键事实；不依赖外部 Chrome；符合客户端内嵌体验 | 需要严格脱敏、预算控制和跨平台降级处理 | Phase 2 主路径 |
| C | 外部 Chrome/CDP/Playwright 作为默认采集层 | DOM/network/screenshot 能力强，自动化空间大 | 依赖重、分发复杂、权限边界更敏感，不适合作为客户端默认 MVP 路径 | 后续高级 provider |
| D | 仅靠截图/Computer Use 视觉理解 | 能覆盖视觉布局和跨 App 场景 | 坐标/截图不稳定，难以形成结构化 page-to-code bridge | 作为补充，不作为主路径 |

主路径选择 B：在现有 Browser Dock 单 native renderer 基础上增强只读页面事实采集，先把 AI “看懂页面”的质量做扎实；C/D 作为后续高级能力或降级补充。

## Capabilities

### New Capabilities

- `browser-agent-page-understanding`: 定义 Browser Context Snapshot v2、context preview、element landmarks、stale/refresh policy、page-to-code candidates 和 browser evidence v2 的产品行为。

### Modified Capabilities

- `conversation-lifecycle-contract`: 对话上下文需要支持 BrowserContextAttachment v2、可见 preview、刷新/移除/stale 状态，并保证 streaming 与恢复不被 browser attachment 破坏。
- `conversation-fact-contract`: 浏览器页面事实需要以结构化、可追溯、可预算的方式进入对话事实层，避免无来源或无边界文本混入上下文。
- `agent-task-center`: TaskRun 需要展示 browser snapshot v2、页面结构摘要、候选代码文件和 evidence 可用/过期状态。
- `agent-task-orchestration-center`: Orchestration dispatch 需要允许 browser snapshot v2 和 page-to-code candidates 作为任务输入证据。
- `file-view-code-intelligence-navigation`: 本地页面到代码候选文件的跳转与解释需要复用现有代码导航能力，而不是在 Browser Agent 内重复实现文件智能导航。

## Impact

- Frontend：扩展 `src/features/browser-agent/**` 的 snapshot preview、landmark rendering、stale/refresh UI；扩展 composer browser attachment 展示；扩展 TaskRun/evidence surfaces。
- Service bridge：扩展 `src/services/tauri/browserAgent.ts`，新增 snapshot v2 capture、refresh、evidence 查询、page-to-code candidate bridge 命令封装。
- Backend：扩展 `src-tauri/src/browser_agent/**`，在不存储敏感 raw payload 的前提下提供只读 capture、sanitization、budget、evidence metadata 和 platform diagnostics。
- AI runtime：扩展 engine-agnostic BrowserContextAttachment payload，将 bounded snapshot v2 和可选 candidate files 注入模型请求；不同 engine 不得 fork 专用 payload。
- Code intelligence：需要复用 route/file search/source navigation 能力，把 local URL、visible text 和 landmarks 转成候选源码位置。
- Storage：Browser evidence v2 需要 TTL、大小预算、redaction metadata、source tab/session、candidate files 和 stale 状态。
- Security / Privacy：需要继续阻断 raw DOM/cookies/headers/secrets；capture script 只能输出经过 redaction 和预算裁剪的结构化事实。
- Validation：需要覆盖 snapshot sanitizer、landmark extraction、context preview、stale policy、AI payload budget、local route-to-code candidates 和 evidence 生命周期。

## 验收标准

- 用户在 Browser Dock 打开页面后，能刷新并关联 Browser Context Snapshot v2；composer preview 清楚展示 AI 将看到的 URL、title、正文片段、元素计数、预算、脱敏和 stale 状态。
- AI 能基于 browser context 回答当前页面的正文主题、关键标题、主要链接、按钮、表单和可见内容，而不是只依赖 URL/title/summary。
- 当用户切换 tab、页面 URL 改变、滚动或 snapshot 超过 TTL 时，composer preview 必须标记 stale，并允许用户刷新。
- 对本地开发页面，AI attachment 能提供候选 route/component/file 列表，并说明候选来源，例如 URL route、visible text match、landmark match。
- 用户可以用自然语言描述右侧页面问题，AI 能更容易定位到候选代码文件；如果候选不足，AI 必须明确说明缺口，而不是臆造文件。
- Browser snapshot v2 必须 bounded、脱敏、带来源、带 capture time、带 truncation/redaction metadata；不得注入 raw DOM、cookies、headers、password/token/authorization。
- TaskRun / orchestration task 可以引用 browser snapshot v2 evidence，并在详情中显示可用、过期或降级状态。
- 现有 Browser Dock 多 tab + 单 native renderer、conversation streaming、Task Center、文件系统和外部链接策略不得回归。
