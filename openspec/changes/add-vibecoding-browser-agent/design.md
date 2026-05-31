## Context

`mossx` 当前是 Tauri 2 + React 19 + TypeScript + Rust 的桌面 AI 工程工作台。主窗口由 Rust 侧通过 `WebviewWindowBuilder` 创建，并且当前主窗口策略会把外部 `http/https` 导航交给系统浏览器，避免普通链接把主应用 WebView 带走。

这套策略适合主应用安全，但不适合 vibecoding 操作室里的“网页作为 AI 上下文”场景。用户希望 AI 不是凭空猜网页，也不是依赖用户转述，而是能从客户端内嵌网页中获得结构化、可审计、可绑定任务的关键信息。

现有 Computer Use Bridge 证明了项目已经有“显式用户动作、status gate、bounded result、跨层 type contract”的工程模式，但它面向 Codex / 官方 Computer Use handoff，不提供产品内 Browser Session。Browser Agent 应作为独立能力：它专注网页运行态的结构化理解和网页内操作，而不是跨 App 的视觉/坐标控制。

主要约束：

- 必须保护主应用窗口，不应改变现有外链默认打开系统浏览器的行为。
- 必须通过 `src/services/tauri.ts` 或其子模块做 bridge，不允许 UI component 直接散落 `invoke()`。
- Browser context 注入 AI 时必须 bounded、可见、可关闭、可追踪。
- MVP 应优先解决“AI 看懂网页”，再逐步扩展“AI 操作网页”。
- 跨平台 WebView 行为存在差异，设计必须允许 platform capability 降级。

## Goals / Non-Goals

**Goals:**

- 提供 Browser Dock：在 vibecoding / orchestration 操作室内承载客户端内嵌网页。
- 提供顶部全局 toolbar 入口：Browser Dock 从全局 icon 打开，并进入主内容区右侧 companion panel，与 conversation 左右分屏。
- 建立 Browser Session：用稳定 `browserSessionId` 绑定 workspace、task/session、URL、title、loading/error、snapshot 与 evidence。
- 建立 Browser Context Snapshot：将页面关键信息压缩成 AI 可消费的结构化对象。
- 建立 AI Browser Context Bridge：让客户端对话、TaskRun、orchestration task 可以显式引用当前网页上下文。
- 建立 Browser Action Gate：为后续 navigate / scroll / click / type / submit 等网页操作预留授权、审计和回放模型。
- 建立 evidence model：截图、页面摘要、选中区域、操作历史可被 task/session/TaskRun 引用。
- 保持 MVP read-only，先让 AI 看懂网页，再启用写操作。

**Non-Goals:**

- 不实现自研 browser engine。
- 不在 MVP 中要求完整 Chrome DevTools Protocol / Playwright 能力。
- 不默认依赖外部 Chrome 作为产品主路径。
- 不将 cookie、password、token、Authorization header 或完整 DOM 无边界注入 AI。
- 不允许 AI 在用户不可见、未授权、无审计记录的情况下操作网页。
- 不替代 Computer Use Bridge；两者是互补能力。

## Decisions

### 0. Browser Agent 是 engine-agnostic 客户端能力

Browser Agent 不属于 Codex、Claude、Gemini、OpenCode 或 custom provider 的某一个 engine adapter。它是客户端运行态能力，位于 workspace/task/session 层之上。

约束：

- 所有 engine MUST 通过同一 `BrowserContextAttachment` 消费网页上下文。
- Browser snapshot capture、sanitization、evidence、action audit MUST 保持 provider-neutral。
- Engine adapter 只允许读取已经成形的 bounded browser context，不允许自己重复实现网页抓取、脱敏或 Browser Session 状态。
- 如果某个 engine 无法消费 browser context，必须返回结构化 unsupported/degraded，而不是 fork 出专用 browser payload。

### 0.1 MVP 完成后 Browser Agent 是默认 AI browser provider

MVP 完成并启用后，客户端内 AI 的网页理解与网页操作请求默认路由到内置 Browser Agent。

允许回退的条件只有：

- 用户在设置中关闭 Browser Agent。
- 用户在当前任务或对话中明确要求不要使用内置 Browser Agent。
- 当前平台或当前页面能力返回 unsupported/degraded，无法满足请求。
- 目标操作超出 Browser Agent 已启用 phase，例如 read-only phase 请求 click/type/submit。

