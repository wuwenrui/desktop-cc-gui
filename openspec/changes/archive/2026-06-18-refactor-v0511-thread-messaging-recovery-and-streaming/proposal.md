# Proposal: v0.5.11 — Thread Messaging 恢复路径抽离 + 流式急派扩展 + 性能证据从 proxy 升 measured

## Why

本轮(v0.5.11)完成了一组"度量 + 优化"动作,但代码必现读后发现:

- `src/features/threads/hooks/useThreadMessaging.ts` 已 2463 行(实际行数,非 commit message 推测),周围已拆出 26 个 reducer/controller 子文件(`threadMessagingHelpers` / `sessionLifecycleController` / `messageRuntimeController` / `threadReducerNormalizedRealtime` 等),但「stale thread binding recovery / fresh continuation / fork」这段约 250 行的恢复路径(行号范围约 1020-1137)仍在主 hook。每加一种 recovery case,主 hook 都会变胖;后续 Gemini / Claude 接入同款 liveness 也要抄主 hook,代价大。
- `src/features/threads/hooks/useThreadItemEvents.ts` 内的三个谓词(`shouldBatchNormalizedRealtimeEvent` 行 209 / `shouldUseContractRealtimeBatcher` 行 219 / `shouldDispatchNormalizedRealtimeEventUrgently` 行 223)只有最后一个对 `appendAgentMessageDelta` 走急派;前两个把 5 种 operation(`itemStarted` / `itemUpdated` / `appendReasoningContentDelta` / `appendReasoningSummaryDelta` / `appendToolOutputDelta`)走 batch。当前 batch / urgent 调度语义已经清晰,但**「为什么这 5 种不走急派」没有 spec 解释**,等于一个未公开的协议。
- `docs/perf/v0511-runtime-evidence.json` 实际 4 measured / 17 proxy = 19% measured(代码实测统计)。门禁 `hardFailures=[]` 通过,但 proxy 占比过高仍应在本轮被显式标成 `warn`,否则 release 报告只放 proxy 数据,等于没优化。
- `openspec/changes/fix-file-tree-virtual-scroll-height/` 已在本次同步移入 `archive/2026-06-12-fix-file-tree-virtual-scroll-height-hotfix-closeout/`,与 OpenSpec lifecycle 对齐。

## 目标与边界

- 抽离 `useThreadMessaging` 内的 stale thread binding recovery / fresh continuation / fork 段为子 hook `useCodexMessageRecovery`,主 hook 调用方零改动。
- 在 `.trellis/spec/frontend/hook-guidelines.md` 下沉淀「batch vs urgent dispatch 决策表」;新增 `shouldUrgentlyDispatchReasoningDelta` 谓词,允许 `appendReasoningContentDelta` 在 `flush.reason === "first-token"` 时走急派,稳态仍走 batch。
- 接入开发机真实跑分,为 allowlisted runtime diagnostics 升级 measured evidence,并显式报告 `proxyRatio`。
- 把 `perf:archive-readiness` 的"proxy 占比 > 50%"列入 **warn soft-launch**,本轮不得写入 `hardFailures`;后续版本若要升 hard,必须另开 change 更新 gate contract。

## 非目标

- 不拆 `useThreadMessaging` 的 `sendMessage` 主流程(留待后续版本观察后再切)。
- 不改变 `appendAgentMessageDelta` 之外的 batch / urgent 调度顺序,只新增 first-token reasoning 急派分支。
- 不在本 change 继续拆 `src/services/tauri.ts` / `FileTreePanel.tsx`;拆分任务已移入 `follow-up-v0511-large-file-cookbook-and-measured-evidence`。
- 不在本 change 写 Codex recovery cookbook 或跨 provider 模板;文档任务已移入 follow-up change。
- 不强行把未证明的 proxy metric 标记为 measured;剩余 measured producer 任务已移入 follow-up change。
- 不调整 large-file policy 阈值。
- 不删除 heavy-test-noise gate。
- 不重写 `scripts/check-large-files.mjs` 或 `scripts/check-heavy-test-noise.mjs` 的核心解析规则。
- 不修改 `useThreadItemEvents` 已有 batch 调度的核心逻辑。

## What Changes

### Refactor: useThreadMessaging 恢复路径抽离

- 新增 `src/features/threads/hooks/useCodexMessageRecovery.ts`,导出顶层 `useCodexMessageRecovery` hook,返回 `createRecoveryAttempt(...)`;单次 attempt 接收 `threadId` / `workspace` / `reboundThreadId` / `acceptedTurnResolution` / `staleRecoveryClassification` / `optimisticUserItem` / `moveOptimisticUserIntentToThread` / `retrySendOnThread` / `startThreadForMessageSend` / `forkThreadForWorkspace` / `dispatch` / `onDebug` 等参数,返回 `{ tryFreshDraftReplacement, tryForkFromMessage, canUseFreshDraftReplacement, isUnverifiedSameThreadMissingRebind }` 方法集。
- `useThreadMessaging` 顶层调用 `useCodexMessageRecovery()`,在单次发送刷新失败路径内通过 `createRecoveryAttempt(...)` 创建 attempt,行号 1020-1137 的 ~110 行替换为调用 `tryFreshDraftReplacement(...)` / `tryForkFromMessage(...)`。
- 现有 `useThreadMessaging` 签名不变,4 个调用方(`ChatInputBoxAdapter` / `useThreadMessaging.test` 等)零改动。
- 新增 `src/features/threads/hooks/useCodexMessageRecovery.test.tsx`,覆盖 fresh continuation / fork / 无效 threadId / 已有 rebound thread / 无 optimistic item 五条路径。

