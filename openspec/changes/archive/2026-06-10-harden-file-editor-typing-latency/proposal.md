# harden-file-editor-typing-latency

## Why

`docs/perf/v0.5.8-performance-optimization-roadmap.md` 已覆盖 file preview、workspace file tree、backend scan、Tauri payload 和 client storage write pressure，但还缺少一个 P0 contract 来约束“文件已经打开后，在编辑器里打字顿挫卡顿”的热路径。

这个问题必须单独立项，因为用户感知到的卡顿发生在 keystroke -> editor transaction -> dirty buffer -> line/selection publication -> save/sync/watch feedback 这一条链路；它不是单纯 lazy-load CodeMirror 或优化文件树扫描就能自然解决。

## 目标与边界

- 建立 file editor typing latency 的 P0 budget 和 evidence gate。
- 让 CodeMirror typing transaction 保持 local-first，不被 app-shell、Composer、workspace tree 或 backend IO 放大。
- 阻断 per-keystroke Tauri invoke、FS write、`clientStorage` write、full file reload。
- 保留 dirty-buffer conflict protection、external-change visibility、explicit save 语义。
- 生成 content-safe diagnostics，不记录文件正文、diff、prompt 或 assistant output。

## What Changes

- 新增 `file-editor-typing-latency` capability，定义文件编辑输入延迟、写盘/同步约束、watcher feedback、防回退 evidence。
- 在 roadmap 中新增 `P0-11 File Editor Typing Latency Hardening`。
- 将 editor cursor/selection/line-range publication 从 high-frequency typing path 中解耦，采用 delayed/coalesced/low-priority publication。
- 对 save/autosave/preference/metadata persistence 增加 bounded debounce/coalescing contract。
- 让 external file sync 与 watcher event 明确区分 dirty buffer、clean buffer、self-save event、真实 external change。
- 增加 typing latency evidence：visible echo P95、editor transaction duration、React commit cost where available、long task count、IPC/write count、stale sync drop count。

## 非目标

- 不引入 collaborative editing。
- 不重写完整 file rendering profile 或 file type inference 体系。
- 不把 CodeMirror 替换成其他 editor。
- 不为了性能牺牲 dirty-buffer conflict protection。
- 不把文件正文、diff 内容或用户输入内容写入性能诊断。

## 技术方案选项与取舍

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. Local-first editor hot path | CodeMirror 作为 keystroke source of truth；React/global publication 延迟合并；save/sync/watch 走 bounded side channel | 最贴近问题根因，能保护输入延迟，也保留现有 file view 架构 | 需要梳理 editor state 与 global state 边界 | 采用 |
| B. Aggressive worker/off-main-thread rewrite | 将编辑器 state、diff、save sync 大量迁移到 worker | 理论上隔离主线程 | 改动大，风险高，当前需求不需要重写 editor 架构 | 暂不采用 |
| C. 只增加 debounce | 给现有写入/同步调用加 debounce | 快速止血 | 无法阻止 React render amplification，也难以证明 per-key IPC/write 为 0 | 仅作为 A 的局部手段 |

## Capabilities

### New Capabilities

- `file-editor-typing-latency`: Defines the P0 performance contract for responsive file editing, local-first editor transactions, bounded persistence/sync, watcher feedback suppression, and content-safe evidence.

### Modified Capabilities

- `file-open-rendering-scheduler`: Align editor typing hot path with existing delayed line-range publication and render-pressure boundaries.
- `file-view-rendering-runtime-stability`: Clarify that external sync and stable rendering protections must not overwrite dirty buffers or force reload during typing.
- `runtime-performance-evidence-gates`: Extend runtime evidence classification to include file editor typing evidence.

## Impact

- Frontend file editor surfaces under `src/features/files/components/**`.
- `src/features/files/hooks/useFileExternalSync.ts` and watcher event handling.
- `src/features/workspaces/hooks/useOpenPaths.ts` where open-file/session state can be touched during edits.
- `src/services/clientStorage.ts` and settings/preference writers if they are triggered from editor state.
- `src/services/tauri.ts` and `src-tauri/src/workspaces/files.rs` for save/read/write IPC boundaries.
- Perf docs and evidence artifacts under `docs/perf/**`.

## Acceptance Criteria / 验收口径

- Typing in an already-open text file does not issue per-keystroke Tauri file reads/writes, FS writes, or `clientStorage` writes.
- CodeMirror visible echo P95 is budgeted at `<= 16 ms`; hard-fail threshold is `> 32 ms` when measured evidence exists.
- Large-file edit visible echo P95 is budgeted at `<= 32 ms`; hard-fail threshold is `> 50 ms` when measured evidence exists.
- Dirty buffers are not replaced by external sync, self-save watcher feedback, or clean-preview refresh logic.
- Evidence is classified as `measured`, `proxy`, `manual-only`, or `unsupported`; proxy evidence is not described as release-grade proof.

