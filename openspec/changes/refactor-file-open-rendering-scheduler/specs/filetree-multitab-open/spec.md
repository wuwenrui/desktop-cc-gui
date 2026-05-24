## MODIFIED Requirements

### Requirement: 文件树支持多文件并行打开

系统 SHALL 在文件树双击打开行为中支持多文件并行打开，而不是替换当前文件；多文件打开 SHALL 保持后台 Tab 轻量，避免因打开多个文件而触发非活动文件的高成本读取、编译或渲染。

#### Scenario: 打开第二个文件不关闭第一个文件
- **GIVEN** 用户已打开文件 A
- **WHEN** 用户在文件树双击文件 B
- **THEN** 系统 SHALL 保留文件 A 的已打开状态
- **AND** 新增文件 B 到已打开 Tab 列表

#### Scenario: 双击已打开文件时激活而非重复创建
- **GIVEN** 文件 A 已存在于已打开 Tab 列表
- **WHEN** 用户再次双击文件 A
- **THEN** 系统 SHALL 仅切换活动 Tab 到文件 A
- **AND** 不得新增重复 Tab

#### Scenario: 单击文件仅更新选中态
- **WHEN** 用户在文件树单击任意文件节点
- **THEN** 系统 SHALL 仅更新选中态
- **AND** 不得触发文件打开动作

#### Scenario: inactive tabs do not perform high-cost preview work
- **GIVEN** 用户已打开多个文件 Tab
- **WHEN** 其中只有一个 Tab 处于活动状态
- **THEN** 非活动 Tab MAY retain lightweight identity and UI state
- **AND** 非活动 Tab MUST NOT run high-cost file reads, Markdown compilation, syntax highlighting, or preview DOM mounting unless explicitly scheduled as bounded background work

#### Scenario: activating a background tab renders from its own snapshot
- **GIVEN** 用户在多个已打开文件之间切换
- **WHEN** 用户激活一个之前处于后台的 Tab
- **THEN** 文件查看区 SHALL 渲染该 Tab 对应文件的内容
- **AND** 不得显示前一个活动 Tab 的 stale content、stale line markers 或 stale annotation draft

#### Scenario: background render work cannot commit after tab switch
- **GIVEN** 文件 A 有 pending preview highlight、Markdown chunk、external refresh 或其他 deferred render work
- **WHEN** 用户切换到文件 B
- **THEN** 文件 A 的 pending work MUST be cancelled or ignored before commit
- **AND** 文件 B SHALL only consume its own active snapshot and render epoch
