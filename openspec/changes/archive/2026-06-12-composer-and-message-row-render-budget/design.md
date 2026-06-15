# Design / 设计

## Context / 背景

本 change 保护同一条 renderer hot path 的两个端点：Composer 输入和 MessageRows live rendering。目标不是重写 Composer 或消息渲染，而是在当前 React 19 + existing perf baseline substrate 上收窄高频更新传播范围，并把 evidence 接入 `runtime-performance-evidence-gates`。

当前事实：

- `ChatInputBox` 已有 IME composition、controlled value sync、undo/redo、history completion 等局部 hooks。
- `scripts/perf-composer-baseline.ts` 已有 `S-CI-50` / `S-CI-100-IME` proxy baseline。
- `MessagesRows.tsx` 是多 subtype 聚合点，贸然全量拆分会扩大回归面。
- `rendererDiagnostics` 已存在，可承载 content-safe render budget evidence。

## Architecture / 架构

```text
Composer local boundary
  -> draft value source of truth
  -> IME composition guard
  -> background input history hydration
  -> diagnostics aggregate

MessagesTimeline / MessagesRows
  -> stable timeline projection inputs
  -> row identity: id + version + sourceVersion
  -> subtype memo boundary only where evidence shows churn
  -> render-count diagnostics aggregate

runtime-performance-evidence-gates
  -> composer budget fields
  -> message-row budget fields
  -> evidenceClass: measured | proxy | manual-only | unsupported
```

## Decisions / 关键决策

### Decision 1: Composer draft value stays inside Composer-local boundary

Composer draft value MUST NOT subscribe to shell-level streaming/radar/session activity tick unless the event directly mutates draft state. Global shell state can change surrounding UI, but the textarea value path must stay locally owned.

Rejected alternative: moving draft state into app-shell/global store. It makes cross-surface coordination easier but increases high-frequency invalidation risk.

### Decision 2: Reuse existing ChatInputBox IME hooks

IME protection should build on `useIMEComposition`、`useControlledValueSync` and `imeCompatibility` utilities. This avoids introducing a second competing composition model.

The design target is event-order safety and stale overwrite prevention, not browser-specific IME internals that jsdom cannot fully measure.

### Decision 3: Input history hydrates after first render

Input history is useful for suggestions, but it is not a prerequisite for accepting the first keystroke. Hydration should run after first render and carry a thread/request token so stale results are ignored.

### Decision 4: MessageRows optimization is evidence-driven

Do not split every row subtype up front. First add render-count instrumentation, then stabilize props and memoize derived data for the subtype paths that actually rerender during live delta fixtures.

Row identity contract:

| Field | Purpose |
|---|---|
| `id` | stable row identity |
| `version` | visible content/action state version |
| `sourceVersion` | derived projection/cache invalidation key |
| subtype id | render attribution and diagnostics |

### Decision 5: Proxy evidence stays proxy

`perf:composer:baseline` and jsdom render fixtures are valuable regression guards, but they are not release-grade runtime proof. Gate reports must preserve `proxy` until browser/WebView/runtime evidence exists.

## Diagnostics Contract / 诊断合同

Composer evidence SHOULD include:

- scenario id or runtime surface id;
- `keystrokeToCommitP95` where available;
- `compositionToCommit` where available;
- `inputEventLossCount`;
- render count for input-facing subtree;
- evidence class and sample window.

Message row evidence SHOULD include:

- workspace/thread id;
- live row render count;
- history row render count;
- affected subtype ids;
- sample window and evidence class.

Diagnostics MUST NOT include prompt text, assistant body text, tool output, file content, or raw command output.

## Rollout Plan / 实施顺序

1. Add diagnostics in dev/test path and collect before-change anchor.
2. Isolate Composer draft subscriptions and protect IME overwrite path.
3. Move input history hydration behind first render with stale guard.
4. Stabilize `MessagesRows` props and sourceVersion memo points.
5. Add selected subtype memo boundaries based on evidence.
6. Extend runtime evidence gate budget fields.

## Validation Matrix / 验证矩阵

| Area | Evidence |
|---|---|
| Composer input proxy | `npm run perf:composer:baseline` |
| Realtime boundary | `npm run perf:realtime:boundary-guard` |
| IME regression | focused Vitest for composition + streaming interference |
| History hydration | focused stale-drop tests |
| MessageRows render budget | streaming fixture render-count test |
| Evidence gate | `npm run check:runtime-evidence-gates` |
| Type/lint | `npm run typecheck`, `npm run lint` |
| OpenSpec | `openspec validate composer-and-message-row-render-budget --strict --no-interactive` |

## Rollback / 回滚

- Composer isolation can be rolled back independently by restoring previous subscription path.
- Input history background hydration can be reverted to synchronous hydration if stale guard causes regressions.
- Message row memo boundaries should be small enough to revert per subtype without changing conversation semantics.
- Diagnostics additions can stay if content-safe and bounded; otherwise disable via dev/test flag.

## Risks / 风险

- Memoization can hide legitimate row updates if `sourceVersion` is incomplete.
- IME behavior differs across WebView/platforms; jsdom evidence must not be overclaimed.
- Diagnostics can become noisy if recorded per token; aggregate by window instead.
