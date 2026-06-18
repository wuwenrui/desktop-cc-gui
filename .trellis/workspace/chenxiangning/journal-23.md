# Journal - chenxiangning (Part 23)

> Continuation from `journal-22.md` (archived at ~2000 lines)
> Started: 2026-06-18

---



## Session 872: 归档 Codex 首响应性能证据变更

**Date**: 2026-06-18
**Task**: 归档 Codex 首响应性能证据变更
**Branch**: `feature/v0.5.11`

### Summary

完成 measure-codex-post-ack-first-delta-latency OpenSpec 收尾：同步 conversation-realtime-client-performance 与 conversation-stream-latency-diagnostics 主 specs，归档 change 到 openspec/changes/archive/2026-06-18-measure-codex-post-ack-first-delta-latency，并验证全量 OpenSpec、rendererDiagnostics 测试与 perf runtime report 测试通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ae1a41d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 873: 修复流式结束窗口并升级 React

**Date**: 2026-06-18
**Task**: 修复流式结束窗口并升级 React
**Branch**: `feature/v0.5.11`

### Summary

修复 Messages finalizing live markdown window 在 React 19.2 时序下被同帧清理的问题，并将 React/ReactDOM 统一升级到 19.2.7。

### Main Changes

## 本次记录

- 升级 React / ReactDOM 到 19.2.7，@types/react 到 19.2.17，@types/react-dom 到 19.2.3。
- 修复 Messages 在 Codex/Claude 流式结束时 finalizing live markdown surface 过早消失的问题。
- 将 active live assistant id 从 live source 提取，避免 deferred snapshot 慢一帧导致 finalizing frame 丢失。
- 扩展 resolveStreamingPresentationItems，使 active live row 可按同 id 更新覆盖，但禁止同 id 不同 kind/role 误替换 reasoning 行。
- 将 Codex 完整文本可见后的 finalizing 清理改为 320ms 短窗口 timer，避免 render callback 同帧清掉 UI 状态。

## 验证

- npm exec vitest run -- src/features/messages/components/Messages.test.tsx src/features/messages/components/messagesLiveWindow.test.ts src/features/messages/components/Messages.live-behavior.test.tsx src/features/messages/components/Messages.windows-render-mitigation.test.tsx src/features/messages/components/Messages.streaming-presentation.test.tsx src/features/messages/components/Messages.codex-live-streaming.test.tsx src/features/messages/components/Messages.transient-timer-cleanup.test.tsx src/app-shell.startup.test.tsx src/app-shell-parts/useSelectedComposerSession.test.tsx src/app-shell-parts/selectedComposerSession.test.ts
- npm run typecheck
- npm ls react react-dom @types/react @types/react-dom --depth=0

## 隔离说明

- record 前工作区仍有非本次改动：src/services/tauri.ts、openspec/changes/optimize-governance-sentry-noise-and-large-file-split/、src/services/tauri/git.ts、src/services/tauri/workspaceFiles.ts。
- 本次业务 commit 与 session record 均未纳入上述非本次改动。


### Git Commits

| Hash | Message |
|------|---------|
| `2f1ba6d6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
