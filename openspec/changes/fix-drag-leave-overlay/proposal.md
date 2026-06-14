# fix-drag-leave-overlay

## Summary

修复桌面端外部文件拖拽经过 app 后，workspace / composer 拖拽遮罩在离开窗口或跨 WebView 边界时无法恢复的问题。

## Problem

当前 Rust WebView drag-drop bridge 不转发 `DragDropEvent::Leave`，前端只能在 `drop` 或部分 DOM `dragleave` 路径里清理 hover 状态。
当用户把左侧 workspace 区域缩窄后，从外部拖文件经过 app 更容易让最后一次 `over` 命中 workspace 区域，但后续离开事件丢失，导致遮罩持续显示到重启。

## Goals

- Rust bridge MUST 向主窗口转发 drag leave。
- 前端 drag-drop payload MUST 允许 `leave` 不带坐标。
- Workspace drop overlay 和 Composer drag overlay MUST 在收到 `leave` 后立即清理。
- 保留现有 main WebView / child WebView drop 转发与 drop 去重逻辑。

## Non-Goals

- 不重做 workspace/sidebar 布局。
- 不改变文件 drop 后的打开项目或插入引用行为。
- 不调整透明度、毛玻璃或主题视觉效果。

## Validation

```bash
npx vitest run src/features/workspaces/hooks/useWorkspaceDropZone.test.ts src/features/composer/components/ChatInputBox/hooks/usePasteAndDrop.test.ts
cargo test --manifest-path src-tauri/Cargo.toml forwarded_leave_drag_payload_serializes_without_position
npm run typecheck
```
