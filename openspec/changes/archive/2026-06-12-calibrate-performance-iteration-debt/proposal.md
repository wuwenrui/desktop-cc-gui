## Why

2026-06 性能迭代已经落地了 substantial batching、render-budget、file-editor hot path isolation 和 provider-scoped runtime work，但 closeout state 比 implementation state 更“乐观”：多个 active changes 已经 task-complete，却仍携带 compatibility adapters、`unsupported` evidence，以及一个明确的 old-path gap：workspace file listing 仍未真正消费 `ScanCache` substrate。

本 change 的目的不是再做一轮大重构，而是在 archive 前做一次 honest calibration：确认什么真的完成、补掉阻塞性能闭环的 narrow implementation gap，并把剩余 structural debt 拆成 explicit follow-up scope，避免藏在 completed task lists 里。

## 目标与边界

- 校准 current active performance changes 的 closeout state：`realtime-input-and-io-isolation-2026-06`、`frontend-prop-chain-stability-2026-06`、workspace listing budget、backend IO cache / bridge payload budget、renderer resource backpressure、Composer/message-row render budget、markdown off-main-thread pipeline、file editor IO/render isolation。
- 修复 concrete substrate-consumption gap：workspace file listing 已有 budget metadata，但 file listing path 仍报告 `ScanCacheState::Unsupported`，应在安全 cache key / source signature 可用时消费 backend `ScanCache`。
- 闭环 workspace listing structural debt：desktop Tauri path 与 `cc_gui_daemon` path 不再各自维护 scanner/cache/DTO helpers，统一委托 shared workspace listing core。
- 校正 evidence / archive-readiness language，避免把 completed tasks、measured evidence、proxy evidence、manual-only evidence、unsupported fields 混为一谈。
- 保留 intentional compatibility fallback paths，但必须标注为 compatibility / adapter / rollback surface，而不是伪装成“已删除旧路径”。
- 明确 large-file modularization debt 的 follow-up boundaries，例如 `app-shell.tsx`、`useAppServerEvents.ts`、`useLayoutNodes.tsx`、`MessagesRows.tsx`、`Markdown.tsx`、`FileViewPanel.tsx`。

## 非目标

- 不做 broad rewrite：本 change 不重写 AppShell、Thread runtime、Markdown rendering 或 FileView。
- 不删除 single-event fallback channels、disk Codex provider fallback、worker unsupported fallback 或其他 documented compatibility paths。
- 不实现 per-thread Codex app-server process isolation。当前 provider-scoped runtime contract 允许 same workspace + same provider conversations 在 thread routing 正确时共享一个 runtime。
- 不新增 dependency，除非实现证明现有 `ScanCache`、payload budget、runtime evidence utilities 无法支撑 targeted fix。
- 不把 proxy / manual-only evidence 宣称为 release-grade measured evidence。

## What Changes

- 增加 performance-iteration debt calibration contract，区分 implemented performance substrate、remaining old-path gaps、intentional compatibility fallback、structural modularization debt、archive-blocking evidence gaps。
- 修改 workspace file listing behavior：initial listing 和 directory-child listing 在 cache key / invalidation signature 安全时消费 existing backend cache substrate。
- 抽取 shared workspace listing core：把 file-tree DTOs、budget helpers、cache signatures、initial listing 和 directory-child listing 放入 shared backend module，desktop / daemon adapters 只保留 adapter-specific IO。
- 更新 runtime evidence closure rules：archive readiness 不能只从 checked task boxes 推断；manual QA 仍有 residual jank 或 profiler artifacts 缺失时必须显式标注。
- 澄清 app shell / frontend prop-chain closeout wording：domain objects 与 row-level subscriptions 已实现，但 broad file-size modularization 仍是 follow-up debt。
- 澄清 Codex runtime isolation wording：provider-scoped process/config isolation 已完成；per-thread process isolation 不是当前 behavior specs 的 requirement。

## Capabilities

### New Capabilities

- None。此 change 校准并收紧 existing performance / runtime contracts，不引入新的 parallel capability namespace。

### Modified Capabilities

