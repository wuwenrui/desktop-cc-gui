## 中文阅读导引

这份 design 说明 Phase 3 的技术分层。中文理解可以按这条线看：

```text
BrowserDock 只管窗口/Tab/Renderer
Observation Service 判断 capture 是否可信
Evidence Builder 把证据整理成可审查 view model
User Annotation 把用户标注变成结构化文字证据
Code Bridge 给本地代码候选
Action Preview 只做预览/确认/审计，不默认执行高风险动作
```

核心设计原则：`Snapshot` 描述“页面里有什么”，`BrowserObservation` 描述“这次观察能不能信”。`BrowserUserAnnotation` 必须绑定 observation，这样页面变化后 annotation 可以自动变成 stale/degraded。

## Context

Browser Dock Phase 2 established the current baseline: a right-side companion Browser Dock with multi-tab UI, one native WebView renderer, active-tab-only capture, Snapshot v2, sanitizer, composer preview, live/history Browser Context cards, and a canonical engine-agnostic `<browser_context_v2>` injection path.

The remaining gap is trust and action readiness. A model can now receive browser facts, but the product does not yet make every capture's reliability, freshness, degradation, visual limitation, and code-candidate confidence sufficiently explicit. Without that layer, moving directly into browser actions would create a black-box automation surface.

Phase 3 therefore treats Browser Dock as an evidence system first:

```text
Browser Dock -> Trusted Observation -> Evidence Inspector -> Code Bridge -> Authorized Action Preview
```

Only after observation and evidence are reliable should higher-risk mutating browser actions become eligible for future phases.

## Related Documents

- Proposal: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/proposal.md`
- Behavior delta: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/specs/browser-agent-page-understanding/spec.md`
- Task breakdown: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/tasks.md`
- Implementation plan: `docs/plans/2026-06-01-browser-dock-phase3.md`
- Trellis execution task: `.trellis/tasks/06-01-browser-dock-phase3-observation-core/prd.md`

## Design Goals

- Preserve the existing Browser Dock runtime baseline and active-tab source of truth.
- Make observation trust explicit and reusable across composer, messages, TaskRun, orchestration, and AI payloads.
- Use one canonical read-only capture script implementation.
- Improve local page-to-code candidate quality without overclaiming certainty.
- Add visual evidence only as opt-in supplemental context.
- Introduce action preview/audit contracts before enabling mutating automation.
- Keep Browser Dock and Composer thin.

## Architecture Overview

```text
BrowserDock
  owns: sessions, tabs, active session, renderer binding, WebView lifecycle
  emits: ActiveBrowserContext

Observation Service
  owns: capture request, transport result, stale reason reconciliation, diagnostics
  returns: BrowserObservation

Evidence Builder
  owns: sanitized BrowserEvidence, sectioned evidence view model, copy-safe summary
  returns: BrowserContextAttachment + BrowserEvidenceViewModel

Code Bridge
  owns: workspace-local candidate generation, confidence, source evidence, open affordance
  returns: BrowserCodeCandidate[]

Visual Evidence
  owns: screenshot/OCR/vision opt-in references, budget, privacy confirmation
  returns: BrowserVisualEvidenceRef[]

User Annotation
  owns: user-created point/region/element/text anchors, notes, nearby evidence, stale reconciliation
  returns: BrowserUserAnnotation[]

Action Preview
  owns: proposed action, risk, confirmation, before/after snapshot refs, audit entry
  returns: BrowserActionPreview / BrowserActionAuditEntry
