# design-three-evidence-turn-settlement Design

## 设计摘要

Three-Evidence Turn Settlement 是 conversation lifecycle 层的 settlement safety layer，不属于某个 engine hook。它解决的问题是：前端如何可靠判断一次 turn 是否可以离开 `generating` / `pseudo-processing` / busy 状态。

设计必须同时处理两条链路：

1. **Realtime event delivery**：terminal/progress event 正常到达时，前端快速更新 UI。
2. **Lifecycle state reconciliation**：event 丢失、乱序、被 guard 拦截或 foreground 切换后，前端通过 authoritative status 校准事实。

核心原则：事件路径负责快，reconciliation 路径负责可恢复事实；前端负责仲裁，backend/runtime 负责权威状态。

## 职责边界

| 层 | 职责 | 禁止做什么 |
| --- | --- | --- |
| Frontend lifecycle coordinator | 发起三证仲裁，读取当前 UI busy state，执行 dry-run diagnostics，按 rollout policy 做 guarded cleanup | 不能凭 timeout 或 history content 猜 completed |
| Engine adapter/runtime bridge | 把 Claude/Codex/Gemini/OpenCode 的 terminal/progress signal 归一化为 evidence | 不能绕过 lifecycle state 自己清 UI busy |
| Backend/runtime | 提供 authoritative turn status、runtime lease status、missed terminal replay 或 session summary | 不能返回缺少 scope 的“全局 completed” |
| Debug/error-log | 记录 bounded decision、scope match、residue、reconciliation outcome | 不能保存完整 prompt/output/tool/stdout/stderr/file diff/secrets |

## 三证模型

| 证据 | 来源 | 作用 | 不能做什么 |
| --- | --- | --- | --- |
| Terminal Evidence | `turn/completed`、`turn/error`、`turn/stalled`、`runtime/ended`、user stop/interruption、backend status confirmed completed/error/runtime-ended、missed terminal replay | 提供权威终态候选 | 不能绕过 scope gate 清错 turn |
| State Evidence | `isProcessing`、`activeTurnId`、pending blockers、alias resolution、foreground/background ownership、active runtime lease | 判断是否需要 settlement，以及是否有 busy residue | 不能单独证明 runtime 已结束 |
| Progress Evidence | heartbeat、status-active、tool/file/approval/user-input、token usage、stream delta、runtime active、non-text activity | 防误伤长任务，解释 no-progress suspicion | 不能单独把 turn 标记 terminal |

## 决策原则

1. **Terminal-first**：自动 completed settlement 必须有 Terminal Evidence 或用户显式终止动作；timeout/no-progress 只能进入 suspected、degraded 或 reconciliation。
2. **State-aware**：settlement 只清理匹配 turn 的 lifecycle residue，不动 message content、history、runtime output。
3. **Progress-protected**：fresh Progress Evidence 优先保护长任务；tool、approval、user-input、file activity 都算 progress。
4. **Session-isolated**：所有 evidence 必须绑定到同一 conversation scope；缺失 scope、跨 thread、跨 engine、旧 runtime lease、旧 turn 的 evidence 只能进入 diagnostic，不得结算当前 UI。
5. **Reconciliation-backed**：前端没有收到 terminal evidence 且 progress stale 时，必须向 authoritative backend/runtime 查询或请求 replay，不能本地猜 completed。
6. **Pure-decision-first**：先用 pure decision helper 产出 decision，再由 caller 根据 rollout phase 执行副作用。
7. **Content-safe**：所有 evidence 只保留 ids、counts、booleans、timestamps、bounded reason、status enum，不保存完整正文。

## 方案比较

| 方案 | 做法 | 优点 | 风险 | 结论 |
| --- | --- | --- | --- | --- |
| A. Engine-specific patch | 在 Codex/Claude 各自 hook 里继续补 if/else | 快，局部风险小 | 规则分裂，未来继续遗忘上下文 | 不选 |
| B. Timeout 强清 | 超过固定时间就清 `isProcessing` | 症状缓解明显 | 高概率误伤长任务，把 silence 当 completed | 不选 |
| C. Three-evidence safety layer | lifecycle 层统一评估 terminal/state/progress，并用 reconciliation 校准缺失 event | 可解释、跨引擎、可 dry-run、可回滚 | 初期要补 adapter parity、backend status query、诊断 | 采用 |

## 统一证据模型

后续实现可以引入类似结构，不要求本 change 立即落代码：

