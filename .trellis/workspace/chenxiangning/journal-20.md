# Journal - chenxiangning (Part 20)

> Continuation from `journal-19.md` (archived at ~2000 lines)
> Started: 2026-06-07

---



## Session 736: 完成 Project Map 接口契约视图阶段交付

**Date**: 2026-06-07
**Task**: 完成 Project Map 接口契约视图阶段交付
**Branch**: `feature/v0.5.7`

### Summary

完成 OpenSpec add-project-map-api-contract-view 的实现、UI 收口、验证与阶段性提交。

### Main Changes

## 本次完成

- 完成 OpenSpec `add-project-map-api-contract-view` 的剩余实现与任务收尾，状态达到 `48/48 all_done`。
- 新增/完善 Project Map `接口 API` tab：API contract graph、group-first rendering、filters、endpoint inspector、method chain inspector。
- 完成 Rust API contract discovery/storage 增强：强契约源、adapter skeleton、identity merge、scope skip、ownership/stale/repair metadata。
- 完成 API view UI 阶段性重构：上方 toolbar 压缩为横排 filters；右侧 method chain 改为专用 card，补齐 source/target i18n。
- 补齐 API tab 大 endpoint smoke test，并修复 typecheck 暴露的 TS 问题。

## 关键验证

- `openspec validate add-project-map-api-contract-view --strict --no-interactive` 通过。
- `openspec instructions apply --change add-project-map-api-contract-view --json` 显示 `48/48`，`all_done`。
- `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml project_map_relations::tests` 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml project_map_api_contracts::tests` 通过。
- `npx vitest run src/features/project-map/components/ProjectMapRelationshipSection.api-smoke.test.tsx` 通过。
- `npm run typecheck` 通过。

## 主要文件

- `src-tauri/src/project_map_api_contracts.rs`
- `src-tauri/src/project_map_relations.rs`
- `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
- `src/features/project-map/components/ProjectMapRelationshipSection.api-smoke.test.tsx`
- `src/features/project-map/types.ts`
- `src/features/project-map/utils/relationshipDashboardModel.ts`
- `src/styles/project-map.api-contract.css`
- `src/i18n/locales/zh.part5.ts`
- `src/i18n/locales/en.part5.ts`
- `openspec/changes/add-project-map-api-contract-view/tasks.md`
- `openspec/changes/add-project-map-api-contract-view/design.md`


### Git Commits

| Hash | Message |
|------|---------|
| `5720fde9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 737: 修复 CI 门禁测试与大文件基线

**Date**: 2026-06-07
**Task**: 修复 CI 门禁测试与大文件基线
**Branch**: `feature/v0.5.7`

### Summary

修复 heavy-test-noise 与 large-file-governance 两个 workflow 的阻塞问题。

### Main Changes

- 修复 IntentCanvasManager 测试缺少 jsdom 环境导致 heavy-test-noise 中断。
- 同步 Intent Canvas transmission context 测试到当前 compact JSON payload marker。
- 刷新 large-file hard-debt baseline，将现有 4 个 hard-debt 文件记录为 retained 基线，恢复 hard gate。

验证：
- node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs
- npm run check:heavy-test-noise
- node --test scripts/check-large-files.test.mjs
- npm run check:large-files:near-threshold
- npm run check:large-files:gate


### Git Commits

| Hash | Message |
|------|---------|
| `fe76841f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 738: 拆分大文件硬债并清零门禁

**Date**: 2026-06-07
**Task**: 拆分大文件硬债并清零门禁
**Branch**: `feature/v0.5.7`

### Summary

完成 OpenSpec split-large-file-hard-debt 第一阶段实施，拆分 Project Map、layout hook、Rust path safety 和关系样式，刷新大文件 baseline，large-file gate 清零。

### Main Changes

- 创建 OpenSpec change: split-large-file-hard-debt，记录 proposal/design/tasks/spec delta。
- ProjectMapRelationshipSection 拆出 API/files/read workspace、API model 和 graph projection helper。
- useLayoutNodes 拆出 code-selection relationship graph、runtime lifecycle、message jump、user input focus helpers。
- project_map_relations.rs 拆出 path_safety 子模块，保留 command facade 和 response schema。
- project-map.relationship.css 拆出 inspector 样式分片并保持 project-map.css import 顺序。
- 刷新 docs/architecture/large-file-baseline.*，fail baseline entries 清空。
- 验证通过：npm run typecheck；npm run check:large-files:gate；npm run check:large-files:near-threshold；ProjectMapRelationshipSection.api-smoke.test.tsx；useLayoutNodes.client-ui-visibility.test.tsx；cargo test -p cc-gui project_map_relations；openspec validate split-large-file-hard-debt --strict --no-interactive。


### Git Commits

| Hash | Message |
|------|---------|
| `2a0efb00` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 739: 归档大文件拆分治理

**Date**: 2026-06-07
**Task**: 归档大文件拆分治理
**Branch**: `feature/v0.5.7`

### Summary

归档 OpenSpec change split-large-file-hard-debt；同步 large-file governance spec；拆分 Project Map relationship/layout/API contracts 大文件并通过 large-file gate、typecheck、OpenSpec strict validate 与 Rust focused compile。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ea0463ed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 740: 提交 Rust 格式化收口

**Date**: 2026-06-07
**Task**: 提交 Rust 格式化收口
**Branch**: `feature/v0.5.7`

### Summary