回退 provider 可以是 Browser skill、Computer Use 或 external CDP provider，但回退必须显式记录原因，并在用户可见 UI 或 task evidence 中体现。

### 0.2 Browser Agent settings 是安全边界的一部分

设置模型至少包含：

```ts
type BrowserAgentSettings = {
  enabled: boolean;
  preferForAiBrowserOperations: boolean;
  allowReadOnlySnapshots: boolean;
  allowNavigationActions: boolean;
  allowElementActions: boolean;
  allowFormSubmitActions: boolean;
  allowExternalProviderFallback: boolean;
  defaultSnapshotBudgetChars: number;
  evidenceRetentionDays: number;
  platformWarningsAcknowledged: Record<string, boolean>;
};
```

默认策略：

- MVP 默认 `enabled = true`，并默认 `preferForAiBrowserOperations = true`。
- 当用户显式设置 `enabled = false` 或 feature flag off 时，Browser Dock 不自动注入 browser context，AI request 不注入 browser context，browser operation 不路由到 Browser Agent。
- 如果本地持久化设置已经关闭 Browser Agent，Browser Dock 必须显示一键启用路径，而不是只呈现不可操作的 disabled state。
- 写操作开关必须按 phase 分级，不能用一个总开关一次性放开 click/type/submit。

### 0.3 macOS / Windows / Linux compatibility matrix first

Browser Agent 必须先定义 capability matrix，再实现平台分支。

```ts
type BrowserPlatformCapability = {
  platform: "macos" | "windows" | "linux" | "unsupported";
  webviewRuntime:
    | "wkwebview"
    | "webview2"
    | "webkitgtk"
    | "unknown";
  browserDock: "supported" | "degraded" | "unsupported";
  snapshotCapture: "supported" | "degraded" | "unsupported";
  screenshotCapture: "supported" | "degraded" | "unsupported";
  navigationActions: "supported" | "degraded" | "unsupported";
  elementActions: "supported" | "degraded" | "unsupported";
  formSubmitActions: "supported" | "degraded" | "unsupported";
  diagnosticsCapture: "supported" | "degraded" | "unsupported";
  unsupportedReasons: string[];
  degradedReasons: string[];
};
```

平台基线：

- macOS 使用 WKWebView；关注 data store、script injection、private API、screenshot 能力差异。
- Windows 使用 WebView2；关注 runtime availability、data directory、browser args、WebView2 compatibility fallback。
- Linux 使用 WebKitGTK；关注 AppImage/Wayland/WebKitGTK 兼容、截图/注入能力不一致、依赖缺失降级。

任何平台不支持某项能力时，MUST 返回 explicit capability，而不是让 AI 误以为网页可读或可操作。

### 0.4 Large-file governance 是实现约束

Browser Agent 不能实现成一个超大 React component、一个超大 service 或一个超大 Rust module。实现必须主动拆分：

- UI：BrowserDock、AddressBar、SnapshotPanel、EvidencePanel、ActionPreview、SettingsSection 分离。
- Frontend logic：hooks、view model、sanitizer client types、service bridge 分离。
- Backend：session store、policy、snapshot builder、sanitizer、evidence store、action gate、platform capability 分离。
- Tests：按 sanitizer、store、service mapping、UI render、platform capability 分组。

实现完成前必须考虑 `.github/workflows/large-file-governance.yml` 覆盖的三平台 large-file governance gate：

- `npm run check:large-files:near-threshold`
- `npm run check:large-files:gate`

任何接近阈值的文件必须优先拆分，而不是在 review 阶段被动修。

### 1. Browser Dock 使用 Tauri WebView，而不是 iframe 或外部 Chrome

采用主路径：Tauri WebView Browser Dock。

理由：

- Browser Dock 是客户端产品能力，应该可见、可绑定 workspace/task/session，并受客户端权限和审计控制。
- iframe 无法可靠读取跨域页面，且大量页面会通过 CSP / X-Frame-Options 拒绝嵌入。
- 外部 Chrome + CDP 自动化能力最强，但依赖外部 runtime，分发和用户信任成本更高，不适合作为 MVP 主路径。

设计取舍：

- MVP 使用系统 WebView：macOS 为 WKWebView，Windows 为 WebView2，Linux 为 WebKitGTK。
- 后续可以添加 `external-cdp-provider` 作为高级自动化 provider，但不能阻塞 Browser Dock MVP。
- Browser Dock 必须与主窗口外链拦截策略分离：主应用继续保护自身导航；browser webview label 使用专属 navigation policy。

