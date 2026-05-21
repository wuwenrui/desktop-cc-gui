# Journal - chenxiangning (Part 15)

> Continuation from `journal-14.md` (archived at ~2000 lines)
> Started: 2026-05-20

---



## Session 521: Fix Codex deferred completion after assistant ingress

**Date**: 2026-05-20
**Task**: Fix Codex deferred completion after assistant ingress
**Branch**: `feature/v0.5.0-md`

### Summary

修复 Codex 长会话尾部 assistant 输出已可见但 processing spinner 不结束的问题。

### Main Changes

- Root cause: Codex `turn/completed` could be deferred behind stale `collabAgentToolCall` / `wait_agent` blockers, and if final assistant completion evidence never arrived, the parent thread stayed `isProcessing=true`.
- Change: `useThreadEventHandlers` now bypasses Codex deferred completion when parent `turn/completed` arrives after assistant stream ingress (`firstDeltaAt` or `deltaCount`), while preserving no-output child blocker deferral.
- Diagnostics: bypass still emits `turn-completed-deferred-bypassed` with `remainingBlockers`, `deltaCount`, and `firstDeltaAtMs`.
- Tests: added hook regression for assistant delta + stale child blocker + `turn/completed` clearing processing.
- Validation passed: targeted Vitest, typecheck, lint, OpenSpec strict validate. Full `npm run test` was attempted and stopped in unrelated settings session catalog tests already affected by current workspace WIP.


### Git Commits

| Hash | Message |
|------|---------|
| `1b75eb0b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 522: 收口项目会话管理幕布

**Date**: 2026-05-20
**Task**: 收口项目会话管理幕布
**Branch**: `feature/v0.5.0-md`

### Summary

收口 Settings 项目会话管理：完成 OpenSpec 校准、磁盘事实源 catalog、folder tree、row progressive details、只读 session curtain 与 Codex 渐进历史加载。

### Main Changes

| Area | Description |
|------|-------------|
| OpenSpec | 校准 `refactor-workspace-session-management` proposal/design/spec/tasks：会话幕布定位为只读查看器，Codex history 采用 local/resume 双源渐进加载，并记录 10s hard timeout 行为。 |
| Backend | 补齐 session catalog 的磁盘存在性、missing-on-disk 清理、folder count/filter、批量 folder assignment 与 owner-aware mutation contract。 |
| Frontend | Settings 会话管理改为左侧 project/worktree/folder 树 + 右侧 session catalog；默认 row 聚焦标题和日期，低频信息进入详情 icon；相邻 icon 打开只读会话幕布。 |
| Verification | 通过 TypeScript、目标 ESLint、目标 Vitest、OpenSpec strict、large-file check 和 cached diff whitespace gate。 |


### Git Commits

| Hash | Message |
|------|---------|
| `1f3fe6df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 523: 标记会话管理提交收口

**Date**: 2026-05-20
**Task**: 标记会话管理提交收口
**Branch**: `feature/v0.5.0-md`

### Summary

标记 `refactor-workspace-session-management` closeout checklist 已提交，确保 OpenSpec tasks 与实际提交状态一致。

### Main Changes

| Area | Description |
|------|-------------|
| OpenSpec | 将 `refactor-workspace-session-management/tasks.md` 的 closeout commit checklist 标记为完成，确保任务文档和实际提交状态一致。 |
| Verification | `openspec validate refactor-workspace-session-management --strict --no-interactive` 通过；`git diff --check` 针对该 tasks 变更通过。 |


### Git Commits

| Hash | Message |
|------|---------|
| `80ee6532` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 524: 收口 harness advisory governance

**Date**: 2026-05-20
**Task**: 收口 harness advisory governance
**Branch**: `feature/v0.5.0-md`

### Summary

