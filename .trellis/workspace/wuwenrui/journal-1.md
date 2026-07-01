# Journal - wuwenrui (Part 1)

> AI development session journal
> Started: 2026-06-01

---



## Session 1: lawyer-shell MVP first cut

**Date**: 2026-06-10
**Task**: lawyer-shell MVP first cut
**Branch**: `feat/lawyer-shell`

### Summary

Add lawyer mode shell: uiMode setting (default developer), LAWYER_VISIBLE_NAV sidebar filtering, local case registry (app client store lawyerCases), CaseHomePage with new-case wizard creating workspace + standard dir skeleton, quick actions dispatching SELECT_SKILL_EVENT. OpenSpec change add-lawyer-mode-shell. 22 new vitest passed; typecheck/lint/cargo check/gates clean.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ed46163a` | (see git log) |
| `7675038e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 2: FanBox 改版、lawhub 技能概览与 0.5.26 发布准备

**Date**: 2026-06-12
**Task**: FanBox 对话优先改版 + lawhub 技能分组概览 + PPT 列表修缮 + 菜单品牌名 + 发布
**Branch**: `main`

### Summary

FanBox 对话优先工作台（casebar 三视图 + 右栏四 tab + 会话文件双区，复用 FileTreePanel 数据源做工作区树热度标记）；lawhub 技能概览抽屉（什么时候用/能做什么/怎么用，能力卡点击出子技能介绍，文件树移除）；bundled 技能启动补装（install_missing_skills 只补缺不覆盖，修复"点击无 chip"）；新增制作技能/文件转Markdown/视觉OCR bundled skills；PPT 列表创建时间倒序 + 组头折叠 + 38vh 内滚 + open_workspace_path_default 修系统打开；macOS 菜单 hide/quit/about 统一 LawyerCopilot（useMenuLocalization APP_NAME 运行时覆盖是根因）；vision 预检工作流与端点域名迁移一并入库。

### Git Commits

| Hash | Message |
|------|---------|
| `e430ecee` | feat(vision): 新增视觉模型预检工作流与可配置视觉模型设置 |
| `bbaab2bc` | feat(vendors): 旧 IP 端点一次性迁移到正式域名 |
| `934dd189` | feat(lawhub): 技能分组概览抽屉、bundled 技能启动补装与 PPT 列表修缮 |
| `2e5158c3` | feat(fanbox): 对话优先工作台改版与会话文件双区视图 |
| `5d36173b` | fix(menu): macOS 菜单项统一品牌名 LawyerCopilot |
| `253be249` | chore(build): 精简 openssl 静态链接说明与修复脚本 |

### Testing

- [OK] vitest：session-evidence 42、lawhub 17、skill-market 42、app 388 全绿
- [OK] cargo test：skill_installer 5/5、menu 4/4
- [OK] typecheck + eslint 干净
- [OK] 真机探针：文件双区/倒序/内滚/系统打开/chip 注入/概览抽屉/能力卡介绍逐项实测

### Status

[OK] **Completed**

### Next Steps

- 合并 upstream/main、跑全量门禁、push 触发 0.5.26 构建


## Session 3: 视觉模型与桌面交互闭环

**Date**: 2026-06-14
**Task**: 视觉模型与桌面交互闭环
**Branch**: `main`

### Summary

完善视觉模型同步、文件输入与桌面交互问题修复

### Main Changes

- 完成视觉模型同步标记与首选视觉模型写入。
- 修复视觉任务缺 key 时的配置入口闭环。
- 修复消息区横向偏移与自动滚动横向漂移。
- 补齐图片/PDF 视觉输入、拖拽 hover 反馈与相关 OpenSpec 记录。
- 验证：npm run typecheck；npm run lint；npm run test；npm run test:integration；cargo test --manifest-path src-tauri/Cargo.toml。


### Git Commits

| Hash | Message |
|------|---------|
| `b8e38b46` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 统一 lawhub 技能中文展示和查看入口

**Date**: 2026-06-14
**Task**: 统一 lawhub 技能中文展示和查看入口
**Branch**: `main`

### Summary

