## 1. Hook 抽离(useCodexMessageRecovery)

- [x] 新增 `src/features/threads/hooks/useCodexMessageRecovery.ts`,导出 `useCodexMessageRecovery` hook
- [x] 把 `useThreadMessaging.ts` 行号 1020-1137 的恢复路径替换为 `createRecoveryAttempt(...).tryFreshDraftReplacement(...)` / `tryForkFromMessage(...)` 调用
- [x] 现有 4 个 `useThreadMessaging` 调用方零改动(签名保持)
- [x] 新增 `useCodexMessageRecovery.test.tsx`,覆盖 fresh continuation / fork / 无效 threadId / 已有 rebound thread / 无 optimistic item 五条路径
- [x] `npm exec vitest run src/features/threads/hooks/useThreadMessaging.test.tsx` 全量通过
- [x] `npm run typecheck && npm run lint` 通过

## 2. 流式派发决策表

- [x] 在 `.trellis/spec/frontend/hook-guidelines.md` 写入「batch vs urgent dispatch 决策矩阵」段落
- [x] 新增 `shouldUrgentlyDispatchReasoningDelta(event, flushReason)` 谓词
- [x] 修改 `useThreadItemEvents.ts:799-800` 与 `:868`,纳入 reasoning delta first-token 急派分支
- [x] 新增 `useThreadItemEvents.first-token-reasoning-delta.test.ts`,锁定 first-token reasoning 急派行为
- [x] `npm run typecheck && npm run lint` 通过

## 3. 性能证据 proxy → measured

- [x] 接入开发机真实跑分,生成 `docs/perf/history/v0.5.11-baseline-2026-06-XX-*.{json,md}` 至少 1 份
- [x] `scripts/perf-v0511-runtime-evidence.ts` 增加 `evidenceClassUpgrade` 模式
- [x] 剩余 proxy → measured producer 拆出到 `follow-up-v0511-large-file-cookbook-and-measured-evidence`
- [x] 在 `scripts/perf-v0511-runtime-evidence.ts` 增加 `proxyRatio` 字段
- [x] 在 `scripts/perf-archive-readiness.mjs` 把 `proxyRatio > 0.5` 标记为 `warning`(本迭代不得写入 `hardFailures`)
- [x] `npm run perf:baseline:all` 通过
- [x] `npm run perf:archive-readiness -- --json` 通过,`proxyRatio` 与 `warnings` 写入 report;`proxyRatio > 0.5` 不进入 `hardFailures`

## 4. PR check 接入(warn 软启动)

- [x] 新增 `.github/workflows/perf-archive-readiness.yml`,跑 `npm run perf:archive-readiness -- --json`
- [x] `no-perf-required` label 触发 `notApplicable` 旁路
- [x] 本迭代 workflow 处于 `warn` 模式(`continue-on-error: true`)
- [x] PR 评论模板贴 `proxyRatio=XX%` / `warnings=N` / `hardFailures=N` 字段

## 5. 大文件继续拆(wave3) — 拆出

- [x] `src/services/tauri.ts` 的 session / permission / appServer 拆分移入 `follow-up-v0511-large-file-cookbook-and-measured-evidence`
- [x] `src/services/tauri.ts` < 600 行目标移入 follow-up
- [x] `FileTreePanel.tsx` 的 `useFileTreeViewState` 抽离移入 follow-up
- [x] `FileTreeRefreshControls.tsx` 抽离移入 follow-up
- [x] `FileTreePanel.tsx` < 1500 行目标移入 follow-up
- [x] `npm run check:large-files` 作为 follow-up 验收项

## 6. Codex recovery cookbook — 拆出

- [x] `.trellis/spec/backend/codex-provider-scoped-runtime.md` 故障剧本移入 follow-up
- [x] `staleRecoveryClassification.reasonCode` / `staleReason` / `userAction` 字段语义移入 follow-up
- [x] "GEMINI / CLAUDE 接入模板" 移入 follow-up
- [x] `codex-stale-thread-binding-recovery` cookbook spec delta 移入 follow-up

## 7. OpenSpec lifecycle(本次)

- [x] 落盘 `openspec/changes/refactor-v0511-thread-messaging-recovery-and-streaming/{proposal.md, tasks.md, design.md, specs/}`
- [x] 落盘 3 个 spec delta:`codex-message-recovery-hook` / `streaming-dispatch-decision-table` / `runtime-perf-evidence-classification`
- [x] 把 `fix-file-tree-virtual-scroll-height` 移入 `archive/2026-06-12-fix-file-tree-virtual-scroll-height-hotfix-closeout/`
- [x] 在主源 `openspec/specs/workspace-filetree-root-node/spec.md` 增加 hotfix closeout 段落
- [x] `openspec validate refactor-v0511-thread-messaging-recovery-and-streaming --strict --no-interactive` 通过

## 验证

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm exec vitest run src/features/threads/hooks/useThreadMessaging.test.tsx src/features/threads/hooks/useCodexMessageRecovery.test.tsx src/features/threads/hooks/useThreadItemEvents.first-token-reasoning-delta.test.ts`
- [x] Rust 未改动;`cargo test --manifest-path src-tauri/Cargo.toml` 不适用,已拆出到 follow-up 验收
- [x] `npm run perf:baseline:all`
- [x] `npm run perf:archive-readiness -- --json`(ok=true, status=warn, hardFailures=[], proxyRatio 写入 report;`proxyRatio > 0.5` 只进入 warnings)
- [x] `openspec validate refactor-v0511-thread-messaging-recovery-and-streaming --strict --no-interactive`