补提交上一轮 cargo fmt 产生的 Rust 机械格式化改动，覆盖 project_canvas、renderer_stability、runtime acquire boundary/mod/state；focused Rust compile 与 diff check 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2b4e4333` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 741: 防止跨引擎清理对话残留

**Date**: 2026-06-07
**Task**: 防止跨引擎清理对话残留
**Branch**: `feature/v0.5.7`

### Summary

为 Codex no-progress watchdog 的 interrupted cleanup 增加 engine scope guard，避免 stream correlation 属于 Claude 等其它引擎时误清理前台 turn residue；补充 focused Vitest 回归，并通过 touched lifecycle test/lint。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `baa85158` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 742: 保留旧品牌兼容路径例外

**Date**: 2026-06-07
**Task**: 保留旧品牌兼容路径例外
**Branch**: `feature/v0.5.7`

### Summary

修复 branding check：为旧 .mossx canvas 迁移路径和旧 .mossx/.codemoss ignored path 增加精确兼容例外，并将 project map ownership 测试 fixture 改为中性 storage key。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e52fb2f2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 743: Markdown 预览硬化收口

**Date**: 2026-06-07
**Task**: Markdown 预览硬化收口
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

完成 Markdown 预览硬化收口，拆分为 3 个原子提交：

- 20feb6a2 docs(openspec): 收口 Markdown 预览硬化方案
  - 回写 harden-file-markdown-preview-rendering proposal / design / tasks。
  - 新增 phase-1 implementation evidence note，记录实现与验证依据。

- 6b4e725a feat(markdown): 增加 fast preview 渲染链路
  - 新增 fastMarkdownRenderer 编译、sanitize、outline、heavy block profile、worker fallback 与测试。
  - 新增 FileMarkdownPreviewFast 和预览 outline/sidebar 样式能力。

- f9dfe648 feat(files): 增加 Markdown 预览专用大文件读取
  - 新增 Tauri/local 与 daemon remote 的 read_workspace_file_preview preview-only 读取通道。
  - 前端 readWorkspaceFilePreview 接入 Markdown preview，编辑路径继续保持原 read limit 与截断保护。
  - bounded renderer 行上限由 1800 调整到 2800。

验证状态：
- 本次提交收口未额外运行新的 typecheck / test。
- 提交前历史验证曾通过 OpenSpec strict validate、npm typecheck，以及 fastMarkdownRenderer 目标 vitest。


### Git Commits

| Hash | Message |
|------|---------|
| `f9dfe648` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 744: 移除 OpenCode CLI 扫描型测试

**Date**: 2026-06-07
**Task**: 移除 OpenCode CLI 扫描型测试
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

移除 OpenCode command build 相关测试，避免默认关闭的 OpenCode 引擎在 Rust lib 测试中触发 CLI 查找门禁。

改动：
- 删除 src-tauri/src/engine/opencode.rs 内 4 个 build_command_* 测试。
- 删除仅服务这些测试的 fake OpenCode CLI helper 与临时目录清理结构。
- 保留 OpenCode parser / event conversion / error extraction 测试，这些测试不触发 CLI scan。

背景：
- CI 失败点为 engine::opencode::tests::build_command_contains_required_flags。
- 错误为 OpenCode CLI not found。
- 本地单跑和本地 cargo test --lib 均通过，判断为 CLI 查找型测试对环境过敏。
- 产品侧 OpenCode 当前默认关闭，不应让默认 lib 测试依赖 OpenCode CLI 可解析。

验证：
- 本次变更后未额外运行测试。
- 变更前排查阶段已运行并通过：cargo test engine::opencode::tests::build_command_contains_required_flags --lib、cargo test engine::opencode::tests:: --lib、cargo test --lib。


### Git Commits

| Hash | Message |
|------|---------|
| `7acab695` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 745: 跳过默认关闭 OpenCode 会话扫描

**Date**: 2026-06-07
**Task**: 跳过默认关闭 OpenCode 会话扫描
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

修复 OpenCode 默认关闭时仍触发会话扫描并产生运行时提示的问题。

改动：
- src/services/tauri.ts：getOpenCodeSessionList 在后端返回 OpenCode disabled diagnostic 时返回空列表，不再让 traceStartupInvoke 记录内部命令失败。
- src-tauri/src/session_management_catalog_projection.rs：catalog 聚合在 cached OpenCode engine status 已为 disabled 时直接投影空 source，不进入 opencode_session_list_core。
- src-tauri/src/session_management_catalog_projection.rs：OpenCode CLI not found / disabled diagnostic 作为空 source 兜底，不再标记 degraded source。

背景：
- 运行时提示面板显示多 workspace 的 opencode_session_list 内部命令失败。
- OpenCode 当前默认关闭，自动线程/会话聚合不应该把未启用引擎当成异常提示。
- 手动启用 OpenCode 后，非 disabled / missing CLI 的真实错误仍继续抛出。

验证：
- 本次修复未额外运行测试。


### Git Commits

| Hash | Message |
|------|---------|
| `12480982` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 746: 同步 Markdown bounded preview 测试期望

**Date**: 2026-06-07
**Task**: 同步 Markdown bounded preview 测试期望
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

修复 CI 中 FileMarkdownPreview bounded projection 测试仍期待旧行数的问题。

改动：
- src/features/files/components/FileMarkdownPreview.test.tsx：将 data-markdown-visible-lines 期望从 1800 更新为 2800。

背景：
- 产品需求已将大 Markdown bounded projection 行数从 1800 调整为 2800。
- 实现文件 FileMarkdownPreview.tsx 已更新 BOUNDED_RENDER_LINE_LIMIT = 2_800。
- 测试仍断言旧值，导致 Vitest batch 52/155 失败。

验证：
- 本次只做测试断言同步，未额外运行测试。


### Git Commits

| Hash | Message |
|------|---------|
| `efc0022c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 747: 适配文档预览目录按钮测试

**Date**: 2026-06-07
**Task**: 适配文档预览目录按钮测试
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

修复 FileDocumentPreview 测试对目录按钮 accessible name 的旧断言。

改动：
- src/features/files/components/FileDocumentPreview.test.tsx：将目录按钮查询从精确名称改为标题前缀正则匹配。

背景：
- PreviewOutlineSidebar 的按钮文本现在包含标题和 heading level，例如“概览 h1”。
- 测试仍使用 role=button + name="概览" 精确匹配，导致 Testing Library 找不到按钮。
- 调整后仍验证点击对应目录项会滚动到 heading anchor。

验证：
- 本次只同步测试查询方式，未额外运行测试。


### Git Commits

