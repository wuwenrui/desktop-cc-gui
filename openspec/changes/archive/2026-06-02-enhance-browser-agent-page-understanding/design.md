## Context

Phase 1 已经完成 Browser Dock MVP：用户可以在主内容区右侧打开内嵌网页，Browser Dock 使用多 tab 数据模型和单 native WebView renderer 规避跨平台 child WebView 叠层问题，并能把浅层 browser context 附加到 AI 对话。

当前缺口是上下文质量。AI 现在通常只能拿到 URL、title、summary 等浅层字段，无法稳定理解页面正文、结构、元素、滚动位置，也无法把本地页面映射到代码文件。Phase 2 必须把 Browser Dock 变成“页面事实采集器”，再把这些事实变成 engine-agnostic AI attachment 和可追溯 evidence。

关键约束：

- Phase 2 必须继承 Phase 1 Browser Dock MVP 的运行基线：顶部全局入口、右侧 companion split、左右拖拽、Browser Dock 不作为浮层、多 tab UI、单 native WebView renderer、active tab 是唯一上下文目标、内置 Browser Agent 默认优先、可显式禁用、cross-platform capability 降级、large-file governance、engine-agnostic attachment、隐私默认安全。
- Tauri 2 + React + Rust 架构不变，UI 不得绕过 `src/services/tauri/**` 直接散落 invoke。
- Browser Dock MVP 的单 native renderer 模型不回退到多 child WebView。
- Snapshot v2 默认只读，不开放 click/type/submit。
- 不存储 raw DOM、cookies、headers、password、token、Authorization 或页面密文。
- 所有 engine 共享同一个 BrowserContextAttachment v2。
- 本地 page-to-code bridge 只能给候选，不得臆造确定映射。
- Phase 2 必须修复 Phase 1 真实代码里的 active tab 归属缺口：Composer 不能再通过 `list sessions -> first ready session` 推断当前页面。
- Phase 2 必须修复 Phase 1 URL policy 与本地页面理解目标的矛盾：默认仍防 private-network SSRF，但当前 workspace 的 local dev target 需要可控放行。
- Phase 2 必须避免继续膨胀 `Composer.tsx` / `BrowserDock.tsx`，新增复杂 UI 和状态逻辑必须拆分到专用 hook/component/service。

## Goals / Non-Goals

**Goals:**

- 定义 Browser Context Snapshot v2，覆盖 visible text、headings、links、buttons、forms、content regions、viewport、budget、redaction 和 diagnostics。
- 在 composer 中展示 AI 实际会收到的 browser context preview，并支持刷新、移除、stale 状态。
- 定义 Browser Element Landmark，为后续操作 preview 和页面结构理解提供稳定事实。
- 对 localhost / app route / workspace 可识别页面生成 page-to-code candidates，帮助 AI 从页面问题定位源码。
- 扩展 browser evidence，让对话、TaskRun、orchestration 可引用 Snapshot v2 和候选代码文件。
- 保持 engine-agnostic 和隐私默认安全。

**Non-Goals:**

- 不实现完整网页自动操作。
- 不实现外部 Chrome/CDP 默认 provider。
- 不为外部网站建立代码映射。
- 不注入无边界全文或 raw DOM。
- 不要求 inactive tab 保持 live DOM 状态。

## Decisions

### 0. Phase 2 是增强层，不重新定义 Browser Dock MVP

Phase 2 只增强“AI 如何理解 active tab”，不重新设计 Browser Dock 的基础交互和运行时。以下 Phase 1 约束在 Phase 2 中继续有效：

- Browser Dock 从顶部全局 toolbar icon 打开，并显示在主内容区右侧 companion panel。
- Browser Dock 与 conversation 左右分屏，分隔线支持拖拽。
- Browser Dock 不作为常驻遮罩浮层。
- 用户看到多 tab，但 native runtime 使用单 Browser Dock renderer。
- active tab 是 URL bar、snapshot、AI attachment、future action preview 的唯一默认目标。
- Browser Agent 默认优先服务 AI browser understanding / operations，除非用户禁用、平台 unsupported/degraded 或用户明确 opt-out。
- Browser Agent 是 engine-agnostic，不属于 Claude、Codex、Gemini、OpenCode 或 custom provider。
- 默认不注入 raw DOM、cookies、headers、password/token/Authorization 或页面密文。
- 实现必须继续遵守 large-file governance，避免 Browser Agent 聚合成超大文件。

取舍：

- Phase 2 不重新引入 per-tab native WebView，因为 Phase 1 验收已经证明多 native child WebView 同区叠层在跨平台兼容性上不可靠。
- Phase 2 只把 active tab 的页面事实做深，inactive tab 不参与 AI 上下文，除非用户切换为 active 并刷新 snapshot。

### 1. Snapshot v2 是 AI 看到网页的唯一主契约

