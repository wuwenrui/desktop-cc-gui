# Proposal: Follow-up v0.5.11 — large-file wave3 + recovery cookbook + measured evidence producers

## Why

`refactor-v0511-thread-messaging-recovery-and-streaming` 已经完成 hook 抽离、streaming first-token reasoning urgent dispatch、perf warn gate 和 PR check。继续在同一个 change 里塞大文件拆分、跨 provider cookbook、更多 measured producer 会扩大 blast radius,也会拖慢已完成链路的收口。

本 follow-up 专门承接这些较大的后续任务。

## 目标与边界

- 继续拆 `src/services/tauri.ts` 中 session / permission / appServer 领域 wrapper,保持 `src/services/tauri.ts` facade 兼容。
- 拆 `src/features/files/components/FileTreePanel.tsx` 的 view-state hook 与 refresh controls。
- 为 `useCodexMessageRecovery` 写 backend/frontend recovery cookbook,沉淀 `reasonCode` / `staleReason` / `userAction` 字段语义和 GEMINI / CLAUDE 接入模板。
- 为剩余 proxy metrics 增加真实 runtime producer,只在 source artifact 能证明时升级为 `measured`。

## 非目标

- 不回改已完成的 `useCodexMessageRecovery` runtime contract。
- 不改变 `proxyRatio > 0.5` 在 v0.5.11 的 warn-only 语义。
- 不调整 large-file policy threshold。
- 不伪造 measured evidence;没有真实 source artifact 的 metric 继续保持 proxy。

## What Changes

- `src/services/tauri.ts` 拆出 `src/services/tauri/session.ts` / `permission.ts` / `appServer.ts`。
- `FileTreePanel.tsx` 抽出 `useFileTreeViewState.ts` 与 `FileTreeRefreshControls.tsx`。
- `.trellis/spec/backend/codex-provider-scoped-runtime.md` 增加 recovery cookbook。
- `scripts/perf-v0511-runtime-evidence.ts` 增加更多 measured producer,并更新 tests / docs perf artifacts。

## Impact

- Frontend bridge facade: `src/services/tauri.ts` and `src/services/tauri/*.ts`。
- File tree UI: `src/features/files/components/FileTreePanel.tsx` and new hook/component。
- Perf evidence scripts and generated `docs/perf/**` reports。
- Trellis backend/frontend implementation specs。

## 验证

- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files`
- `node --test scripts/perf-v0511-runtime-evidence.test.mjs scripts/perf-archive-readiness.test.mjs`
- `npm run perf:baseline:all`
- `npm run perf:archive-readiness -- --json`
- `cargo test --manifest-path src-tauri/Cargo.toml` only if Rust command contracts are touched
- `openspec validate follow-up-v0511-large-file-cookbook-and-measured-evidence --strict --no-interactive`