重新核对并提交 harness advisory governance 收口：补齐 advisory-only policy ceiling、checkpoint section projection、evidence trail provenance、policy audit enforcement metadata 与 conformance checks；同步主 specs，归档 soften-harness-governance-to-advisory-mode，并验证 typecheck、focused vitest、governance checks、OpenSpec strict。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9b6c4b09` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 525: 修复会话管理 heavy gate 遗留问题

**Date**: 2026-05-20
**Task**: 修复会话管理 heavy gate 遗留问题
**Branch**: `feature/v0.5.0-md`

### Summary

稳定会话目录 hook 依赖，补齐拆分后的类型/i18n/测试契约，并通过 heavy-test-noise、typecheck、lint 与 OpenSpec 校验。

### Main Changes

## 完成内容

- 修复 `useWorkspaceSessionCatalog` 因 filters 对象引用变化导致的重复 reload / heavy timeout。
- 补齐 Session Management 拆分后的 helper/type export/import，使 settings 相关测试恢复通过。
- 修正 i18n split 文件尾部语法问题，并更新 query contract 测试预期中的 `folderId: null`。
- 新增并归档 Trellis task：`05-20-fix-workspace-session-catalog-heavy-test-timeout`。

## 验证

- `npx vitest run src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx --reporter verbose`
- `npx vitest run src/features/settings/components/settings-view/sections/SessionManagementSection.test.tsx --reporter verbose`
- `npx vitest run src/features/settings/components/SettingsView.test.tsx -t "SettingsView Session management" --reporter verbose`
- `npm run typecheck`
- `npm run lint`
- `npm run check:heavy-test-noise`
- `openspec validate refactor-workspace-session-management --strict --no-interactive`

## 结果

- `.artifacts/heavy-test-noise.json`: `status=pass`, `exitCode=0`, `breachCount=0`。
- 仅剩 npm 环境警告 `Unknown user config "electron_mirror"`，不属于 test noise breach。


### Git Commits

| Hash | Message |
|------|---------|
| `a59ceac2` | (see git log) |
| `ae19ab3d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 526: 修复会话管理边界条件

**Date**: 2026-05-20
**Task**: 修复会话管理边界条件
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

本次完成代码 review 后的修复提交。

| 项目 | 内容 |
|------|------|
| Code commit | `50574fac fix(settings): 修复会话窗超时与文件夹统计边界` |
| 修复 1 | Codex session curtain 超时后，迟到的空数据源不会错误清掉 timeout notice；迟到的有效消息仍可替换 timeout notice。 |
| 修复 2 | session folder 继承与统计改为 workspace-scoped key，避免不同 workspace 复用相同 sessionId 时串桶。 |
| 修复 3 | workspace/folder 排序使用 deterministic collator，降低 macOS/Windows locale 差异导致的顺序漂移。 |
| 修复 4 | 关闭、重载、重新打开 curtain 时清理旧 timer，避免 stale timeout 写回。 |

**Updated Files**:
- `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx`
- `src/features/settings/components/settings-view/sections/SessionManagementSection.test.tsx`
- `src/features/settings/components/settings-view/sections/sessionManagementSectionUtils.ts`
- `src/features/settings/components/settings-view/sections/sessionManagementSectionUtils.test.ts`

**Validation**:
- `npx vitest run src/features/settings/components/settings-view/sections/SessionManagementSection.test.tsx src/features/settings/components/settings-view/sections/sessionManagementSectionUtils.test.ts src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files`
- `npm run check:large-files:near-threshold`
- `npm run check:large-files:gate`
- `node --test scripts/check-large-files.test.mjs`
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `npm run check:heavy-test-noise`
- `openspec validate refactor-workspace-session-management --strict --no-interactive`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `50574fac` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 527: Git 文件单击打开编辑器

**Date**: 2026-05-20
**Task**: Git 文件单击打开编辑器
**Branch**: `feature/v0.5.0-md`

### Summary

调整 Git diff 面板文件行普通单击行为，改为打开文件编辑器；保留显式 diff 预览入口并补充回归测试。

### Main Changes

- 将 `GitDiffPanel` 普通文件行 click 从 diff selection 改为优先调用现有 `onOpenFile(path)`，进入 editor 文件视图。
- 保留 `onSelectFile` 作为 fallback，并继续服务 Enter 键和显式 inline diff preview 按钮，避免误伤现有 diff 入口。
- 在 `useLayoutNodes` 中把现有 `options.onOpenFile` 传入 Git 面板。
- 增加 `GitDiffPanel` 回归测试，断言普通 row click 调用 `onOpenFile` 且不触发 `onSelectFile`。