Browser Agent 不应把多个零散字段直接拼进 prompt。前端、任务、orchestration 都通过同一个 `BrowserContextSnapshotV2` 消费页面事实。

建议数据结构：

```ts
type BrowserContextSnapshotV2 = {
  snapshotId: string;
  browserSessionId: string;
  workspaceId: string;
  capturedAt: number;
  freshness: "fresh" | "stale" | "expired" | "degraded";
  source: BrowserSnapshotSource;
  viewport: BrowserViewportState;
  page: BrowserPageFacts;
  landmarks: BrowserElementLandmark[];
  codeCandidates: BrowserCodeCandidate[];
  budget: BrowserSnapshotBudget;
  privacy: BrowserSnapshotPrivacyReport;
  diagnostics: BrowserDiagnostic[];
};
```

`source` 只保存 URL、normalized URL、origin、title、tab label、capture reason。`page` 保存 bounded visible text、headings、links、buttons、forms、main content regions 和 language hint。`landmarks` 是后续操作能力的基础，但 Phase 2 只读展示，不执行动作。

取舍：

- 选择结构化对象而不是大段 markdown，因为结构化对象便于预算、脱敏、UI preview、TaskRun evidence 和后续 action gate 复用。
- 不保存 raw DOM，因为它体积不可控且容易携带隐私与认证态信息。

### 2. Capture 使用只读页面脚本，但输出必须经过双层过滤

Capture 分两层：

- WebView 页面侧只读脚本：采集 `document.title`、visible text、semantic elements、viewport、scroll、表单 metadata、链接和按钮文字。
- Rust/TS sanitizer：统一截断、脱敏、字段白名单、预算统计、diagnostics 生成。

只读脚本允许读取：

- `document.title`
- `location.href`
- 可见文本片段
- semantic tags：`h1-h6`、`a`、`button`、`input`、`textarea`、`select`、`form`、`main`、`article`、`nav`
- ARIA role/name 的安全摘要
- viewport 和 scroll position

只读脚本禁止输出：

- cookies、headers、storage
- raw HTML / raw DOM subtree
- password/token/authorization 字段值
- hidden input value
- script/style 内容
- 超预算全文

取舍：

- 页面侧脚本可以更准确地区分可见元素，但不能被信任为最终安全边界。
- 最终 AI payload 只能使用 sanitizer 后的 Snapshot v2。

### 2.1 Capture transport 必须绑定单 native renderer 的 active session

Phase 1 当前 runtime 是“多 tab 数据模型 + 单 native WebView renderer”。Phase 2 的 capture transport 必须尊重这个事实：

- Browser Dock 维护 active session id、renderer bound session id、active URL/title/load state。
- Composer / TaskRun / orchestration 只能请求 active session 的 snapshot。
- capture command 必须确认 requested session 是当前 renderer bound session；不匹配时返回 stale/degraded diagnostic，而不是抓取旧 tab。
- native WebView 执行 read-only capture script，返回 JSON-safe raw facts。
- raw facts 进入 sanitizer 后才允许进入 UI preview、evidence 或 AI payload。

如果 WebView JS 执行、回传、平台 API 或页面策略失败，系统必须返回 degraded snapshot，包含 URL/title/diagnostics，而不是假装 capture 成功。

### 2.2 Local URL policy 必须从“默认阻断”升级为“workspace-scoped allow”

Phase 1 出于安全默认阻断 localhost/private network。Phase 2 要做 local page-to-code bridge，必须增加受控例外：

- 默认继续阻断 arbitrary private network、内网 IP、非 http/https scheme。
- 当前 workspace 明确关联的 local dev target 可以放行，例如 `localhost`、`127.0.0.1`、workspace app route 或用户手动确认的 dev server origin。
- local allow decision 必须进入 diagnostics / evidence，AI 需要知道这是 workspace-local 页面。
- 外部网站仍不得生成 workspace code candidates。

该策略不是放开内网浏览器，而是为“当前工程页面理解”提供最小权限通道。

### 3. Composer preview 必须展示“AI 实际会看到什么”

Browser context attachment 不能只显示“已关联浏览器上下文”。用户必须能展开看到：

- URL、title、capture time、fresh/stale 状态
- visible text 摘要
- heading/link/button/form 数量
- code candidates 数量
- redaction/truncation 状态
- diagnostics

Preview 与实际 AI payload 必须来自同一个 `BrowserContextAttachmentV2`，避免 UI 预览和发送内容不一致。

Composer 必须从 Browser Dock active tab source of truth 获取 session id。禁止用 session list 中第一个 `ready` session 作为上下文目标，因为多 tab 场景会产生错页 attach。

取舍：

- 不把完整 snapshot 全量展示在 composer，避免 UI 过重。
- 展示摘要和计数，提供可展开 detail。

### 4. Stale policy 由页面状态变化和时间共同触发

