# Proposal: Desktop Editor Split Keeps Composer In Chat Column

## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 8/8 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `DesktopLayout`/`FileViewPanel` 已支持 editor split 与 composer chat-column placement；相关 test 覆盖 horizontal editor split 中 composer 位置。
- **Next action**: 归档前确认 layout focused tests 与 visual/manual notes。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

desktop editor split 现在把幕布与文件放在上方左右分栏，但 composer 仍在全局底部横跨整屏。用户在“边看文件边对话”时，输入框与幕布被视觉和空间上拆开，右侧文件也被底部 composer 挤短。

这个布局应该表达为两列：左列是 conversation column（幕布 + composer），右列是 file editor column。

## 目标与边界

- desktop editor split 的非最大化状态下，composer MUST 和 messages 留在同一列。
- horizontal editor split 下，左列 MUST 是 conversation column，右列 MUST 是 file editor。
- file editor column MUST 使用可用全高，不再被全局底部 composer 压缩。
- 从 workspace 文件区域打开文件时，desktop MUST 自动折叠左侧 sidebar，并默认进入 horizontal editor split。
- desktop editor split 已打开文件时，composer send/queue MUST 保持当前 editor split，不得自动退回 chat-only 布局。
- 普通 chat、diff、memory、home、phone/tablet compact layout MUST 保持既有布局语义。
- editor file maximized 状态保持既有行为：文件编辑器占主内容区，composer 仍可保留在底部以支持输入。

## 非目标

- 不改变 editor tabs、file open/close、session switch 或 diff selection 状态逻辑。
- 不改变 composer 发送、排队、文件引用、context ledger 或 review prompt 的消息语义。
- 不调整 right panel、git panel、status panel 或 terminal dock 的布局。
- 不引入新的用户设置或持久化 preference。

## What Changes

- 新增 `desktop-editor-split-layout` behavior capability，记录 desktop editor split 的两列布局契约。
- 调整 desktop layout render tree：在 editor split 非最大化时，composer 进入 chat layer；其他模式继续使用全局底部 composer。
- 调整 CSS：conversation column 使用 vertical stack，messages 占满剩余空间，composer 固定在同列底部。
- 调整 workspace file open 入口：打开编辑器时请求 desktop sidebar 折叠，并把 split layout 设为 horizontal。
- 调整 composer send/queue 包装层：发送或排队消息后保留 editor split，不再把 center mode 自动切回 chat。
- 补充 focused layout test，防止 composer 再次回退成全局横跨底部。

## 技术方案对比

### 方案 A：只用 CSS 重排现有 composer

- 优点：TSX 改动少。
- 缺点：composer 仍是 `content` 的兄弟节点，很难可靠限制到左列；grid/absolute 叠加会增加 clipping 和 z-index 风险。

### 方案 B：在 editor split 中把 composer 渲染到 chat layer

- 优点：DOM 语义与视觉语义一致，左列天然包含幕布和输入框；CSS 只负责列内 stack。
- 缺点：需要避免同一 render 中重复挂载 composer。

选择方案 B。它更贴近布局事实，且改动边界集中在 `DesktopLayout`。

## Capabilities

### New Capabilities

- `desktop-editor-split-layout`: desktop editor split 中 conversation column 与 file editor column 的布局契约。

### Modified Capabilities

- None.

## Impact

- Frontend layout:
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/styles/main.css`
- Tests:
  - `src/features/layout/components/DesktopLayout.test.tsx`

## 验收标准

- Given desktop horizontal editor split is visible and editor is not maximized, when rendering the workspace, then messages and composer are in the same chat column.
- Given the same state, then the file editor column occupies its side without being shortened by a global bottom composer.
- Given desktop workspace file open is triggered, then sidebar collapse is requested and editor split layout becomes horizontal.
- Given desktop editor split has an open file, when composer sends or queues a message, then the active file editor remains visible.
- Given editor file maximized, then existing composer mounting behavior remains available.
- Given normal chat/diff modes or compact layouts, then composer placement remains unchanged.