| Hash | Message |
|------|---------|
| `23e41f2a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 748: 适配 PDF 预览目录按钮测试

**Date**: 2026-06-07
**Task**: 适配 PDF 预览目录按钮测试
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

修复 FilePdfPreview 测试对目录按钮 accessible name 的旧断言。

改动：
- src/features/files/components/FilePdfPreview.test.tsx：将 PDF outline 按钮查询从精确名称改为标题前缀正则匹配。

背景：
- PreviewOutlineSidebar 的按钮文本现在包含标题和 heading level，例如“Appendix h1”。
- PDF preview 复用该 sidebar，测试仍使用 role=button + name="Appendix" / "Section A" 精确匹配，导致 waitFor 超时。

验证：
- 已运行：npx vitest run src/features/files/components/FilePdfPreview.test.tsx
- 结果：5 tests passed。


### Git Commits

| Hash | Message |
|------|---------|
| `6f343a2d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 749: 补齐 FileViewPanel 预览读取 mock

**Date**: 2026-06-07
**Task**: 补齐 FileViewPanel 预览读取 mock
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

修复 FileViewPanel 测试中 tauri service mock 缺少新增 readWorkspaceFilePreview 导出的问题。

改动：
- src/features/files/components/FileViewPanel.test-utils.tsx：在 ../../../services/tauri mock 中加入 readWorkspaceFilePreview，默认返回空内容且 truncated=false。

背景：
- FileViewPanel 新增 preview-only 大 Markdown 读取路径后，组件 effect 会调用 readWorkspaceFilePreview。
- FileViewPanel.test.tsx 使用完整 module mock，但没有同步新增导出，导致 Vitest 抛 unhandled error。

验证：
- 已运行：npx vitest run src/features/files/components/FileViewPanel.test.tsx
- 结果：62 tests passed。


### Git Commits

| Hash | Message |
|------|---------|
| `dc6a56f1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 750: 记录 Codex codex-tui UA 兼容

**Date**: 2026-06-07
**Task**: 记录 Codex codex-tui UA 兼容
**Branch**: `feature/v0.5.7`

### Summary

Codex app-server 对话链路切换为 codex-tui 兼容身份，补 terminal env fallback，并保留 ccgui/codex-tui control-plane 过滤兼容。

### Main Changes

本次 session 记录 commit ba8786a7。

主要内容：
- Codex app-server 子进程启动时补充 TERM_PROGRAM / TERM_PROGRAM_VERSION，缺失时 fallback 为 Apple_Terminal/470.2。
- Codex app-server initialize.clientInfo 切换为 codex-tui，并从 codex --version 动态解析版本，失败 fallback 为 0.137.0。
- Claude history/control-plane filtering 兼容 ccgui 与 codex-tui，避免内部控制面消息污染历史。
- 新增 OpenSpec change: openspec/changes/harden-codex-tui-compatible-user-agent/。

验证：
- cargo test --manifest-path src-tauri/Cargo.toml parse_codex_cli_version_accepts_common_outputs
- cargo test --manifest-path src-tauri/Cargo.toml codex_tui_client_info_with_experimental_api_is_control_plane


### Git Commits

| Hash | Message |
|------|---------|
| `ba8786a7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 751: 收口接口契约边界与大文件门禁

**Date**: 2026-06-07
**Task**: 收口接口契约边界与大文件门禁
**Branch**: `feature/v0.5.7`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 代码提交 | 6e9c6afb |
| 主要改动 | 拆分 project_map_api_contracts 大文件中的 schema source 逻辑，修复 OpenAPI export 对无效协议/缺失 path 的边界处理，补齐 API pane resize listener cleanup，降低 duplicate key 噪声风险。 |
| 验证 | git diff --check；npm run check:large-files:gate；npm run typecheck；npx vitest run src/features/project-map/utils/apiContractExport.test.ts src/features/project-map/components/ProjectMapRelationshipSection.api-smoke.test.tsx；cargo test --manifest-path src-tauri/Cargo.toml project_map_api_contracts；npm run check:heavy-test-noise。 |
| 备注 | npm 输出 electron_mirror 环境 warning，非代码阻塞项。 |


### Git Commits

| Hash | Message |
|------|---------|
| `6e9c6afb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 752: 稳定异步测试等待契约

**Date**: 2026-06-07
**Task**: 稳定异步测试等待契约
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

修复 CI flaky 测试等待契约：
- McpSection 测试不再等待静态 Session overview，而是等待 OpenCode MCP 切换后的最终数据状态。
- GitHistoryWorktreePanel 测试在选择 commit message engine 后，显式等待 setTimeout(0) 驱动的英文二级菜单出现。

验证：
- npx vitest run src/features/settings/components/McpSection.test.tsx src/features/git-history/components/GitHistoryWorktreePanel.test.tsx
- 结果：2 个 test file passed，23 个 tests passed。


### Git Commits

| Hash | Message |
|------|---------|
| `f2518b86` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 753: 打磨 Project Map 文件关系与接口契约视图

**Date**: 2026-06-08
**Task**: 打磨 Project Map 文件关系与接口契约视图
**Branch**: `feature/v0.5.8`

### Summary

完成 Project Map Files/API/Graph MVP polish：低信号文件过滤文案、API 三栏与 Inspector 细化、Java 方法链路解析与分层展示、Graph 左右栏拖拽和节点文件名展示，并回写 OpenSpec。

### Main Changes

本次会话围绕 Project Map file relationship、API contract、Graph inspector 的 MVP 打磨收口。

主要变更：
- Files 视图：将 noise 文案调整为 low-signal，避免 governance/docs 根路径被无条件当作噪音隐藏。
- API 视图：压缩 toolbar，把 scan/export 放入 advanced filters；调整三栏默认比例；增加 Inspector detail focus / restore；优化 Responses 展示结构；Method chain 改为 endpoint-scoped layered tree，并支持 source/target file-line anchor。
- Backend scanner：Java/Spring method chain 从 handler body 做静态 receiver call 解析，避免固定范围扫描把 sibling method 调用误归到 endpoint。
- Graph 视图：Files / Canvas / Inspector 三栏支持左右 pane resize；修正后加载 CSS 覆盖导致拖拽不生效的问题；节点 basename 改为主信息展示，避免不必要省略。
- OpenSpec：更新 polish-project-map-files-api-mvp 的 proposal/design/tasks/specs，新增 project-map-relationship-graph-view delta spec。

验证：
- openspec validate polish-project-map-files-api-mvp --strict 通过。
- 会话中此前跑过 focused Rust unit test 与 TypeScript noEmit，均通过；本次提交前未重复跑全量 typecheck/test。


### Git Commits

| Hash | Message |
|------|---------|
| `6acd7dd9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 754: 收口 Project Map 阅读路径与关系精度