- `runtime-performance-evidence-gates`: Archive-readiness guidance 必须纳入 residual manual jank、missing profiler artifacts、unsupported/proxy evidence，不能只看 completed tasks。
- `workspace-filetree-progressive-scan-protocol`: Workspace file listing / directory-child listing 在 cache key 与 source signature 安全时必须消费 backend scan-cache substrate；只有 intentional unavailable 时才报告 unsupported。
- `app-shell-runtime-boundaries`: AppShell domain context extraction 与 structured section inputs 必须和 full physical file modularization 分开分类，让 large compatibility adapters 保持可见。
- `codex-provider-scoped-session-launch`: Provider-scoped runtime isolation wording 必须明确区分 provider/process configuration isolation 与 per-thread process isolation。

## 技术方案取舍

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. Treat existing task-complete changes as archive-ready | Only update archive notes and leave code untouched. | Fastest; no implementation risk. | Hides the `ScanCacheState::Unsupported` gap and evidence contradictions; repeats the drift this change is meant to remove. | Rejected. |
| B. Narrow calibration + workspace listing structural closure | Update specs/tasks/evidence wording, wire workspace listing to the existing `ScanCache` substrate, and extract the duplicated desktop/daemon listing core. | Directly addresses the known old-path gap; closes the concrete duplicate scanner/cache drift vector; keeps broad UI modularization out of scope. | Does not pay down every large frontend file modularization debt immediately. | Accepted. |
| C. Full performance refactor closure | Continue splitting AppShell, event dispatcher, layout nodes, MessagesRows, Markdown, and FileView until all large files are under threshold. | Reduces structural debt deeply. | Too broad for one OpenSpec change; high regression risk across active runtime surfaces; would blur calibration with refactor. | Rejected for this change; track as follow-up. |

## Acceptance Criteria

- Workspace file listing paths 在可安全按 workspace root、listing mode、budget、source signature 缓存时，不再报告 `cacheState=unsupported`。
- Initial workspace listing cache hit validation MUST avoid recursive pre-walk；cache validation 要减少 hot-path work，不能为了判断 hit/miss 再扫一遍完整 file tree。
- Directory-child listing 保留 bounded one-level behavior、path boundary checks、partial metadata、old DTO compatibility，同时新增 cache hit/miss/invalidation evidence。
- `cc_gui_daemon` workspace listing path MUST expose the same additive `listingBudget` / `sourceVersion` / `payloadBudget.cacheState` contract as desktop Tauri path，避免 remote/web-service mode 继续停留在 legacy branch。
- Desktop Tauri path 与 `cc_gui_daemon` workspace listing path MUST delegate to the same shared core；scanner/cache internals MUST NOT remain duplicated across both adapters。
- `ScanCache` miss/invalidated compute MUST run outside the cache mutex，避免把 workspace/path 之间的重 IO 串行化。
- Runtime evidence artifacts 与 OpenSpec tasks 清楚标注每个 performance claim 是 `measured`、`proxy`、`manual-only` 还是 `unsupported`。
- `frontend-prop-chain-stability-2026-06` 不再同时写“无 visible jank”和“residual jank remains”这类 contradictory closeout language。
- Codex provider-scoped runtime documentation 明确：当前 spec 下 provider-scoped runtime isolation 完成；per-thread process isolation 除非新 proposal 改 contract，否则 out of scope。
- Validation 覆盖 strict OpenSpec validation、workspace listing cache behavior focused Rust tests、DTO/evidence mapping changed 时的 focused frontend tests、existing runtime evidence gate checks。

## Impact

- Backend:
  - `src-tauri/src/backend_budget.rs`
  - `src-tauri/src/shared/workspace_listing.rs`
  - `src-tauri/src/shared/mod.rs`
  - `src-tauri/src/workspaces/files.rs`
  - `src-tauri/src/bin/cc_gui_daemon/workspace_io.rs`
  - related workspace file listing tests
- Frontend:
  - `src/services/tauri.ts`
  - `src/features/workspaces/hooks/useWorkspaceFiles.ts`
  - `src/features/files/components/FileTreePanel.tsx` if response metadata mapping changes
- OpenSpec:
  - active performance change artifacts that contain stale or contradictory closeout language
  - delta specs for the modified capabilities listed above
- Performance evidence:
  - `docs/perf/runtime-evidence-gates.json`
  - generated runtime evidence markdown, if regenerated during implementation

No public API breaking change is intended。Existing payload fields 保持 backward-compatible；new or corrected metadata 必须 additive。
