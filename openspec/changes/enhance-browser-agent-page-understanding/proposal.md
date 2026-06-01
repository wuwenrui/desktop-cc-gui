## Why

Browser Dock Phase 1 已经让网页进入客户端，并能把浅层 browser context 交给 AI；但当前上下文仍偏薄，主要覆盖 URL、title、summary 与少量 metadata。用户真正想要的是：AI 能看懂右侧页面的正文、结构、交互元素和本地页面对应代码，从而让“看页面、描述问题、修改代码、验证效果”变成一条连续链路。

Phase 2 要把 Browser Agent 从“内嵌浏览器 + 浅层上下文提示器”升级为“结构化页面理解器 + 本地页面到代码的桥”，为后续全自动网页代理奠定可审计、可控、跨引擎通用的上下文基础。

## 目标与边界

- Phase 2 MUST 继承 Phase 1 `add-vibecoding-browser-agent` 的 Browser Dock MVP 约束：顶部全局入口、主内容区右侧分屏、conversation / Browser Dock 可拖拽分隔、多 tab UI、单 native WebView renderer、active tab 归属、engine-agnostic attachment、默认优先内置 Browser Agent、可禁用设置、跨 macOS / Windows / Linux capability 降级、large-file governance、隐私默认安全。
- Browser Agent MUST 以 active tab 为唯一默认上下文目标；多 tab 只影响用户可见页面选择，不允许 AI 混用 inactive tab 内容。
- Browser Context Snapshot v2 MUST 提供结构化页面事实，包括 URL、title、viewport、scroll、visible text、headings、links、buttons、forms、main article/content regions、diagnostics、budget 与 redaction metadata。
- Composer MUST 展示 AI 实际将收到的 browser context preview，让用户能判断“AI 看到了什么”，并能移除或刷新该上下文。
- 本地开发页面 SHOULD 建立 page-to-code bridge：从 active URL / route / visible text / DOM landmarks 推导候选 route、component、file path，帮助 AI 更快定位应修改的代码。
- Phase 2 MUST 修正 Phase 1 的 URL policy 与本地开发目标之间的矛盾：Browser Agent 默认仍禁止任意 private-network 访问，但 MUST 支持 workspace-scoped local dev URL allow policy，用于 localhost / 127.0.0.1 / app route / file-like workspace 页面理解。
- Composer MUST 从 Browser Dock 的 active tab source of truth 获取 browser session，不得通过“第一个 ready session”推断当前上下文。
- AI request MUST 通过单一 engine-agnostic BrowserContextAttachment v2 formatter 注入浏览器上下文；legacy prompt block 只能作为 fallback，不得与结构化 attachment 双重注入。
- Browser evidence MUST 记录 snapshot 来源、时间、tab、route/code candidates、truncation/redaction 状态，并能被对话、TaskRun、orchestration task 引用。
- Phase 2 MUST 继续保持 engine-agnostic；Claude、Codex、Gemini、OpenCode、custom provider 都只能消费同一个 BrowserContextAttachment v2 contract。
- Phase 2 MUST 延续 Phase 1 的隐私边界：不注入 raw DOM、cookies、headers、password、token、Authorization 或页面密文。
- Snapshot sanitizer MUST 覆盖所有 AI-visible string fields，包括 visible text、selected text、link href、labels、placeholders、ARIA text、landmark preview、form metadata 和 diagnostics。
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
- 新增 Active Browser Context Source：Browser Dock 维护 active tab / active renderer / active snapshot 的唯一事实源，Composer、TaskRun、orchestration 只从该 contract 取上下文。
- 新增 workspace-scoped local URL allow policy：在保留 SSRF/private-network 默认防护的前提下，为当前 workspace 的本地开发页面开启受控页面理解。
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
- Frontend large-file guard：Phase 2 新增 UI MUST 拆到 `BrowserContextPreview`、attachment hook、candidate subcomponents 或 service utilities；不得继续把核心逻辑堆进现有 `Composer.tsx` / `BrowserDock.tsx`。
- Service bridge：扩展 `src/services/tauri/browserAgent.ts`，新增 snapshot v2 capture、refresh、evidence 查询、page-to-code candidate bridge 命令封装。
- Backend：扩展 `src-tauri/src/browser_agent/**`，在不存储敏感 raw payload 的前提下提供只读 capture、sanitization、budget、evidence metadata 和 platform diagnostics。
- AI runtime：扩展 engine-agnostic BrowserContextAttachment payload，将 bounded snapshot v2 和可选 candidate files 注入模型请求；不同 engine 不得 fork 专用 payload。
- Code intelligence：需要复用 route/file search/source navigation 能力，把 local URL、visible text 和 landmarks 转成候选源码位置。
- Storage：Browser evidence v2 需要 TTL、大小预算、redaction metadata、source tab/session、candidate files 和 stale 状态。
- Security / Privacy：需要继续阻断 raw DOM/cookies/headers/secrets；capture script 只能输出经过 redaction 和预算裁剪的结构化事实。
- Validation：需要覆盖 snapshot sanitizer、landmark extraction、context preview、stale policy、AI payload budget、local route-to-code candidates 和 evidence 生命周期。

