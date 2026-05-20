## Context

主窗口文件模块当前在存在 `activeWorkspace` 和 `activeEditorFilePath` 时即启用 `externalChangeMonitoringEnabled`，并固定使用 `polling` transport。`FileViewPanel` 随后通过 `useFileExternalSync` 每隔约 2s 调用 `readWorkspaceFile`，clean buffer 检测到磁盘内容变化后会直接 `setContent`。Markdown preview 的输入正是该 `content`，因此阅读态会被后台同步重渲染。

detached file explorer 另有明确 OpenSpec contract：打开文件需要检测外部变化并在 clean buffer 时自动同步。本次修复聚焦主窗口默认阅读体验，不改 detached 监控契约。

## Goals / Non-Goals

**Goals:**

- 主窗口文件模块默认不启动 external-change polling。
- live edit preview 显式开启时，主窗口仍可启用外部变更监控。
- dirty buffer 的冲突保护、detached explorer 外部同步能力保持现有语义。
- 用 focused regression test 锁住主窗口 gating 行为。

**Non-Goals:**

- 不改 Markdown renderer 内部实现。
- 不改 Tauri watcher、backend polling interval 或事件 payload。
- 不新增用户设置项。

## Decisions

### Decision 1: 在主窗口调用方收紧监控开关

选择：将 `enableMainFileExternalChangeMonitoring` 从 “workspace + active file” 改为 “workspace + active file + liveEditPreviewEnabled”。

备选 A：在 `useFileExternalSync` 内识别 Markdown preview 并跳过 auto-sync。该方案会让 hook 依赖 UI mode/file type，破坏 hook 的 side-effect contract，也可能误伤 detached 的明确外部同步需求。

备选 B：完全删除主窗口 external-change monitoring。该方案止血更彻底，但会破坏 live edit preview 已建立的显式 opt-in 语义。

取舍：调用方 gating 最小、最清晰，能直接阻断默认 polling，又保留显式 live preview 路径。

### Decision 2: 不改 detached explorer

选择：detached explorer 继续按 `isFocused && externalChangeAwarenessEnabled` 驱动外部变更检测。

备选 A：统一让 detached Markdown preview 也改为手动 reload。该方案会修改 `independent-file-explorer-workspace` 已存在的 auto-sync clean files contract，影响范围过大。

取舍：用户当前反馈来自文件模块 Markdown 阅读；优先修主窗口默认行为，detached 若后续确认也有阅读模式诉求，再单独设计“阅读锁定/手动 reload”能力。

## Risks / Trade-offs

- 主窗口默认不再发现外部磁盘改动 → 通过 live edit preview 显式开启监控来保留需要实时反馈的工作流。
- 只修主窗口，detached 仍可能按既有 contract 自动同步 → 本次保持规格一致，避免跨窗口行为误改。
- app-shell hook 体量较大，测试直接覆盖较难 → 抽出小型 pure helper 或直接测试 exported helper，降低回归测试成本。

## Migration Plan

1. 增加主窗口 external monitoring enablement 的可测试 helper。
2. 将主窗口 `FileViewPanel` 入参改为使用该 helper。
3. 增加 focused test 覆盖：未开启 live edit preview 时，即使 active workspace/file 存在也不启用 monitoring；开启后才启用。
4. 运行 OpenSpec validate、focused Vitest、typecheck。

Rollback：还原 helper 与调用点到 `Boolean(activeWorkspace && activeEditorFilePath)`，删除对应回归测试。

## 验收标准

- 打开 `.md` 文件并进入 preview 时，主窗口默认不再发起周期性 external-change polling。
- 打开 live edit preview 后，主窗口仍可启用 external-change monitoring。
- detached file explorer 现有外部变更测试不因本次修改失效。

