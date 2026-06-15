# Implement Browser Dock Trusted Observation Core

## Goal

执行 Browser Dock Phase 3 的第一实现切片：先建立 trusted observation contract、explicit stale reasons、sectioned evidence view model，并让 Composer preview 与 message evidence surfaces 使用一致的 observation/evidence state。

补充中文说明：本任务也会为 `BrowserUserAnnotation` 预留 contract。用户未来可以在 Browser Dock 页面上标注 point、region、element 或 text range；AI 默认看到 structured text evidence，不默认看到 annotated screenshot。

本任务只做后续实现入口和范围约束。当前状态为 planning，未开始代码实现。

## Linked OpenSpec Change

- `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge`

## Linked Plan

- `docs/plans/2026-06-01-browser-dock-phase3.md`

## Linked OpenSpec Artifacts

- Proposal: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/proposal.md`
- Design: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/design.md`
- Tasks: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/tasks.md`
- Spec delta: `openspec/changes/advance-browser-dock-trusted-observation-and-code-bridge/specs/browser-agent-page-understanding/spec.md`

## Scope

- Browser Observation v3 trust envelope.
- Explicit stale reason reconciliation.
- AI-visible browser context formatter/parser trust state.
- Browser Evidence view model.
- Browser User Annotation contract as structured text evidence.
- Minimum Evidence Inspector integration for Composer preview and sent/history browser context cards.
- Consistent available/stale/degraded/expired state across attachment surfaces.

## Out Of Scope

- Canonical capture script migration.
- Full workspace-aware code candidate scorer.
- Screenshot/OCR/vision execution.
- Annotated screenshot overlay, image binary payload, or multimodal region injection.
- External provider capture.
- Browser action execution.
- Click/type/select/submit automation.
- Annotation-guided browser action execution.

## BrowserUserAnnotation Boundary

Phase 3 做：

- 定义 annotation contract。
- 绑定 `BrowserObservation`。
- 记录 user note、viewport、scroll、`devicePixelRatio`、region coordinates。
- 记录 nearby text 和 nearest element metadata。
- 进入 Evidence Inspector 和 AI text payload。

Phase 3 不做：

- 不默认发送 annotated screenshot。
- 不默认发送 image overlay 或 multimodal region payload。
- 不让 AI 根据 annotation 自动 click/type/select/submit。
- 不承诺任意像素区域都能稳定映射到 DOM element。

## Requirements

- Keep `BrowserDock` focused on session/tab/renderer lifecycle.
- Keep `Composer` as wiring only.
- Put observation/evidence/code-bridge/action logic in focused Browser Agent modules.
- Preserve engine-agnostic browser context payloads.
- Do not expose raw DOM, cookies, headers, storage, scripts, styles, password values, token values, Authorization values, hidden input values, or page secrets.
- Do not add `screenshot_ocr` as an automatic fallback.
- Do not send annotated screenshots or image overlays by default.
- Do not treat code candidates as definitive ownership claims.
- User annotations must bind to BrowserObservation and inherit stale/degraded diagnostics.

## Recommended First OpenSpec Tasks

- [ ] 1.1 Define Browser Observation v3 trust envelope.
- [ ] 1.2 Replace boolean-only stale handling with explicit stale reasons.
- [ ] 1.3 Make capture degradation explainable.
- [ ] 1.4 Extend canonical AI payload without engine-specific forks.
- [ ] 3.1 Create sectioned evidence view model.
- [ ] 3.2 Replace single detail block in Composer.
- [ ] 3.3 Align composer, live, and history surfaces.
- [ ] 6.1 Define structured user annotation evidence.
- [ ] 6.2 Keep annotations honest when pages move.
- [ ] 6.3 Attach nearby evidence safely.
- [ ] 7.1 Preserve single AI payload path.
- [ ] 7.2 Keep UI state consistent.
- [ ] 8.1 Validate behavior artifacts.
- [ ] 8.2 Verify frontend behavior.
- [ ] 8.3 Verify backend behavior.

## Acceptance Criteria

- [ ] Browser context attachment exposes observation state and explicit stale reasons.
- [ ] Formatter/parser round-trips observation state without engine-specific forks.
- [ ] Composer preview and message Browser Context card render consistent evidence state.
- [ ] Degraded/stale/expired states show diagnostics rather than hiding limitations.
- [ ] Implementation passes strict OpenSpec validation.
- [ ] Focused frontend tests cover attachment/evidence surfaces.
- [ ] Focused Rust tests cover any backend DTO changes.

## Verification

```bash
openspec validate advance-browser-dock-trusted-observation-and-code-bridge --strict --no-interactive
npx vitest run src/features/browser-agent/utils/attachment.test.ts src/features/browser-agent/components/BrowserContextPreview.test.tsx src/features/browser-agent/components/BrowserContextSummaryCard.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml browser_agent
```

## Implementation Calibration - 2026-06-03

本 PRD 原始定位是 Browser Dock Phase 3 observation core first slice。根据当前工作区浏览器相关变更区，实际推进范围已经覆盖更完整的 trusted observation + evidence inspector + action audit + code bridge + detached dock window 链路。

### Calibrated Scope

- Browser Dock 已从主界面面板迁移到 detached renderer window。
- Tauri Browser Agent 已承接 toolbar bridge、capture bridge、safe action、snapshot refresh、session routing、toolbar i18n。
- Capture script 已抽成 frontend canonical source，Rust 侧 include，降低脚本双写漂移。
- Evidence、visual evidence、annotation、action audit、code bridge、task/thread context 都已有对应代码落点。
- 2026-06-03 晚间补丁包含多 tab toolbar action session targeting 修正，以及 toolbar i18n locale propagation。

### Current Completion Interpretation

该任务不再按“仅首片”理解；当前应视为实现已大范围落地，但验收仍依赖后续测试和手工矩阵确认。后续继续推进时，应优先验证现有实现，而不是继续盲目扩展能力。

### Next Acceptance Gate

- 先跑 Browser Agent 相关 vitest fixture/unit tests。
- 再跑 TypeScript typecheck。
- 最后做 detached window + 多 tab + locale + evidence/code bridge 手工验收。