验证：
- `npm run typecheck`
- `npx vitest run src/features/git/components/GitDiffPanel.test.tsx --maxWorkers 1 --minWorkers 1`
- `git diff --check -- src/features/git/components/GitDiffPanelTypes.ts src/features/git/components/GitDiffPanel.tsx src/features/layout/hooks/useLayoutNodes.tsx src/features/git/components/GitDiffPanel.test.tsx`
- `npx eslint src/features/git/components/GitDiffPanelTypes.ts src/features/git/components/GitDiffPanel.tsx src/features/layout/hooks/useLayoutNodes.tsx src/features/git/components/GitDiffPanel.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `3ce64477` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 528: 切换同工作区会话保留编辑器

**Date**: 2026-05-20
**Task**: 切换同工作区会话保留编辑器
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 问题 | 桌面 editor split 中切换同 workspace session 时，`exitDiffView()` 会把 `centerMode` 强制切回 `chat`，导致右侧已打开文件被隐藏，体验像文件被关闭。 |
| 修复 | 抽出 `shouldPreserveEditorOnThreadSelect` 和 `getThreadSelectDiffCleanupAction`，在同 workspace、非 compact、当前 editor split 且存在 active file 时，只清理 selected diff，不调用会切 chat 的 `exitDiffView()`。 |
| 边界 | 跨 workspace、compact、非 editor split、无 active file 时保持原有回 chat / exit diff 行为。 |
| 验证 | `npm run lint`、`npm run typecheck`、目标 Vitest、目标 ESLint、`git diff --check` 均通过。 |

**Updated Files**:
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- `src/app-shell-parts/threadEditorPreservation.ts`
- `src/app-shell-parts/useAppShellLayoutNodesSection.test.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `e4479078` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 529: 记录会话切换保留编辑器契约

**Date**: 2026-05-20
**Task**: 记录会话切换保留编辑器契约
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 问题 | 已修复的 topbar session switch editor split 行为需要沉淀到 OpenSpec，避免未来重构把交互重新退回“切 session 隐藏已打开文件”。 |
| 记录 | 新增 `preserve-editor-on-topbar-session-switch` OpenSpec change，proposal 说明问题根因与边界，spec delta 修改 `workspace-topbar-session-tabs`，要求同 workspace topbar session switch 保留 desktop editor split。 |
| 边界 | compact / phone / tablet、非 editor split、无 active file、跨 workspace 切换继续保持保守 fallback，避免旧 workspace 文件错误绑定到新 workspace。 |
| 验证 | `openspec validate preserve-editor-on-topbar-session-switch --strict --no-interactive` 通过；`git diff --check` 通过。 |

**Updated Files**:
- `openspec/changes/preserve-editor-on-topbar-session-switch/proposal.md`
- `openspec/changes/preserve-editor-on-topbar-session-switch/specs/workspace-topbar-session-tabs/spec.md`
- `openspec/changes/preserve-editor-on-topbar-session-switch/tasks.md`
- `openspec/changes/preserve-editor-on-topbar-session-switch/.openspec.yaml`


### Git Commits

| Hash | Message |
|------|---------|
| `bc5ff2fd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 530: 动态治理证据与成本预算收口

**Date**: 2026-05-20
**Task**: 动态治理证据与成本预算收口
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

## 本次完成

- 实现 `dynamic-project-governance-evidence` OpenSpec 变更：项目治理证据从固定 mossx/harness 清单改为 profile-aware adapter 收集。
- StatusPanel 治理证据改为 action-oriented 分组；Checkpoint 主视图移除不可读 raw evidence trail，保留 advisory/audit 诊断链路。
- Cost/Budget 补全 token-only 降级、pricing freshness、本地成本历史、月预算配置、预算 UI 与 settings 入口。
- 补充 conformance script，防止 bridge-fed governance policy 重新贡献 blocking 或绕过 profile adapter。

## Review / 边界修复

- localStorage 访问增加 try/catch，兼容受限浏览器或 storage 被禁用场景。
- 成本历史缓存恢复增加字段级 sanitize，丢弃 malformed persisted entries，避免脏缓存污染预算聚合。
- 月预算 warn/exceeded ratio 保持单调，避免坏持久化值导致阈值倒挂。
- malformed `package.json` 在 profile-aware 收集路径也会显式产生 degraded evidence，不再静默消失。
- Cost UI 的 aria-label 改走 i18n，避免用户可访问文本硬编码英文。

## 验证

- `npm run test`：519 test files completed。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run check:governance-evidence-bridge`：通过。
- `npm run check:large-files`：found=0。
- `openspec validate dynamic-project-governance-evidence --strict --no-interactive`：通过。
- `git diff --cached --check`：通过。

## 未纳入本次提交

- 工作区仍有无关 desktop split layout 变更未提交：`src/features/layout/components/DesktopLayout*`、`src/styles/main.css`、`openspec/changes/desktop-editor-split-left-composer/`。


### Git Commits

