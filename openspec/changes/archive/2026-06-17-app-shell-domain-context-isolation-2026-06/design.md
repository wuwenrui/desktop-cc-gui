# Design: AppShell Domain Context Isolation 2026-06

## Architecture Overview

本 change 是 `topbar-runtime-state-stability-2026-06` 的 Phase 2。Phase 1 只切 runtime/topbar hot path;本 change 处理 AppShell domain context 的系统性传播风险。

核心策略:

1. **先建 owner contract,再拆结构**:先让 owner map 覆盖真实 raw context 字段,否则任何拆分都会继续漂移。
2. **先收窄 flatten consumer,再拆 domain**:全量 flatten 是传播放大器;先让关键 consumer 不再读全量。
3. **P0 只做治理和最大传播面收敛**:owner map completeness + layout/sections/render flatten narrowing。
4. **P1 再做局部 domain split**:search/composer、settings/model、action arrays。

## P0 Design

### 1. Owner Map Completeness

**Files**:

- `src/app-shell-parts/appShellDomainContexts.ts`
- `src/app-shell-parts/appShellDomainContexts.test.ts`
- `src/app-shell.tsx`

**Implementation shape**:

- 新增 test helper 读取 `src/app-shell.tsx`,定位 `defineAppShellDomainContexts({ ... })`,提取每个 domain object 的 top-level shorthand keys 和 explicit keys。
- 比较提取结果和 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domain]`。
- 如果 parser 无法可靠处理复杂表达式,先约束为当前 raw object 的 top-level property pattern,并把无法解析的行列为 explicit review failures。
- owner keys 排序使用 lexical order 或当前 domain source order,但同一策略必须固定。

**Contract**:

- 每个 raw context key exactly one owner。
- `findOverlappingAppShellDomainKeys()` MUST return empty。
- 新增 raw key 未登记时 test MUST fail。

### 2. Flatten Consumer Narrowing

**Files**:

- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- `src/app-shell-parts/useAppShellSections.ts`
- `src/app-shell-parts/renderAppShell.tsx`
- `src/app-shell-parts/appShellDomainContexts.ts`

**Implementation shape**:

- 为每个 consumer 新增 selected-domain flatten helper:
  - `flattenLayoutNodesShellBoundary`
  - `flattenAppShellSectionsBoundary`
  - `flattenRenderAppShellBoundary`
- 第一阶段允许 selected domains,不要求一次变成 selected fields。
- 第二阶段在 hot subsection 上引入 explicit selected fields,例如 topbar/right panel/runtime dock。

**Contract**:

- consumer 不得因为 unrelated domain 引用变化而重建它不依赖的 memoized values。
- selected-domain list 必须在测试中固定,避免未来重新退回全量 flatten。

### 3. Compatibility Facade

保留 `adaptAppShellLegacyFlatContext<T>()` 作为迁移 facade,但每个使用点必须声明:

- 输入 domain list
- 输出 boundary type
- 为什么还需要 flat compatibility

这符合 `core-complexity-governance` 的 facade-first migration 原则。

## P1 Design

### 4. Search / Composer Context Isolation

**Files**:

- `src/app-shell-parts/useAppShellSearchAndComposerSection.ts`
- related focused tests(若不存在则新增)

**Implementation shape**:

- 把 `COMPOSER_SEARCH_DOMAIN_NAMES` 从 5 个大 domain 收窄。
- 将 `ComposerSearchShellBoundary` 拆成:
  - `SearchPaletteBoundary`
  - `ComposerSendBoundary`
  - `GitSearchOpenBoundary`
  - `KanbanComposerBridgeBoundary`
- 每个 helper 只接收所需 selected fields。

### 5. Settings / Model Context Split

**Files**:

- `src/app-shell.tsx`
- `src/app-shell-parts/appShellDomainContexts.ts`
- settings/model/composer section consumers

**Implementation shape**:

- 从 `settingsContext` 拆出:
  - `settingsUiContext`
  - `modelSelectionContext`
  - `collaborationModeContext`
- 每拆一个 context,先登记 owner keys,再迁移 consumers。

### 6. Action Array Stability Audit

**Files**:

- `src/features/app/components/MainHeaderActions.tsx`
- toolbar/menu/search/action component hooks discovered by `rg "Action\\[\\]|items =|map\\(.*onSelect"`

**Implementation shape**:

- 对 hot path action arrays 增加 `useMemo`。
- 对 module-constant tabs/items 保持 module-level constant。
- 对 inline closures 使用 memoized array deps 覆盖真实 callbacks。

**2026-06-17 audit note**:

- `MainHeaderActions.tsx`: hot topbar `OpenAppMenuExtraAction[]`; stabilized with `useMemo` and focused reference tests.
- `PanelTabs.tsx`: right-panel `ResponsiveIconToolbarItem[]`; stabilized with `useMemo` inside memoized `PanelTabs`.
- `useLayoutTopbarSessionTabs.tsx`: session tab item callbacks are produced by existing topbar session tab builder path; left as lower-risk follow-up because current focused tests cover behavior and this change does not alter session tab data flow.
- Sidebar/git/file tree context menus create transient menu items only when menus open; not part of the always-visible topbar/right-panel hot path, so no P1 code change.

## Failure Modes

- **F1 parser false confidence**:owner map completeness parser 漏掉 computed property。Mitigation:测试必须列出 skipped/unparsed source lines,不得 silent pass。
- **F2 selected boundary 漏字段**:TypeScript 可能因为 `Record<string, any>` facade 放过。Mitigation:新增 explicit boundary types,减少 `Record<string, unknown>` passthrough。
- **F3 over-splitting**:一次拆太多 contexts 导致 type churn。Mitigation:P0 不拆 settings/model;P1 每次只拆一个 domain。
- **F4 behavior drift**:context narrowing 误删行为依赖。Mitigation:每个 consumer batch 跑 focused interaction tests。

## Validation Matrix

| Phase | Gate | Evidence |
|---|---|---|
| P0 owner map | `appShellDomainContexts.test.ts` | raw keys all owned; no overlap |
| P0 flatten narrowing | focused section tests + typecheck | selected-domain lists fixed; no full flatten regression |
| P1 search/composer | focused search/composer tests | search open/close/select/send unchanged |
| P1 settings/model | typecheck + settings/model tests | model selection/settings behavior unchanged |
| P1 action arrays | action hook/component tests | stable reference under same deps |

## Rollback Strategy

- Owner map completeness can revert independently.
- Each flatten consumer narrowing must be one bounded batch with old facade still present.
- P1 context splits must leave compatibility bridge until all consumers migrate.
