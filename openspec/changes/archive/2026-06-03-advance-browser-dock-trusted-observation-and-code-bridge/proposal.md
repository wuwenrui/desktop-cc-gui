## 中文阅读导引

这份 proposal 的核心是：Browser Dock Phase 3 不急着做“AI 自动操作浏览器”，而是先补一层可信的浏览器观察与证据系统。

关键 English terms 保留不翻译，避免后续实现歧义：

- `BrowserObservation`：浏览器观察的可信度外壳，描述这次 capture 是否 fresh、stale、degraded、expired 或 unsupported。
- `Evidence Inspector`：把页面证据拆成 overview、primary content、interactive elements、diagnostics 等区块给用户审查。
- `Code Bridge`：把 workspace-local page facts 转成可解释的本地代码候选。
- `BrowserUserAnnotation`：用户在浏览器页面上做的 point / region / element / text_range 标注，AI 默认看到结构化文字证据，不默认看到截图。
- `Action Preview`：浏览器动作必须先 preview、confirm、audit，Phase 3 不默认执行 click/type/submit。

## Why

Browser Dock Phase 2 has closed the read-only evidence-grade page understanding MVP: the app can attach active-tab page facts to an AI turn as a bounded BrowserContextAttachment. The next bottleneck is not "more DOM text"; it is whether the observation is trustworthy, whether page facts can point to local code with explainable confidence, and whether future browser actions can be previewed and audited before execution.

Phase 3 upgrades Browser Dock from a page snapshot attachment into a trusted observation and code-bridge substrate. This creates the safety and evidence layer required before any higher-risk browser automation such as click, type, select, or submit can be enabled.

## Related Documents