```

## Core Contracts

### BrowserObservation

`BrowserObservation` is the trust envelope around a page capture.

Required fields:

- `observationId`
- `schemaVersion`
- `browserSessionId`
- `workspaceId`
- `capturedAt`
- `state`: `available | degraded | stale | expired | unsupported`
- `staleReasons`: array of explicit reasons
- `transport`: `webview_dom | metadata_fallback | screenshot_ocr | external_provider | unavailable`
- `rendererBinding`: `matched | mismatched | unavailable`
- `source`: URL, title, tab label, page type
- `budget`: char limits, omitted counts, truncation state
- `privacy`: omitted/redacted kinds
- `diagnostics`: user-visible and AI-visible messages
- `omittedCapabilities`: e.g. `iframe`, `shadow_dom`, `canvas`, `cross_origin_frame`, `visual_binary`, `authenticated_region`

`screenshot_ocr` MUST only appear after explicit user authorization. It is never an automatic fallback for default read-only text capture. `external_provider` is reserved for a future optional provider path and is not the Phase 3 default transport.

### BrowserEvidenceViewModel

The UI must not render raw snapshot objects directly. It should consume a sectioned view model:

- `overview`
- `primaryContent`
- `readableBlocks`
- `interactiveElements`
- `visualEvidence`
- `codeCandidates`
- `diagnostics`
- `privacyBudget`

Each section has:

- `title`
- `state`
- `items`
- `truncated`
- `copySafeText`
- `emptyReason`

### BrowserCodeCandidate v2

Candidates must be explainable:

- `candidateId`
- `filePath`
- `symbolName`
- `reason`
- `confidence`: `high | medium | low`
- `matchedText`
- `sourceEvidence`
- `explanation`
- `openAction`

Allowed reasons:

- `route_match`
- `file_name_match`
- `visible_text_match`
- `heading_match`
- `button_label_match`
- `form_label_match`
- `aria_label_match`
- `test_id_match`
- `component_symbol_match`

### BrowserUserAnnotation

`BrowserUserAnnotation` 是用户在当前 Browser Dock 页面上创建的结构化证据。Phase 3 发送的是 text evidence，不是 annotated image binary。

也就是说，AI 默认看到类似这样的信息：

```text
User annotation:
- note: "这里按钮文案不对"
- anchor: region x=420 y=180 w=160 h=48
- nearest element: button "Start"
- nearby text: "Start your first task"
- observation state: available
```

Required fields:

- `annotationId`
- `observationId`
- `browserSessionId`
- `workspaceId`
- `createdAt`
- `url`
- `title`
- `anchor`: `point | region | element | text_range`
- `userNote`
- `viewport`: width, height, scrollX, scrollY, devicePixelRatio
- `region`: x, y, width, height for point/region anchors
- `nearbyText`
- `nearestElement`: role, label, placeholder, href origin, selector hint, sensitive flag
- `privacy`: redacted kinds and omitted kinds
- `staleReasons`
- `diagnostics`

Coordinate model MUST record viewport size、scroll offset、`devicePixelRatio`。只有 x/y 坐标是不够的，因为页面 scroll、zoom、DPR 变化后，同一个点可能已经不是同一个 UI 区域。

Phase 3 MAY support element/text/region annotation contracts and Evidence Inspector rendering。Phase 4 才负责 annotated screenshot overlays、multimodal image injection、annotation-to-code diagnosis、annotation-guided browser actions。

### BrowserActionPreview

All actions are preview-first:

- `actionId`
- `browserSessionId`
- `action`: `navigate | reload | scroll | click | type | select | submit`
- `targetDescription`
- `valuePreview`
- `reason`
- `riskLevel`: `low | medium | high`
- `requiresUserConfirmation`
- `blockedByDefault`
- `beforeSnapshotId`
- `expectedEffect`
- `privacyNotice`

Phase 3 may execute confirmed low-risk actions only:

- `navigate`
- `reload`
- `scroll`

These remain disabled if settings or platform capability disallow them. Mutating actions stay preview-only/blocked.

## Data Flow

### Attach browser context

```text
User clicks Attach in Browser Dock header
  -> command bus requests attachment for workspace
  -> attachment hook asks Observation Service to capture active context
  -> BrowserDock active context validates session + renderer binding
  -> backend executes canonical read-only capture script or returns degraded fallback
  -> sanitizer builds bounded snapshot
  -> observation reconciles stale/degraded reasons
  -> evidence builder creates BrowserContextAttachment + EvidenceViewModel
  -> Composer preview renders Evidence Inspector summary
```

### Send message with browser context

```text
Composer send
  -> sendOptions.browserContextAttachment
  -> useThreadMessaging injects canonical browser context payload once
  -> optimistic user row stores the same attachment
  -> MessagesRows renders BrowserContextSummaryCard/Evidence Inspector
  -> history restore can parse fallback prompt block or use structured attachment
```

### Generate code candidates

```text
Observation source says workspace-local URL
  -> Code Bridge normalizes route and page facts
  -> workspace file index/search returns candidate files
  -> candidate scorer combines route, file name, text, landmarks, aria/test ids, symbols
  -> UI shows candidates with confidence and explanation
  -> open action delegates to existing file/code navigation