### 1.1 Browser Dock 是主内容区 companion panel，不是遮罩浮层

Browser Dock 的第一打开方式必须符合当前工作台的 workspace 布局模型：

- 顶部全局 toolbar 的 Browser icon 是 primary opener。
- 打开后，Browser Dock 渲染在主内容区右侧，与 conversation 左右分屏。
- conversation 与 Browser Dock 中间的 splitter 必须支持左右拖拽，并通过 bounded ratio 限制两侧最小宽度，避免任一侧被拖到不可用。
- 左侧 sidebar / Workspace Home / orchestration / composer attachment 可以作为辅助入口，但不能成为唯一入口。
- 常驻浏览器不应使用 modal、popover、floating overlay 或遮罩层承载；这些模式只适合短暂提示，不适合 AI 持续读取网页上下文。
- 关闭 Browser Dock 只关闭右侧 companion panel，不应影响当前 conversation、right panel、Task Center 或外部链接策略。

### 1.2 Browser Dock 使用 tab 表达多页面

Browser Dock 的用户心智模型是浏览器标签页，而不是后端 session 列表。每个可见 tab 可以由一个 BrowserSession 承载，但 UI 不应展示“当前会话数”。active tab 是 URL bar、WebView mount、AI browser context attachment 和后续 browser action 的唯一默认目标。

验收修正：Browser tab 必须拥有独立 WebView label 和生命周期。切换 tab 时隐藏非激活 WebView、显示激活 WebView；关闭 tab 时关闭对应 WebView。Browser Dock 底部只保留信息 icon，错误诊断与隐私边界通过 icon 弹出层展示，避免常驻文案挤占网页视口。

回归修正：Browser WebView mount/sync effect 禁止依赖会被 page-load/title 事件频繁更新的 session 列表。load event 只能更新 tab 标题、状态和 AI attachment，不得触发 active WebView 的 cleanup + remount + navigate 循环。

兼容性修正：Browser Dock MVP 使用“多 BrowserSession tab + 单 native WebView renderer”模型。UI 可以展示多个 tab，但底层只创建一个 child WebView label，并在 active tab 切换时将 renderer 重新绑定到 active session URL。该约束避免 macOS WKWebView、Windows WebView2、Linux WebKitGTK 在同一区域多 child WebView hide/show/z-order 行为不一致。

### 2. Browser Session 是产品状态，不是临时工具调用

新增 `BrowserSession` 概念：

```ts
type BrowserSession = {
  browserSessionId: string;
  workspaceId: string;
  linkedThreadId?: string | null;
  linkedTaskRunId?: string | null;
  linkedOrchestrationTaskId?: string | null;
  url: string;
  title: string | null;
  status: "idle" | "loading" | "ready" | "blocked" | "failed";
  lastSnapshotId?: string | null;
  createdAt: number;
  updatedAt: number;
};
```

Session 必须有 workspace 归属。没有 workspace 的 global browsing 会降低审计价值，MVP 不作为优先路径。

Session metadata 可以持久化；敏感网页内容默认不长期持久化。Snapshot / screenshot evidence 应有 TTL、大小上限和用户可清理入口。

### 3. Browser Context Snapshot 是 AI 的主要输入，而不是完整 DOM

AI 不直接读取完整 DOM。后端/前端只提供 bounded snapshot：

```ts
type BrowserContextSnapshot = {
  snapshotId: string;
  browserSessionId: string;
  capturedAt: number;
  source: {
    url: string;
    title: string | null;
    origin: string | null;
  };
  page: {
    visibleText: string;
    textTruncated: boolean;
    headings: BrowserTextNode[];
    landmarks: BrowserLandmark[];
    links: BrowserActionTarget[];
    buttons: BrowserActionTarget[];
    forms: BrowserFormSummary[];
    selectedText?: string | null;
  };
  diagnostics: {
    consoleErrors: BrowserDiagnostic[];
    networkSummary: BrowserNetworkSummary | null;
    captureWarnings: string[];
  };
  evidence: {
    screenshotRef?: string | null;
  };
  privacy: {
    redactionApplied: boolean;
    redactedKinds: string[];
  };
  budget: {
    charLimit: number;
    tokenEstimate?: number | null;
  };
};
```

Snapshot 规则：

