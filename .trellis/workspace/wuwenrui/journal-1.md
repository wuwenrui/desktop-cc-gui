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