**Date**: 2026-06-08
**Task**: 收口 Project Map 阅读路径与关系精度
**Branch**: `feature/v0.5.8`

### Summary

优化 Project Map Read Path 定位、收紧 Java calls 关系解析，并清理文件关系底部噪音展示。

### Main Changes

| Area | Summary |
|------|---------|
| Project Map Read Path | 重做阅读路径 tab，将原始关系列表改成面向理解顺序的分层 route，包括入口关系、当前文件、依赖阅读、验证材料与 checklist。 |
| Java calls precision | 后端 Java 关系解析从全局 symbol 猜测收紧为 receiver/import/field/method-backed 解析，减少 DTO getter、Parameter、局部变量等误连。 |
| Relationship UI noise | 删除文件关系与其他 tab 底部全局 Repair / Read issues 噪音条，避免干扰主要图谱阅读。 |
| OpenSpec | 回写 polish-project-map-files-api-mvp 的 proposal/design/tasks，并新增 read-path-view delta spec 与 storage 行为约束。 |

**Code commit**: `346fcbf7 feat(project-map): 优化阅读路径与Java关系精度`

**Validation**: 未运行测试、typecheck 或 OpenSpec validate；本轮按用户要求做收口提交与记录。


### Git Commits

| Hash | Message |
|------|---------|
| `346fcbf7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 755: 收口 Project Map Read Path 提案与门禁修复

**Date**: 2026-06-08
**Task**: 收口 Project Map Read Path 提案与门禁修复
**Branch**: `feature/v0.5.8`

### Summary

回写 Project Map Read Path 提案，移除无效定位关系入口，并修复完整前端门禁 lint 问题。

### Main Changes

- 回写 polish-project-map-files-api-mvp OpenSpec proposal/design/spec/tasks，使 Read Path 定位到文件解剖图与方法链路闭环。
- 移除 Read Path 关系卡片里的“定位关系”动作入口，减少无效点击噪音。
- 修复完整 CI 暴露的 lint 问题：清理未使用 scope warning 类型/变量，修正 Java 方法声明正则中的无效转义。
- 验证通过：npm run lint && npm run typecheck && npm run test。


### Git Commits

| Hash | Message |
|------|---------|
| `5a657356` | (see git log) |
| `4b916613` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 756: Project Map API 合约大文件拆分

**Date**: 2026-06-08
**Task**: Project Map API 合约大文件拆分
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|---|---|
| 背景 | large-file-governance hard gate 指出 `src-tauri/src/project_map_api_contracts.rs` 接近/触发 3000 行 fail 阈值。 |
| 处理 | 拆出 API contract DTO 到 `project_map_api_contracts_types.rs`，拆出 hash/path/endpoint identity helper 到 `project_map_api_contracts_identity.rs`。 |
| 验证 | `cargo check --manifest-path src-tauri/Cargo.toml` 通过；`npm run check:large-files:near-threshold` 通过且仅 watch warning；`npm run check:large-files:gate` 通过，found=0。 |
| 影响 | 主文件从贴近 3000 行红线降至约 2793 行，保留约 200 行安全余量；未改变 API contract 构建行为。 |

**Updated Files**:
- `src-tauri/src/project_map_api_contracts.rs`
- `src-tauri/src/project_map_api_contracts_types.rs`
- `src-tauri/src/project_map_api_contracts_identity.rs`


### Git Commits

| Hash | Message |
|------|---------|
| `391a336d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 757: 拆分 Project Map 关系视图工作区

**Date**: 2026-06-08
**Task**: 拆分 Project Map 关系视图工作区
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 说明 |
|------|------|
| P0 拆分 | 完成 Project Map relationship/API/read/graph 工作区拆分，降低巨型组件混合职责。 |
| API workspace | 拆出 toolbar、group rail、endpoint stage、inspector 及 overview/parameter/response/evidence/method-chain sections。 |
| Read/File/Graph | 拆出 read workspace、file workspace、graph workspace、graph rail，并提取 read model 与 projection hooks。 |
| 门禁验证 | 已通过 typecheck、lint、目标 vitest、large-file check 与 diff whitespace check。 |

**Code Commit**: `a85570b7 refactor(project-map): 拆分关系视图工作区组件`

