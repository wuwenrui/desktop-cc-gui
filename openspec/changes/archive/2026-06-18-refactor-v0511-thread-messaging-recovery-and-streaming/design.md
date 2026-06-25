# Design: v0.5.11 — Thread Messaging 恢复路径抽离 + 流式急派扩展 + 性能证据从 proxy 升 measured

## 模块 1:useCodexMessageRecovery

### 上下文

`useThreadMessaging` 当前 2463 行,周围已拆出 26 个 reducer/controller 子文件,但「stale thread binding recovery / fresh continuation / fork」段(行号 ~1020-1137,~250 行)仍耦合在主 hook。后续 Gemini / Claude 接入同款 liveness 需要复用这段逻辑,抽离是必要前提。

### 接口设计

```typescript
// src/features/threads/hooks/useCodexMessageRecovery.ts
export interface CodexMessageRecoveryAttemptDeps {
  threadId: string;
  workspace: Workspace;
  reboundThreadId: string | null;
  acceptedTurnResolution: AcceptedTurnResolution;
  staleRecoveryClassification: StaleRecoveryClassification | null;
  optimisticUserItem: OptimisticUserItem | null;
  moveOptimisticUserIntentToThread: (newThreadId: string) => void;
  retrySendOnThread: (threadId: string) => Promise<void>;
  startThreadForMessageSend: (
    workspace: Workspace,
    provider: "codex",
  ) => Promise<string | null>;
  forkThreadForWorkspace: (
    workspaceId: string,
    threadId: string,
    options: { activate: boolean },
  ) => Promise<string | null>;
  dispatch: (action: MessagingAction) => void;
  onDebug?: (event: ClientDebugEvent) => void;
  errorMessage: string;
  refreshErrorMessage?: string | null;
}

export interface CodexMessageRecoveryResult {
  createRecoveryAttempt: (
    deps: CodexMessageRecoveryAttemptDeps,
  ) => CodexMessageRecoveryAttempt;
}

export interface CodexMessageRecoveryAttempt {
  tryFreshDraftReplacement: (fallbackReason: string | null) => Promise<boolean>;
  tryForkFromMessage: (reason: string | null) => Promise<boolean>;
  canUseFreshDraftReplacement: boolean;
  isUnverifiedSameThreadMissingRebind: boolean;
}

export function useCodexMessageRecovery(): CodexMessageRecoveryResult;
```

### 决策矩阵

| 错误类型 | optimisticUserItem 存在 | canUseLocalFirstSendCodexDraftReplacement | canUseFreshDraftReplacement |
|---|---|---|---|
| `isInvalidReviewThreadIdError` | 是 | 是 | **是** |
| `isInvalidReviewThreadIdError` | 否 | 是 | 否 |
| `isCodexMissingThreadBindingError` | 是 | 是 | **是** |
| `isCodexMissingThreadBindingError` | 否 | 是 | 否 |
| 其它错误 | — | — | 否 |

### 主 hook 改造点

`useThreadMessaging.ts` 行号 1020-1137 的 ~110 行恢复段替换为:

```typescript
const { createRecoveryAttempt } = useCodexMessageRecovery();
const recoveryAttempt = createRecoveryAttempt({ /* per-send deps */ });

// 替换 if (!reboundThreadId || isUnverifiedSameThreadMissingRebind) { ... } 段:
if (!reboundThreadId || recoveryAttempt.isUnverifiedSameThreadMissingRebind) {
  if (await recoveryAttempt.tryFreshDraftReplacement(
    refreshErrorMessage ? `refresh failed: ${refreshErrorMessage}` : null,
  )) {
    return true;
  }
  if (await recoveryAttempt.tryForkFromMessage(refreshErrorMessage)) {
    return true;
  }
  return false;
}
```

`useCodexMessageRecovery` 必须在 `useThreadMessaging` 顶层调用;单次发送的动态依赖通过 `createRecoveryAttempt(...)` 创建普通 attempt 对象,避免在 async callback 内违反 React Rules of Hooks。

## 模块 2:流式派发决策表

### 当前状态(`useThreadItemEvents.ts:209-224`)

| 谓词 | 行号 | 判定 | 走哪条通道 |
|---|---|---|---|
| `shouldBatchNormalizedRealtimeEvent` | 209 | 5 种 operation 任一 | batch(aggregator) |
| `shouldUseContractRealtimeBatcher` | 219 | `appendAgentMessageDelta` | batch(contract) |
| `shouldDispatchNormalizedRealtimeEventUrgently` | 223 | `appendAgentMessageDelta` | urgent dispatch(no transition) |

