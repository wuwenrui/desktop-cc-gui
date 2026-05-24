## MODIFIED Requirements

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

#### Scenario: empty folder chains render as compact dotted labels across git trees

- **GIVEN** 右侧 Git 树或 Git History/HUB worktree 树需要渲染 `test/java/com/example/demo/service/UserServiceTest.java`
- **WHEN** `test/java/com/example/demo/service` 链路中的 folder 均不直接包含文件且每层只有一个子目录
- **THEN** 系统 MUST 将该 folder chain 展示为 `test.java.com.example.demo.service`
- **AND** Git 树与 Git History/HUB worktree 树 MUST 使用同一 compact display 规则
- **AND** compact label MUST NOT 改变 file row 的真实 path、diff open path 或 commit scope descendant path

#### Scenario: compact folder display stops at branch folders

- **GIVEN** tree 中同时存在 `service/UserService.java` 与 `service/impl/UserServiceImpl.java`
- **WHEN** 系统计算 compact folder label
- **THEN** `service` MUST 作为独立 folder row 保留
- **AND** `impl` MAY 作为其子 folder row 展示
- **AND** 系统 MUST NOT 将该分叉错误展示成 `service.impl`

#### Scenario: compact folder labels do not collide with structural keys

- **GIVEN** tree 中存在两个 sibling folder，其 dotted display label 可能相同
- **WHEN** 系统 compact folder chains for display
- **THEN** rendering identity MUST continue to use structural folder key or true path
- **AND** display label MUST NOT be used as the only `Map` key for sibling folders
- **AND** compacting one folder MUST NOT overwrite another folder with the same display label

#### Scenario: git and hub worktree file tree typography stays aligned

- **GIVEN** 右侧 Git 文件树与 Git History/HUB worktree 文件树同时渲染 changed file rows 或 folder rows
- **WHEN** 系统计算 file name、folder name、status marker 与 muted path 的 typography
- **THEN** 两个 surface MUST 使用同一组 `--git-filetree-*` typography CSS variables
- **AND** Git History/HUB worktree MUST NOT 维护独立 file name / folder name 字号或字重规则
- **AND** status colors and file stat colors MUST resolve through theme CSS variables so built-in theme and custom theme switching remain compatible

#### Scenario: git history hub close chip uses theme-safe compact square style

- **GIVEN** Git History/HUB overlay renders its close control
- **WHEN** built-in light/dark theme or custom theme is active
- **THEN** the close control MUST render as a `20px * 20px` small-radius square
- **AND** border, background, hover, and focus colors MUST resolve through existing theme CSS variables
- **AND** the style change MUST NOT alter close behavior, accessible title, icon semantics, or keyboard activation