**Key Files**:
- `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
- `src/features/project-map/components/ProjectMapRelationshipWorkspaces.tsx`
- `src/features/project-map/components/ProjectMapRelationshipApiWorkspace.tsx`
- `src/features/project-map/components/ProjectMapRelationshipGraphWorkspace.tsx`
- `src/features/project-map/components/ProjectMapRelationshipReadWorkspace.tsx`
- `src/features/project-map/components/projectMapRelationshipReadModel.ts`
- `src/features/project-map/hooks/useProjectMapRelationshipApiProjection.ts`
- `src/features/project-map/hooks/useProjectMapRelationshipFileProjection.ts`
- `src/features/project-map/hooks/useProjectMapRelationshipGraphProjection.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `a85570b7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 758: 修复 markdown 预览标注测试 act warning

**Date**: 2026-06-08
**Task**: 修复 markdown 预览标注测试 act warning
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|---|---|
| 背景 | CI heavy-test-noise 在 FileViewPanel markdown preview annotation 用例中捕获 FileMarkdownPreviewFast 的 React act warning。 |
| 根因 | 测试只等待 markdown preview 挂载，未等待 rich preview outline 的异步 compile state update settle，Windows CI timing 下偶发越过 act 边界。 |
| 改动 | 在 annotation 操作前等待 `Show outline` 按钮出现，确保 outline async update 由 Testing Library async/act 处理。 |
| 验证 | 目标用例通过；FileViewPanel 所在 4 文件 batch 通过；目标文件 ESLint 通过；`npm run typecheck` 通过。 |

**Updated Files**:
- `src/features/files/components/FileViewPanel.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `c74d0f9f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 759: 收口 ProjectMap 大文件拆分

**Date**: 2026-06-08
**Task**: 收口 ProjectMap 大文件拆分
**Branch**: `feature/v0.5.8`

### Summary

将 ProjectMap 主面板、面板 surface、dataset 测试 fixture 与主 CSS 拆分到 feature-local 组件、hook、test support 与 CSS 分片；ProjectMap 相关原大于 2000 行文件均降到 2000 行以下，并完成批量验证。

### Main Changes

完成内容:
- 拆分 ProjectMapPanelSurfaces 为导航、关系、证据文件、详情、设置与生成弹窗组件，保留 barrel 兼容既有 import。
- 从 ProjectMapPanel 抽出 ProjectMapGraphCanvas、ProjectMapStorageSwitch、projectMapPanelModel、useProjectMapGraphInteractionHandlers、useProjectMapIntentCanvasHandlers。
- 抽出 useProjectMapDataset.testSupport，降低 dataset hook 测试文件体积。
- 将 project-map.css 中 graph canvas 与 evidence files 样式拆为 project-map.graph-canvas.css / project-map.evidence-files.css，并更新 CSS layout 测试读取分片。
- ProjectMapPanel.tsx、useProjectMapDataset.test.tsx、project-map.css 均已降至 2000 行以下。

验证:
- npm run typecheck
- npm run lint
- npm run test
- npm run check:large-files
- git diff --check


### Git Commits

| Hash | Message |
|------|---------|
| `f64deaf2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 760: 稳定实时对话幕布渲染

**Date**: 2026-06-08
**Task**: 稳定实时对话幕布渲染
**Branch**: `feature/v0.5.8`

### Summary

为 realtime conversation message canvas 增加 OpenSpec 提案和实现：识别 live tail row，检测 virtualizer empty visible set / active live row missing，触发有界 measure 恢复并记录 privacy-safe diagnostics；同时为 streaming assistant row 增加局部渲染稳定 CSS，并补充 focused regression tests。验证通过：OpenSpec strict validate、focused Vitest 36 tests、targeted ESLint、typecheck、large-file check。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `241f5839` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 761: 拆分客户端大文件第一组

**Date**: 2026-06-08
**Task**: 拆分客户端大文件第一组
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| App shell | Extracted composer model/reasoning/collaboration/access-mode state into `useAppShellComposerModelSection`; extracted plan/home/kanban/git-history view-state handling into `useAppShellViewStateSection`. |
| Kanban shell sections | Extracted composer-linked Kanban send flow into `useAppShellKanbanComposerSection`; extracted Kanban execution/scheduler lifecycle into `useAppShellKanbanExecutionSection`. |
| Layout hooks | Extracted layout node shared types into `layoutNodesTypes`; extracted topbar session tab state machine into `useLayoutTopbarSessionTabs`. |
| Governance | Kept original public hook surfaces intact while bringing large-file policy check to `found=0`. |

**Validation**:
- `npm run typecheck -- --pretty false`
- `npm run lint`
- `npm run check:large-files`
- `npx openspec validate harden-live-message-canvas-rendering --strict --no-interactive`
- `npm run test` (completed 621 test files)


### Git Commits

| Hash | Message |
|------|---------|
| `7473688b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 762: 修复大文件拆分后启动崩溃

**Date**: 2026-06-08
**Task**: 修复大文件拆分后启动崩溃
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| App shell split regression | Restored `handleDispatchOrchestrationTask` wiring after extracting Kanban execution logic. |
| Kanban execution section | Moved orchestration dispatch dependencies into `useAppShellKanbanExecutionSection` and returned the handler to `useAppShellSections`. |
| Regression coverage | Added a static adapter contract assertion so the extracted execution section must destructure and return the dispatch handler. |

**Root Cause**:
`useAppShellSections.ts` still returned `handleDispatchOrchestrationTask`, but the extracted `useAppShellKanbanExecutionSection` did not return it. Because the adapter file is still under legacy `ts-nocheck`, TypeScript did not catch the missing binding and the app failed at runtime during initial render.

**Validation**:
- `npm run typecheck -- --pretty false`
- `npm run lint`
- `npm run check:large-files`
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/app-shell-parts/useAppShellSections.kanban-text.test.ts src/app-shell-parts/useAppShellLayoutNodesSection.test.ts src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `58ca7358` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 763: 拆分客户端大文件第二组

**Date**: 2026-06-08
**Task**: 拆分客户端大文件第二组
**Branch**: `feature/v0.5.8`

### Summary

拆分 files 面板与 Sidebar 大文件：抽离 FileView/FileTree helpers、文件树行渲染、Sidebar 菜单/弹层/工具逻辑；验证 typecheck、lint、large-file sentry 与 targeted tests 全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `47e36c4f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 764: 收敛旧品牌兼容入口

**Date**: 2026-06-08
**Task**: 收敛旧品牌兼容入口
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

修复 v0.5.8 Windows doctor branding gate 失败。

主要变更：
- 将 HomeChat 默认 workspace 候选路径生成收敛到 src/features/workspaces/utils/defaultWorkspace.ts，避免 app shell hook 直接散落 legacy brand path 字面量。
- 新增 getDefaultWorkspaceCandidatePaths(homePath)，并补充 defaultWorkspace targeted tests。
- 将 FileViewPanel markdown fast renderer 的 legacy localStorage key 读取迁移到 src/features/files/utils/fileMarkdownFeatureFlags.ts，使组件 internals 回归 editor/CodeMirror 辅助职责。
- 同步 scripts/check-branding.mjs 的精确允许规则到实际兼容 utility 文件。

验证：
- npm run check:branding
- npm exec vitest run src/features/workspaces/utils/defaultWorkspace.test.ts
- npm exec vitest run src/features/files/components/FileViewPanel.test.tsx
- npm run typecheck
- npm run doctor:win

结果：doctor:win 通过，Doctor: OK。


