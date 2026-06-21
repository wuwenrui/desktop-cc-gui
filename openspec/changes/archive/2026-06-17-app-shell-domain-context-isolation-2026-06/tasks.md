# Tasks: AppShell Domain Context Isolation 2026-06

## 0. Baseline / Inventory (P0)

- [x] 0.1 [P0][depends:none][input:`src/app-shell.tsx` `defineAppShellDomainContexts` raw object][output:脚本或 test helper 输出每个 domain 的真实 top-level key count 和 key list][validation:inventory 能复现 workspaceNavigation/settings/composer/layout/fileEditor 大桶现状] Inventory raw context keys.
- [x] 0.2 [P0][depends:0.1][input:`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`][output:生成 raw keys vs owned keys 差异报告,列出 unowned / duplicate / stale owner keys][validation:差异报告进入 test fixture 或 snapshot] Compare owner map.

## 1. Owner Map Completeness Gate (P0)

- [x] 1.1 [P0][depends:0.2][input:`appShellDomainContexts.ts`][output:补全 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`,让每个 raw key exactly one owner;保持 domain ownership 语义,不要借机迁移字段][validation:`findOverlappingAppShellDomainKeys()` returns `[]`] Complete owner map.
- [x] 1.2 [P0][depends:1.1][input:`appShellDomainContexts.test.ts`][output:新增 raw context parser/fixture test,验证 raw keys 与 owner map 完全对齐;parser 无法识别的行必须 fail 并输出 line][validation:`npm exec vitest run src/app-shell-parts/appShellDomainContexts.test.ts` pass] Add completeness test.
- [x] 1.3 [P0][depends:1.2][input:新增 owner map test][output:新增 regression case:给 fixture 增加未登记 key 时 test fail(可用 inline fixture helper,不改 production source)][validation:测试覆盖 unowned key failure path] Prove gate catches drift.

## 2. Flatten Consumer Narrowing (P0)

- [x] 2.1 [P0][depends:1.2][input:`useAppShellLayoutNodesSection.tsx:92` 全量 flatten][output:新增 `LAYOUT_NODES_DOMAIN_NAMES` selected-domain list + `flattenLayoutNodesShellBoundary`;先按实际读取 domains 选择,不得全量 fallback][validation:typecheck pass;focused layout tests pass] Narrow layout nodes boundary.
- [x] 2.2 [P0][depends:2.1][input:`useAppShellSections.ts:57` 全量 flatten][output:新增 `APP_SHELL_SECTIONS_DOMAIN_NAMES` selected-domain list + `flattenAppShellSectionsBoundary`;按实际读取 domains 收窄][validation:typecheck pass;focused sections tests pass] Narrow sections boundary.
- [x] 2.3 [P0][depends:2.2][input:`renderAppShell.tsx:65` 全量 flatten][output:新增 `RENDER_APP_SHELL_DOMAIN_NAMES` selected-domain list + `flattenRenderAppShellBoundary`;runtime dock/layout/modal 所需字段保持行为不变][validation:typecheck pass;render/layout focused tests pass] Narrow render boundary.
- [x] 2.4 [P0][depends:2.3][input:`appShellDomainContexts.test.ts` production wiring tests][output:把 tests 从"必须使用 full flatten"改成"禁止关键 consumers 回退 full flatten";固定 selected-domain list][validation:tests fail if consumer reintroduces `flattenAppShellDomainContexts` full flatten] Lock selected boundaries.

## 3. Search / Composer Context Isolation (P1)

- [x] 3.1 [P1][depends:2.4][input:`useAppShellSearchAndComposerSection.ts` `COMPOSER_SEARCH_DOMAIN_NAMES`][output:`COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS` records search palette / composer send / git search open / kanban bridge selected fields][validation:字段清单进入 test fixture] Inventory search/composer reads.
- [x] 3.2 [P1][depends:3.1][input:`ComposerSearchShellBoundary`][output:改为 explicit selected-field boundary;移除 domain dependency input][validation:search palette open/close, selection reset, filter toggle, result opening tests pass] Narrow search/composer boundary.
- [x] 3.3 [P1][depends:3.2][input:focused tests][output:新增 `useAppShellSearchAndComposerSection.test.tsx`,覆盖 search/composer 关键行为和 callback stability][validation:targeted vitest pass] Add focused coverage.

## 4. Settings / Model Context Split (P1)

- [x] 4.1 [P1][depends:1.2][input:`settingsContext` raw fields][output:字段分组 implemented as `modelSelectionContext` / `collaborationModeContext`;ordinary settings UI remains in `settingsContext`][validation:分组没有 duplicate owner] Plan settings split.
- [x] 4.2 [P1][depends:4.1][input:`appShellDomainContexts.ts` + `app-shell.tsx`][output:新增 `modelSelectionContext`,迁移 effective model/reasoning 字段和 actual selected flatten consumers][validation:typecheck + domain focused tests pass] Split model selection context.
- [x] 4.3 [P1][depends:4.2][input:`settingsContext` remaining fields][output:新增 `collaborationModeContext`;保持 compatibility facade][validation:typecheck + domain focused tests pass] Split next settings subdomain.

## 5. Action Array Stability Audit (P1)

- [x] 5.1 [P1][depends:2.4][input:`rg "OpenAppMenuExtraAction|ResponsiveIconToolbarItem|onSelect: \\(\\) =>|items =|tabs =" src`][output:action array audit recorded in `design.md` 2026-06-17 note][validation:audit list committed to change notes or tests] Inventory action arrays.
- [x] 5.2 [P1][depends:5.1][input:topbar/header/menu action arrays][output:`MainHeaderActions` and `PanelTabs` hot path arrays use `useMemo`;deps cover real inputs][validation:focused tests cover stable reference under same deps for `MainHeaderActions`;PanelTabs behavior tests pass] Stabilize hot path arrays.
- [x] 5.3 [P1][depends:5.2][input:remaining lower-risk action arrays][output:lower-risk transient menus recorded as follow-up/no-op in `design.md`, avoiding broad churn][validation:targeted vitest pass] Stabilize remaining necessary arrays.

## 10. Final Validation

- [x] 10.1 [P0][depends:2.4][input:OpenSpec artifacts][output:`openspec validate app-shell-domain-context-isolation-2026-06 --strict --no-interactive` pass][validation:exit 0] Validate OpenSpec.
- [x] 10.2 [P0][depends:2.4][input:TypeScript][output:`npm run typecheck` pass][validation:exit 0] Typecheck.
- [x] 10.3 [P0][depends:2.4][input:lint][output:`npm run lint` pass][validation:exit 0] Lint.
- [x] 10.4 [P0][depends:2.4][input:large file guard][output:`npm run check:large-files` exit 0;`npm run check:large-files:gate` exit 0 with `found=0`;the previous `src/features/threads/hooks/useThreadEventHandlers.ts` 2831-line blocker was resolved by extracting `threadReconciliationStatusQuery.ts`, leaving the source file at 2799 lines][validation:exit 0] Large-file guard.
- [x] 10.5 [P0][depends:2.4][input:focused tests][output:`npm exec vitest run src/app-shell-parts/appShellDomainContexts.test.ts` plus touched section tests pass][validation:exit 0] Focused tests.
- [x] 10.6 [P1][depends:3.3,4.3,5.3][input:P1 touched surfaces][output:`npm exec vitest run src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx src/app-shell-parts/appShellDomainContexts.test.ts src/app-shell-parts/useAppShellSearchAndComposerSection.test.tsx src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx src/features/app/components/MainHeaderActions.test.tsx src/features/app/components/MainHeader.branch-reveal.test.tsx src/features/app/components/MainHeader.workspace-switch-regression.test.tsx src/features/app/components/MainHeader.topbar-session-tabs.test.tsx src/features/layout/components/PanelTabs.test.tsx` pass][validation:exit 0] P1 focused tests.

## 11. Follow-up

- [ ] 11.1 [P2] 进一步把 selected-domain boundary 收敛为 selected-field boundary。
- [ ] 11.2 [P2] 将 `adaptAppShellLegacyFlatContext` 使用点逐步替换为 explicit typed props。
- [ ] 11.3 [P2] 按 feature slice 抽小 `useAppShellLayoutNodesSection`。