### Refactor: 流式派发决策表

- 在 `.trellis/spec/frontend/hook-guidelines.md` 写入「batch vs urgent dispatch 决策矩阵」段落,锁定当前 3 个谓词的判定依据。
- 新增 `shouldUrgentlyDispatchReasoningDelta(event, flushReason)` 谓词,仅在 `event.operation === "appendReasoningContentDelta" && flushReason === "first-token"` 时返回 `true`。
- 修改 `useThreadItemEvents.ts:799-800` 与 `:868` 处的 urgent 判断,纳入 `shouldUrgentlyDispatchReasoningDelta`。
- 新增 `src/features/threads/hooks/useThreadItemEvents.first-token-reasoning-delta.test.ts`,锁定 first-token reasoning 急派行为。

### Feat(perf): proxy → measured

- 接入开发机真实跑分,生成 `docs/perf/history/v0.5.11-baseline-2026-06-XX-*.{json,md}` 至少 1 份。
- `scripts/perf-v0511-runtime-evidence.ts` 增加 `evidenceClassUpgrade` 模式,只允许 allowlisted runtime diagnostics 把 proxy row 替换为 measured row。
- 在 `scripts/perf-v0511-runtime-evidence.ts` 增加 `proxyRatio` 计算字段,值 = `proxy / (proxy + measured + synthetic)`。
- 在 `scripts/perf-archive-readiness.mjs` 中把 `proxyRatio > 0.5` 标记为 `warning`(本迭代以 `warn` 形态跑,记录在 PR 评论;是否升 hard 留给后续 change 决策)。

### Feat(perf): PR check 接入

- 新增 `.github/workflows/perf-archive-readiness.yml`,在 PR 上跑 `npm run perf:archive-readiness -- --json`,把 `ok=true && hardFailures=[]` 作为通过条件,同时把 `warnings` 写入 PR 评论。
- PR 加 `no-perf-required` label 时,workflow 跳过 perf 步骤并输出 `notApplicable`。
- 本迭代该 workflow 处于 `warn` 模式(`continue-on-error: true`),仅 PR 评论贴 `proxyRatio=XX%` 警告,不卡 merge。

### Follow-up 拆出

- `large-file wave3`、Codex recovery cookbook、剩余 proxy → measured producer 已拆入 `openspec/changes/follow-up-v0511-large-file-cookbook-and-measured-evidence/`。
- 本 change 只保留已经实现且验证通过的 hook / streaming / perf warn gate / PR check / lifecycle 收口。

### Spec Delta(写入 `openspec/specs/`)

- `codex-message-recovery-hook/spec.md` — `useCodexMessageRecovery` 契约(输入 / 输出 / 错误处理 / 调用方约束)
- `streaming-dispatch-decision-table/spec.md` — batch / urgent / first-token 三种派发通道的判定矩阵
- `runtime-perf-evidence-classification/spec.md` — `proxy` / `synthetic` / `measured` 三档分类,以及 PR check 升级规则

## Capabilities

### New Capabilities

- `codex-message-recovery-hook` — 抽出 stale thread binding recovery 子 hook
- `streaming-dispatch-decision-table` — 沉淀 batch / urgent / first-token 决策矩阵
- `runtime-perf-evidence-classification` — proxy → measured 升级规则

### Modified Capabilities

- `runtime-performance-evidence-gates` — `proxyRatio` 字段 + `warn` 启动机制
- `codex-stale-thread-binding-recovery` — 关联 `useCodexMessageRecovery` 抽象

## Impact

- `useThreadMessaging` 调用方:签名不变,4 个调用方零改动。blast radius:低。
- 流式派发:仅在 `flush.reason === "first-token"` 时新增 reasoning 急派分支,稳态不变。blast radius:中。
- 性能门禁 `warn` 升级:PR check 接入,无 perf fixture 的 PR 给 `no-perf-required` label 走旁路。blast radius:中。

## 验证

- `npm run typecheck`
- `npm run lint`
- `npm exec vitest run src/features/threads/hooks/useThreadMessaging.test.tsx src/features/threads/hooks/useCodexMessageRecovery.test.tsx src/features/threads/hooks/useThreadItemEvents.first-token-reasoning-delta.test.ts`
- `npm run perf:baseline:all`
- `npm run perf:archive-readiness -- --json`(`ok=true, status=warn, hardFailures=[]`,`proxyRatio` 与 `warnings` 写入 report)
- `openspec validate refactor-v0511-thread-messaging-recovery-and-streaming --strict --no-interactive`

## 风险与不做的事

- **不做** 把 `useThreadMessaging` 全量拆完。本轮只拆「recovery」一段;`sendMessage` 主流程等下一轮观察后再拆。
- **不做** 改变 batch / urgent 调度顺序的语义,只新增 first-token reasoning 急派分支。
- **不做** 未证明的 measured 补数、大文件 wave3、cookbook 文档;这些已经拆入 follow-up change。
- **风险**:PR check 接入 `perf:archive-readiness` 后,无 perf fixture 的 PR 会被误判。本轮以 `warn` 形态启动,`no-perf-required` label 旁路。