- 默认只抓 visible / semantically relevant content。
- password、token、cookie、Authorization、secret-like input、隐藏字段默认脱敏。
- 超预算必须截断，并保留 `textTruncated` / `captureWarnings`。
- 每个 action target 必须有稳定但短生命周期的 `targetId`，不能把 selector 当长期公开 API。
- Snapshot 注入 AI 时必须显示来源 URL/title 和 capture time，避免 AI 把旧页面当当前事实。

### 4. Context Bridge 由用户显式控制，不自动污染每轮对话

新增对话级 browser context attachment：

```ts
type BrowserContextAttachment = {
  kind: "browser_snapshot";
  browserSessionId: string;
  snapshotId: string;
  title: string | null;
  url: string;
  summary: string;
  capturedAt: number;
};
```

UI 行为：

- Browser Dock 显示“附加当前页面给 AI”或等价 toggle/action。
- Composer / Task dispatch 明确展示已附加的 browser snapshot。
- Snapshot 不应每轮无条件自动注入；必须由用户选择、任务策略或明确的 orchestration rule 触发。
- 如果页面发生导航或 snapshot 过期，UI 必须提示 refresh，而不是静默使用 stale context。

### 5. Action Gate 分阶段开放网页操作

阶段划分：

- Phase 1：read-only Browser Dock + Snapshot。AI 能看懂网页，不能操作网页。
- Phase 2：safe navigation actions。允许用户授权 AI 调用 `browser_navigate`、`browser_reload`、`browser_scroll`。
- Phase 3：targeted element actions。允许 `click`、`type`、`select`，但必须显示 action preview。
- Phase 4：form submit / multi-step browser task。支持全自动网页代理，但必须有 task-level permission、stop button、audit log 和 final evidence。
- Phase 5：可选 external CDP provider。对复杂 Web App 使用 Chrome/CDP provider，但仍复用 BrowserSession / Snapshot / ActionAudit contract。

Action request 模型：

```ts
type BrowserActionRequest = {
  browserSessionId: string;
  action: "navigate" | "reload" | "scroll" | "click" | "type" | "select" | "submit";
  targetId?: string | null;
  value?: string | null;
  reason: string;
  requestedBy: "user" | "ai" | "task_run";
};
```

Action audit 模型：

```ts
type BrowserActionAuditEntry = {
  actionId: string;
  browserSessionId: string;
  requestedAt: number;
  completedAt?: number | null;
  action: BrowserActionRequest["action"];
  targetDescription?: string | null;
  outcome: "completed" | "blocked" | "failed" | "canceled";
  diagnosticMessage?: string | null;
  beforeSnapshotId?: string | null;
  afterSnapshotId?: string | null;
};
```

MVP 可以先定义类型和 UI copy，不启用写操作。

### 6. Browser Evidence 接入 TaskRun / Orchestration，但不改写源事实

Browser evidence 是执行证据，不是任务本身的真值源。

- OrchestrationTask 可以引用 browser snapshot 作为 source evidence。
- TaskRun 可以在 detail 中展示 linked browser session、snapshot、screenshotRef、action audit summary。
- Browser evidence 不应自动把 task 标记完成；它只帮助 review / verification。
- Evidence 删除或过期时，TaskRun 应显示 degraded evidence，而不是崩溃。

### 7. 跨层落位

预计模块边界：

- `src/features/browser-agent/**`：Browser Dock UI、hooks、snapshot viewer、attachment UI。
- `src/services/tauri/browserAgent.ts`：所有 browser command 的 frontend bridge。
- `src/services/tauri.ts`：统一导出 browser bridge。
- `src-tauri/src/browser_agent/**`：session command、platform policy、snapshot capture、evidence persistence、action gate。
- `src-tauri/src/command_registry.rs`：注册 browser commands。
- `src-tauri/capabilities/default.json`：增加 browser webview labels / permissions。
- `openspec/specs/vibecoding-browser-agent/spec.md`：主行为契约。
- 可能的 delta specs：`agent-task-orchestration-center`、`agent-task-center`、`conversation-lifecycle-contract`。

### 8. Data model contract

Browser Agent 的数据结构需要一次性定义完整，避免实现阶段边写边补导致 cross-layer drift。

核心类型：