## 验收标准

- 用户在 Browser Dock 打开页面后，能刷新并关联 Browser Context Snapshot v2；composer preview 清楚展示 AI 将看到的 URL、title、正文片段、元素计数、预算、脱敏和 stale 状态。
- Composer 关联浏览器上下文时，必须关联 Browser Dock 当前 active tab；多 tab 场景不得误取其它 ready tab。
- AI 能基于 browser context 回答当前页面的正文主题、关键标题、主要链接、按钮、表单和可见内容，而不是只依赖 URL/title/summary。
- 当用户切换 tab、页面 URL 改变、滚动或 snapshot 超过 TTL 时，composer preview 必须标记 stale，并允许用户刷新。
- 对本地开发页面，AI attachment 能提供候选 route/component/file 列表，并说明候选来源，例如 URL route、visible text match、landmark match。
- 对 localhost / 127.0.0.1 / workspace local route，Browser Agent 必须通过 workspace-scoped allow policy 支持页面理解；对非 workspace private network 仍默认阻断。
- 用户可以用自然语言描述右侧页面问题，AI 能更容易定位到候选代码文件；如果候选不足，AI 必须明确说明缺口，而不是臆造文件。
- Browser snapshot v2 必须 bounded、脱敏、带来源、带 capture time、带 truncation/redaction metadata；不得注入 raw DOM、cookies、headers、password/token/authorization，且所有 AI-visible string fields 都必须经过统一 sanitizer。
- Browser context 不得同时以结构化 attachment 和手写 prompt block 双重注入；发送路径必须只有一个 canonical payload。
- TaskRun / orchestration task 可以引用 browser snapshot v2 evidence，并在详情中显示可用、过期或降级状态。
- 现有 Browser Dock 多 tab + 单 native renderer、conversation streaming、Task Center、文件系统和外部链接策略不得回归。

## 验收复盘补充（2026-06-01）

本轮实现后的人工验收暴露出三个关键体验缺口，已纳入 Phase 2 的提案约束：

- Browser Context 的 UI 不能只显示“已关联浏览器上下文”。发送前 composer preview 和发送后消息引用卡都必须明确这是“浏览器可见页面快照”，并说明它不是 API raw 数据。
- Browser Context 的实时对话可见性必须与历史回放一致。用户发送消息时，如果本轮带有 BrowserContextAttachment，幕布中必须立即出现上下文引用卡，不允许只在历史重新加载后才出现。
- Browser Context 摘要必须主内容优先。Snapshot v2 的 `visibleText` / summary 不能默认使用 `document.body.innerText` 前缀，而应优先选择页面主内容/正文块，降低导航、登录、页眉、页脚、工具栏、链接密集区域和操作区噪声。

因此 Phase 2 的实际验收不仅要求“能采集”，还要求：

- 用户看得懂 AI 引用了什么网页事实。
- AI 优先基于 browser context 回答当前页面问题，不主动绕到 CLI/API，除非用户明确要求 raw/API 数据或 context 明确不足。
- 摘要质量足以让 AI 回答页面核心内容，而不是被导航文本污染。

## 当前实现状态（验收中）

- 已完成 Browser Dock 右侧 companion split、active tab capture、Snapshot v2、sanitizer、composer preview、发送后 summary card、AI payload usage hint、live optimistic browser context card、main-content-first visible text 初版。
- 已移除左侧 sidebar 重复 Browser Dock 入口，保留顶部 toolbar 作为主入口。
- 已确认新闻/文章页能通过视觉 heading fallback 得到标题候选；GitHub issue 页面能读取标题、链接、按钮和正文片段。
- 验收后重调版已把 Browser Context 从“短摘要卡”升级为“证据级页面快照”：Snapshot v2 显式包含 `primaryContent`、`readableBlocks`、`noiseDiagnostics`、`visualEvidence` 和 `pageType`，AI payload 与引用卡优先使用主内容和可读块，而不是只依赖 `visibleText`。
- GitHub issue / markdown / comment body / image attachment 场景已增强：采集脚本优先识别 issue body、comment markdown、user attachment/image links，并把图片、figure、附件、alt text、origin 与 nearby text 作为安全视觉线索输出。
- 发送后 Browser Context 引用卡已支持展开证据详情，展示主内容、可读块、图片/附件线索、噪声诊断和候选代码；复制按钮只复制安全摘要，不复制 raw DOM、cookies、headers 或图片二进制。
- 已补内容提取回归集，覆盖 GitHub issue、新闻文章、文档页、表单页和 SPA shell，锁定主内容不能退回导航/登录/页脚前缀。

