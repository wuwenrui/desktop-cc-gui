# Proposal: AppShell Domain Context Isolation 2026-06

## Why

`topbar-runtime-state-stability-2026-06` 修的是一条已确认的 P0 hot path:

```text
runtime output -> runtimeRunState -> fileEditorContext -> topbar / right panel toolbar re-render
```

但代码事实显示,AppShell 仍存在更大的结构性传播风险:多个 domain context 是"大桶",下游 section 通过 `flattenAppShellDomainContexts` / `flattenSelectedAppShellDomainContexts` 获得过宽输入,owner key 表也没有覆盖真实 raw context 字段。只要另一个高频或 unstable field 被塞进这些大桶,类似污染链会换一个 UI 区域复发。

### Code Facts

- `src/app-shell.tsx` 的 `rawAppShellDomainContexts` 当前仍是大对象聚合。粗略字段量:
  - `workspaceNavigationContext`:约 204 个字段,实际混有 workspace、git、diff、debug、prompt、dictation、engine、release notes、global search 等状态和 actions。
  - `settingsContext`:约 153 个字段,混有 settings、model、collaboration、loading、effective state。
  - `composerContext`:约 127 个字段,混有 composer draft/image/input/action 与大量 workflow handlers。
  - `layoutContext`:约 106 个字段,混有 layout state、panel state、terminal state 与 handlers。
  - `fileEditorContext`:约 48 个字段,且当前 topbar change 已证明它能被 runtime state 污染。
- `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`(`src/app-shell-parts/appShellDomainContexts.ts:30-100`)只登记代表字段,不是完整 owner map。例如 `workspaceNavigationContext` owner keys 只列出 workspace/navigation 代表字段,远少于真实 context 字段。
- `useAppShellLayoutNodesSection`(`src/app-shell-parts/useAppShellLayoutNodesSection.tsx:92`)通过 `flattenAppShellDomainContexts(input.appShellDomainContexts)` flatten 全部 domain。
- `useAppShellSections`(`src/app-shell-parts/useAppShellSections.ts:57`)通过 `flattenAppShellDomainContexts(input.appShellDomainContexts)` flatten 全部 domain。
- `renderAppShell`(`src/app-shell-parts/renderAppShell.tsx:65`)通过 `flattenAppShellDomainContexts(ctx.appShellDomainContexts)` flatten 全部 domain。
- `useAppShellSearchAndComposerSection`(`src/app-shell-parts/useAppShellSearchAndComposerSection.ts:53-59`)选择 5 个 domain(`workspaceNavigationContext` / `composerContext` / `layoutContext` / `fileEditorContext` / `settingsContext`),但实际 boundary 只读取其中一部分字段。
- 当前 main spec `app-shell-exhaustive-deps-stability` 已要求 dependency remediation 不得演变成结构漂移;本 change 把该原则落到 domain context ownership 和 flatten boundary。

## What Changes

### P0. Owner Map Completeness Gate

把 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 从"代表字段清单"升级为"真实 owner contract":

- 每个 `rawAppShellDomainContexts.<domain>` 的 top-level key MUST 在 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domain]` 中登记。
- 新增测试扫描 `src/app-shell.tsx` 的 `defineAppShellDomainContexts({ ... })` raw object,提取 top-level keys,与 owner map 对齐。
- `findOverlappingAppShellDomainKeys()` 继续检查跨 domain 重复 owner。
- 允许临时 legacy bucket,但必须显式命名并带 follow-up,不能靠未登记字段逃逸治理。

### P0. Flatten Consumer Narrowing

把全量 flatten consumer 改为 selected-domain / selected-field boundary:

- `useAppShellLayoutNodesSection` 不再默认 flatten 全部 domain;先收窄为它实际需要的 domains,再逐步按 subsection 提取 selected field boundary。
- `useAppShellSections` 不再默认 flatten 全部 domain;按 workspace transition、file operations、settings actions、home/kanban navigation 分组收窄。
- `renderAppShell` 保留 legacy adapter 的兼容能力,但 runtime dock、desktop layout、modal/prompt surfaces SHOULD 逐步改为 explicit props 或 selected boundary。

### P1. Search / Composer Context Isolation

收窄 `useAppShellSearchAndComposerSection`:

- 移除未使用或可局部传入的 domain dependency。
- 把 search palette、composer send、git PR/diff interaction、kanban jump 等分成更小 boundary。
- 避免 settings/model/file editor 无关变化触发 search/composer callbacks 和 derived values 重建。

### P1. Settings / Model Context Split

把 `settingsContext` 拆成更小稳定域:

- `settingsUiContext`:settings panel loading/open/error 等 UI state。
- `modelSelectionContext`:effective models、selected model、reasoning support/options。
- `collaborationModeContext`:collaboration modes 和 selected mode。

这避免模型刷新、settings loading 或 collaboration mode 更新污染不关心这些字段的 layout/composer sections。

### P1. Action Array Stability Audit

系统审计 toolbar/menu/action arrays:

- `OpenAppMenuExtraAction[]`
- panel toolbar items
- search result actions
- header/topbar/menu items

任何传给 memoized component 或 hot path component 的数组/对象 MUST 由 `useMemo` 或 module-level constant 稳定,并用 focused tests 覆盖"相同 deps 返回同一引用 / 真实 deps 变化返回新引用"。

## Out of Scope

- 不改变用户可见功能、文案、i18n key 或交互语义。
- 不重写 AppShell 为全新架构。
- 不和 `topbar-runtime-state-stability-2026-06` 重复修 runtime/topbar hot path。
- 不做 RuntimeLogPanel 虚拟化或 runtime state atom 拆分。

## Risk

- P0 owner map completeness 会暴露大量未登记字段,初次 patch 可能较大。缓解方式:先生成完整 owner map,再做 semantic review,不同时迁移字段归属。
- flatten narrowing 容易漏字段。缓解方式:每个 consumer 先加 snapshot/contract test,再拆 selected boundary。
- settings/model split 可能触发 broad type churn。缓解方式:P1 执行,且每次只拆一个 context。

## Validation

```bash
openspec validate app-shell-domain-context-isolation-2026-06 --strict --no-interactive
npm run typecheck
npm run lint
npm run check:large-files
npm exec vitest run \
  src/app-shell-parts/appShellDomainContexts.test.ts \
  src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx \
  src/app-shell-parts/useAppShellSearchAndComposerSection.test.tsx \
  src/features/app/components/MainHeaderActions.test.tsx
```

> Note:部分 focused tests 可能需要本 change 新增;不存在的测试文件必须在 tasks 中明确标注为新增。

## Rollback

- P0 owner map completeness 是测试与 metadata contract,可单独 revert。
- flatten narrowing 必须按 consumer 分批提交,每批保留原 adapter 的 compatibility path。
- P1 splits 必须保留旧 boundary 到新 boundary 的 facade,不得要求一次性迁移所有 caller。