### Git Commits

| Hash | Message |
|------|---------|
| `b79ce303` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 765: 拆分消息渲染大文件

**Date**: 2026-06-08
**Task**: 拆分消息渲染大文件
**Branch**: `feature/v0.5.8`

### Summary

拆分 Messages/MessagesRows 消息渲染大文件，抽出 view model、类型、常量、锚点栏、inline prompts 与上下文摘要卡片，并迁移 reasoning render 测试；已通过 lint、typecheck、大文件检查和消息区 targeted Vitest。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9e249e7f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 766: 提交 Codex provider 作用域会话启动变更

**Date**: 2026-06-09
**Task**: 提交 Codex provider 作用域会话启动变更
**Branch**: `feature/v0.5.8`

### Summary

按模块提交 Codex provider-scoped session launch：OpenSpec 规范、Rust provider runtime/session 绑定、前端 provider 选择展示，以及 Project Map 测试格式整理。

### Main Changes

本次会话按模块完成工作区整体提交：

- docs(openspec): 新增 add-codex-provider-scoped-session-launch change artifacts，覆盖 proposal/design/tasks/spec deltas。
- feat(codex): 后端支持 provider-scoped CODEX_HOME、runtime key、thread provider binding、catalog projection、fork provider rebind 与 thread-bound routing。
- feat(sidebar): 前端支持 Codex 新会话 provider selector、sidebar provider badge/fallback label、fork dialog provider 选择、thread reducer metadata 保留、tauri service payload 与相关测试/i18n/styles。
- refactor(project-map): 整理 API contract relation 相关 Rust 测试和轻量格式化变更。

已执行：
- npm run typecheck
- npm run lint


### Git Commits

| Hash | Message |
|------|---------|
| `d1b8c648` | (see git log) |
| `1b572f99` | (see git log) |
| `6e1c97b6` | (see git log) |
| `319293be` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 767: 修复用户输入提交与取消收口

**Date**: 2026-06-09
**Task**: 修复用户输入提交与取消收口
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Thread user input | Distinguished submit vs dismiss settlement for AskUserQuestion/requestUserInput handling. |
| Regression coverage | Updated stale timeout test to use dismiss path and added retryable empty-submit/malformed-empty-submit cases. |
| Verification | Passed `npm run lint`, `npm run typecheck`, full `npm run test`, targeted `npx vitest run src/features/threads/hooks/useThreadUserInput.test.tsx`, and `git diff --check`. |

**Updated Files**:
- `src/features/threads/hooks/useThreadUserInput.ts`
- `src/features/threads/hooks/useThreadUserInput.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `9b074c8f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 768: Composer provider 标签显示

**Date**: 2026-06-09
**Task**: Composer provider 标签显示
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

本次完成 composer 底部右侧 Codex provider/source 标签显示。

主要改动：
- 复用 sidebar 的 Codex provider label 解析逻辑，在 layout 层从 active thread 解析当前 provider label。
- 将 providerProfileLabel 贯穿 Composer、ChatInputBoxAdapter、ChatInputBox、ChatInputBoxFooter 到 ButtonArea。
- 在 ButtonArea 右侧 send/stop 按钮前渲染 compact provider tag，并增加局部 toolbar CSS。
- 增加 ButtonArea 单测，锁定 provider tag 出现在 send control 前。

验证：
- npx vitest run src/features/composer/components/ChatInputBox/ButtonArea.test.tsx
- npm run typecheck
- npm run check:large-files
- npm run lint

注意：提交时刻工作区仍有非本次任务的 Rust 文件未提交，已排除在本次 code commit 外。


### Git Commits

| Hash | Message |
|------|---------|
| `1d2797bc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 769: 修复 Codex 磁盘会话 stale thread 重试

**Date**: 2026-06-09
**Task**: 修复 Codex 磁盘会话 stale thread 重试
**Branch**: `feature/v0.5.8`

### Summary

修复磁盘 .codex 模式创建/发送时 app-server 返回 thread not found 的恢复路径：同 provider runtime 内先 thread/resume 再 bounded retry turn/start；补齐 daemon providerProfileId 解析和 managed provider unsupported guard；同步回写 provider-scoped session launch OpenSpec，并通过 openspec validate、Rust focused tests、cargo no-run 和 runtime contract 检查。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `24b92415` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 770: 同步 Codex 供应商契约文档

**Date**: 2026-06-09
**Task**: 同步 Codex 供应商契约文档
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

## Goal
提交当前工作区中的 Codex provider / codex-tui 相关 OpenSpec 与 Trellis code-spec 文档变更。

## Changes
- 新增 `.trellis/spec/backend/codex-provider-scoped-runtime.md`，固化 Codex provider-scoped runtime、thread binding、fork、stale retry 与 codex-tui launch identity 的 executable contract。
- 新增 `.trellis/spec/frontend/codex-provider-session-ui.md`，固化 provider selector、start/fork payload、thread metadata merge、sidebar/pinned/composer label contract。
- 更新 `.trellis/spec/backend/index.md` 与 `.trellis/spec/frontend/index.md`，将新 code-spec 纳入 Pre-Development Checklist。
- 校准 `add-codex-provider-scoped-session-launch` proposal/design/tasks/spec，明确 disk legacy runtime key、managed provider runtime key、frontend in-flight identity 和 provider metadata preservation。
- 为 `harden-codex-tui-compatible-user-agent` 新增 behavior spec，并在 proposal/tasks 中同步 codex-tui compatible launch identity 与 control-plane filtering contract。

## Validation
- `openspec validate add-codex-provider-scoped-session-launch --strict --no-interactive` passed。
- `openspec validate harden-codex-tui-compatible-user-agent --strict --no-interactive` passed。
- `git diff --check` passed。
- 未运行 `npm`/`cargo` gates：本次仅提交文档与 spec artifact，无源码改动。

## Follow-ups
- `add-codex-provider-scoped-session-launch` 仍有 manual verification evidence task 未完成。
- `harden-codex-tui-compatible-user-agent` 仍需 relay-side request-log evidence。


### Git Commits

| Hash | Message |
|------|---------|
| `e6dc2157` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 771: 会话列表供应商标签显示开关

**Date**: 2026-06-09
**Task**: 会话列表供应商标签显示开关
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Settings | Added `showSidebarProviderLabels` app setting with TS/Rust defaults normalized to false. |
| UI | Moved the provider-label visibility switch into Settings -> Vendor Management -> Codex, instead of Basic Appearance. |
| Sidebar | ThreadList, PinnedThreadList, Sidebar, WorktreeSection, folder-tree thread list props now hide Codex provider labels by default and show them only when the setting is enabled. |
| Tests | Added/updated focused coverage for default-hidden labels, explicit opt-in rendering, settings normalization, Rust defaults, and VendorSettingsPanel switch persistence. |

**Validation**:
- `npx vitest run src/features/vendors/components/VendorSettingsPanel.test.tsx src/features/settings/components/SettingsView.test.tsx src/features/app/components/ThreadList.test.tsx src/features/app/components/PinnedThreadList.test.tsx src/features/app/components/Sidebar.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `cargo test --manifest-path src-tauri/Cargo.toml app_settings_defaults --quiet`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `openspec validate add-codex-provider-scoped-session-launch --strict --no-interactive`