```ts
type EngineId = "claude" | "codex" | "gemini" | "opencode";

type TerminalKind =
  | "completed"
  | "error"
  | "stalled"
  | "runtime-ended"
  | "user-stop"
  | "status-confirmed-completed"
  | "status-confirmed-error"
  | "replayed-terminal";

type TurnSettlementEvidence = {
  workspaceId: string;
  engine: EngineId;
  threadId: string;
  turnId: string | null;
  runtimeSessionId: string | null;
  runtimeLeaseId: string | null;
  source: "event" | "status-query" | "terminal-replay" | "user-action";
  scope: {
    foreground: boolean;
    currentWorkspaceId: string;
    currentEngine: EngineId;
    currentThreadId: string;
    currentTurnId: string | null;
    currentRuntimeLeaseId: string | null;
  };
  terminal: {
    kind: TerminalKind | null;
    sourceMethod: string | null;
    receivedAtMs: number | null;
    finalContentPresent?: boolean;
  };
  state: {
    isProcessing: boolean;
    activeTurnId: string | null;
    aliasTurnId: string | null;
    blockers: string[];
  };
  progress: {
    lastSource: string | null;
    lastAtMs: number | null;
    ageMs: number | null;
    sequence: number;
    fresh: boolean;
  };
  reconciliation?: {
    attempted: boolean;
    status: "not-needed" | "completed" | "running" | "failed" | "unknown" | "query-failed";
    replayRequested: boolean;
  };
};
```

## Pure Decision Helper Contract

后续实现应先落一个纯函数 decision helper，再接入任何 UI/store 副作用。它的职责是“给定 evidence、policy、nowMs，产出可解释 decision”，不是直接修改 conversation state。

建议接口形态：

```ts
type TurnSettlementAction =
  | "settle"
  | "reject"
  | "defer"
  | "keep-running"
  | "request-reconciliation"
  | "cleanup-residue";

type TurnSettlementPolicy = {
  progressFreshWindowMs: number;
  allowRuntimeEndedDegradedSettlement: boolean;
  allowBusyResidueCleanup: boolean;
  allowStatusQueryReconciliation: boolean;
};

type TurnSettlementDecision = {
  action: TurnSettlementAction;
  reason:
    | "matched-terminal"
    | "scope-mismatch"
    | "stale-turn"
    | "stale-runtime-lease"
    | "missing-terminal"
    | "progress-protected"
    | "busy-residue"
    | "runtime-ended-degraded"
    | "missing-scope"
    | "needs-authoritative-status"
    | "status-confirmed-running"
    | "status-unknown";
  scopeMatch: {
    matched: boolean;
    workspace: boolean;
    engine: boolean;
    thread: boolean;
    turn: boolean;
    runtimeLease: boolean | null;
    foregroundOwner: boolean;
  };
  acceptedEvidence: {
    terminal: boolean;
    state: boolean;
    progress: boolean;
    reconciliation: boolean;
  };
  diagnostics: {
    boundedReason: string;
    staleEvidence?: boolean;
    missingScope?: string[];
    residue?: boolean;
    reconciliationAttempted?: boolean;
  };
};

declare function evaluateTurnSettlement(
  evidence: TurnSettlementEvidence,
  policy: TurnSettlementPolicy,
  nowMs: number,
): TurnSettlementDecision;
```

硬约束：

- helper 必须是 pure function，不读写 React store、Zustand/Jotai state、DOM、Tauri command、backend API 或 runtime singleton。
- helper 不得读取 wall clock；`nowMs` 必须由 caller 传入，保证 replay test 和乱序事件测试可复现。
- helper 不得直接清理 `isProcessing`、`activeTurnId`、runtime lease、debug entry 或 error-log。
- helper 必须先执行 scope gate，再执行 terminal/state/progress arbitration，最后才判断是否需要 reconciliation。
- scope gate 失败时只允许返回 `reject`、`defer` 或 diagnostic-only 等价 action。
- helper 的输出必须足够让 caller 记录 dry-run diagnostics，也足够让 Phase 2 caller 在 guarded path 中执行实际 settlement。
- helper 不得包含 engine-specific 分支；引擎差异必须在 evidence normalization 层消化。

## 会话隔离模型

Settlement coordinator 必须先做 scope gate，再做三证仲裁。scope gate 的目标是证明“这批 evidence 描述的是当前要结算的同一个 turn”，而不是证明“系统里某个 turn 结束了”。

最小隔离键：

- `workspaceId`
- `engine`
- `threadId`
- `turnId` 或 verified alias
- `runtimeSessionId` 或 `runtimeLeaseId`
- foreground/background ownership

处理规则：

