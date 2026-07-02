## ADDED Requirements

### Requirement: Busy state MUST terminate in bounded time after stream death

对任何引擎，回合已产出助手正文后若上游流中断（无终止事件、无新进展），前端 MUST 在有界时间内自行收尾忙碌态，不得无限显示"正在生成响应"。

#### Scenario: codex suspicion escalates to settlement

- **GIVEN** codex 回合已流出助手正文，随后进入无进展怀疑态
- **WHEN** 怀疑态持续 120 秒仍无任何进展
- **THEN** 系统 MUST 触发前端最终收尾（关闭忙碌态、结算回合），并发出 `codex-no-progress-forced-settlement` 诊断
- **AND** 怀疑期间有新进展到达时 MUST 取消升级并恢复正常监听

#### Scenario: claude stale execution item does not defer forever

- **GIVEN** claude 回合存在未完成的执行项（如 commandExecution）且流已静默
- **WHEN** 最新执行项开始后超过 10 分钟仍无任何流量
- **THEN** 静默看门狗 MUST 停止改期并执行收尾
- **AND** 执行项仍新鲜（未超龄）时 MUST 继续改期，不得提前打断长时工具