```ts
type BrowserAgentFeaturePhase =
  | "disabled"
  | "read_only_snapshot"
  | "safe_navigation"
  | "targeted_element_actions"
  | "form_submit"
  | "full_agent";

type BrowserSessionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "blocked"
  | "failed"
  | "closed"
  | "unsupported";

type BrowserSession = {
  browserSessionId: string;
  workspaceId: string;
  label: string;
  url: string;
  normalizedUrl: string;
  origin: string | null;
  title: string | null;
  faviconRef?: string | null;
  status: BrowserSessionStatus;
  featurePhase: BrowserAgentFeaturePhase;
  platformCapability: BrowserPlatformCapability;
  linkedThreadId?: string | null;
  linkedTaskRunId?: string | null;
  linkedOrchestrationTaskId?: string | null;
  lastSnapshotId?: string | null;
  lastActionId?: string | null;
  errorCode?: string | null;
  diagnosticMessage?: string | null;
  createdAt: number;
  updatedAt: number;
  lastActivatedAt: number;
  closedAt?: number | null;
};

type BrowserSnapshotBudget = {
  charLimit: number;
  visibleTextLimit: number;
  elementLimit: number;
  formFieldLimit: number;
  diagnosticLimit: number;
  tokenEstimate?: number | null;
};

type BrowserTextNode = {
  targetId: string;
  role: "heading" | "paragraph" | "list_item" | "label" | "code" | "table_cell" | "other";
  level?: number | null;
  text: string;
  truncated: boolean;
};

type BrowserActionTarget = {
  targetId: string;
  kind: "link" | "button" | "input" | "textarea" | "select" | "checkbox" | "radio" | "submit" | "other";
  label: string;
  accessibleName?: string | null;
  text?: string | null;
  href?: string | null;
  placeholder?: string | null;
  valuePreview?: string | null;
  disabled: boolean;
  visible: boolean;
  sensitive: boolean;
  bounds?: BrowserElementBounds | null;
};

type BrowserElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BrowserFormSummary = {
  formId: string;
  label: string;
  method?: string | null;
  actionOrigin?: string | null;
  fields: BrowserActionTarget[];
  submitTargets: BrowserActionTarget[];
  sensitive: boolean;
};

type BrowserLandmark = {
  targetId: string;
  role: "main" | "navigation" | "search" | "form" | "banner" | "contentinfo" | "dialog" | "region";
  label: string;
  textPreview?: string | null;
};

type BrowserDiagnostic = {
  diagnosticId: string;
  kind: "console_error" | "console_warning" | "network_error" | "security_warning" | "capture_warning";
  severity: "info" | "warning" | "error";
  message: string;
  source?: string | null;
  redacted: boolean;
};

type BrowserNetworkSummary = {
  requestCount: number;
  failedRequestCount: number;
  blockedRequestCount: number;
  mainDocumentStatus?: number | null;
  slowRequestCount?: number | null;
  redacted: boolean;
};

type BrowserPrivacyReport = {
  redactionApplied: boolean;
  redactedKinds: Array<
    | "password"
    | "token"
    | "cookie"
    | "authorization"
    | "hidden_input"
    | "email"
    | "phone"
    | "secret_like"
    | "unknown"
  >;
  omittedKinds: Array<"raw_dom" | "cookies" | "headers" | "scripts" | "styles" | "hidden_nodes">;
};

type BrowserContextSnapshot = {
  snapshotId: string;
  browserSessionId: string;
  workspaceId: string;
  capturedAt: number;
  source: {
    url: string;
    normalizedUrl: string;
    title: string | null;
    origin: string | null;
  };
  page: {
    visibleText: string;
    textTruncated: boolean;
    headings: BrowserTextNode[];
    landmarks: BrowserLandmark[];
    links: BrowserActionTarget[];
    buttons: BrowserActionTarget[];
    forms: BrowserFormSummary[];
    selectedText?: string | null;
  };
  diagnostics: {
    console: BrowserDiagnostic[];
    network: BrowserNetworkSummary | null;
    captureWarnings: BrowserDiagnostic[];
  };
  evidence: {
    screenshotRef?: string | null;
    htmlExcerptRef?: string | null;
  };
  privacy: BrowserPrivacyReport;
  budget: BrowserSnapshotBudget;
  availability: "available" | "partial" | "expired" | "deleted" | "unsupported";
};

type BrowserContextAttachment = {
  kind: "browser_snapshot";
  attachmentId: string;
  browserSessionId: string;
  snapshotId: string;
  workspaceId: string;
  title: string | null;
  url: string;
  capturedAt: number;
  stale: boolean;
  summary: string;
  privacy: BrowserPrivacyReport;
};

type BrowserProviderRouteDecision = {
  requestedCapability:
    | "read_snapshot"
    | "navigate"
    | "scroll"
    | "click"
    | "type"
    | "submit"
    | "full_agent_task";
  selectedProvider:
    | "built_in_browser_agent"
    | "browser_skill"
    | "computer_use"
    | "external_cdp"
    | "none";
  reason: string;
  userOverride: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
};
```

