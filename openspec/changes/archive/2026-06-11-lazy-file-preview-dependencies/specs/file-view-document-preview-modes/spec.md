## MODIFIED Requirements

### Requirement: File view SHALL provide inline PDF preview with safe degradation

系统 MUST 为 PDF 提供桌面内分页预览，并在大文档、加载失败、Worker 初始化失败或 lazy runtime 加载失败时进行显式、安全的降级。

#### Scenario: pdf runtime loads only for pdf preview

- **WHEN** 用户打开非 PDF 文件、非文件功能，或仅启动 app shell
- **THEN** 系统 SHOULD NOT load `pdfjs-dist` runtime or PDF worker solely for that path
- **AND** PDF runtime SHOULD load when a PDF preview is activated.

#### Scenario: pdf preview failure falls back explicitly

- **WHEN** PDF viewer、PDF runtime lazy import、或 PDF worker 无法完成加载
- **THEN** 系统 MUST 显示显式 fallback 状态
- **AND** MUST NOT 留下空白面板或未捕获异常.

### Requirement: Preview runtime resources SHALL be cleaned up on surface transitions

系统 MUST 在文件切换、tab 关闭、surface 销毁和 detached window 关闭时释放 preview runtime 资源，避免 worker、object URL、临时句柄、旧请求和 stale lazy loader 结果残留。

#### Scenario: switching files ignores stale lazy preview runtime

- **WHEN** 用户在高成本 preview runtime 仍在 lazy loading 时切换到另一个文件
- **THEN** 原文件 loader resolve 后 MUST NOT apply renderer state to the new active file
- **AND** the new file MUST keep its own preview mode and fallback semantics.