```

### Create user annotation

```text
User marks a point/region/element/text in Browser Dock
  -> annotation binds to the current BrowserObservation
  -> annotation records viewport coordinates, scroll, DPR, URL/title, and session/workspace identity
  -> nearest text and element metadata are extracted through sanitized evidence helpers
  -> Evidence Builder attaches BrowserUserAnnotation to BrowserEvidenceViewModel
  -> Composer preview and message card show the annotation as user-authored evidence
  -> AI payload includes note + anchor metadata + nearby evidence, not screenshot binary
```

中文解释：用户画框/点选/选中文本后，系统先把这次标注绑定到当前 `BrowserObservation`。AI 看到“用户标注了哪里、说了什么、附近有什么文本和元素”，但默认不会收到截图或视觉二进制。

### Confirm safe browser action

```text
AI/user proposes navigate/reload/scroll
  -> Action Preview created with risk + expected effect
  -> User confirms
  -> before snapshot captured
  -> backend executes safe action if enabled
  -> after snapshot captured
  -> audit entry stores before/after refs and outcome
  -> UI reports diff/diagnostics
```

## Key Decisions

### Decision 1: Observation state is separate from Snapshot

Snapshot describes page facts. Observation describes trust in the capture. Keeping them separate prevents every page model from absorbing transport, freshness, platform, and policy logic.

### Decision 2: Single native renderer remains the default

Phase 3 does not switch to multiple child WebViews or external Chrome. The active renderer binding remains a hard gate. Renderer mismatch must produce stale/degraded diagnostics, never wrong-page capture.

### Decision 3: Visual evidence is supplemental and opt-in

Screenshot/OCR/vision can help where DOM text is insufficient, but it has higher privacy and cost. The default AI payload remains structured text evidence. Visual binary or OCR injection requires explicit user confirmation and budget metadata.

### Decision 4: Code bridge reuses existing navigation

Browser Agent may generate candidates but must not own a separate file opening/navigation stack. Candidate open actions delegate to existing file-view/code-intelligence surfaces.

### Decision 5: Actions are preview-first

Action execution must be designed as an auditable workflow before mutating actions are enabled. Phase 3 only permits low-risk safe navigation actions when confirmed.

### Decision 6: Annotations are text evidence before visual evidence

User annotations 只要包含 user note、anchor type、coordinates、nearby text、nearest element metadata，就已经能让 AI 理解“用户指的是哪里”。带 overlay 的 rendered screenshot 更强，但 privacy、budget、stale-coordinate risk 都更高。因此 Phase 3 先定义和展示 annotation evidence；annotated screenshots 和 multimodal interpretation 留给后续 visual phase。

## Module Boundary

Recommended frontend modules:

```text
src/features/browser-agent/observation/
src/features/browser-agent/evidence/
src/features/browser-agent/code-bridge/
src/features/browser-agent/visual-evidence/
src/features/browser-agent/annotations/
src/features/browser-agent/actions/
```

Recommended backend modules:

```text
src-tauri/src/browser_agent/observation.rs
src-tauri/src/browser_agent/evidence.rs
src-tauri/src/browser_agent/annotations.rs
src-tauri/src/browser_agent/actions.rs
src-tauri/src/browser_agent/visual_evidence.rs
```

Existing modules keep these responsibilities:

- `BrowserDock`: session/tab/renderer lifecycle.
- `useBrowserContextAttachment`: attachment state owner and command bus subscriber.
- `attachment.ts`: canonical AI payload formatter/parser.
- `snapshotSanitizer.ts`: privacy and budget boundary.
- `Composer`: wiring only.

## Stale Reason Model

Stale reasons should be additive:

- `active_tab_changed`
- `renderer_mismatch`
- `url_changed`
- `title_changed`
- `scroll_changed`
- `dom_fingerprint_changed`
- `ttl_expired`
- `browser_dock_closed`
- `session_closed`
- `workspace_mismatch`
- `capture_degraded`

UI must show the top reason in compact surfaces and all reasons in details.

Annotations inherit the same stale reason model. A region or point annotation MUST become stale or degraded when its bound observation no longer matches the active tab, renderer, URL/title, scroll threshold, DOM fingerprint, session, workspace, or TTL policy.

## Privacy And Security

- All AI-visible strings must pass sanitizer.
- Screenshot/OCR/vision must be opt-in and budgeted.
- Annotation notes and nearby evidence must pass sanitizer before preview, storage, or AI payload formatting.
- Annotated screenshots, overlay images, and multimodal region payloads are not sent by default in Phase 3.
- Hidden/password/token/authorization values remain omitted or redacted.
- Evidence records store bounded references and summaries, not raw DOM or complete image payloads by default.
- Private-network policy remains blocked by default except workspace-scoped local development targets.
- Action audit logs must not store typed secrets; value previews for type/submit remain redacted.

## Rollout Strategy

1. Add observation types and view models without changing existing capture behavior.
2. Move current preview/card rendering onto Evidence Inspector view models.
3. Consolidate capture script source and add fixture regression.
4. Upgrade code candidates for workspace-local pages.
5. Add visual evidence opt-in scaffolding.
6. Add safe navigation action preview/confirm/audit.
7. Keep mutating actions blocked until a later dedicated change.

## Validation Strategy

- OpenSpec strict validation for the change.
- Frontend unit tests for observation stale reasons, evidence view model, code candidate scoring, preview/card rendering, and action preview state.
- Rust tests for observation DTO serialization, renderer mismatch diagnostics, URL policy, evidence retention, and action audit records.
- Fixture tests for GitHub issue, PR diff, docs page, article page, form wizard, dashboard, SPA shell, and localhost app route.
- Large-file governance checks after implementation.
- Manual cross-platform matrix for macOS, Windows WebView2, and Linux WebKitGTK degraded behavior.

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Capture script drift | Frontend/Rust behavior diverges | Single canonical script source and fixture tests |
| Stale state over-noises UI | Users ignore warnings | Compact top reason plus detailed drilldown |
| Code candidates overclaim | AI edits wrong files | Confidence, source evidence, wording guard |
| Visual evidence leaks sensitive data | Privacy regression | Explicit confirmation, sanitizer, budget metadata |
| Action preview becomes accidental execution | Unsafe automation | Confirmation gate, settings gate, blocked mutating actions |
| Large files grow again | Maintainability regression | Dedicated modules and large-file governance |

## Implementation Mapping - 2026-06-03

### Runtime Architecture

Browser Dock 当前实现分为五条协作链路：

1. Detached Dock Window：前端通过 `browserAgentDockWindow.ts` 打开独立 Browser Dock renderer，`DetachedBrowserAgentWindow.tsx` 承接窗口页面，`browser-agent-window.css` 提供窗口级样式。
2. Tauri Browser Agent Bridge：`src-tauri/src/browser_agent/mod.rs` 负责窗口创建、toolbar 注入、capture bridge、安全 action、snapshot refresh、multi-tab session routing 和 toolbar i18n。
3. Trusted Observation Capture：`src/features/browser-agent/capture/read-only-capture-script.js` 是唯一 capture script 源，Rust 侧 `capture_script.rs` 只 include，不再维护重复脚本。
4. Evidence and Annotation Surface：`evidence/*`、`visual-evidence/*`、`annotations/*`、`components/BrowserEvidencePanel*` 负责把 DOM/text/visual/a11y 证据转换成可审计 UI。
5. Code Bridge and Task Context：`code-bridge/*`、`utils/codeCandidates.ts`、`types.ts`、`features/tasks/types.ts`、`taskRunStorage.ts`、`useThreadMessaging.ts` 负责把浏览器证据桥接到任务和消息上下文。

### Source of Truth Decisions

- Capture script source of truth 是 frontend `capture/read-only-capture-script.js`；Rust 侧不得再手写第二份脚本。
- Active browser context source of truth 是 Browser Agent session id + workspace id；toolbar action 必须从当前 toolbar URL query 读取 session/workspace，不能依赖创建时闭包里的旧 session。
- Browser Dock UI copy source of truth 分两层：React UI 使用 `src/i18n/locales/*.part1.ts`；Rust 注入 toolbar 使用 `browser_toolbar_labels(locale)`，由前端打开窗口时传入 `i18n.language`。
- Evidence UI 和 Code Bridge 都必须保持 read-only observation 边界；涉及 action 的能力必须经 Action Preview/Audit Trail 显式呈现。

### Residual Design Risks

- Detached window 生命周期和主界面 session 状态同步仍需端到端验证，尤其是多 tab、关闭窗口、重开窗口、跨 workspace 场景。
- Toolbar i18n 当前覆盖 Browser Dock 注入层静态 copy，后续如果增加更多 toolbar 文案，需要同步扩展 Rust labels。
- Visual evidence 与 DOM evidence 的一致性需要继续保留 degraded capability matrix，避免在不同平台/browser runtime 下过度承诺。