## 后续优化状态

- **P0：摘要质量回归集**：已落地。Fixture 覆盖 GitHub issue、新闻文章、文档页、表单页和 SPA shell。
- **P0：live / history / queued 一致性**：已围绕同一个 `BrowserContextAttachment` shape 统一，queued handoff 已补结构化 metadata 回归；live optimistic card 与历史解析继续复用同一引用卡和 parser。
- **P1：结构化主内容字段**：已落地。Snapshot v2 新增 `primaryContent` / `readableBlocks` / `noiseDiagnostics`，formatter 和 UI 不再只靠 `visibleText`。
- **P1：图片/附件线索**：已落地。`visualEvidence` 输出图片、figure、附件、alt text、origin、nearby text 和 sensitive 标记。
- **P1：可复制上下文详情**：已落地。引用卡可复制安全浏览器上下文摘要。
- **P2：页面类型推断**：已落地。基于通用 DOM / URL / form / dashboard / SPA 信号推断 article / issue / docs / form / dashboard / spa / unknown。
- **后续仍可增强**：若要真正“看见截图内容”，需要新增截图缩略图/OCR 或视觉模型输入；当前版本只提供页面中图片/附件的结构化线索，不读取图片二进制内容。

## Phase 2 收口结论（2026-06-01）

本 change 的 Phase 2 已收口为 **Browser Dock evidence-grade page understanding MVP**：

- Browser Dock 继续作为右侧 companion split，不新增第二套浏览器入口。
- Browser Dock header 提供“关联浏览器上下文”入口，复用 Composer 的原 attachment 能力；Composer 只保留已关联后的 preview / refresh / remove / detail inspection。
- Snapshot v2 已从浅层 `URL + title + visibleText` 升级为结构化 evidence：`primaryContent`、`readableBlocks`、`visualEvidence`、`noiseDiagnostics`、`pageType`、`codeCandidates`、budget 和 privacy metadata。
- AI payload、composer preview、live optimistic card、history card、queued handoff 统一围绕 `BrowserContextAttachment`，避免 UI 预览和实际发送内容分裂。
- Browser context UI 明确标注“浏览器可见页面快照 / 非 API Raw 数据”，并把长正文、图片线索和诊断收进可滚动详情区，避免默认把聊天区撑爆。
- 当前版本不承诺 OCR、截图二进制理解或完整 browser automation；图片/附件仅以安全结构化线索进入 AI 上下文。

### Phase 2 验收口径

Phase 2 的完成标准是：AI 能拿到安全、可预算、可追溯的当前 active tab 页面事实，并优先基于主内容和证据块回答当前页面问题。它不是最终的视觉浏览器代理，也不是 Playwright/CDP 级自动化运行时。

### 下一阶段输入

以下能力不再塞入本 change，转入下一阶段独立设计：

- 截图缩略图、OCR 或视觉模型输入，用于真正读取 issue 截图、diff 截图和新闻配图内容。
- 复杂 SPA / dashboard 的动态区域理解，包括虚拟列表、canvas、shadow DOM、iframe 和登录态降级策略。
- Browser Context detail 的二级折叠与证据过滤，按主内容、图片线索、候选代码、诊断独立展开。
- 更完整的真实站点 fixture matrix，覆盖 GitHub issue、PR diff、docs search、新闻详情、表单 wizard、dashboard 和本地 dev app。
- 授权式 click/type/submit action preview；默认仍保持只读 capture。

## Post-Closure Hardening（2026-06-01）

验收后发现 Composer 的 Browser Dock 快捷打开入口存在意图识别过宽的问题：用户在普通 bug report、截图说明或日志文本里提到“打开 / open / URL / Browser Dock”时，发送流程可能被误判为浏览器导航命令，导致消息没有正常发送而是直接打开 Browser Dock。

本 change 追加约束：

- Composer 自动打开 Browser Dock 只能响应明确、短句式导航命令，例如 `打开 https://example.com`、`访问 example.com`、`open https://example.com`、`go to example.com`、`百度`。
- 描述性文本、问题反馈、截图说明、构建日志、包含 URL 的错误上下文 MUST NOT 被快捷导航劫持。
- URL/navigation 识别逻辑 MUST 作为 pure utility 独立测试，不应继续内联堆在 `Composer.tsx`。
- 当识别不确定时，必须 fail closed：优先把文本作为普通用户消息发送，而不是打开 Browser Dock。

这属于 Browser Context / Browser Dock 输入边界的 post-closure hardening，不改变 Phase 2 的核心完成口径。