统一 lawhub 技能中文展示名，补齐内置 skill 小眼睛查看入口，并让 $ 技能下拉展示中文名。

### Main Changes

本次实现：
- lawhub 左侧内置技能和已安装技能统一使用中文展示名。
- 已安装 skill 点击时使用中文名触发选择，Composer 再映射到真实 skill token 发送。
- $ 技能下拉读取已安装 skill index，优先展示中文 displayName 并支持中文搜索。
- 内置单文件 skill 支持通过结构抽屉查看介绍、使用场景和使用方法。
- Rust skill_market 支持顶层单文件 skill 的 tree/file 读取。

验证：
- npm run typecheck
- npm run lint
- npm run test
- npm run test:integration
- cargo test --manifest-path src-tauri/Cargo.toml


### Git Commits

| Hash | Message |
|------|---------|
| `6c626e31` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: 修复请求输入跳转右漂

**Date**: 2026-06-15
**Task**: 修复请求输入跳转右漂
**Branch**: `main`

### Summary

修复请求输入卡片跳转时触发横向滚动导致对话内容右漂的问题，补充回归测试和可视化说明页。

### Main Changes

| Area | Detail |
|------|--------|
| Frontend | `focusUserInputRequestCard` 改为滚动 `.messages` 容器，显式写入 `left: 0` 与 `scrollLeft = 0`。 |
| Tests | 新增 `userInputRequestFocus.test.ts`，复现 `scrollLeft=240` 并断言跳转后回到 `0`。 |
| Docs | 新增 `docs/user-input-scroll-drift-explained.html` 说明旧问题与修复效果。 |

### Testing

- [OK] `npx vitest run src/features/layout/hooks/userInputRequestFocus.test.ts src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx src/features/app/components/RequestUserInputMessage.test.tsx src/styles/messages-overflow-guard.test.ts`：33/33 passed
- [OK] `npm run typecheck`


### Git Commits

| Hash | Message |
|------|---------|
| `d2447e4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 合并 upstream main 并保留 fork 能力

**Date**: 2026-06-15
**Task**: 合并 upstream main 并保留 fork 能力
**Branch**: `main`

### Summary

合并 upstream/main，解决冲突并保留本 fork 的 app shell、Settings、new-api 用量、Skill Market 等能力。

### Main Changes

| Area | Detail |
|------|--------|
| Upstream | 合并 upstream/main 的非冲突改动。 |
| Conflict resolution | 对冲突文件保留 fork 侧关键能力，并调整上游新增测试匹配当前 fork 架构。 |
| Tests | 补充 UsageBadge 空返回防御，修正 app shell 相关测试断言。 |

### Testing

- [OK] `npm run typecheck`
- [OK] `npm run test` (699 test files)
- [OK] `cd src-tauri && cargo test` (1308 lib tests, 761 daemon tests, 2 config tests)


### Git Commits

| Hash | Message |
|------|---------|
| `625216f0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: 修复设置崩溃和模型映射回填

**Date**: 2026-06-15
**Task**: 修复设置崩溃和模型映射回填
**Branch**: `main`

### Summary

修复 app-shell domain context 旧状态崩溃、设置页样式加载门禁、模型同步弹窗二次编辑回填。

### Main Changes

- 修复 app-shell domain context 展平函数对 undefined/null/缺字段的防御，避免发布包中旧状态触发整页 Application Error。
- 修复 Sync Models from Site 弹窗初始化，二次打开时优先使用 active provider 已保存的 haiku/sonnet/opus 映射。
- 将 SettingsView 的 settings.css 改为组件静态 import，并把 runtime contract 门禁改为检查该组件边界。
- 验证：npx vitest run 相关 5 个测试文件，node --test scripts/check-app-shell-runtime-contract.test.mjs，npm run check:app-shell:runtime-contract，npm run typecheck，npm run build，npm run doctor:strict，npm run lint，git diff --check，npm run test（701 files）。


### Git Commits