- 缺失 `workspaceId`、`engine`、`threadId` 的 evidence 只能用于 diagnostic。
- 缺失 `turnId` 但带有 verified runtime lease 的 terminal evidence 可以进入 degraded/runtime-ended 分支；不能直接标记 completed。
- `turnId` 匹配但 `runtimeLeaseId` 已不是当前 active lease 时，必须按 stale lease reject/defer。
- foreground 切换后，旧 foreground 的 terminal evidence 不得清理新 foreground 的 active state。
- 同一 thread 连续多轮时，旧 turn 的 terminal/progress evidence 不得影响新 turn，除非 explicit replay/history repair 路径声明正在回放历史。
- lifecycle arbitration 不得用“最近 active foreground turn”填补缺失 scope。

## Reconciliation Source

当 frontend lifecycle coordinator 没有 Terminal Evidence，但 State Evidence 仍 busy 且 Progress Evidence stale 时，系统进入 reconciliation，而不是 completed settlement。

允许的 authoritative source：

- backend `getTurnStatus(workspaceId, engine, threadId, turnId, runtimeLeaseId)` 等价接口。
- runtime lease status summary，能回答 active/running/ended/failed/unknown。
- missed terminal replay，能按 scope 重放 completed/error/stalled/runtime-ended event。
- bounded session summary，能证明同一 scoped turn 已进入 terminal state。

状态解释：

| Backend/runtime status | 前端 decision |
| --- | --- |
| `completed` / `error` with matching scope | 升级为 Terminal Evidence，再重新走三证仲裁 |
| `running` / active lease | `keep-running`，不得清 UI busy |
| `failed` with matching scope | 升级为 Terminal Evidence `error` 或 `stalled` |
| `unknown` / `query-failed` | `defer` 或 degraded/reconnect，不得标 completed |
| replay returned scoped terminal | 升级为 Terminal Evidence `replayed-terminal` |
| replay returned unscoped terminal | diagnostic-only，不得清当前 UI |

reconciliation 也必须 content-safe：只返回 scoped ids、status enum、timestamps、bounded reason，不返回完整 prompt/output/tool/stdout/stderr。

## 决策矩阵

| Terminal | State | Progress | Reconciliation | 决策 |
| --- | --- | --- | --- | --- |
| scope 缺失或跨会话 | 任意 | 任意 | 任意 | diagnostic-only；不得结算当前 UI |
| same thread old turn/old lease | busy | 任意 | 任意 | reject/defer as stale evidence；不得清理新 turn |
| matched completed/error/stalled | active turn 匹配 | 任意 | not needed | settle，或记录正常路径一致性 |
| matched terminal | settlement 后仍 busy | stale or absent | not needed | 记录 `busy-residue`；Phase 2b 可 guarded cleanup |
| terminal 到达但 turn/thread 不匹配 | busy | 任意 | 任意 | reject，记录 identity mismatch；不得清状态 |
| 无 terminal | busy | progress fresh | not needed | keep-running；记录 progress-protected |
| 无 terminal | busy | progress stale | not attempted | request-reconciliation；不得 completed |
| 无 terminal | busy | progress stale | status running | keep-running；不得清 UI busy |
| 无 terminal | busy | progress stale | status completed/error with matching scope | 升级为 Terminal Evidence 后重新仲裁 |
| 无 terminal | busy | progress stale | status unknown/query failed | defer/degraded/reconnect；不得 completed |
| runtime-ended | active lease confirmed ended 且 turn identity 可绑定 | stale or absent | optional | settle as runtime-ended/degraded |
| runtime-ended | backend 表示仍有 active lease 或不可绑定 | unknown | 任意 | defer/reject，保留诊断 |

## Rollout

### Phase 1: Dry-run observer

- 建立 settlement coordinator 的 pure decision helper。
- 对 terminal settlement attempt、busy residue、suspected stuck turn 生成 decision。
- 在 dry-run 记录中映射为 `wouldSettle`、`wouldReject`、`wouldDefer`、`wouldKeepRunning`、`wouldRequestReconciliation`、`wouldCleanupResidue`。
- 不改变现有 lifecycle state，不阻断正常 completion 主链路。
- 用现有 `~/.ccgui/error-log` 和 DebugEntry 记录 core rejected、residue、scope mismatch、reconciliation-needed。

### Phase 2a: Normal settlement guard observer

- 正常 terminal handler 继续按原有路径 append message、更新 history、结束 streaming。
- 三证 helper 在旁路观察正常 settlement，与现有路径做一致性校验。
- helper 不作为所有正常 completion 的唯一入口，不阻断、不替换正常结束。
- 若发现正常路径与三证 decision 不一致，只记录 bounded diagnostic。

