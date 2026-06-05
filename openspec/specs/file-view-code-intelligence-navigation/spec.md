# file-view-code-intelligence-navigation Specification

ADDED by change: file-view-code-intelligence-navigation-2026-03-01

## Purpose

在现有文件树与多 Tab 文件编辑能力基础上，提供面向代码符号的语义导航（跳转定义、查找引用）与跨文件定位能力，使打开文件具备 IDE
级核心导航体验。

## Requirements

### Requirement: Editor Symbol Definition Navigation

系统 MUST 支持在文件编辑视图中对代码符号执行“跳转定义”。

#### Scenario: ctrl/cmd click navigates to single definition

- **GIVEN** 用户在支持语言文件中打开编辑模式
- **AND** 光标所在符号存在唯一定义位置
- **WHEN** 用户按住 `Ctrl/Cmd` 并点击该符号
- **THEN** 系统 MUST 打开或激活目标文件
- **AND** MUST 将编辑器定位到定义所在行列

#### Scenario: multiple definitions require explicit target selection

- **GIVEN** 当前符号存在多个可跳转定义目标
- **WHEN** 用户触发跳转定义
- **THEN** 系统 MUST 展示目标候选列表
- **AND** 用户选择后 MUST 跳转到对应目标

### Requirement: Symbol References Discovery

系统 MUST 支持从当前符号查询引用列表，并支持从引用列表继续导航。

#### Scenario: find references returns navigable results

- **GIVEN** 用户在支持语言文件中定位到符号
- **WHEN** 用户触发 “Find References / Find Usages”
- **THEN** 系统 MUST 展示引用结果列表（至少包含文件路径与位置）
- **AND** 点击任一结果项 MUST 打开并定位到对应位置

#### Scenario: no references shows explicit empty state

- **GIVEN** 当前符号不存在引用
- **WHEN** 用户触发引用查询
- **THEN** 系统 MUST 显示空结果提示
- **AND** MUST NOT 抛出未处理异常

### Requirement: Open File With Location

系统 MUST 支持“按位置打开文件”，并与现有多 Tab 行为兼容。

#### Scenario: open unopened file at location

- **GIVEN** 目标文件尚未出现在已打开 Tab
- **WHEN** 系统收到 `path + location` 打开请求
- **THEN** 系统 MUST 新增目标文件 Tab
- **AND** MUST 在文件打开后定位到目标行列

#### Scenario: activate existing tab and relocate cursor

- **GIVEN** 目标文件已在已打开 Tab 中
- **WHEN** 系统收到 `path + location` 打开请求
- **THEN** 系统 MUST 激活现有目标 Tab
- **AND** MUST 更新光标与视口到目标位置

### Requirement: LSP Failure and Unsupported Fallback

系统 MUST 对 LSP 不可用、查询失败、结果为空等场景提供可解释回退。

#### Scenario: backend lsp command unavailable

- **GIVEN** 当前环境不支持 definition/references 查询
- **WHEN** 用户触发导航或引用查询
- **THEN** 系统 MUST 显示“当前环境不支持”提示
- **AND** MUST 保持编辑器可继续正常使用

#### Scenario: query failure is surfaced without breaking editor

- **GIVEN** LSP 查询执行失败
- **WHEN** 前端收到错误响应
- **THEN** 系统 MUST 显示错误提示并允许用户重试
- **AND** MUST NOT 导致编辑器崩溃或内容丢失

### Requirement: Non-Regression for Existing File Workflows

新增代码导航能力 MUST 不破坏现有文件系统与编辑器基础行为。

#### Scenario: existing file open/switch/close/save behavior remains stable

- **WHEN** 用户执行现有文件操作（打开、切换、关闭、保存）
- **THEN** 行为 MUST 与变更前保持一致
- **AND** 不得因新增导航能力引入回归

#### Scenario: java baseline passes end-to-end acceptance

- **GIVEN** 用户打开 Java 工程中的类名或方法调用
- **WHEN** 触发跳转定义与查找引用
- **THEN** 结果 MUST 可用且可导航
- **AND** 验收记录 MUST 覆盖至少一个跨文件跳转与一个引用列表场景

### Requirement: Browser page-to-code candidates reuse code intelligence navigation
File view code intelligence navigation SHALL provide or expose navigation support for Browser Agent page-to-code candidates so Browser Agent does not duplicate source navigation behavior.

#### Scenario: Browser candidate points to a file
- **WHEN** Browser Snapshot v2 includes a candidate file path
- **THEN** the user SHALL be able to open or inspect that candidate through existing file/code navigation surfaces

#### Scenario: Candidate includes matched source text
- **WHEN** a browser code candidate includes matched text or symbol metadata
- **THEN** code navigation SHALL preserve that reason so the user can understand why the file was suggested

### Requirement: Browser candidates remain explainable
File view code intelligence navigation SHALL treat browser-derived code candidates as explainable suggestions, not guaranteed source ownership.

#### Scenario: Candidate confidence is low
- **WHEN** a browser code candidate has low confidence
- **THEN** the UI or AI context SHALL preserve the low confidence state and SHALL NOT present it as a confirmed file mapping
