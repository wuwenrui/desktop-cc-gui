## Implementation Update

### 已回写项（当前分支）

- 已完成长内容实时可视折叠（Claude streaming lightweight Markdown path）：
  - 阈值 `STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD = 20000`
  - head `STREAMING_PLAIN_TEXT_HEAD_CHARS = 4000`
  - tail `STREAMING_PLAIN_TEXT_TAIL_CHARS = 2000`
  - 非完整显示文本仅用于可见层，传入 live `Markdown` 时使用 `liveRenderMode="lightweight"`，不再退化成纯文本 `<div>`。
  - `onAssistantVisibleTextRender` 保持上报完整 canonical 文本。
  - `isFinal` 后回到完整 Markdown 渲染。
- 已完成 review 后边界修正：
  - 当显式 `renderPlainTextWhileStreaming` mitigation 与 Claude 超长输出同时命中时，plain-text surface 也复用 head/tail folded view，避免绕开折叠后重新渲染全文。
  - Shadow recovery 在存在 `expectedTurnId` 时不再回退到不同 concrete turn 的最新 shadow；只允许 exact turn match，或 legacy 无 turnId shadow 兜底。
  - Shadow settle 在 completion 拿到 concrete `turnId` 时会提升并移除同一 thread/item 的 legacy no-turn shadow，防止异常路径下旧 no-turn 缓存残留后被下一个 turn 错误恢复；若 provider final 文本为空，则保留 existing/legacy shadow 正文作为 settled 文本。
  - `Sidebar.subagent-tree` heavy-test-noise 门禁用例已对齐当前 submenu 交互和批量 `assignWorkspaceSessionFolders` contract。
- 已完成 large-file governance 后续拆分：
  - 将 `renameThreadId` 的 thread identity 迁移/合并逻辑抽到 `threadReducerThreadIdentity.ts`。
  - `useThreadsReducer.ts` 从 2401 行降到 2158 行，已移出 `check:large-files:near-threshold` watch 列表。
  - 将 `useThreadActions.ts` 的 last-good snapshot、local archive/reconcile、unified history loader factory 和 options type 拆到独立 feature-local modules。
  - `useThreadActions.ts` 从 2782 行降到 2389 行，已低于 feature-hotpath watch 阈值 2400，并从 near-threshold watch 列表移除。
  - 将 `Sidebar.test.tsx` 的 shared mocks/default props 拆到 `Sidebar.test-utils.tsx`，主测试从 2755 行降到 2501 行。
  - 将 `useThreadActions.test.tsx` 的 shared mocks/reset 拆到 `useThreadActions.test-mocks.ts`，并将 resume guard 用例拆到 `useThreadActions.resume-guard.test.tsx`；主测试从 2746 行降到 2584 行。
  - 将 `StatusPanel.test.tsx` 的 governance/diff mocks 与 shared fixtures 拆到 `StatusPanel.test-utils.tsx`，主测试从 2687 行降到 2489 行。
  - 将 `useThreadMessaging.test.tsx` 的 service mocks、默认 workspace、reset 与 hook factory 拆到 `useThreadMessaging.test-utils.tsx`，主测试从 2640 行降到 2459 行。
  - 将 `FileViewPanel.test.tsx` 的 CodeMirror/preview/service/mermaid mocks 与 code-intel location builders 拆到 `FileViewPanel.test-utils.tsx`，主测试从 2619 行降到 2394 行。
  - large-file near-threshold watch 数从 16 降到 11，`Sidebar.test.tsx`、`useThreadActions.test.tsx`、`StatusPanel.test.tsx`、`useThreadMessaging.test.tsx` 与 `FileViewPanel.test.tsx` 已移出 watch 列表。
  - reducer public API 与 action contract 保持不变。
- 已补充长文本 streaming 的 reducer 与历史恢复相关测试（含长内容未截断 merge、recovery 匹配、render 回归）。
- 已增加可回退开关与诊断字段：长行可见文本增长、recovery source、阴影持久化恢复链路。

### 设计对齐说明

- 本次更新属于 **Decision 5（Folded lightweight Markdown live surface）** 的落地实现。
- 与 canonical/recovery 方向不冲突：折叠只作用在显示层；canonical 仍保持 full-body。

### 建议验证点（请你测试）

1. Claude 长输出（>20k）期间，UI 是否可见变更仍连续，但不再出现明显顿挫。
2. 长文在未完成时是否显示 head/tail 折叠且中间有省略文案，同时标题、列表、代码块等基础 Markdown 样式仍可见。
3. 同一条流结束后是否恢复完整 Markdown（列表、代码块、标题语义完整）。
4. 关闭/异常重开场景下，若 provider history 缺失 final body，历史恢复是否有本地 shadow 回填。
5. 新 turn 存在 turnId 时，旧 turn 的 shadow 不应被错误恢复到当前 turn。