Snapshot stale 条件：

- active tab URL 变化
- active tab title 变化且 capture 后发生 load event
- 用户滚动超过阈值
- 超过 TTL
- Browser Dock 切换 active tab
- capture diagnostics 标记 degraded

发送前如果 attachment stale，composer 必须可见提示用户刷新；是否阻断发送由后续产品策略决定，Phase 2 默认允许发送但必须向 AI 标记 stale。

### 5. Page-to-code bridge 只生成候选，不做确定断言

本地页面候选来源：

- URL route：localhost/app route path 与 router config / file path 的匹配。
- visible text：页面标题、按钮、主要文案在 `src/**` 中的搜索命中。
- landmark name：ARIA label、button text、form label 与组件源码命中。
- existing code intelligence：复用 `file-view-code-intelligence-navigation` 能力做跳转与解释。

候选结构：

```ts
type BrowserCodeCandidate = {
  candidateId: string;
  filePath: string;
  symbolName?: string;
  reason: "route_match" | "visible_text_match" | "landmark_match" | "manual_hint";
  confidence: "high" | "medium" | "low";
  matchedText?: string;
};
```

约束：

- 外部网站不生成 workspace code candidates。
- candidate 是 evidence，不是事实断言。
- AI 如果候选不足，必须说明缺口并请求更多上下文或搜索代码。

### 6. Evidence v2 记录引用，不记录敏感原文

Browser evidence v2 应保存：

- snapshot id
- browser session id
- source URL/title/origin
- capture time / expires at
- summary
- budget / redaction metadata
- diagnostics
- code candidate refs

不保存：

- raw DOM
- cookies/headers/storage
- password/token values
- 无预算全文

### 7. Engine adapter 不得各自实现 browser payload

所有 provider 只读取同一个 `BrowserContextAttachmentV2`。Engine adapter 可以做格式化，但不得重新抓取页面，不得绕过 sanitizer，不得加入 provider-specific browser context schema。

发送路径也必须单一：结构化 `BrowserContextAttachmentV2` 是 canonical payload。`<browser_context>` prompt block 只能作为 legacy fallback；不得在同一次请求里既发送结构化 attachment，又把同一份 browser context 拼进用户 prompt 文本。

### 8. Sanitizer 必须覆盖所有 AI-visible string fields

Sanitizer 不只处理 `visibleText`。凡是可能进入 UI preview、evidence 或 AI payload 的 string 都必须统一处理：

- visible text / selected text
- heading text
- link text / href
- button text
- input placeholder / label / value preview
- form label / action origin
- ARIA label / accessible name
- landmark label / text preview
- diagnostics message

敏感字段值必须 redacted；可疑 URL query/fragment 必须截断或脱敏；hidden/password/token/authorization-like 字段只能保留安全 metadata。

### 9. Large-file governance 是实现约束，不只是验证项

Phase 2 会触碰 Composer、BrowserDock、service bridge、Rust DTO 和 evidence surfaces。实现时必须拆分：

- Composer 只负责接线，不承载 preview 细节和 stale 计算。
- BrowserDock 只负责 tab/session/renderer lifecycle，不承载 snapshot formatter。
- Snapshot sanitizer、Attachment formatter、Active browser context store、Page-to-code candidate generator 必须各自独立。
- 新增代码需要遵守 `.github/workflows/large-file-governance.yml`，避免已有大文件继续增长。

### 10. Browser Context 引用卡必须覆盖发送前、实时发送、历史回放三种表面

Browser Context 不是只给模型看的隐藏 prompt，它也是用户判断“AI 看到了什么”的可见证据。Phase 2 需要保持三处表面一致：

- Composer preview：发送前展示当前 active tab 的 browser-visible snapshot。
- Live curtain：发送后实时对话中立即显示同一份 attachment 的引用卡。
- History restore：历史回放时继续显示同一份 attachment 的引用卡或 legacy prompt parse fallback。

约束：

- 三处表面必须使用同一份 `BrowserContextAttachmentV2` view model，不得各自拼接字段。
- 卡片标题必须表达“浏览器可见页面快照”，避免泛泛的“上下文”让用户误解为隐藏 API/raw data。
- 卡片必须显示 source、freshness、capture time、短摘要、结构计数；详情可展开显示 privacy、budget、diagnostics。
- 当实时发送路径尚未收到后端/历史事件时，frontend optimistic user row 也必须携带 `browserContextAttachment`，否则 live curtain 与 history restore 会出现不一致。

取舍：

- 不在卡片中展示完整 snapshot，避免消息流过重。
- 卡片只展示 AI-visible bounded facts，不展示 raw DOM、cookies、headers 或 API raw response。

### 11. 可见文本必须从主内容提取，而不是从 body 前缀截断

