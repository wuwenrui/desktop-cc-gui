## MODIFIED Requirements

### Requirement: User Input Response Roundtrip

系统 MUST 将用户输入结果通过标准响应通道回传给服务端，并在提交后使线程生命周期进入可恢复、可结算状态，而不是留下不可恢复的伪 processing。

#### Scenario: stale timeout or cancel settlement removes pending request

- **WHEN** 用户提交空答案、跳过或 dismiss 一个 `AskUserQuestion` / `RequestUserInput` 卡片
- **AND** runtime response 表明该 request 已 unknown、timeout-settled、cancelled 或 workspace disconnected
- **THEN** 客户端 MUST 从本地 pending queue 移除该 request
- **AND** 客户端 MUST 清理该线程的 optimistic processing residue
- **AND** 客户端 MUST NOT 将该 stale settlement 当作 fatal submit failure 展示给用户

#### Scenario: non-stale submit failure remains retryable

- **WHEN** 用户提交 `AskUserQuestion` / `RequestUserInput` 响应
- **AND** response channel 失败但不符合 stale timeout/cancel settlement 条件
- **THEN** 客户端 MUST 保留 pending request
- **AND** 用户 MUST 能重试提交
