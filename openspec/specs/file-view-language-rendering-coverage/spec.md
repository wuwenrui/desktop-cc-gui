# file-view-language-rendering-coverage Specification

## Purpose

定义文件预览与编辑链路共享的语言判定契约，持续扩展语言覆盖（含 shell 脚本组）并保障既有渲染能力无回归。
## Requirements
### Requirement: Unified Language Resolution Contract

系统 MUST 使用统一的文件语言判定规则为预览渲染、编辑渲染、结构化预览和安全 fallback 提供一致输入，不得由多套独立映射长期漂移；该规则 MUST 在进入判定前完成平台相关路径归一化，并 MAY resolve editor language runtime asynchronously.

#### Scenario: same file path resolves consistently for preview and edit pipelines

- **WHEN** 用户在右侧文件树打开任意可文本渲染文件
- **THEN** 系统 MUST 基于统一规则解析该文件的语言类型
- **AND** 预览链路与编辑链路 MUST 共享同一语言判定结果来源
- **AND** lazy language extension loading MUST NOT change the resolved language identity after the fact.

#### Scenario: editor language extension loads on demand

- **WHEN** 用户进入 edit mode for a text file
- **THEN** the CodeMirror language extension for the resolved language SHOULD load on demand rather than requiring all supported language packages in the startup path
- **AND** editor fallback/loading state MUST remain stable until the extension is ready.

#### Scenario: stale language loader result is ignored

- **WHEN** a language extension import resolves after the active file or resolved language changed
- **THEN** the stale extension result MUST be ignored
- **AND** it MUST NOT apply syntax mode or editor state to the wrong file.

### Requirement: Java and XML Files Render with Syntax Highlighting

系统 SHALL 为 Java 与 XML 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: java source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.java` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Java 语法高亮
- **AND** 编辑模式 MUST 显示 Java 语法高亮

#### Scenario: pom and other xml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `pom.xml` 或任意 `*.xml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 XML 语法高亮
- **AND** 编辑模式 MUST 显示 XML 语法高亮

### Requirement: Python Files Render with Syntax Highlighting

系统 SHALL 为 Python 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: python source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.py` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Python 语法高亮
- **AND** 编辑模式 MUST 显示 Python 语法高亮

### Requirement: Spring Configuration Files Render Correctly

系统 SHALL 为 Spring 常见配置文件提供可读且一致的语法渲染。

#### Scenario: spring properties files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.properties` 或任意 `*.properties` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Properties 语法高亮
- **AND** 编辑模式 MUST 显示 Properties 语法高亮

#### Scenario: spring yaml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.yml`、`application.yaml` 或 `application-*.yml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 YAML 语法高亮
- **AND** 编辑模式 MUST 显示 YAML 语法高亮

### Requirement: SQL, GitIgnore, Lock and TOML Files Render Correctly

系统 SHALL 为 SQL、GitIgnore、Lock 与 TOML 文件提供可读且一致的语法渲染。

#### Scenario: sql files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.sql` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 SQL 语法高亮
- **AND** 编辑模式 MUST 显示 SQL 语法高亮

#### Scenario: gitignore files are highlighted in preview and edit modes

- **WHEN** 用户打开 `.gitignore` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示可读语法高亮
- **AND** 编辑模式 MUST 显示可读语法高亮

#### Scenario: lock files follow filename-priority language rules

- **WHEN** 用户打开 `*.lock` 文件并在预览/编辑模式间切换
- **THEN** 系统 MUST 先应用文件名优先规则（例如 `cargo.lock`）
- **AND** 文件名规则未命中时 MUST 回退到扩展名规则
- **AND** 预览与编辑模式 MUST 使用同一判定结果来源

#### Scenario: toml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.toml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 TOML 语法高亮
- **AND** 编辑模式 MUST 显示 TOML 语法高亮

### Requirement: Additive-Only Delivery and Non-Regression Guard

