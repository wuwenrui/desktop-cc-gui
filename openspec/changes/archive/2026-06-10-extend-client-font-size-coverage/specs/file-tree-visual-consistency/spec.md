## MODIFIED Requirements

### Requirement: 多文件树视图 SHALL 采用统一视觉规范
系统 SHALL 在目标面板中使用统一的文件树视觉规范，包括行高、缩进、图标尺寸、圆角、分组容器样式与计数徽标样式。

#### Scenario: tree rows keep consistent density across panels
- **WHEN** 用户分别查看 Git Diff 树视图与 Git History 工作区文件树
- **THEN** 两处文件树行项 SHALL 使用一致的视觉密度（行高与垂直间距）
- **AND** 节点缩进与图标尺寸 SHALL 保持统一

#### Scenario: section containers and badges follow shared style contract
- **WHEN** 面板渲染 staged/unstaged 或同类分组容器
- **THEN** 分组容器外观 SHALL 遵循共享样式契约
- **AND** 变更计数徽标（正负值）SHALL 使用统一视觉语义

#### Scenario: file tree readable typography follows client content font size
- **WHEN** 用户调整客户端 font-size preference
- **THEN** 文件树中的 file name、folder name、muted path、status marker 与 textual badge SHALL 通过共享 typography variables 响应该设置
- **AND** 行高、缩进、图标尺寸与命中区域 SHOULD NOT 被该设置隐式改变

### Requirement: 展示层改造 MUST NOT 改变交互语义

系统 MUST 将本次改动限制在展示层，且不得改变现有交互行为、状态语义或命令调用链路。

#### Scenario: worktree file row commit checkbox moves to trailing controls without behavior changes

- **GIVEN** Git History/HUB worktree 文件列表中存在 changed file row
- **WHEN** 系统渲染该 file row 的 commit scope inclusion control
- **THEN** 该 control SHALL 位于 file row 右侧 trailing control area
- **AND** 该 control MUST 继续表达同一个 file-level commit scope 状态
- **AND** 点击该 control MUST NOT 触发 file row 的 diff open 行为
- **AND** stage / unstage / discard actions MUST 保持原有命令语义

#### Scenario: tree folder rows do not render leading commit checkboxes

- **GIVEN** Git tree view 中存在 root 或 folder row
- **WHEN** 系统渲染该 tree row
- **THEN** 该 row MUST NOT 渲染 leading commit scope checkbox
- **AND** root/folder row SHOULD 只承担展开/折叠语义
- **AND** file-level commit scope selection MUST 继续由 file row trailing checkbox 表达

#### Scenario: typography migration preserves tree interaction behavior
- **WHEN** 文件树或 Git worktree file tree 迁移到共享 typography variables
- **THEN** 展开/折叠、选择、打开 diff、stage、unstage、discard、commit scope toggle 与 context menu 行为 MUST 保持不变
- **AND** 变更范围 SHOULD 限定于 CSS variable / style token wiring
