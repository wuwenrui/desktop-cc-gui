# Settle Stalled Turn Busy State

## Why

v0.6.5 用户仍复现"正在生成响应"无限转圈（12 分钟以上）。既有三层防御只覆盖 claude 无执行项路径，仍有两个死角：
1. codex 无进展看门狗（10/20 分钟）触发后只标记怀疑、发横幅与诊断，**没有任何收尾升级路径**，流中断后忙碌态永不落地。
2. claude 静默看门狗遇到活跃执行项（如 commandExecution）一律无限改期；流在工具运行中中断时执行项永不完成，看门狗永远等待。

## What Changes

- codex：怀疑无进展后再等 `CODEX_NO_PROGRESS_FORCE_SETTLEMENT_MS`（120s）仍无进展、且回合已有助手正文，则强制走 `applyAssistantFinalSettlementFallback` 收尾；进展恢复即取消升级；被 collab 阻塞项挡住时保留重试。
- claude：静默看门狗对活跃执行项加 `TURN_INGRESS_EXECUTION_STALE_CEILING_MS`（10 分钟）僵尸上限，最新执行项超龄仍无流量则不再改期、转入收尾。
- 无助手正文的死回合不代为收尾（避免造出空回合），维持横幅供用户手动中断。

## Impact

- Frontend only: `src/features/threads/hooks/useThreadEventHandlers.ts`、`threadEventDiagnostics.ts`。
- No DB/backend changes.