Rust DTOs must preserve camelCase serialization and map unknown future enum values to explicit error/degraded states instead of panicking.

## Risks / Trade-offs

[Risk] Tauri WebView 跨平台行为不一致。  
Mitigation：MVP 只承诺 URL/title/visible text/basic landmarks/screenshotRef；高级操作按 platform capability 显式降级。

[Risk] 跨域页面无法稳定注入或读取完整 DOM。  
Mitigation：不承诺完整 DOM；优先读取可见文本与语义摘要；复杂自动化后续通过 optional CDP provider 扩展。

[Risk] Browser snapshot 过大，污染 AI context 或增加 token 成本。  
Mitigation：强制 char/token budget、摘要化、截断标记、用户可见 attachment 状态。

[Risk] 敏感信息泄露给 AI。  
Mitigation：默认 redaction；禁止 cookie/token/password/Authorization 注入；对 input/form fields 做 secret-like detection；evidence TTL 和清理入口。

[Risk] AI 自动网页操作造成误点击、误提交或外部副作用。  
Mitigation：Phase 1 read-only；写操作必须 action preview、用户授权、stop button、audit log；submit/multi-step 任务需要更高权限级别。

[Risk] Browser Dock 和现有主窗口导航策略冲突。  
Mitigation：Browser Dock 使用独立 webview label 和 navigation policy；主窗口继续外链打开系统浏览器。

[Risk] Browser evidence 与 TaskRun/Orchestration 概念重叠。  
Mitigation：Browser evidence 只表示观察和操作证据；TaskRun 仍是执行记录，OrchestrationTask 仍是工作项。

## Migration Plan

1. 新增 OpenSpec specs，先固化 read-only Browser Agent 行为契约。
2. 实现 BrowserSession metadata 与 Browser Dock UI，不接入 AI context。
3. 实现 bounded BrowserContextSnapshot 与 sanitizer，并在 UI 中展示 snapshot preview。
4. 接入 composer / task dispatch 的 browser context attachment。
5. 接入 TaskRun / Orchestration evidence display。
6. 在 feature flag 下开放 Phase 2 navigation/scroll action。
7. 后续按 spec 增加 click/type/submit 与 optional CDP provider。

Rollback：

- MVP 实现应由 feature flag 和用户设置控制；关闭后 Browser Dock 不自动注入上下文，conversation / TaskRun 忽略 browser attachments，并在 Dock 内保留显式启用路径。
- Browser evidence store 使用独立 namespace；回滚不应影响 existing conversation、TaskRun、workspace store。
- 若某平台 WebView snapshot 不稳定，应降级为 Browser Dock only，并显示 snapshot unsupported reason。

## Decisions and Open Questions

- Decision：Browser Dock 第一入口放在顶部全局 toolbar icon group。点击后打开主内容区右侧 companion panel，与 conversation 左右分屏；不使用遮罩浮层承载常驻浏览器。左侧 sidebar / icon rail、Workspace Home、Agent Task Orchestration Center、composer attachment 只能作为补充入口；MVP 不能让用户只能先进入某个操作室页面才能打开浏览器。
- Decision：Browser Agent MVP 默认开启；用户仍可在 Settings 或 Browser Dock 内显式禁用/启用。已关闭状态必须有清晰的一键启用路径。
- Snapshot capture 由前端注入脚本完成，还是由 Rust webview API / custom preload 负责？需要在实现前确认 Tauri 2 对 remote page injection 的稳定能力。
- Screenshot evidence 使用 Tauri WebView 原生截图、系统截图，还是仅先保留 text snapshot？MVP 可先不强制 screenshot。
- 是否需要 per-origin allowlist / denylist？MVP 至少需要阻止本地敏感协议和危险 URL scheme。
- 是否需要为 browser session 引入 incognito mode？建议 MVP 默认 session-scoped isolated storage，后续再提供持久登录态策略。
