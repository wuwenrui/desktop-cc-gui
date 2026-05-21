## Why

Markdown 文件预览仍存在两个用户可感知的问题：阅读态下外部变更感知与强制刷新边界不清，Live Preview 或外部写入会让已打开文档闪烁；大 Markdown 文件依赖整段 ReactMarkdown progressive 重建，数据越多越卡。

当前需要把“知道文件变了”和“立即重绘阅读界面”解耦，同时把大文件渲染从整段投影升级为按 block 增量渲染，保留 GitHub-style Markdown、frontmatter、table、code highlight、KaTeX、Mermaid 与 annotation 能力。

## 目标与边界

- 主窗口 Markdown 阅读态 MUST remain stable：外部文件变化只提示，不默认替换当前 preview DOM。
- Live edit preview 继续作为显式 opt-in：可自动跟随 AI 修改，但必须 debounce 合并刷新，避免文件写入风暴触发连续重绘。
- dirty buffer 外部变更仍按现有冲突保护处理，禁止覆盖用户未保存编辑。
- 大 Markdown 文件必须保留结构渲染能力，不退化为纯文本或简单 code preview，除非文件读取本身已被截断。
- 本次聚焦 frontend file view，不改 Rust watcher / Tauri command 签名。

## 非目标

- 不重写 Markdown 语法能力，不替换现有 ReactMarkdown/remark/rehype 依赖。
- 不改变 detached file explorer 的既有外部变化 contract，除非共享 hook 的内部状态需要兼容。
- 不新增全局设置项。
- 不实现完整编辑器级 Markdown diff merge。

## What Changes

- 将主窗口文件外部同步拆成 awareness 与 apply 两个阶段：默认检测变更并展示提示，只有用户刷新或 Live Preview debounce 命中时才应用到 content。
- Markdown stable preview 在外部变化时保持当前 reading snapshot；提示用户可刷新或查看对比。
- Live Preview 自动应用外部变化前进行 debounce，避免 AI 连续写文件导致多次重渲染。
- 将 FileMarkdownPreview 的大文档渲染从 line projection 改为 block projection：compile 后生成稳定 block，逐块 progressive/viewport 渲染，保持 source line range。
- 保留 existing file-preview renderer 能力：frontmatter、GFM、HTML sanitize、code highlight、KaTeX、Mermaid Source/Render tabs、annotation line mapping。

## 方案对比

| 方案 | 优点 | 缺点 | 取舍 |
|---|---|---|---|
| A. 完全关闭外部监控 | 最快止血 | AI 修改当前文件没有感知 | 不采用，能力倒退 |
| B. 保留 polling 但只显示提示，Live Preview 才自动 apply | 感知不丢，阅读稳定 | 需要补状态和测试 | 采用 |
| C. 后端 watcher 全量重构 | 架构更彻底 | 范围过大、风险高 | 本次不做 |

Markdown 渲染也比较两种方案：

| 方案 | 优点 | 缺点 | 取舍 |
|---|---|---|---|
| A. 继续整段 ReactMarkdown，只调阈值 | 改动小 | 大文件仍反复 parse/render | 不足以解决根因 |
| B. block-level progressive render，block 内仍用 ReactMarkdown | 保留结构能力，降低单次重绘成本 | 需要 line map / annotation 适配 | 采用 |
| C. 全量切 markdown-it token renderer | 性能潜力更高 | 重写成本高，风险大 | 后续可评估 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-view-rendering-runtime-stability`: 主窗口文件预览默认必须感知外部变化但不强制刷新阅读 snapshot；自动应用必须是显式 Live Preview 行为。
- `file-view-markdown-github-preview`: 大 Markdown 文件必须通过 block-level bounded/progressive 渲染保持结构化阅读能力。
- `codex-chat-canvas-live-edit-preview`: Live Preview 跟随文件变化时必须 debounce 合并刷新，避免高频写入造成闪烁。

## Impact

- Affected frontend code:
  - `src/features/files/hooks/useFileExternalSync.ts`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/components/FileViewBody.tsx`
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/features/files/utils/fileMarkdownDocument.ts`
- Tests:
  - focused file external sync / panel tests
  - Markdown preview render budget tests
  - Markdown document block segmentation tests
- APIs/dependencies:
  - No new dependency.
  - No Tauri command signature change.

## 验收标准

- 默认打开 Markdown 文件后，外部/AI 修改当前文件时 UI 显示变化提示，但 preview 不自动闪烁重绘。
- 用户点击刷新后，preview 应用最新磁盘内容。
- Live Preview 开启时可自动跟随变化，但连续变化被 debounce 合并。
- dirty buffer 仍不会被外部内容覆盖。
- 大 Markdown 文件仍渲染 heading、paragraph、blockquote、table、code、math、Mermaid、frontmatter 和 annotation 行号。
- focused tests 与 `npm run typecheck` 通过。
