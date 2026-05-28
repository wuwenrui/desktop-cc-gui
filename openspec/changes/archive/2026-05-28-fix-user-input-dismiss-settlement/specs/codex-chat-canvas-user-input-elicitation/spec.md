## MODIFIED Requirements

### Requirement: User Input Question Card Presentation MUST Be Shared Across AskUserQuestion And RequestUserInput

系统 MUST 对 Claude `AskUserQuestion` 与 Codex `RequestUserInput` 使用一致的用户提问卡片交互语义，避免两个引擎在多问题、关闭、宽度与时间线位置上产生 UI 漂移。

#### Scenario: live request card uses dedicated form width instead of chat bubble width

- **WHEN** 系统渲染待回答的 `RequestUserInput` / `AskUserQuestion` 卡片
- **THEN** 卡片 MUST 使用专用问答卡片样式
- **AND** 卡片 MUST NOT 依赖普通聊天 `.bubble` 的 `max-width` 约束
- **AND** 普通聊天气泡的宽度规则 MUST NOT 因问答卡片变更而扩大

#### Scenario: multi-question card displays one active question tab at a time

- **WHEN** request payload 包含多个 `questions`
- **THEN** 卡片 MUST 渲染 tab 列表
- **AND** 每次 MUST 只显示当前 active tab 对应的问题正文、选项和输入区
- **AND** 切换 tab MUST 保留其它问题已填写的 draft 状态

#### Scenario: multi-question card submits only from final tab

- **WHEN** request payload 包含多个 `questions`
- **AND** 当前 active tab 不是最后一个问题
- **THEN** 主按钮 MUST 显示 `Next` / `下一步`
- **AND** 点击主按钮 MUST 切换到下一个 tab
- **AND** 系统 MUST NOT 调用提交响应

- **WHEN** 当前 active tab 是最后一个问题
- **THEN** 主按钮 MUST 显示 `Submit` / `提交`
- **AND** 点击主按钮 MUST 使用标准 `{ answers: Record<string, { answers: string[] }> }` 响应契约提交所有问题答案

#### Scenario: pending question card separates collapse from skip settlement

- **WHEN** 待回答卡片可见
- **THEN** 卡片 header MUST 提供收起按钮
- **AND** 收起操作 MUST 将完整卡片折叠为 compact actionable surface
- **AND** 收起操作 MUST NOT 调用 runtime response channel
- **AND** collapsed surface MUST 提供展开与 skip/dismiss settlement 入口
- **AND** action 区 MUST 提供明确的 skip/dismiss settlement 按钮
- **AND** skip/dismiss settlement 操作 MUST 使用标准响应通道提交空 answers
- **AND** 成功 settlement 后 MUST 从本地可见队列移除该卡片
- **AND** skip/dismiss settlement 操作 MUST NOT 构造带用户选择内容的正常答案提交

#### Scenario: timeout settlement failure remains retryable

- **WHEN** 待回答卡片 timeout 后触发自动 skip/dismiss settlement
- **AND** runtime 返回非 stale/unknown/disconnected 的失败
- **THEN** 客户端 MUST 保留或恢复可见请求 surface
- **AND** 客户端 MUST 显示可重试错误
- **AND** 客户端 MUST NOT 产生 unhandled async rejection

#### Scenario: stale pending question card skip removes local residue

- **WHEN** 用户跳过待回答卡片
- **AND** runtime 返回该 request 已 unknown、timeout、stale 或 workspace disconnected
- **THEN** 客户端 MUST 从本地可见队列移除该卡片
- **AND** 客户端 MUST NOT 将该 stale settlement 暴露为 fatal submit failure

#### Scenario: live request card is anchored to message timeline

- **WHEN** request payload 包含可关联的消息或工具 `item_id`
- **THEN** live request card MUST 插入到对应 timeline 位置附近
- **AND** 卡片 MUST NOT 永久吸附在 composer 上方或消息流底部
- **AND** 若找不到 anchor，系统 MAY 回退到 timeline 尾部显示，但仍 MUST 保持可关闭