| Hash | Message |
|------|---------|
| `84c1c07d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: 核验设置崩溃/模型映射修复并补回填测试

**Date**: 2026-06-16
**Task**: 核验设置崩溃/模型映射修复并补回填测试
**Branch**: `main`

### Summary

对抗式核验 2cee526f 三类修复均有效，补全门禁验证与模型映射回填边界测试

### Main Changes

对上一会话 fix(app-shell) 2cee526f 的修复汇报做对抗式核验（workflow 12 agent + 6 skeptic 复核）：

- 三类修复均确认真实有效、无生产 bug：
  1. 更新后崩溃：根因是旧 renderAppShell/useAppShellSections 把恒为 undefined 的 ctx.appShellDomainContexts 传入旧 flatten，改走 flattenAppShellContextInput 的 return input 分支修复（appShellDomainContexts.ts:142）
  2. 设置页 CSS：改前 SettingsView 零 CSS 加载路径（loader 调用在合并中丢失），静态 import settings.css 正确补上（SettingsView.tsx:4）
  3. 模型映射回填：读写 env key 逐字一致 ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL，闭环成立
- 实测补齐此前未跑的门禁：build / doctor:strict / cargo test / typecheck / lint / 全量 test(701 files) 全部 exit 0
- 补齐唯一测试盲区：SiteModelPicker initialSlotMapping 回填三种边界（commit 0bf97e77，+3 测试，6/6 通过）
- 决策保留孤儿（about.github i18n key / loadSettingsStyles / about.css 死 class）：fork upstream 同步缓冲 + 非 bug + 与预存孤儿同类，不做选择性清理
- upstream/main(0.5.10) 已被 HEAD 完全包含，无需 merge

后续：push main + gh workflow run release.yml 触发发版


### Git Commits

| Hash | Message |
|------|---------|
| `0bf97e77` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: 完善微信高级功能与远程控制

**Date**: 2026-06-25
**Task**: 完善微信高级功能与远程控制
**Branch**: `feat/wechat-bridge`

### Summary

完成微信入口远程控制、高级功能权益校验、富媒体收发、全权限任务执行与伙伴式回复体验，并补充 Go/Rust/前端测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2516c712` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: 修复最终消息后忙碌态残留

**Date**: 2026-07-01
**Task**: 修复最终消息后忙碌态残留
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

目标：修复用户反馈的“模型最终回复已经显示，但顶部/对话仍停留在正在生成响应，用户打断后进入融合回复”的桌面端残留忙碌态问题。

主要改动：
- 在 useThreadEventHandlers 增加 assistant final settlement fallback：assistant 完成消息出现后，若 3 秒内没有 turn/completed 或 turn/error，且线程仍 isProcessing、activeTurn 匹配、无 active execution blocker，则主动执行终态收敛。
- fallback 会清理 busy state、activeTurnId、pending tool status、plan/context compacting 状态、agent segment，并补发 terminal settlement/domain diagnostics，避免用户误判模型仍在响应。
- 新增/改写回归测试，复现“final assistant message without terminal event”并验证 3 秒兜底后 markProcessing(false)、setActiveTurnId(null)、markRealtimeTurnTerminal 与 diagnostic 均发生。

验证：
- npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts -t "settles a codex turn from assistant message completion when no terminal event follows"：1/1 通过（先 RED 后 GREEN）。
- npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts：62/62 通过。
- npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreadMessaging.test.tsx：199/199 通过。
- npm run test：765 test files completed，全部通过。
- npm run typecheck：通过。
- npm run lint：通过。
- npm run doctor:strict：通过。
- cargo test（src-tauri）：lib 1466/1466、main 1/1、cc_gui_daemon 851/851、wx_bridge 99/99、tauri_config 3/3、doc-tests 0 通过。
- git diff --check：通过。
- Fork 能力锚点检查：社区/反馈模块未渲染；new-api provider onboarding/vendors、环境依赖检查、余额徽标与 skill market 锚点仍存在。

上游同步：
- git fetch upstream main / origin main 后确认 upstream/main 无新增待合并提交；本地相对 upstream/main 为 115/0，origin/main 为 0/0（提交前）。

后续：
- 推送 main 后触发 release.yml workflow_dispatch 发版。


### Git Commits

| Hash | Message |
|------|---------|
| `38e3f12e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