本变更 MUST 采用新增优先策略；既有已支持文件类型的渲染行为不得被破坏或回退，但 Markdown 文件允许按照文件预览专用 renderer 的新契约演进，且主窗口与独立文件窗口 MUST 保持共享渲染基线。

#### Scenario: find-in-file search remains in the file panel startup path

- **WHEN** 用户打开 find-in-file in editor mode
- **THEN** `@codemirror/search` SHALL be available synchronously alongside the editor so that the `searchState` field, contiguous navigation, and replace/replace-all flows behave identically to the pre-change baseline
- **AND** the file panel SHALL NOT introduce a dynamic import boundary around `@codemirror/search` because doing so breaks the contiguous search/replace contract (see the proposal's “Withdrawn Optimization” section).

### Requirement: Shell Script Group Files Render with Unified Compatibility Rules

系统 SHALL 为 shell 脚本组文件在预览与编辑两种模式下提供一致语法渲染，并复用统一语言判定来源。

#### Scenario: shell extension group resolves to bash/shell in preview and edit

- **WHEN** 用户打开 `*.sh`、`*.bash`、`*.zsh`、`*.ksh`、`*.dash`、`*.command` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 使用 `bash` 渲染语义
- **AND** 编辑模式 MUST 使用 `shell` 渲染语义
- **AND** 两种模式 MUST 共享同一语言判定结果来源

#### Scenario: shell dotfile names follow filename-priority compatibility rules

- **WHEN** 用户打开 `.envrc`、`envrc`、`.bashrc`、`bashrc`、`.zshrc`、`zshrc`、`.kshrc`、`kshrc`、`.profile`、`profile`
- **THEN** 系统 MUST 优先命中文件名规则并按 shell 语义渲染
- **AND** 文件名规则命中结果 MUST 高于扩展名回退规则

#### Scenario: dockerfile compatibility remains stable after shell group expansion

- **WHEN** 用户打开 `Dockerfile` 或 `Dockerfile.*` 文件
- **THEN** 系统 MUST 保持既有 Dockerfile 渲染契约
- **AND** shell 脚本组扩展 MUST NOT 覆盖 Dockerfile 的识别结果

#### Scenario: boundary inputs safely fall back without crash

- **WHEN** 用户打开空路径、无文件名、未知扩展名或尾随点文件名（如 `script.`）
- **THEN** 系统 MUST 回退为纯文本渲染
- **AND** 回退过程 MUST 不触发崩溃、空白渲染或未捕获异常

### Requirement: High-Frequency Languages and Configuration Files Expand Rendering Coverage

系统 SHALL 在本次冻结范围内补齐高频语言与配置文件的渲染覆盖，并优先保证“可读预览 + 可解释编辑能力 + 安全 fallback”的一致结果。

#### Scenario: popular web and application source files no longer fall back blindly

- **WHEN** 用户打开高频但原先缺失或不完整支持的源码文件类型（例如 `vue`、`php`、`rb`、`cs`、`dart`）
- **THEN** 系统 MUST 为这些文件提供明确的渲染策略
- **AND** 该策略 MUST 至少在预览、编辑或 fallback 三者之一中表现为一致、可解释的结果

#### Scenario: high-frequency configuration files resolve with explicit strategy

- **WHEN** 用户打开高频配置文件类型（例如 `gradle`、`kts`、`ini`、`conf`、`.env`、`docker-compose.yml`）
- **THEN** 系统 MUST 为这些文件提供明确的语言渲染或结构化预览策略
- **AND** MUST NOT 将其长期保留为无语义的隐式纯文本处理

#### Scenario: comment-aware config editors use lightweight syntax modes when already available

- **WHEN** 用户在编辑模式打开高频配置文件，且仓库内已存在可复用的轻量语法模式（例如 `.env`/`ini`/`conf` 的 `#` 注释，`gradle`/`kts` 的 `//` 注释）
- **THEN** 系统 MUST 优先复用这些轻量模式提供注释和基础 key/value 或脚本结构着色
- **AND** MUST NOT 在已有低风险模式可用时仍一律退化为无注释高亮的纯文本编辑