网页 `document.body.innerText` 的前缀经常是导航、登录、菜单、页眉或工具栏。Phase 2 的 Snapshot v2 必须把 `visibleText` 定义为“AI 应优先阅读的页面正文/主内容摘要”，而不是“页面所有可见文本的开头”。

通用提取策略：

- 第一层选择主容器：优先 `main`、`article`、`[role=main]`、`[role=article]`、正文/内容/详情/markdown 类容器。
- 第二层选择可读块：在主容器内部优先段落、列表、blockquote、pre、markdown/comment/body/description/content 类块。
- 降权噪声容器：`nav`、`header`、`footer`、`aside`、toolbar/menu/search、链接密集区、控件密集区、登录/注册/评论操作区。
- 若没有可靠主内容，才 fallback 到 bounded body text，并标记 diagnostics。

取舍：

- 不做站点专用 API adapter。即使 GitHub issue 可以通过 API 拿到更干净 JSON，Phase 2 默认仍应先从浏览器可见页面事实回答。
- 可以使用通用 CSS/ARIA/文本密度 heuristic，但必须保持 bounded、脱敏、可降级。

### 12. AI 使用策略：浏览器上下文优先，但不伪装成 API 数据

BrowserContextAttachment v2 需要在 AI payload 中显式说明：

- `sourceKind` 是 browser-visible page snapshot。
- 当前页面相关问题应优先基于 browser context 回答。
- 不应主动切换到 CLI/API/raw fetch，除非用户明确要求 raw/API 数据，或 browser context 明确 degraded/insufficient。
- 回答中必须区分“浏览器中可见事实”和“外部 API/raw 数据”。

这条约束不是阻止 AI 使用工具，而是避免当用户问“当前浏览器页面是什么”时，AI 放弃已采集的 browser context，转而绕开客户端浏览器链路。

## Risks / Trade-offs

- [Risk] WebView 页面脚本在部分页面受 CSP、沙箱或平台限制无法完整执行 → Mitigation：返回 degraded snapshot，明确 diagnostics，并允许用户退回截图/Computer Use/Browser skill。
- [Risk] visible text 太长导致 token 膨胀 → Mitigation：强制 budget、section truncation、元素计数与摘要优先。
- [Risk] 页面到代码候选误导 AI → Mitigation：候选必须带 reason/confidence，AI 不允许把候选当确定事实。
- [Risk] 用户以为 AI 已经看到完整页面 → Mitigation：composer preview 展示实际字段、截断和脱敏状态。
- [Risk] local page mapping 搜索成本高 → Mitigation：先做 route/text/landmark 的 bounded search，后续再接更强索引。
- [Risk] Snapshot v2 与 Phase 1 attachment 并存造成混乱 → Mitigation：保留兼容字段，但发送路径统一升级到 v2 view model。
- [Risk] 多 tab 下 Composer 关联错页 → Mitigation：active tab source of truth 成为 P0 contract，禁止 first-ready-session heuristic。
- [Risk] local page-to-code 因 localhost 被 policy 阻断无法使用 → Mitigation：workspace-scoped local URL allow policy，默认仍阻断非 workspace private network。
- [Risk] browser context 被结构化 attachment 和 prompt block 双重注入 → Mitigation：单一 canonical formatter，legacy prompt block 只做 fallback。
- [Risk] sanitizer 只覆盖 visible text，元素字段泄露敏感信息 → Mitigation：所有 AI-visible string fields 统一 sanitizer。

## Migration Plan

1. 新增 Snapshot v2 types 和 sanitizer，不改变现有 Browser Dock 打开/渲染路径。
2. 建立 active tab source of truth，Composer attach 不再扫描 first ready session。
3. 增加 workspace-scoped local URL allow policy，为本地开发页面开启受控理解。
4. 新增 capture v2 command 和 service bridge，旧 capture/attachment 保持兼容。
5. Composer browser attachment preview 切到 v2 view model。
6. AI request 注入路径切到 v2 bounded canonical payload，legacy prompt block 仅 fallback。
7. 增加 page-to-code candidates，仅对本地页面启用。
8. TaskRun/orchestration evidence 读取 v2 evidence refs。
9. 旧 snapshot 字段保留一段时间，只作为 fallback。

回滚策略：

- 如果 v2 capture 不稳定，关闭 v2 capture flag，回退到 Phase 1 URL/title/summary attachment。
- 如果 page-to-code bridge 噪音过大，单独关闭 code candidates，不影响 Snapshot v2。

## Open Questions

- Snapshot TTL 默认值应该是多少：30 秒、60 秒还是按页面类型区分？
- visible text 预算初始值应该是 6k、10k 还是沿用现有 defaultSnapshotBudgetChars？
- 本地 route mapping 第一版是否只支持 Vite/React router，还是做通用文本候选即可？
- 是否需要在 preview 中提供“复制 AI 上下文 JSON”的调试入口？