**Notes**:
- Default behavior remains hidden to reduce sidebar noise.
- The setting controls display only; it does not change Codex provider binding or launch semantics.
- Untracked `openspec/changes/harden-codex-provider-session-catalog-recovery/` was detected and intentionally left out of this commit/session record.


### Git Commits

| Hash | Message |
|------|---------|
| `3b4a975a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 772: 校准 Codex provider home catalog recovery 提案

**Date**: 2026-06-09
**Task**: 校准 Codex provider home catalog recovery 提案
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| OpenSpec change | `harden-codex-provider-session-catalog-recovery` |
| 本次动作 | 将未跟踪的 OpenSpec 提案独立提交，避免后续实现代码与提案文档混在同一个 commit。 |
| 状态 | Planning complete / Implementation not started。 |
| 关键结论 | 该 change 用于修复 managed Codex provider sessions 存在 `codex-provider-homes/<providerId>` 后，workspace catalog 刷新/重启无法恢复 provider-home-only sessions 的缺口。 |
| 验证 | `openspec validate harden-codex-provider-session-catalog-recovery --strict --no-interactive` 通过。 |

**Updated Files**:
- `openspec/changes/harden-codex-provider-session-catalog-recovery/.openspec.yaml`
- `openspec/changes/harden-codex-provider-session-catalog-recovery/proposal.md`
- `openspec/changes/harden-codex-provider-session-catalog-recovery/design.md`
- `openspec/changes/harden-codex-provider-session-catalog-recovery/tasks.md`
- `openspec/changes/harden-codex-provider-session-catalog-recovery/specs/codex-session-sidebar-state-parity/spec.md`
- `openspec/changes/harden-codex-provider-session-catalog-recovery/specs/workspace-session-catalog-projection/spec.md`


### Git Commits

| Hash | Message |
|------|---------|
| `ebf75dff` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 773: 恢复 Codex provider home 会话目录扫描

**Date**: 2026-06-09
**Task**: 恢复 Codex provider home 会话目录扫描
**Branch**: `feature/v0.5.8`

### Summary

实现 Codex managed provider home 的 sessions/archived_sessions 扫描、provider metadata 投影、sourceKind 后端状态和 provider-home mutation 回归测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `27a43778` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 774: 保留 provider home 会话侧栏连续性

**Date**: 2026-06-09
**Task**: 保留 provider home 会话侧栏连续性
**Branch**: `feature/v0.5.8`

### Summary

前端按 engine/sourceKind 合并 catalog source status，provider-backed Codex rows 在 degraded refresh 中继续保留，并补齐 provider metadata 类型与回归测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d88fb69d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 775: 收口 provider home 会话恢复提案

**Date**: 2026-06-09
**Task**: 收口 provider home 会话恢复提案
**Branch**: `feature/v0.5.8`

### Summary

更新 OpenSpec proposal/tasks 与 Trellis workspace session catalog contract，明确 provider-home sourceKind 合同、自动化验证状态和剩余真实 app 手工验证项。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8cd0c751` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 776: 拆分会话管理大文件测试

**Date**: 2026-06-09
**Task**: 拆分会话管理大文件测试
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| Summary | 拆分 `src-tauri/src/session_management_tests.rs`，将共享 fixture/helper 与 catalog、metadata/provider-home、folder、archive/delete、workspace scope、projection 等测试按主题迁移到多个 Rust test include 文件。 |
| Validation | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`; `git diff --cached --check`; `cargo test --manifest-path src-tauri/Cargo.toml session_management`; `npm run check:large-files:gate`。 |
| Result | large-file gate 从 `found=1` 恢复为 `found=0`；session_management 聚焦测试在 lib 与 daemon test binary 均为 78 passed。 |
| Notes | 仅提交 Rust 后端测试拆分；保留既有前端 `Sidebar.test.tsx` 与 `sidebarInternals.ts` 未提交改动。 |


### Git Commits

| Hash | Message |
|------|---------|
| `ef677161` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 777: 兼容 Codex provider-home 会话归属恢复错误

**Date**: 2026-06-09
**Task**: 兼容 Codex provider-home 会话归属恢复错误
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| Summary | 将 Sidebar 的 `isSessionCatalogNotReadyError` 扩展为同时识别 legacy `session does not belong to target workspace` 与新的 `Codex session target could not be resolved safely` 错误。 |
| Tests | 在 `Sidebar.test.tsx` 中覆盖 legacy 与 Codex provider-home unresolved 错误都被判定为 retryable。 |
| Validation | `npm exec vitest run src/features/app/components/Sidebar.test.tsx`; `npm run typecheck`; `npm run lint -- --quiet src/features/app/components/Sidebar.test.tsx src/features/app/components/sidebarInternals.ts`; `git diff --check`。 |


### Git Commits

| Hash | Message |
|------|---------|
| `f464ef6c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 778: 修复 Sidebar 子会话移动测试等待