| Hash | Message |
|------|---------|
| `0b83493d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 531: 保持桌面编辑器分栏对话体验

**Date**: 2026-05-20
**Task**: 保持桌面编辑器分栏对话体验
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes



### Git Commits

| Hash | Message |
|------|---------|
| `47878ca0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 532: 统一 StatusPanel 证据与成本字号

**Date**: 2026-05-20
**Task**: 统一 StatusPanel 证据与成本字号
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

## 目标
统一 StatusPanel 中治理证据与成本预算视图的字号，消除同一卡片内标题、正文、chip、badge 参差不齐的问题，并沉淀防回归规范。

## 主要改动
- 在 `src/styles/status-panel.css` 为 `.sp-governance-evidence` 与 `.sp-cost-budget` 定义 scoped typography 变量。
- 将 governance evidence 与 cost budget 区域的 label/copy/meta 字号统一为同一局部尺度。
- 在 `.trellis/spec/frontend/component-guidelines.md` 新增 StatusPanel Evidence / Cost Dense Typography 场景，约束局部字号 ownership 与防回归审查点。

## 验证
- `npm run check:large-files` 通过。
- 同回合曾执行 `npm run lint` 通过；最终改动为 CSS 数值与文档补充。

## 影响范围
- 仅影响 StatusPanel 治理证据与成本预算区域的视觉字号。
- 未改动组件逻辑、runtime contract、service bridge 或数据模型。


### Git Commits

