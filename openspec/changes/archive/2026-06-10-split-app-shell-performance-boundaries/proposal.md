# split-app-shell-performance-boundaries

## Summary / 摘要

收敛 `AppShell` startup static surface：把非首屏 tab/controller/view 从主 shell 静态导入路径拆到 lazy boundary，并移除核心 shell 文件里的 `@ts-nocheck`，让 App main chunk 与类型边界同时可控。

## Problem / 问题

`docs/perf/v0.5.8-performance-optimization-roadmap.md` 的 `P0-06` 指出：`src/app-shell.tsx` 仍带 `// @ts-nocheck`，并静态拉入 workspace、threads、git、models、skills、prompts、settings、update、composer、engine、kanban、git history、workspace home、SpecHub、search、detached file explorer 等大量 surface。

当前风险不是单个组件大，而是 AppShell orchestration 把 inactive feature controllers 变成 startup path 的一部分：

- App main chunk 继续承载低频 surface 的 parse/compile cost；
- shell 类型错误被 `@ts-nocheck` 掩盖，后续拆分更容易引入 runtime regression；
- 已存在的 `lazyViews` 不能完全阻断 controller/static imports 进入 `App` chunk。

## Goals / 目标

- 定义 minimal AppShell critical surface：sidebar、active thread shell、composer basic input、runtime notification essentials。
- Lazy-load tab-specific controllers/views：Git History、Kanban、SpecHub、WorkspaceHome、Settings、GitHub panel、Detached file explorer。
- 保留 always-on runtime/controller 的 explicit ownership，避免把关键 session lifecycle 延迟到错误 lazy boundary。
- 移除核心 shell 文件的 `@ts-nocheck`，用 typed boundary props 替代 broad `any` bags。
- 增加 import boundary / chunk budget evidence，证明 heavy inactive features 不回到 startup static surface。

## Non-Goals / 非目标

- 不重做 AppShell 信息架构或视觉布局。
- 不改变 active thread、composer、sidebar 的首屏行为。
- 不合并或重写 `useThreads` / runtime lifecycle 公共 API。
- 不一次性拆完所有 AppShell 历史债务；本 change 只处理 P0 startup/static surface 与 type boundary。

## Approach / 方案

1. Inventory `src/app-shell.tsx`、`src/app-shell-parts/*`、`lazyViews.tsx`、`renderAppShell.tsx` 的 static imports。
2. 标注每个 import：`critical-shell`、`always-on-runtime`、`route-or-tab-on-demand`、`modal-on-demand`、`legacy-coupled`。
3. 将 inactive tab/view/controller 移到 lazy entry 或 feature activation path。
4. 为 shell -> feature 边界定义 typed props，逐步移除 `@ts-nocheck`。
5. 对 `Suspense` 只包 feature pane/modal，不包 whole shell。
6. 增加 boundary check，防止 CodeMirror/PDF/Mermaid/Kanban/SpecHub 等 heavy modules 被 AppShell 直接静态导入。

## Risks / 风险

- controller lazy loading 可能打断 feature 的状态恢复，需要明确哪些 state 必须先于 render 可用。
- 过粗 `Suspense` 会造成首屏闪烁；boundary 必须贴近 feature pane。
- 移除 `@ts-nocheck` 会暴露历史类型问题，需要按 typed boundary 收敛，而不是用 `any` 重新掩盖。

## Acceptance Criteria / 验收口径

- `src/app-shell.tsx` 不再使用 `@ts-nocheck`。
- AppShell static imports 不直接拉入 inactive heavy feature controllers/views。
- App main chunk gzip 有 measurable decrease，或明确记录无法下降的 retained critical dependency。
- Initial active tab、sidebar、composer、runtime notices 正常渲染。
- Import boundary test 或 equivalent script 能阻止 heavy optional modules 回到 startup shell。

## Validation / 验证

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run check:bundle-chunking`
- Focused AppShell render / lazy boundary tests。
- `openspec validate split-app-shell-performance-boundaries --strict --no-interactive`
