## MODIFIED Requirements

### Requirement: Settings MUST Expose Email Sender Configuration And Mail Session Management

系统 MUST 在设置页提供邮件发送配置、收信监听配置与邮件驱动 session 管理入口，使用户能够配置发信、控制收信处理，并审计邮件如何驱动 session。

#### Scenario: email settings are organized into tabs

- **WHEN** 用户打开设置页的邮箱设置区域
- **THEN** 系统 MUST 展示文档、发送配置、收信监听、邮件会话或等价分组
- **AND** 发送配置 MUST 保留现有启用开关、provider、SMTP 参数、用户名、默认收件箱、授权码状态与测试发送入口

#### Scenario: email settings include built-in documentation

- **WHEN** 用户打开邮箱设置的文档分组
- **THEN** 系统 MUST 解释模块用途、配置前准备、发送配置、收信监听、配置完成后怎么回复邮件继续 session、常见回复示例与安全边界
- **AND** 文档 MUST 使用面向用户的简单语言，不要求用户理解内部 ACTION protocol 才能使用邮件回复

#### Scenario: inbound listener settings are visible

- **WHEN** 用户打开收信监听设置
- **THEN** 系统 MUST 展示监听开关、连接状态、最近检查时间、有效回复数量、待确认数量、异常数量与手动检查入口
- **AND** 系统 MUST 展示或应用允许发件人策略，默认只接受配置收件箱或明确白名单来源
- **AND** 系统 MUST 展示 read-only 收信状态，说明默认不会删除、移动或标记远端邮箱邮件

#### Scenario: mail session management is visible

- **WHEN** 用户打开邮件会话管理
- **THEN** 系统 MUST 展示 Moss 邮件驱动 session 列表
- **AND** 列表 MUST 支持查看相关邮件事件、命令状态和跳转到对应 session
- **AND** 列表 SHOULD 优先提供刷新、查看邮件、打开会话和清理已处理记录等低风险操作
- **AND** 暂停或停止 session MAY 通过邮件回复、backend session action 或后续管理入口完成，不应作为 MVP 列表中的默认强曝光按钮

#### Scenario: unrelated mailbox messages are not shown

- **WHEN** 收件箱存在与 Moss session 无关的普通邮件
- **THEN** 邮件设置管理页 MUST NOT 展示这些普通邮件
- **AND** 系统 MUST NOT 为这些普通邮件创建邮件会话记录

### Requirement: Email Secrets And Mail Intake Data MUST Be Protected

系统 MUST 继续保护 SMTP/IMAP secret，并将入站邮件处理限制为最小、可审计、可清理的数据。

#### Scenario: inbound credentials are secret settings

- **WHEN** 用户配置收信监听所需的 IMAP 或等价凭据
- **THEN** 系统 MUST 将凭据作为 secret 处理
- **AND** 普通 AppSettings JSON、日志、toast、诊断包和邮件会话列表 MUST NOT 包含 secret 明文

#### Scenario: saved authorization code is masked in settings UI

- **WHEN** 用户打开邮件发送配置
- **THEN** 授权码 / App Password 输入框 MUST 默认以脱敏状态展示
- **AND** 用户 MUST 能通过明确的显示/隐藏 icon 临时切换明文可见性
- **AND** 显示/隐藏切换 MUST 只影响当前 UI 输入框类型，不改变 secret 保存、清除、测试发送或提交 payload 语义

#### Scenario: raw inbound mail is not persisted by default

- **WHEN** 系统检查收件箱
- **THEN** 系统 MUST NOT 默认保存完整原始邮件正文、HTML body、附件或无关邮件 metadata
- **AND** 只允许保存通过 Moss 协议过滤后的最小 command/audit 字段

#### Scenario: inbound listener does not mutate mailbox by default

- **WHEN** 收信监听检查邮箱
- **THEN** 系统 MUST 使用本地 cursor / ledger 或等价机制跟踪处理进度
- **AND** 系统 MUST NOT 默认删除、移动、归档或标记远端邮件为已读

#### Scenario: provider-specific IMAP requirements are handled

- **WHEN** 用户使用 126、163、QQ 或 custom provider 配置收信监听
- **THEN** 系统 MUST 根据 provider 填充合理的 IMAP host、port 和 security defaults
- **AND** 对需要客户端身份声明的邮箱服务，系统 SHOULD 在 IMAP 连接阶段发送客户端 ID 或等价能力信息，避免服务商拒绝 read-only `SELECT`

#### Scenario: management cleanup removes processed mail records

- **WHEN** 用户执行清理已处理邮件记录
- **THEN** 系统 MUST 删除或归档已完成、重复、过期、已忽略的 mail command 记录
- **AND** 系统 MUST NOT 修改现有 SMTP 发信配置、邮箱 secret 或 conversation 历史

### Requirement: Email Settings Integration MUST Preserve Existing Send Contracts

系统 MUST 以增量方式扩展邮箱设置，不得破坏既有 SMTP 发信、测试发送、completion email 发送或通知行为。

#### Scenario: outbound settings remain backward compatible

- **WHEN** 用户只使用现有发信配置和测试发送能力
- **THEN** 系统 MUST 保持当前 SMTP provider、secret、默认收件箱和测试发送行为兼容
- **AND** 未启用收信监听时 MUST NOT 轮询或处理收件箱

#### Scenario: inbound management uses typed bridge

- **WHEN** Settings UI 读取收信状态、执行手动检查、更新监听配置或操作邮件会话
- **THEN** UI MUST 通过 typed Tauri bridge 调用 backend command
- **AND** feature component MUST NOT 直接调用 Tauri `invoke()`

#### Scenario: users without selected completion email are not forced into mail-driven sessions

- **WHEN** 用户没有在会话中选择发送 completion email
- **THEN** 系统 MUST NOT 自动启用邮件驱动 session continuation
- **AND** 用户在会话中选择发送 completion email 后，该轮 completion email SHOULD 默认可回复继续当前 session