| Hash | Message |
|------|---------|
| `7ffc4d2d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 533: 收紧 Codex 后台终止漂移恢复边界

**Date**: 2026-05-20
**Task**: 收紧 Codex 后台终止漂移恢复边界
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 修复目标 | 修复多会话/后台 Codex 会话中，已输出 final answer 但线程偶发停留在“正在生成响应...”的终止态漂移问题。 |
| 核心改动 | 增加 assistant-completed 与 activation-terminal-drift 两条 bounded reconcile 路径，并在可证明终止时执行 Codex-only terminal settlement。 |
| 边界加固 | 终止证据必须属于当前 processing window；旧 assistant final 不能结束后续 turn；shared/non-Codex 不进入 Codex quarantine；未知 tool status 继续视为活跃工作。 |
| OpenSpec | 新增 `fix-codex-background-turn-terminal-reconciliation` change，补充 realtime canvas idempotency 与 stalled recovery contract。 |
| 验证 | `git diff --check`、`openspec validate fix-codex-background-turn-terminal-reconciliation --strict --no-interactive`、`pnpm typecheck`、`pnpm lint`、相关 5 个 vitest 文件 68 个用例全部通过。 |
| 留存状态 | 工作区仍保留一处非本次改动：`src/styles/status-panel-theme.test.ts`。 |


### Git Commits

| Hash | Message |
|------|---------|
| `3e258333` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 534: 修复同工作区会话切换保留编辑器

**Date**: 2026-05-20
**Task**: 修复同工作区会话切换保留编辑器
**Branch**: `feature/v0.5.0-md`

### Summary

扩展同 workspace session navigation 的 editor-preservation policy：notification/status、search、latest/sidebar-style selection 与 keyboard cycle 切换时不再触发 full diff exit 或折叠面板导致编辑器闪回 chat；补充 OpenSpec follow-up 与 Vitest 回归。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2a2af6e1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 535: 根治 Markdown 文件预览渲染抖动

**Date**: 2026-05-21
**Task**: 根治 Markdown 文件预览渲染抖动
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 背景 | 根据本地录屏确认 Markdown preview 在表格与 Mermaid 图之间反复闪烁，根因是 live 内容刷新、全文 ReactMarkdown 渲染、AI 标注全量扫描、Mermaid/KaTeX 重型渲染互相放大。 |
| OpenSpec | 新增 `stabilize-file-markdown-preview-render-architecture` change，覆盖 preview snapshot、render pipeline、runtime stability 三类约束。 |
| 实现 | 引入 `compileFileMarkdownDocument` 编译缓存；Markdown preview 支持 stable/live snapshot；大文档 progressive/bounded 渲染；Mermaid/KaTeX render cache；重型表格、图表、数学块、长代码块 lazy mount；AI 标注改为按 end line 分桶索引。 |
| 稳定性 | `useFileDocumentState` 增加 target key，避免切换文件时旧内容短暂渲染到新文件预览。 |
| 测试 | 新增 Markdown document utility 和 preview 渐进/边界/懒渲染测试；更新 FileViewPanel external-change 和 Mermaid 缓存预期。 |
| 验证 | `openspec validate stabilize-file-markdown-preview-render-architecture --strict --no-interactive`、`npm run typecheck`、`npm run lint`、相关 Vitest 80 tests、`npm run test` 全量 524 files、`npm run check:large-files:gate` 均通过。 |

**Updated Files**:
- `openspec/changes/stabilize-file-markdown-preview-render-architecture/**`
- `src/features/files/components/FileMarkdownPreview.tsx`
- `src/features/files/utils/fileMarkdownDocument.ts`
- `src/features/files/components/FileViewBody.tsx`
- `src/features/files/components/FileViewPanel.tsx`
- `src/features/files/components/FileExplorerWorkspace.tsx`
- `src/features/files/hooks/useFileDocumentState.ts`
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `src/features/files/components/FileMarkdownPreview.test.tsx`
- `src/features/files/utils/fileMarkdownDocument.test.ts`
- `src/features/files/components/FileViewPanel.external-change.test.tsx`
- `src/features/files/components/FileViewPanel.test.tsx`
- `src/i18n/locales/en.part2.ts`
- `src/i18n/locales/zh.part2.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `61a33feb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 536: 升级发布版本到 v0.5.0

**Date**: 2026-05-21
**Task**: 升级发布版本到 v0.5.0
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

Task goal: 修复 GitHub release job 因 v0.4.18 tag/release 已存在而失败的问题。
Main changes: 将项目发布版本源从 0.4.18 统一升级到 0.5.0，覆盖 package.json、package-lock.json、src-tauri/tauri.conf.json。
Affected modules: release/version metadata only；未修改 release workflow 和应用运行逻辑。
Validation: 检查三处版本源均为 0.5.0；确认 upstream/origin 均无 refs/tags/v0.5.0；git diff 仅包含版本号变更。
Follow-ups: 重新推送并运行 Release workflow，创建 v0.5.0 release。


### Git Commits

| Hash | Message |
|------|---------|
| `0af58d83` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 537: 修复 Codex 终态 identity 缺失卡住生成

**Date**: 2026-05-21
**Task**: 修复 Codex 终态 identity 缺失卡住生成
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

## Summary

修复 Codex 偶发 final assistant 已可见但 composer 仍显示正在生成的问题。

## Root Cause

前两次修复为了避免 terminal event 串到高亮线程，禁止了 active-thread fallback；这个方向是对的，但没有补上安全的 ownership fallback，导致两类真实完成事件被丢弃：

- `turn/completed` 缺 `threadId` 时无法使用已知 `turnId -> threadId` evidence 清算。
- thread-owned assistant completion 缺 `turnId` 时不触发 bounded reconcile。

## Changes

- 在 `useAppServerEvents` 中记录 bounded `workspaceId + turnId -> threadId` ownership。
- `turn/completed` 缺 `threadId` 时只从 recorded ownership 或唯一 active-turn resolver 恢复目标线程，不回退到 highlighted thread。
- assistant completion 缺 `turnId` 时使用 `__unknown_turn__` 做 thread-scoped reconcile，仍通过 terminal-drift guard 清 processing。
- 新增 OpenSpec change `fix-codex-terminal-identity-recovery`。
- 更新 `.trellis/spec/guides/cross-layer-thinking-guide.md`，固化 realtime terminal ownership contract。

## Validation

- `npm exec vitest run src/features/app/hooks/useAppServerEvents.completion-turn-id.test.tsx src/features/threads/hooks/useThreadRealtimeHistoryReconcile.test.ts src/features/threads/hooks/useThreads.integration.test.tsx src/features/threads/hooks/useThreadsTerminalDrift.test.ts`
- `npm exec vitest run src/features/app/hooks/useAppServerEvents.test.tsx src/features/app/hooks/useAppServerEvents.realtime-contract.test.tsx src/features/app/hooks/useAppServerEvents.routing.test.tsx src/features/app/hooks/useAppServerEvents.completion-turn-id.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run check:runtime-contracts`
- `npm run doctor:strict`
- `npm run test`
- `openspec validate fix-codex-terminal-identity-recovery --strict --no-interactive`


### Git Commits

| Hash | Message |
|------|---------|
| `b2a04097` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 538: 回滚 Codex 终止漂移恢复链路

**Date**: 2026-05-21
**Task**: 回滚 Codex 终止漂移恢复链路
**Branch**: `feature/v0.5.0-md`

### Summary

按用户要求完整回滚 Codex 终止/漂移恢复修复链路，避免已结束会话被迟到事件复活。

### Main Changes

## 背景
用户反馈 Codex 会话在上一轮修复后仍会偶发无法正常结束，并出现已终止对话被迟到状态复活的问题。

## 本次处理
- 撤销未提交的二次补丁，避免继续叠加错误方向。
- 通过语义 revert 回滚以下运行时修复提交：
  - 3e258333 fix(codex): 收紧后台终止漂移恢复边界
  - 12af3ccb Fix
  - b2a04097 fix(codex): 修复终态 identity 缺失卡住生成
- 删除对应 OpenSpec 变更与测试资产，恢复到这些修复进入前的运行时行为。
- 不回滚 release、Markdown、sidebar、workspace 等无关正常功能。

## 验证
- npm exec vitest run src/features/app/hooks/useAppServerEvents.test.tsx src/features/app/hooks/useAppServerEvents.realtime-contract.test.tsx src/features/app/hooks/useAppServerEvents.routing.test.tsx src/features/app/hooks/useAppServerEvents.tokenUsage.test.tsx src/features/app/hooks/useAppServerEvents.completion-turn-id.test.tsx src/features/threads/hooks/useThreadEventHandlers.test.ts src/features/threads/hooks/useThreadItemEvents.test.ts src/features/threads/hooks/useThreads.integration.test.tsx
- npm run typecheck
- npm run lint
- npm run check:runtime-contracts
- npm run doctor:strict
- git diff --cached --check


### Git Commits

| Hash | Message |
|------|---------|
| `4456ed67` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 539: 对齐成本分段文本颜色

**Date**: 2026-05-21
**Task**: 对齐成本分段文本颜色
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 改动 | StatusPanel 成本预算 token breakdown 的文本 label 颜色与进度条 segment 一一对应。 |
| 范围 | 仅调整 `TokenBreakdownBar` label class 与 `status-panel.css` 文本颜色映射，不改 token 计算、pricing、budget 或渲染条件。 |
| 验证 | `npm exec vitest run src/features/status-panel/components/StatusPanel.test.tsx` 通过，74 tests passed。 |

**Updated Files**:
- `src/features/status-panel/components/CostBudgetSection.tsx`
- `src/styles/status-panel.css`


### Git Commits

| Hash | Message |
|------|---------|
| `d099f94c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 540: 稳定 Markdown 预览刷新与大文档渲染

**Date**: 2026-05-21
**Task**: 稳定 Markdown 预览刷新与大文档渲染
**Branch**: `feature/v0.5.0-md`

### Summary

(Add summary)

### Main Changes

## Summary

修复 Markdown 文件预览的自动刷新、闪烁和大文档卡顿问题：

- 将主窗口文件外部变化处理拆成 awareness 与 apply，默认只提示外部变化，Live Preview 才 debounce 自动应用。
- 使用 native watcher / metadata monitor 优先感知外部变化，减少打开其他文件编辑时的全量内容读取。
- 大 Markdown 预览改为 block-level progressive rendering，保留 GitHub Markdown、frontmatter、table、code highlight、KaTeX、Mermaid 与 annotation line mapping。
- 修复 dirty buffer 下外部变化可能覆盖本地未保存内容的竞态，pending refresh 会升级为 conflict。
- 稳定 Mermaid source/render tab 与 table/card lazy reveal，已显示的重块不会因 annotation rerender 回退到 placeholder。
- 补齐 heavy-test-noise 日期测试、runtime contract 与 monitor cleanup 可观测性问题。

## Validation

- npx vitest run src/features/files/components/FileMarkdownPreview.test.tsx src/features/files/utils/fileMarkdownDocument.test.ts src/features/files/components/FileViewPanel.external-change.test.tsx src/features/files/hooks/useFileExternalSync.test.tsx src/features/files/components/DetachedFileExplorerWindow.test.tsx src/app-shell-parts/fileExternalMonitoring.test.ts
- npm run lint
- npm run typecheck
- npm run check:large-files:near-threshold
- npm run check:large-files:gate
- npm run check:heavy-test-noise
- npm run check:runtime-contracts
- npm run doctor:strict
- openspec validate --changes stabilize-markdown-preview-awareness-and-large-rendering --strict --no-interactive
- git diff --check


### Git Commits

| Hash | Message |
|------|---------|
| `f5515768` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