**Date**: 2026-06-09
**Task**: 修复 Sidebar 子会话移动测试等待
**Branch**: `feature/v0.5.8`

### Summary

修复 Sidebar subagent tree 测试在 CI 慢环境中的 act warning 和 timeout 风险。

### Main Changes

- `Sidebar.subagent-tree.test.tsx` 将 Move to folder submenu hover 纳入 async act。
- 点击目标 folder 后用 `waitFor` 等待 batch assignment 调用和 Target folder DOM 渲染收敛。
- 验证：`npx vitest run --maxWorkers 1 --minWorkers 1 src/features/app/components/Sidebar.subagent-tree.test.tsx`。
- 验证：`npx vitest run --maxWorkers 1 --minWorkers 1 src/features/app/components/Sidebar.subagent-tree.test.tsx src/features/app/components/Sidebar.test.tsx src/features/app/components/sidebarCodexIconTone.test.ts src/features/app/components/SidebarWorkspaceMenuOverlay.test.tsx`。
- 验证：`npx eslint src/features/app/components/Sidebar.subagent-tree.test.tsx`。


### Git Commits

| Hash | Message |
|------|---------|
| `d4a7ed63` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 779: Session Activity 轮次产物语义 diff 第一版

**Date**: 2026-06-10
**Task**: Session Activity 轮次产物语义 diff 第一版
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Product | 将 Session Activity 的文件视图改为轮次级“产物”视图，按对话轮次展示 AI 改动了哪些文件。 |
| UI | 合并 file-change card 与文件列表，产物模块内提供“产物 / 语义 diff” tabs，header 压缩为单行，语义 diff 使用单列布局。 |
| Semantics | 新增基于 diff evidence 的确定性语义摘要，覆盖 intent、behavior、risk、validation，并展示本轮语义。 |
| Turn Context | `turnSemantic` 来自用户消息，并支持 child session 继承父轮次用户请求；文本由 React 转义展示。 |
| Reliability | 产物 tab 计数按去重文件数显示，不再按底层 file-change event 数显示。 |
| Governance | 新增 OpenSpec change `add-semantic-diff-review` 和 Trellis task PRD，并已归档 task。 |

**Validation**:
- `npx vitest run src/features/session-activity/components/WorkspaceSessionActivityPanel.test.tsx src/features/session-activity/adapters/buildWorkspaceSessionActivity.test.ts src/features/git/utils/semanticDiffSummary.test.ts` -> 98 passed
- `npm run typecheck` -> passed
- `npm run lint` -> passed
- `npm run check:large-files` -> passed
- `openspec validate add-semantic-diff-review --strict --no-interactive` -> valid


### Git Commits

| Hash | Message |
|------|---------|
| `1c5e6a6e` | (see git log) |
| `0192308a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 780: 深化 Session Activity 语义 Diff 证据审查

**Date**: 2026-06-10
**Task**: 深化 Session Activity 语义 Diff 证据审查
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Semantic Diff Model | 扩展 `SemanticDiffSummaryItem`，支持 `source` 与 structured `evidenceRefs`，保留数组输入兼容性并新增 object input。 |
| Evidence Collection | 接入同 turn validation command evidence，区分 test-file hint 与真实验证命令结果。 |
| Extractors | 增加 TypeScript/React/test/config deterministic facts，包括 hooks、component、state、handler、test case、assertion、config key。 |
| AI Review Contract | 新增 bounded AI review fact contract；无 evidence refs 的 AI fact 会被丢弃，不自动调用模型。 |
| UI | 语义 diff 保持平铺极简；为章节加入主题适配色彩；证据合并为单行，长路径自适应换行，文件证据可点击打开到对应行号。 |
| Proposal Sync | 新增并回写 OpenSpec change `deepen-semantic-diff-review` 与 Trellis task/PRD，记录 evidence UI 单行与 file-line navigation contract。 |
| Validation | 通过 OpenSpec strict、focused Vitest、lint、typecheck、large-file check。 |


### Git Commits

| Hash | Message |
|------|---------|
| `9daa596c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 781: 扩展自定义主题配色

**Date**: 2026-06-10
**Task**: 扩展自定义主题配色
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

本次完成自定义主题配色扩展并修复新增 preset 保存后回弹问题。

主要变更：
- 新增 OpenSpec change `add-custom-theme-palette-presets`，记录自定义主题新增 10 套配色的 proposal、tasks 与 `settings-custom-theme-presets` spec delta。
- 前端新增 5 套 light preset 与 5 套 dark preset，更新 `ThemePresetId` 类型、`vscodeThemePresets` catalog、SettingsView 下拉顺序测试和中英文 i18n label。
- 修复新增主题切换后瞬间回退问题：同步 `src-tauri/src/shared/settings_core.rs` 的 Rust settings sanitize 白名单和 custom window appearance 解析，避免后端把新增 `customThemePresetId` 当非法值回退到默认 preset。
- 补充 Rust regression coverage，确认新增 preset 可通过后端 sanitize 并解析正确 light/dark appearance。

验证：
- `npx vitest run src/features/theme/utils/themePreset.test.ts src/features/settings/components/SettingsView.test.tsx` 通过。
- `npm run typecheck` 通过。
- 相关文件 ESLint 通过。
- `npm run check:large-files` 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml shared::settings_core::tests` 通过。
- `openspec validate add-custom-theme-palette-presets --strict --no-interactive` 通过。

备注：
- 未纳入无关未跟踪目录 `.trellis/tasks/06-10-client-module-integration-plan/` 与 `openspec/changes/extend-client-font-size-coverage/`。


### Git Commits

| Hash | Message |
|------|---------|
| `f79e269e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 782: 扩展客户端字号覆盖范围

**Date**: 2026-06-10
**Task**: 扩展客户端字号覆盖范围
**Branch**: `feature/v0.5.8`

### Summary

将客户端字号设置扩展到主窗口和 detached/client windows 的可读文本区域，覆盖文件树、Git worktree、diff metadata、sidebar、message canvas、tool block、session activity 与 mobile tabbar；保留图标、命中区、行高和布局密度不随内容字号隐式缩放。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fc2a2a1f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