### 新增谓词

```typescript
// 行 225 附近新增
function shouldUrgentlyDispatchReasoningDelta(
  event: NormalizedThreadEvent,
  flushReason: FlushReason,
): boolean {
  return (
    event.operation === "appendReasoningContentDelta" &&
    flushReason === "first-token"
  );
}
```

### 决策矩阵

| operation | flushReason | 通道 | 备注 |
|---|---|---|---|
| `appendAgentMessageDelta` | 任意 | **urgent**(no transition) | 已有 |
| `appendReasoningContentDelta` | `first-token` | **urgent**(no transition) | 本轮新增 |
| `appendReasoningContentDelta` | 其它 | batch | 稳态聚合 |
| `appendReasoningSummaryDelta` | 任意 | batch | 稳态聚合 |
| `appendToolOutputDelta` | 任意 | batch | 稳态聚合 |
| `itemStarted` / `itemUpdated` | 任意 | batch | 状态聚合 |

## 模块 3:性能证据 proxy → measured

### 当前数据(代码实测)

`docs/perf/v0511-runtime-evidence.json`:`4 measured / 17 proxy = 19% measured`。

### 升级路径

1. `scripts/perf-v0511-runtime-evidence.ts` 增加 `evidenceClassUpgrade` 模式:
   - 输入:开发机真实跑分 artifact(`.artifacts/realtime-runtime-diagnostics.json` 等)
   - 输出:把 `proxy` metric 重写为 `measured` 形态(同一字段名 / 同一 unit / 不同 `evidenceClass` 标记)
2. 接入 4 个真实跑分源:
   - `realtime.turnTrace.summary.reducerCommitCount/deltaCount` — 已有 measured
   - `realtime.turnTrace.summary.batchFlushEndToReducerCommitMs` — 已有 measured
   - `realtime.turnTrace.summary.realtimeDeltaRouteDurationAvgMs` — 已有 measured
   - 本 change 只升级可从现有 runtime diagnostics 严谨证明的 measured rows;剩余 producer 进入 `follow-up-v0511-large-file-cookbook-and-measured-evidence`
3. `proxyRatio` 字段计算与本轮 gate 语义:
   ```typescript
   const proxyRatio = proxy / (proxy + measured + synthetic);
   if (proxyRatio > 0.5) {
     warnings.push({ code: "proxy-ratio-too-high", ratio: proxyRatio });
   }
   ```
   本轮 `v0.5.11` 只做 warn soft-launch,不得把 `proxy-ratio-too-high` 写入 `hardFailures`;后续版本如要升 hard,必须另开 change 更新 gate contract 与 CI 行为。

### PR check 接入(warn 软启动)

```yaml
# .github/workflows/perf-archive-readiness.yml
name: perf-archive-readiness
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  readiness:
    runs-on: ubuntu-latest
    continue-on-error: true  # 本迭代 warn 软启动
    if: ${{ !contains(github.event.pull_request.labels.*.name, 'no-perf-required') }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run perf:archive-readiness -- --json > readiness.json
      - uses: actions/github-script@v7
        with:
          script: |
            const r = require('./readiness.json');
            const ratio = (r.proxyRatio * 100).toFixed(1);
            const body = `perf-archive-readiness: ${r.ok ? 'pass' : 'warn'} proxyRatio=${ratio}% warnings=${r.warnings?.length ?? 0} hardFailures=${r.hardFailures.length}`;
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body
            });
```

## 模块 4:Follow-up 拆分边界

本 change 收口后,以下任务不继续落在同一 commit:

- large-file wave3:`src/services/tauri.ts` session / permission / appServer 拆分,以及 `FileTreePanel.tsx` view-state / refresh-controls 拆分。
- Codex recovery cookbook:`staleRecoveryClassification.reasonCode` / `staleReason` / `userAction` 字段语义和 GEMINI / CLAUDE 接入模板。
- measured evidence producer:剩余 proxy rows 需要新增真实 runtime producer 才能升级,不能在本 change 里伪装成 measured。

这些任务已进入 `follow-up-v0511-large-file-cookbook-and-measured-evidence`,避免本 change 的 hook / streaming / perf gate 收口被大范围重构拖住。
