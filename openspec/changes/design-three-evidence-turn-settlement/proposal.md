# design-three-evidence-turn-settlement Proposal

## 背景

用户多次遇到“模型输出已经结束，但客户端仍显示生成中”的偶发问题。该问题横跨 `Claude`、`Codex`，未来也可能影响 `Gemini`、`OpenCode`。表面看是 UI spinner 没停，本质是 conversation lifecycle 缺少一个可靠的 turn settlement contract。

典型表现：

- engine/backend 已经完成一次 turn。
- assistant 最终内容可能已经进入 history 或渲染到页面。
- 前端仍保留 `isProcessing`、`activeTurnId`、blocking marker 或 spinner。
- 用户需要重启客户端、重新加载会话，才能看到后续状态恢复。

前置 change `observe-foreground-turn-settlement-gaps` 与 `persist-client-error-log` 已补上基础观测：现在可以看到 terminal event 是否到达、settlement 是否 rejected、是否存在 busy residue、最近是否仍有 progress evidence。下一步需要把“如何基于这些证据结算 turn，以及缺失 terminal event 时如何校准事实”固化为顶层设计，避免继续做 engine-specific 补丁。

## 要解决的问题

本 change 解决的是 **turn settlement 事实判定与恢复模型缺失**，不是单个 provider 的 loading bug。

它覆盖两类故障：

1. **terminal evidence 已到，但前端没有清 busy state**
   - 例如 completed/error/runtime-ended 已经到达前端。
   - 但 guard、turn alias、active state、foreground ownership 或 runtime lease 不匹配，导致状态未结算。
   - 目标修复：通过统一三证仲裁识别 `busy-residue`，在安全边界内清理匹配 turn 的 residue。

2. **backend/runtime 已结束，但前端没有收到 terminal evidence**
   - 例如网络抖动、stream 断开、event delivery 丢失、前端切换 foreground、runtime reconnect 后错过 terminal。
   - 前端不能凭 timeout 猜 completed。
   - 目标修复：进入 reconciliation，向 backend/runtime 查询 authoritative turn status 或请求 replay missed terminal event，再把确认结果升级为 Terminal Evidence。

## 目标

- 设计统一的 **Three-Evidence Turn Settlement** contract，作为所有引擎共享的 conversation lifecycle 顶层逻辑。
- 明确定义三类证据：
  - **Terminal Evidence**：backend/engine/runtime/user action 给出的权威终态。
  - **State Evidence**：前端 lifecycle state 是否仍保留 `isProcessing`、`activeTurnId`、blocker residue、foreground ownership。
  - **Progress Evidence**：近期是否仍存在 heartbeat、tool、file、approval、user-input、token usage、stream delta、runtime active 等非文本进展。
- 明确职责边界：
  - 前端 lifecycle coordinator 发起三证仲裁，因为卡住的是前端 UI state。
  - engine adapter/runtime bridge 提供 normalized evidence。
  - backend/runtime 提供可查询、可重放、可关联的 authoritative status。
- 规定会话隔离边界：所有参与结算的 evidence 必须绑定到同一 workspace/thread/engine/runtime lease/turn scope。
- 规定 recovery 边界：没有 Terminal Evidence 时，不能清成 completed；只能进入 suspected/degraded/reconciliation。
- 采用 staged rollout：先 dry-run observer，再 guarded residue cleanup，再 stale-progress reconciliation query，最后再考虑收敛正常主链路。

## 非目标

- 本 change 不实现业务代码。
- 不立即替换现有正常 completion 主链路。
- 不引入 timeout 强清 stuck turn。
- 不要求 engine 私有事件协议一次性重写。
- 不把完整 prompt、assistant output、tool output、stdout/stderr 正文作为 settlement evidence。
- 不改变已有 interrupt、stop、retry 的用户语义。
- 不把 history 中存在最终内容当作 completed 证据；它只能辅助诊断。

## 为什么这是顶层逻辑

“生成中残留”不是单个 provider 的表现问题，而是 lifecycle settlement 的一致性问题。只在 Codex 或 Claude hook 内修会继续产生以下问题：

- 同类状态在不同引擎被不同规则结算，回归难以复现。
- timeout 被误用为终态证据，容易误伤长任务。
- terminal event 已到达但 guard 拦截时，缺少统一解释和回退策略。
- terminal event 丢失时，没有 authoritative reconciliation，只能靠重启客户端恢复。
- 未来新增引擎时没有统一 adapter contract，只能继续堆补丁。

## 成功标准

- OpenSpec 中存在可检索的三证结算顶层 contract。
- 设计明确 realtime event delivery 与 lifecycle state reconciliation 的分层。
- 设计明确三证模型、会话隔离、pure decision helper、reconciliation source、rollout、回滚和测试矩阵。
- 后续实现者能够基于该提案拆分为 pure helper、dry-run diagnostics、backend status query、missed terminal replay、cross-engine parity tests、guarded cleanup 六类任务。