- Implementation plan: `docs/plans/2026-06-01-browser-dock-phase3.md`
- Trellis execution task: `.trellis/tasks/06-01-browser-dock-phase3-observation-core/prd.md`
- Technical design: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/design.md`
- Task breakdown: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/tasks.md`
- Behavior delta: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/specs/browser-agent-page-understanding/spec.md`

## 目标与边界

- Phase 3 MUST inherit the Phase 1/2 Browser Dock baseline: top toolbar entry, right companion split, draggable conversation/browser divider, multi-tab UI, single native WebView renderer, active-tab ownership, engine-agnostic attachment, settings-based enablement, cross-platform degradation, large-file governance, and privacy-safe defaults.
- Phase 3 MUST make capture trust explicit through availability, stale reasons, degradation diagnostics, budget state, privacy state, and renderer binding state.
- Phase 3 MUST treat Browser Dock as an observation surface first. Browser actions may be previewed and audited, but mutating actions remain blocked by default.
- Phase 3 MUST improve local page-to-code candidates for workspace-local pages without claiming certain ownership unless evidence is strong and explicit.
- Phase 3 MUST define a `BrowserUserAnnotation` contract：用户可以在打开的 Browser Dock 页面里标注 point、region、element 或 text range；AI 看到的是结构化证据，包括用户备注、坐标、附近文本、最近元素、stale reasons，而不是默认截图。
- Phase 3 MUST keep AI-visible browser context engine-agnostic across Claude, Codex, Gemini, OpenCode, and custom providers.
- Phase 3 MUST avoid growing `Composer.tsx` and `BrowserDock.tsx` with new responsibilities; observation, evidence, code-bridge, visual evidence, and action logic must live in focused Browser Agent modules.
- Phase 3 MUST continue to exclude raw DOM, cookies, headers, storage, scripts, styles, password values, token values, Authorization values, hidden input values, and page secrets from preview, evidence, storage, and AI payloads.

## 非目标

- Do not implement full Playwright/CDP-grade browser automation runtime.
- Do not allow AI to click, type, select, or submit without user confirmation.
- Do not send full screenshots, OCR output, or image binaries to models by default.
- Do not send annotated screenshots, image overlays, or multimodal region images to models by default. Phase 3 的 annotation 默认只是 structured text evidence；带标注截图和 multimodal region payload 留到后续显式 opt-in visual flow。
- Do not store complete HTML or raw DOM for evidence.
- Do not create a Browser Agent-specific file navigation system that bypasses existing code-intelligence/file-view navigation surfaces.
- Do not let AI automatically click, type, select, submit, or otherwise act on a user annotation in Phase 3。用户标注只是证据，不是自动执行授权。
- Do not guarantee perfect understanding for iframe, shadow DOM, canvas, virtual list, heavily authenticated, or cross-origin embedded content; Phase 3 must expose degraded diagnostics instead.
- Do not convert code candidates into definitive file ownership claims. Candidates remain suggestions with evidence, reason, and confidence.

## What Changes

- Add a Browser Observation v3 contract that records capture availability, stale reasons, transport status, renderer binding, omitted capabilities, budget state, privacy state, and diagnostics.
- Consolidate read-only capture script ownership into one canonical source to prevent frontend/Rust extraction drift.
- Extend stale policy from a boolean to explicit reasons: active tab switch, renderer mismatch, URL change, title change, scroll threshold, DOM fingerprint change, TTL expiry, Browser Dock close, session close, and workspace mismatch.
- Replace the current single expanded context block with a Browser Context Evidence Inspector that separates overview, primary content, readable blocks, interactive elements, visual evidence, code candidates, diagnostics, and privacy/budget.
- Upgrade Local Page-to-Code Bridge into a workspace-aware candidate pipeline using route, file name, visible text, headings, button labels, form labels, ARIA labels, test ids, and component symbols.
- Add `BrowserUserAnnotation` Contract：支持用户创建 point、region、element、text anchors。Annotation 必须绑定 `BrowserObservation`，记录 user note、viewport coordinates、scroll state、`devicePixelRatio`、nearby DOM/text evidence、`staleReasons`、privacy/budget metadata。
- Add visual evidence MVP as an opt-in channel for screenshot thumbnails, OCR text, and multimodal references, with explicit user confirmation before model injection.
- Add an Authorized Browser Action Preview contract. Phase 3 may enable preview-confirm-audit flow for navigate, reload, and scroll; click, type, select, and submit remain blocked by default.
- Gate safe browser actions by settings and platform capability even after user confirmation.
- Add before/after snapshot comparison metadata for confirmed safe navigation actions.
- Extend Browser Context Attachment formatting so AI sees trust state and limitations before using browser facts.
- Extend evidence references so TaskRun and orchestration dispatch can show available/stale/degraded/expired browser evidence consistently.

## 技术方案选项与取舍

| Option | Approach | Strength | Weakness | Decision |
|---|---|---|---|---|
| A | Keep Phase 2 snapshot shape and only improve copy/UI wording | Lowest effort, low regression risk | Does not solve trust, stale reasons, code confidence, or action readiness | Reject |
| B | Build a trusted observation layer on top of the existing single WebView renderer and BrowserContextAttachment | Preserves current architecture, improves safety, keeps engine-agnostic path | Requires careful contract and UI refactor | Choose for Phase 3 |
| C | Replace Browser Dock capture with external Playwright/CDP as the default engine | Strong automation and inspection power | Heavy dependency, distribution complexity, larger security surface, not aligned with desktop MVP | Defer as optional advanced provider |
| D | Make screenshot/vision the primary page understanding channel | Better visual layout understanding | Higher privacy cost, more expensive, weak code mapping, less deterministic than DOM facts | Use only as opt-in supplement |

Phase 3 chooses B as the main path. C and D may become provider or opt-in supplements after the trusted observation and user confirmation contracts are stable.

## Capabilities

### New Capabilities

- None. Phase 3 extends the existing Browser Agent Page Understanding capability rather than introducing a parallel browser automation capability.

### Modified Capabilities

- `browser-agent-page-understanding`: Add trusted observation state, stale reasons, evidence inspector behavior, workspace-aware code bridge, opt-in visual evidence, and authorized action preview requirements.

## Impact

- Frontend:
  - `src/features/browser-agent/**` will gain focused observation, evidence, code-bridge, visual evidence, and action-preview modules.
  - `BrowserDock` remains session/tab/renderer lifecycle only.
  - `Composer` remains wiring only and delegates browser context UI/state to Browser Agent modules.
  - Message rows and TaskRun evidence surfaces consume shared BrowserContextAttachment/BrowsingEvidence view models.
- Service bridge:
  - `src/services/tauri/browserAgent.ts` may add observation, visual evidence, and action preview commands while preserving existing snapshot commands during migration.
- Backend:
  - `src-tauri/src/browser_agent/**` will expose observation diagnostics, stale reasons, optional visual evidence references, and safe action preview/audit contracts.
- AI runtime:
  - Existing canonical browser context formatter will include trust state and limitations without creating engine-specific payloads.
- Security/privacy:
  - Existing sanitizer remains the boundary for all AI-visible strings.
  - Screenshot/OCR/model-image channels require explicit confirmation and budget metadata.
- Governance:
  - Implementation must follow Trellis frontend/backend/guides rules before code changes.
  - Validation must include strict OpenSpec validation, focused frontend tests, focused Rust tests, and large-file governance when implementation begins.

## 验收标准

- Browser observation exposes `available`, `degraded`, `stale`, `expired`, and `unsupported` states with user-visible and AI-visible diagnostics.
- Browser context stale state includes explicit reasons rather than only a boolean.
- Capture script logic has one canonical source of truth and fixture coverage prevents frontend/Rust drift.
- Composer preview, sent message card, TaskRun evidence, and orchestration dispatch use consistent observation/evidence state.
- Browser Context Evidence Inspector lets users independently inspect primary content, readable blocks, interactive elements, visual evidence, code candidates, diagnostics, and privacy/budget.
- Workspace-local pages generate explainable code candidates with reason, confidence, matched text, source evidence, and open action.
- External sites do not generate local code candidates unless a later explicit manual mapping feature is designed.
- Screenshot/OCR/vision payloads are opt-in and are not sent to AI by default.
- User annotations 只有在 Browser Context attached 时，才作为 structured browser evidence 进入 AI-visible payload；annotated screenshots 和 image binaries 仍属于 opt-in/future visual evidence。
- 当 page URL、title、scroll position、DOM fingerprint、renderer binding、session、workspace 或 observation age 与原 anchor 不再匹配时，stale annotations 必须显示 diagnostics，不能伪装成 fresh evidence。
- Navigate/reload/scroll can be previewed, confirmed, audited, and compared with before/after snapshots.
- Click/type/select/submit remain blocked by default in Phase 3.
- No browser context payload exposes raw DOM, cookies, headers, storage, scripts, styles, password/token/Authorization values, hidden input values, or page secrets.

## Implementation Calibration - 2026-06-03

本次校准基于工作区浏览器相关变更区，而不是只按原始 Phase 3 first slice 设想回写。实际实现已经从“只做 observation core”推进到更完整的 Browser Dock trusted observation + evidence + code bridge 能力链路。

### Actual Implemented Scope

- Browser Dock 从主界面内嵌面板迁移为 detached renderer window，由 `src/features/browser-agent/browserAgentDockWindow.ts`、`src/features/browser-agent/components/DetachedBrowserAgentWindow.tsx`、`src/styles/browser-agent-window.css` 和 `src/router.tsx` 承接窗口入口。
- Tauri Browser Agent 新增 dock renderer window、toolbar bridge、capture bridge、safe browser action、snapshot refresh、trusted observation DTO、toolbar i18n 和多 tab session targeting。
- Read-only capture script 以 `src/features/browser-agent/capture/read-only-capture-script.js` 作为 canonical frontend source，Rust 侧 `src-tauri/src/browser_agent/capture_script.rs` 通过 `include_str!` 引用，避免双份脚本漂移。
- 前端新增 Evidence Inspector、Action Preview/Audit Trail、Annotation contract、Visual Evidence gate/reference、Code Bridge candidate extraction 与 active browser context attachment command bus。
- Thread messaging、task run storage、task types、Tauri service API、i18n locale copy 已跟随浏览器上下文链路补齐。

### Late-session Fixes Included

- 多 tab toolbar 点击关联逻辑已从闭包内 stale `browserSessionId` 改为读取 toolbar query 中的 `sessionId` / `workspaceId`，使 attach/open/close/activate fallback 命中当前 active tab。
- Browser Dock toolbar 的静态文案已补 i18n，`open_browser_agent_window` 接受 locale 并向 Rust toolbar script 传播当前语言。

### Calibration Implication

该 change 当前不应再被描述为“只完成首片 observation core”。更准确的状态是：主要实现已落地，剩余风险集中在验证、跨平台降级矩阵确认、窗口生命周期边界和 evidence/code bridge 的端到端回归。
