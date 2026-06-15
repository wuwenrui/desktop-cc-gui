## 1. Baseline And Characterization

- [x] 1.1 [P0] 输入：当前 `src/features/files/**` 与相关 tests；输出：补齐 file open / tab switch / dirty draft / external conflict / line range / git marker characterization tests；验证：focused Vitest 通过。
- [x] 1.2 [P0] 输入：现有 typing diagnostics / perfBaseline；输出：新增或扩展 `fileInteractionDiagnostics` / `fileEditorTypingDiagnostics`，定义 file open、tab activation、typing、line change、realtime pressure 的 content-safe evidence schema；验证：新增 schema tests 或 static contract tests。
- [x] 1.3 [P1] 输入：真实卡顿现象和现有 runtime evidence gates；输出：记录当前 measured/proxy/manual-only/unsupported baseline；验证：evidence artifact 可重复生成且不含文件内容。

## 2. Per-Tab File Session Boundary

- [x] 2.1 [P0] 依赖 1.1；输入：main editor、detached explorer、editable diff review 的 `FileViewPanel` consumers；输出：引入 file tab session manager 或 thin adapter，保留 `openTabs` 与 `activeFilePath` 对外兼容；验证：三个入口的现有 tests / static coverage 通过。
- [x] 2.2 [P0] 依赖 2.1；输入：document snapshot state；输出：把 document snapshot、load state、dirty metadata 挂到 per-tab session；验证：切回已打开 clean tab 不默认重读文件。
- [x] 2.3 [P0] 依赖 2.2；输入：dirty draft 场景；输出：后台 dirty tab 保留 draft，关闭 tab 仍执行 dirty confirm；验证：新增 dirty background tab tests。
- [x] 2.4 [P0] 依赖 2.2；输入：session cache 生命周期；输出：定义 lightweight session release / memory budget / large file fallback；验证：close tab releases session，large file 不无限缓存。

## 3. Editor Hot Path Isolation

- [x] 3.1 [P0] 依赖 2.2；输入：`FileViewBody` controlled value path；输出：CodeMirror/editor session 成为输入 hot-path owner，父级 content publish 只保留 coalesced/explicit path；验证：typing latency focused tests。
- [x] 3.2 [P0] 依赖 3.1；输入：save flow；输出：save 前 flush latest editor draft，防止写 stale parent snapshot；验证：pending publish + save regression test。
- [x] 3.3 [P0] 依赖 3.1；输入：line range publication；输出：latest-only cancellable line range channel；验证：tab switch 后 stale line range 不发布。
- [x] 3.4 [P0] 依赖 3.1；输入：active declaration anchor / Composer active file reference；输出：line range 与 active code anchor 改为 latest-only + epoch guarded derivation，减少每次输入/切行的 full-content recomputation；验证：typing/line-change path 不触发 AppShell/Composer/file tree 重算的 proxy test。
- [x] 3.5 [P1] 依赖 3.1、6.1；输入：tab activation evidence；输出：只在证据需要时评估 CodeMirror `EditorState` 保活；验证：memory budget 与 remount evidence 同时通过。

## 4. File Rendering Scheduler And Side Channels

- [x] 4.1 [P0] 依赖 2.2；输入：file open rendering pipeline；输出：拆出 tab activation、snapshot ready、first useful viewport、heavy preview completion 阶段；验证：open timing evidence 能区分阶段。
- [x] 4.2 [P0] 依赖 4.1；输入：preview handle resolution、git marker、external refresh async work；输出：统一 file identity + snapshotVersion + renderEpoch guard；验证：stale work after tab switch 被丢弃。
- [x] 4.3 [P1] 依赖 4.2；输入：git marker loading；输出：git marker 变为 side channel，失败/延迟不阻塞 editor mount；验证：marker pending/failure tests。
- [x] 4.4 [P1] 依赖 4.2；输入：`useFileExternalSync` existing `fileVersionRef` guard；输出：与 renderEpoch/snapshotVersion guard 统一，stable preview 下 clean external update 只提示 pending，不强制 rebuild；验证：external-change focused tests。
- [x] 4.5 [P1] 依赖 4.2；输入：code intelligence navigation；输出：cursor move 不默认一动一请求，explicit/debounced bounded；验证：command count tests。

## 5. Realtime And AppShell Boundary Cleanup

- [x] 5.1 [P0] 依赖 3.1；输入：file surface props；输出：文件视图只接收 `FileRenderPressure` narrow signal，不接收 `threadStatusById` 或 conversation reducer state；验证：static prop/import guard。
- [x] 5.2 [P1] 依赖 5.1；输入：AppShell/layout node construction；输出：layout 只为 file surface 传递必要 pressure signal，避免 unrelated realtime map churn 重建 file props；验证：layout focused tests。
- [x] 5.3 [P1] 依赖 5.2；输入：Sidebar / WorktreeSection running aggregation；输出：将 sidebar running/exited derivation 保持在 sidebar concern，不泄漏到 file props；验证：Sidebar tests 和 prop-chain static checks。

## 6. Evidence And Closeout

- [x] 6.1 [P0] 依赖 3.1、4.1、5.1；输入：runtime evidence schema；输出：file open / tab activation / typing / line change / realtime pressure evidence gate；验证：gate command 通过。
- [x] 6.2 [P0] 依赖 6.1；输入：用户手动复测；输出：记录“打开文件、Tab 切换、打字、切换行”四类体感结果；验证：用户反馈“有重大改善”，仍未升级为 measured runtime evidence，归类为 manual-only acceptance。
- [x] 6.3 [P0] 依赖全部 P0；输入：实现与 specs；输出：strict OpenSpec validation、typecheck、lint、focused tests；验证：`openspec validate file-editor-io-render-isolation-2026-06 --strict --no-interactive`、`npm run check:file-interaction-evidence`、focused Vitest、`npm exec tsc -- --noEmit --pretty false`、`npm run lint` 均通过。
- [x] 6.4 [P1] 依赖 6.2；输入：仍存在的卡顿分类；输出：决定是否开启 Rust/Tauri file IO cache follow-up；验证：本轮 manual evidence 指向 frontend hot path isolation 已产生重大改善，暂不开 backend cache 提案；若后续 evidence 指向 raw file read / file tree polling，再新开 follow-up。