### Phase 2b: Guarded busy-residue cleanup

- 只处理异常残留路径：terminal evidence 已到或 status query confirmed terminal，但 State Evidence 仍 busy。
- 必须满足 scope gate 全通过、active turn/alias 匹配、runtime lease/session 非 stale、没有 fresh progress 反证。
- cleanup 只清匹配 turn 的 `isProcessing`、`activeTurnId`、blocking marker residue。
- cleanup 不动 message content、history、runtime output、tool output、file diff、approval state。
- 必须 behind feature flag 或 kill switch；关闭后恢复 Phase 1 dry-run + 原有正常路径。

### Phase 2c: Stale-progress reconciliation query

- 当前端没有 Terminal Evidence、State Evidence busy、Progress Evidence stale 时，只能请求 authoritative status 或 missed terminal replay。
- backend/runtime 确认 completed/error/runtime-ended 后，结果升级为 Terminal Evidence，再重新走 helper。
- backend/runtime 返回 running 时保持 loading。
- backend/runtime unknown/query failed 时进入 degraded/reconnect，不得 completed。
- reconciliation request 必须带完整 scope，不得查询或应用全局最近 turn。

### Phase 3: Cross-engine parity and consolidation

- Claude/Codex/Gemini/OpenCode 都通过 adapter 输出统一 evidence。
- 增加 replay/parity tests，确保同一 evidence matrix 在不同引擎下得到一致 decision。
- 只有当 dry-run 和 guarded cleanup 数据证明稳定后，才考虑把 scattered settlement guard 收敛到统一 coordinator。

## 影响范围

- `conversation-lifecycle-contract`：新增三证结算、会话隔离、reconciliation、pure helper 顶层 contract。
- `engine-runtime-contract`：要求所有 engine adapter/runtime surface 提供可归一化 terminal/progress evidence，以及 authoritative status/replay surface。
- `conversation-realtime-client-performance`：diagnostics 必须区分 event delivery failure、settlement guard rejection、busy residue、provider delay、runtime still active、long-task protection、reconciliation outcome。
- 前端 hooks：未来应把 scattered settlement guard 逐步收敛到 coordinator，但不能第一阶段替换正常主链路。
- Rust/app-server/runtime：未来应提供 runtime-ended、active lease、turn status、missed terminal replay 的可关联摘要。
- Debug/error-log：继续作为 dry-run 与事故复盘证据出口。

## 测试矩阵

- terminal 到达，scope 匹配，state 正常清理。
- terminal 到达，scope 匹配，但 state 仍 busy residue。
- terminal 到达，但 turn/thread/engine/workspace 不匹配。
- no terminal、progress fresh 的长 tool call。
- no terminal、progress stale、backend status completed。
- no terminal、progress stale、backend status running。
- no terminal、progress stale、backend status unknown/query failed。
- missed terminal replay 返回 scoped terminal。
- missed terminal replay 返回 unscoped/stale terminal。
- A/B 会话并行，A completed 不结束 B。
- foreground 切换后，旧 foreground terminal 不清新 foreground。
- same thread old turn completed 晚到，不清新 turn。
- runtime reconnect 后，old lease terminal 不清 new lease。
- user stop/interruption 作为 terminal evidence，但仍需 scope gate。

## 风险与缓解

- **误伤正常长任务**：Progress Evidence 新鲜时 keep-running；无 terminal 不 completed。
- **误伤其他会话**：scope gate 在三证仲裁前执行；跨会话、旧 lease、旧 turn 事件只记录 rejected/deferred diagnostic。
- **影响正常结束主链路**：Phase 2a 只旁路观察，不阻断、不替换；Phase 2b 只处理异常 residue。
- **backend status 不可靠**：status/replay 必须 scope 完整；unknown/query failed 不得 completed。
- **复杂度上升**：先实现 pure decision helper、dry-run diagnostics、parity tests，再接状态写入。
- **诊断噪音**：只记录 terminal attempt、rejected、deferred、busy residue、scope mismatch、reconciliation-needed/outcome，不记录每个普通 event。

## 回滚

- Phase 1 回滚只移除 dry-run coordinator 与 diagnostics，不影响主流程。
- Phase 2b/2c 必须有 feature flag 或 kill switch。关闭后恢复现有正常路径 + Phase 1 dry-run observer。
- 若 backend status/replay surface 出现不可信结果，禁用 reconciliation application，只保留 query diagnostic。
