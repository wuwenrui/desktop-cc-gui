## MODIFIED Requirements

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

### Requirement: Additive-Only Delivery and Non-Regression Guard

本变更 MUST 采用新增优先策略；既有已支持文件类型的渲染行为不得被破坏或回退，但 Markdown 文件允许按照文件预览专用 renderer 的新契约演进，且主窗口与独立文件窗口 MUST 保持共享渲染基线。

#### Scenario: find-in-file search remains in the file panel startup path

- **WHEN** 用户打开 find-in-file in editor mode
- **THEN** `@codemirror/search` SHALL be available synchronously alongside the editor so that the `searchState` field, contiguous navigation, and replace/replace-all flows behave identically to the pre-change baseline
- **AND** the file panel SHALL NOT introduce a dynamic import boundary around `@codemirror/search` because doing so breaks the contiguous search/replace contract (see the proposal's “Withdrawn Optimization” section).
