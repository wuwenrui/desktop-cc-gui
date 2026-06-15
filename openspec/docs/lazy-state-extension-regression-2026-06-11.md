# Lazy State-Extension Regression Note — 2026-06-11

## TL;DR

把 `@codemirror/search` 这类 **state-coupled extension** 拆到 `React.lazy` / 动态 `import()` 边界之后会破坏 Cmd+F 连续搜索、replace、replace-all 的 contiguous 行为。本次回滚来自 `openspec/changes/lazy-file-preview-dependencies`，详见该 change proposal 的 *Withdrawn Optimization* 章节。

后续 AI / 任何 contributor 重新评估"压缩 startup bundle"或"按 activation 触发加载"时，**必须**先读：

- `.trellis/spec/frontend/quality-guidelines.md` —— *CodeMirror State-Coupled Extensions 不可跨越 Lazy Boundary* 章节（Hard Rule）
- `.trellis/spec/frontend/index.md` —— Pre-Development Checklist 中的 CodeMirror 拆分提示

## 触发场景的判断标准

把任何 `@codemirror/*` 模块拆出 static import 之前，按下列清单过一遍：

1. **该模块是否注册 `StateField` / `StateEffect`？**
   - 是：继续看 2。
   - 否：可以拆到 lazy 边界之后（例如纯 utility 工具函数或独立 selector）。

2. **是否有同步 keymap run / 命令 / 同步状态读取依赖该 field？**
   - 是：**禁止拆到 lazy 边界之后**。
   - 否：可以拆，但要给出 synchronously-available 替代路径。

3. **该模块是否参与 transactional effect 链（dispatch + select state + dispatch）？**
   - 是：禁止拆。
   - 否：参照 2。

4. **是否依赖 `EditorState` 的特定 `extension` slot（如 `searchState`、`lintState`、`completionState`）？**
   - 是：禁止拆。
   - 否：可以拆。

参考清单（state-coupled extension，当前禁止拆到 lazy 边界之后）：

- `@codemirror/search`（`search({ top })`、`searchKeymap`、`openSearchPanel` / `closeSearchPanel` / `searchPanelOpen`）
- `@codemirror/autocomplete`（`autocompletion({})`、`startCompletion`）
- `@codemirror/lint`（`linter(...)` / `lintGutter`）
- `@codemirror/view` 内被多 panel 共享的 `keymap.of([...])`
- 任何自定义 `StateField` 配套 API

## 失败的根因

`search({ top: true })` 在 `EditorState` 上注册 `searchState` field，所有 search / replace 行为围绕该 field 的 transactional effect 链工作：

- `openSearchPanel` → `setSearchQuery` → 写入 `searchState` field
- `findNext` / `findPrevious` → 读取 `searchState.matches` 决定光标位移
- `replaceNext` / `replaceAll` → 读取 `searchState` + 派发 transaction 修改文档

动态 import 异步期间（cold cache ~ms 级，warm cache 0），`searchState` field 不存在于 `EditorState`：

- `openSearchPanel` 因 `state.field(searchState, false)` 返回 `null` 而 noop 或抛错（`TypeError: state.field is not a function`）。
- Mod-F / Cmd-F 同步 keymap 路径无法等待 import；连续按 Cmd+F 时会出现"开了但跳不回原文位置"。
- 即使后续 import resolve 并 `setExtension(search({ top }))`，新的 extension 实例没有继承前一次的 query 状态，且与原 `EditorState` 上的 transactional effect 链脱钩。
- React 18 StrictMode + Suspense 下 lazy chunk 的 re-render 容易让 extension 引用 mismatch，search panel 关闭再开时 query / matches 丢失。

## 当前的正确做法

- `FileViewPanel` 启动路径上继续 `import { search } from "@codemirror/search"` 并在 `useMemo` 中构造 `persistentSearchExtension`。
- `useFileNavigation` 启动路径上继续 `import { closeSearchPanel, openSearchPanel, searchPanelOpen } from "@codemirror/search"`，Mod-F keymap 同步可用。
- CodeMirror 整体（`@uiw/react-codemirror` + `@codemirror/view`）按"打开文件 / 切到 edit mode 才挂载"的粒度拆到 `FileCodeMirrorEditor` lazy 边界；该粒度下 `search` 仍以**同步 import 形式**留在 `vendor-codemirror` chunk 内（与 view / autocompletion 等同 chunk），而该 chunk 本身是 lazy 的——这正是当前架构的正确状态。

## 后续如果还要压缩 `@codemirror/search` 体积

不在本次 change 范围内。候选方向（任何实现都必须先在 proposal.md 标注"已通过 §触发场景的判断标准"审查）：

- 拆出仅 `searchPanelOpen` 状态读取相关的轻量 helper（不依赖 `searchState` field），把 `openSearchPanel` / `closeSearchPanel` 留静态 import。
- 把 `searchKeymap` 与 `search({ top })` 拆为两个独立 extension：保留 `search({ top })` 静态、把 `searchKeymap` 拆到 lazy 后并用 `Prec.high` 优先注入。
- 在不破坏 contiguous 语义前提下，编写自研的 `find-in-file` 替代品（成本高，不再赘述）。

## 测试要求

任何后续要触碰 CodeMirror lazy 边界的 PR 在 review 时必须保证：

- `src/features/files/components/FileViewPanel.find-in-file.test.tsx`（若不存在则新增）覆盖：
  - 打开 search panel 后立即输入 query
  - 连续 Cmd+F 切换 toggle
  - replace 一次 / 多次
  - replace-all
  - 在切换文件后 search panel 状态符合预期（query 清空或保留）
- `npx vitest run src/features/files/` 全套通过
- Tauri 桌面真机 smoke：连续 Cmd+F 30 次，肉眼确认无 regression

## Reference

- 失败时的具体改动：`useFileSearchExtension` hook（`src/features/files/components/FileCodeMirrorEditorImpl.tsx`）、`ensureSearchCommandsLoaded` helper（`src/features/files/hooks/useFileNavigation.ts`）。
- 失败时新增的测试：`src/features/files/components/findInFile.lazy-search.test.tsx`（已删除）。
- 失败时新引入的 props 透传：`isFindInFileOpen` / `markFindInFileOpened`（已撤回）。
- 治理回写：`.trellis/spec/frontend/quality-guidelines.md` 末尾 *CodeMirror State-Coupled Extensions 不可跨越 Lazy Boundary* 章节。
