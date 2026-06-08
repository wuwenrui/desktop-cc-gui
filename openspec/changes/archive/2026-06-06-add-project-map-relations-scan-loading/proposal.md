## Why

Project Map 的 `project-map-relations` 扫描可能持续数秒；当前点击 `扫描关系` 后，顶部只显示轻量状态，主画布仍保持空白或旧态，用户难以判断扫描是否真正进行中。

该变更为关系扫描增加主区域全局 loading 反馈，让用户在等待 deterministic file relationship scan 时获得明确、持续、可访问的进度状态。

## 目标与边界

- 在 Project Map 关系视图点击 `扫描关系` 后，主内容区域必须展示全局 loading 进度条。
- loading 由现有 `relationshipScanState.status === "running"` 驱动。
- 进度条为 indeterminate progress，不承诺真实百分比。
- 扫描成功或失败后，loading 必须自动消失，并回到现有成功/失败展示路径。
- 不改变 relationship scan command、扫描数据结构、存储目录或 `project-map-relations` artifact 格式。

## 非目标

- 不实现后端扫描阶段事件流。
- 不实现真实百分比进度。
- 不新增取消扫描、暂停扫描或并发扫描队列。
- 不改变 Project Map relationship dashboard 的 graph/files/read/api 数据模型。

## What Changes

- Project Map relationship section 在扫描运行中渲染一个主区域 loading overlay。
- loading overlay 包含：
  - 当前状态标题。
  - indeterminate progress bar。
  - 简短说明，告知正在分析 files、imports、calls 与 evidence。
  - `role="status"` / `aria-live="polite"` 可访问语义。
- relationship scan request 采用边沿触发语义，避免组件 remount、顶部栏收起/展开后重放历史扫描事件。
- Project Map 顶部栏收起/展开只控制 header chrome 可见性，不改变当前 workspace；如果当前选中 `文件关系`，收起后仍直接显示文件关系 workspace。
- 增加中英文 i18n 文案。
- 增加 scoped CSS，不影响扫描完成后的正常关系图、文件视图或 read view。

## 技术方案

### Option A：前端基于现有 scan state 渲染 indeterminate overlay（推荐）

- 直接复用 `relationshipScanState.status === "running"`。
- 不要求 Rust backend 追加进度事件。
- 改动集中在 `ProjectMapRelationshipSection.tsx`、relationship CSS 与 locale 文案。

取舍：不能显示真实百分比，但能快速解决“扫描是否进行中不可见”的核心问题，风险最低。

### Option B：后端扫描阶段上报真实进度

- Rust scan command 需要拆分阶段并通过 event stream 上报。
- 前端消费阶段事件并计算进度。

取舍：体验更完整，但涉及 backend command contract、event channel、错误恢复与并发扫描治理；当前需求只要求全局 loading 进度条，属于过度设计。

## Capabilities

### New Capabilities

- `project-map-relations-scan-loading`: Defines visible loading feedback for Project Map relationship scans.

### Modified Capabilities

- None.

## Impact

- Frontend component:
  - `src/features/project-map/components/ProjectMapPanel.tsx`
  - `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
- Frontend styles:
  - `src/styles/project-map.relationship.css`
  - `src/styles/project-map.relationship-workspace.css`
- i18n:
  - `src/i18n/locales/zh.part5.ts`
  - `src/i18n/locales/en.part5.ts`
- No new dependencies.
- No backend/Rust API changes.

## 验收标准

- 点击 `扫描关系` 后，关系主区域出现全局 loading overlay 与 indeterminate progress bar。
- loading overlay 在扫描成功后消失，并展示现有 relationship graph/dashboard。
- loading overlay 在扫描失败后消失，并保留现有失败状态提示。
- loading overlay 具备 `role="status"` 与 `aria-live="polite"`。
- 未扫描、已完成、已失败状态下，不出现额外 loading overlay。
- 文件关系 tab 已选中时，点击 `收起顶部栏` 后仍显示文件关系 workspace，不回退到基础节点图。
- `收起顶部栏` / `展开顶部栏` 不会触发或重放 relationship scan；只有明确点击扫描动作才会扫描。
