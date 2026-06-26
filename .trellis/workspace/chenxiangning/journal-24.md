# Journal - chenxiangning (Part 24)

> Continuation from `journal-23.md` (archived at ~2000 lines)
> Started: 2026-06-24

---



## Session 920: 修复幕布 File changes 误判输出捕获

**Date**: 2026-06-24
**Task**: 修复幕布 File changes 误判输出捕获
**Branch**: `feature/v0.5.13`

### Summary

收窄 commandExecution 的文件变更推断，避免非文件变更命令被展示为 File changes。

### Main Changes

| 项目 | 内容 |
|---|---|
| 目标 | 修复幕布 `File changes` 展示范围过宽的问题，避免 `claude --help > claude_help.txt 2>&1`、`rg ... 2>&1 \| head` 等输出捕获/探测命令被误标为文件变更。 |
| 主要改动 | 在 `src/utils/threadItemsFileChanges.ts` 收窄 shell redirection 推断，只对 `cat` / `echo` / `printf` / `tee` 等明确内容写入命令保留 file mutation 推断。 |
| 回归测试 | 在 `src/utils/threadItemsFileChanges.test.ts` 增加 helper 回归；在 `src/utils/threadItems.test.ts` 增加幕布入口回归，确认输出捕获命令仍为 `commandExecution`，不会生成 `File changes` 卡片。 |
| 验证 | `npx vitest run src/utils/threadItemsFileChanges.test.ts src/utils/threadItems.test.ts` 通过，118 tests；`npm run typecheck` 通过。 |
| Git 状态 | 代码改动尚未提交，按用户要求先记录为未提交工作记录；当前没有 code commit hash。 |
| 注意 | 工作区还存在与本次修复无关的其它 modified/untracked 文件，本次未触碰、未归档任务。 |


### Git Commits

(No commits - planning session)

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 921: 提交幕布 File changes 误判修复

**Date**: 2026-06-24
**Task**: 提交幕布 File changes 误判修复
**Branch**: `feature/v0.5.13`

### Summary

单独提交幕布 File changes 误判修复，并补充验证结果。

### Main Changes

| 项目 | 内容 |
|---|---|
| Code commit | `3112e90f fix(messages): 修复文件变更幕布误判` |
| 变更范围 | 仅提交 `src/utils/threadItemsFileChanges.ts`、`src/utils/threadItemsFileChanges.test.ts`、`src/utils/threadItems.test.ts`。 |
| 修复内容 | 收窄 `commandExecution` 的 shell redirection 文件变更推断，避免 help capture、grep/head、rg/read 类输出捕获或探测命令被误展示为 `File changes`。 |
| 保留行为 | `apply_patch`、明确 heredoc/内容写入命令仍可生成 file mutation；输出捕获命令保持普通 `commandExecution`。 |
| 验证 | `npx vitest run src/utils/threadItemsFileChanges.test.ts src/utils/threadItems.test.ts` 通过，118 tests；`npm run typecheck` 通过。 |
| 工作区 | 仍存在与本次提交无关的 app-shell/OpenSpec 未提交改动，未纳入本次 commit。 |


### Git Commits

| Hash | Message |
|------|---------|
| `3112e90f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 922: 修复会话选择迁移重复写入

**Date**: 2026-06-24
**Task**: 修复会话选择迁移重复写入
**Branch**: `feature/v0.5.13`

### Summary

修复 pending thread finalized 后 composer/agent 选择迁移重复写入，避免 React maximum update depth 循环；补充对应 hook 回归测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `acb8bc4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 923: 归档 fast-markdown 与 codex-provider 两个 fix 提案

**Date**: 2026-06-24
**Task**: 归档 fast-markdown 与 codex-provider 两个 fix 提案
**Branch**: `feature/v0.5.13`

### Summary

归档两个已验证 OpenSpec fix 提案并单独提交

### Main Changes

### Summary

通过 `openspec archive` 将两个已验证的 fix 提案归档，把 spec deltas 合并到 `openspec/specs/` 主线，并把 change 目录迁移到 `openspec/changes/archive/2026-06-24-*`，全程在单独一次 commit 中完成。

### Main Changes

| 项目 | 内容 |
|---|---|
| 目标 | 归档 `fix-codex-provider-composer-cold-start-binding` 与 `fix-fast-markdown-annotation-action` 两个已验证 OpenSpec 提案。 |
| 归档方式 | 连续执行 `openspec archive fix-fast-markdown-annotation-action -y` 与 `openspec archive fix-codex-provider-composer-cold-start-binding -y`，CLI 自动完成 spec 合并 + change 迁移。 |
| spec 影响 | `codex-provider-scoped-session-launch` / `composer-model-selector-config-actions` / `composer-send-readiness-ux` / `file-markdown-preview-render-architecture` 共 4 个 spec 收到 deltas 合并。 |
| 提交流程 | 仅暂存两个归档相关 change 与对应 4 个 spec 的更新，使用 git rename 检测把 12 个文件以 rename 形式提交，避免大段 churn。 |
| 验证 | `openspec archive` 自身执行了 spec 合并并报告 `Specs updated successfully`；`git status` 确认 changes 根目录已无 `fix-*` 残留；archive 目录新增两条 `2026-06-24-*` 条目。 |
| Git 状态 | 提交 `7abed3bf` 在 `feature/v0.5.13`，16 files changed, +76；commit message 主体为中文 Conventional Commits，符合 AGENTS.md 全局 Gate。 |
| 注意 | 工作区还存在 `openspec/changes/2026-06-24-{curated-skill-bundles, infer-thread-rename-from-claude-codex-jsonl, retire-opencode-and-gemini-cli}/` 三个 untracked 提案目录，与本次归档无关，留给用户后续处理。 |


### Git Commits

| Hash | Message |
|------|---------|
| `7abed3bf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 924: 完成精选技能收口

**Date**: 2026-06-25
**Task**: 完成精选技能收口
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Curated skills | Added bundled `lazy-senior-dev` curated skill assets, metadata, lock validation, runtime loading, Settings toggle surface, and composer readiness indicator. |
| Engine integration | Injected enabled curated skills into Codex app-server developer instructions and Claude `--append-system-prompt`, with restart detection for stale app-server snapshots. |
| Boundary hardening | Added build-time/runtime curated skill id validation, settings id sanitization, safe UTF-8 prompt truncation, source/path validation, and async unmount guards. |
| Large-file governance | Split Claude curated prompt construction into `src-tauri/src/engine/claude/curated_skill_prompt.rs`, reducing `claude.rs` growth while keeping the hard gate clean. |
| OpenSpec | Reconciled the archived original curated-skill proposal, wrote follow-up change artifacts, and updated main `curated-skill-bundles` spec plus tasks verification. |
| Verification | Passed typecheck, lint, runtime contracts, OpenSpec strict validation, large-file hard/advisory gates, focused Rust/frontend tests, and `npm run check:heavy-test-noise` across 723 Vitest files. |

**Primary commit**: `45c65526 feat(curated-skills): 完成精选技能收口`

**Notes**:
- `npm run check:heavy-test-noise` completed with environment warnings=1, act warnings=0, stdout payload lines=0, stderr payload lines=0.
- `npm run check:large-files:gate` reported found=0.
- `npm run check:large-files:near-threshold` reported advisory watch-list warnings only; no failing files.


### Git Commits

| Hash | Message |
|------|---------|
| `45c65526` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 925: 消除精选技能测试 helper 死代码告警

**Date**: 2026-06-25
**Task**: 消除精选技能测试 helper 死代码告警
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Rust warning cleanup | Changed `validate_token_estimate` in `src-tauri/src/curated_skills.rs` from `pub(crate)` production-visible helper to a `#[cfg(test)]` private helper because it is only used by unit tests. |
| Verification | `cargo test --manifest-path src-tauri/Cargo.toml curated_skill --lib` passed with 36 tests. |
| Verification | `cargo check --manifest-path src-tauri/Cargo.toml --lib` passed without the reported dead_code warning. |

**Primary commit**: `911537d7 fix(curated-skills): 消除测试估算函数死代码告警`


### Git Commits

| Hash | Message |
|------|---------|
| `911537d7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 926: 修正退役 OpenCode/Gemini CLI 提案

**Date**: 2026-06-25
**Task**: 修正退役 OpenCode/Gemini CLI 提案
**Branch**: `feature/v0.5.13`

### Summary

检查并修正 OpenSpec change 2026-06-24-retire-opencode-and-gemini-cli，明确只删除客户端 OpenCode/Gemini CLI 能力，保留共享 Claude/Codex 边界。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `31ed8796` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 927: 归档实时交互卡顿补强

**Date**: 2026-06-25
**Task**: 归档实时交互卡顿补强
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| OpenSpec | Archived `2026-06-24-harden-realtime-interaction-jank-during-tool-call` into `openspec/changes/archive/2026-06-25-2026-06-24-harden-realtime-interaction-jank-during-tool-call/` and synced main specs. |
| Code | Hardened residual realtime jank paths: raw app-server fallback now drains through scheduler, app-server backpressure budgets were tightened, SnapshotThrottle state is bounded by TTL/cap/terminal cleanup, and ToolOutputTailGate releases idle/capped entries and side metadata. |
| Validation | `openspec validate --specs --strict --no-interactive`; `npm run typecheck`; `npm run lint`; focused Vitest for app-server/tail-gate/thread item events; `cargo test --manifest-path src-tauri/Cargo.toml snapshot_throttle`; `git diff --check`. |
| Trellis | Archived task `06-24-harden-realtime-interaction-jank` after code commit. |
| Follow-up | New uncommitted OpenSpec proposal `harden-conversation-rendering-for-large-history` is prepared for review before implementation. |


### Git Commits

| Hash | Message |
|------|---------|
| `6e2c663d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 928: 稳定实时对话渲染与 Codex 创建

**Date**: 2026-06-25
**Task**: 稳定实时对话渲染与 Codex 创建
**Branch**: `feature/v0.5.13`

### Summary

完成实时对话大历史渲染止损、Markdown heavy island 降载、消息幕布虚拟化/轻量模式/错误边界、renderer diagnostics 增强，以及 disk Codex 创建会话 ready confirmation 和一次性自动恢复；验证 typecheck、lint、runtime contracts、large-file governance、cargo no-run、Codex 相关 cargo tests、focused vitest 与 heavy-test-noise。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `982f6ed0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 929: 实时幕布与控制区隔离 Phase 1

**Date**: 2026-06-25
**Task**: 实时幕布与控制区隔离 Phase 1
**Branch**: `feature/v0.5.13`

### Summary

创建 OpenSpec isolate-conversation-canvas-runtime，定义五区模型与 interaction/canvas/background lane 契约；实现 Composer interaction-safe memo comparator，memo 化 TopbarSessionTabs，给 app-server realtime dispatch scheduler 增加 resource-retention diagnostics；验证 focused Vitest、typecheck、lint、runtime-contracts、large-file gate 与 OpenSpec strict validate。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `823c657f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 930: 闭环实时幕布交互隔离

**Date**: 2026-06-25
**Task**: 闭环实时幕布交互隔离
**Branch**: `feature/v0.5.13`

### Summary

完成 isolate-conversation-canvas-runtime：新增 interaction/canvas/background lane policy；realtime dispatch 进入 bounded canvas lane；收敛 streaming timeline overscan 并钳制 virtual row placeholder，防止空白幕布块被撑大；补 scheduler cleanup diagnostics 测试与 interaction guard；通过 lint/typecheck/runtime contracts/large-files/heavy-test-noise/OpenSpec strict validate。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b2f00f40` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 931: Shell-first lazy runtime isolation

**Date**: 2026-06-25
**Task**: Shell-first lazy runtime isolation
**Branch**: `feature/v0.5.13`

### Summary

创建 OpenSpec shell-first-lazy-runtime-isolation，并实现 Shell summary、Conversation Canvas node builder、ProjectMap/IntentCanvas hidden compute gates；全量 heavy-test-noise 729 test files 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4c8d3191` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 932: 修复 ProjectMap 冷启动空态循环

**Date**: 2026-06-25
**Task**: 修复 ProjectMap 冷启动空态循环
**Branch**: `feature/v0.5.13`

### Summary

修复 fresh install 首次打开时 ProjectMap disabled 空态重复发布新对象导致的 React #185 风险。

### Main Changes

- 在 `useProjectMapDataset` 中增加空 dataset 与 storage location map 的语义等价判断。
- 将 disabled/no workspace 冷启动 reset 收敛到 `resetToEmptyState`，空态不再创建新引用。
- 补充 disabled cold-start reload 回归测试，确认不会触发 storage read、memory scan 或 worker。
- 验证：vitest startup/project-map、typecheck、lint、production build、runtime contracts 均通过。


### Git Commits

| Hash | Message |
|------|---------|
| `5dabbcc6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 933: 降级临时 runtime 重连提示

**Date**: 2026-06-25
**Task**: 降级临时 runtime 重连提示
**Branch**: `feature/v0.5.13`

### Summary

修复 transient managed-runtime cleanup 被误当作真实断联恢复卡的问题，并同步记录到 harden-codex-disk-session-start-readiness 提案。

### Main Changes

- 区分 blocking runtime reconnect diagnostic 与 transient managed-runtime cleanup。
- `stale_reuse_cleanup` / `internal_replacement` 只显示轻量 Runtime 切换提示，不再显示重连/重发按钮。
- 用户继续输入后丢弃旧 transient diagnostic，避免旧 runtime 切换提示长期占据对话流。
- 更新 `harden-codex-disk-session-start-readiness` proposal/tasks，记录本次 UI semantics 收敛。
- 验证：focused runtime reconnect tests、typecheck、lint、OpenSpec validate 均通过。


### Git Commits

| Hash | Message |
|------|---------|
| `809e8234` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 934: Externalize active canvas state selectors

**Date**: 2026-06-25
**Task**: Externalize active canvas state selectors
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Frontend | Added feature-local active canvas external store with selector/comparator subscriptions, plus Composer and StatusPanel selector-backed node boundaries. |
| Layout | Kept `useLayoutNodes` public composition surface while moving heavy active canvas state consumption out of shell-facing props. |
| OpenSpec | Archived `externalize-active-canvas-state-selectors`, `isolate-conversation-canvas-runtime`, and `shell-first-lazy-runtime-isolation`; synced related main specs. |
| Trellis | Archived completed task `06-25-externalize-active-canvas-state-selectors`. |

**Verification**:
- [OK] `openspec validate externalize-active-canvas-state-selectors --strict --no-interactive`
- [OK] `openspec archive externalize-active-canvas-state-selectors -y`
- [OK] `openspec validate --specs --strict --no-interactive`
- [OK] `npm exec vitest run src/features/layout/hooks/activeCanvasStore.test.tsx src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx src/features/status-panel/components/StatusPanel.test.tsx src/features/composer/components/Composer.status-panel-toggle.test.tsx`
- [OK] `npm run typecheck`


### Git Commits

| Hash | Message |
|------|---------|
| `40c49757` | (see git log) |
| `774d1354` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 935: Archive Codex disk session start readiness

**Date**: 2026-06-25
**Task**: Archive Codex disk session start readiness
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| OpenSpec | Archived `harden-codex-disk-session-start-readiness` into `openspec/changes/archive/2026-06-25-harden-codex-disk-session-start-readiness/`. |
| Specs | Synced `codex-provider-scoped-session-launch` main spec with disk auto-recovery, disk ready confirmation, managed-provider isolation, and app-server probe cache requirements. |
| Scope | No code changes in this closeout commit; only OpenSpec archive movement and main spec sync. |

**Verification**:
- [OK] `openspec validate harden-codex-disk-session-start-readiness --strict --no-interactive`
- [OK] `openspec archive harden-codex-disk-session-start-readiness -y`
- [OK] `openspec validate --specs --strict --no-interactive`


### Git Commits

| Hash | Message |
|------|---------|
| `3e485b63` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 936: feat(messages): 去除对话幕布重复复制入口

**Date**: 2026-06-25
**Task**: feat(messages): 去除对话幕布重复复制入口
**Branch**: `feature/v0.5.13`

### Summary

(Add summary)

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `34cf3ac6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 937: Fix history canvas lightweight spacing & expanded-history layout

**Date**: 2026-06-26
**Task**: Fix history canvas lightweight spacing & expanded-history layout
**Branch**: `feature/v0.5.13`

### Summary

历史会话 lightweight mode 出现大段空白、点击“显示之前 n 条消息”后抖动 + 顶部操作卡片被裁剪 + banner/sticky/rows 分属不同 layout contract。根因不是单个 CSS 间距：virtualized row 沿用旧 heavy measured height，manual reveal 还在用 scrollHeight delta viewport restore + absolute virtual canvas，timeline root 顶部再叠 inset 补丁。

修复：
- MessagesTimeline 区分 lightweight summary row 走 compact virtualized placeholder height
- lightweight / detail hydration 切换触发 bounded virtualizer remeasure
- manual reveal 切到稳定 expanded-history document flow，移除 scrollHeight delta 视口恢复；jump-to-message 仍由 anchor scroll 定位
- lightweight mode bar、history sticky header、collapsed-history reveal control 收敛到同一个 messages-full padding contract
- 新增 curtain.stickyUserBubble 默认 client UI control
- i18n Hydrate visible details -> Render details

同步 messages-streaming-render-contract.md spec、openspec change fix-history-canvas-lightweight-spacing 落地。openspec validate --strict、npm run typecheck、focused vitest 7 files / 149 tests 全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `40398107` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 938: 补充设置页性能诊断说明

**Date**: 2026-06-26
**Task**: 补充设置页性能诊断说明
**Branch**: `feature/v0.5.13`

### Summary

设置页性能诊断补充中英文说明文案：实时流调度档位中文/英文区分展示，页面解释三档用途与性能覆盖项重置范围，并更新 OtherSection 单测覆盖下拉 i18n 与说明切换。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `52ca79cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 939: 删除用户气泡吸顶条

**Date**: 2026-06-26
**Task**: 删除用户气泡吸顶条
**Branch**: `feature/v0.5.13`

### Summary

删除用户气泡吸顶条设置项、消息时间线 sticky header 渲染与样式，保留普通用户消息行；同步并归档 OpenSpec 变更 remove-sticky-user-bubble-curtain-bar。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `897b954e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 940: 复刻 Codex daemon 启动确认与 transient 诊断清理

**Date**: 2026-06-26
**Task**: 复刻 Codex daemon 启动确认与 transient 诊断清理
**Branch**: `v0.5.13`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Codex daemon | 为 daemon disk Codex `thread/start` 增加 bounded `thread/resume` readiness confirmation，确认成功后才记录 auto-session metadata，避免后续 `turn/start` 暴露 `thread not found`。 |
| Runtime reconnect UI | 为 `stale_reuse_cleanup` / `internal_replacement` transient cleanup notice 增加 2.5s auto-dismiss，继续压制 raw diagnostic text，并保持 blocking runtime-ended card 持久显示。 |
| Tests | 增加 daemon readiness helper tests、runtime reconnect TTL tests 与 blocking card regression tests。 |

**Updated Files**:
- `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`
- `src/features/messages/components/runtimeReconnect.ts`
- `src/features/messages/components/runtimeReconnect.test.ts`
- `src/features/messages/components/Messages.tsx`
- `src/features/messages/components/Messages.runtime-reconnect.test.tsx`

**Validation**:
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml daemon_disk_start`
- `npx vitest run src/features/messages/components/runtimeReconnect.test.ts src/features/messages/components/Messages.runtime-reconnect.test.tsx`
- `npm run check:runtime-contracts`
- `npm run typecheck`


### Git Commits

| Hash | Message |
|------|---------|
| `931ae769` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 941: 屏蔽废弃 CLI 验证入口

**Date**: 2026-06-26
**Task**: 屏蔽废弃 CLI 验证入口
**Branch**: `v0.5.13`

### Summary

屏蔽运行环境 CLI 验证中的 Gemini/OpenCode 废弃入口，并记录 Codex 启动确认窗口调整。

### Main Changes

- Settings CLI 验证页只保留 Codex 与 Claude Code tab。
- 在 `CodexSection.tsx` 中新增 `DEPRECATED_CLI_VALIDATION_ENGINES`，显式标记 Gemini/OpenCode CLI validation entries 已废弃并隐藏。
- 删除 Gemini/OpenCode CLI validation panel 的 Switch 入口，避免用户继续从设置页启用/禁用废弃入口。
- 更新 `SettingsView.test.tsx`，断言 Gemini/OpenCode tab 与 switch 均不可见。
- 同次提交包含 `src-tauri/src/shared/codex_core.rs` 的 `THREAD_START_READY_CONFIRM_TIMEOUT_MS` 从 2s 调整到 8s，以减少 Disk Codex cold start 被误判。
- Verification: `npx vitest run src/features/settings/components/SettingsView.test.tsx`; `npm run typecheck`; `npm run lint`.


### Git Commits

| Hash | Message |
|------|---------|
| `e93305cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 942: Codex 首轮线程启动恢复边界

**Date**: 2026-06-26
**Task**: Codex 首轮线程启动恢复边界
**Branch**: `v0.5.13`

### Summary

回写 OpenSpec 并提交 Codex thread/start readiness、runtime foreground continuity 与 frontend recovery 边界修复

### Main Changes

Task goal: 用户确认工作区代码已测试通过，要求回写提案并整体提交。

Main changes:
- 新建 OpenSpec change `fix-codex-thread-start-continuity-and-recovery`，补齐 proposal/design/tasks/spec delta。
- 固化 Codex native `thread-start` empty draft 不再 silent fresh replay/fork 的恢复边界。
- 记录 backend bounded `thread/resume` readiness retry、runtime foreground continuity protection、static history auto-follow gate。
- 同步修正 `.trellis/spec/frontend/hook-guidelines.md` 中过时的 empty-draft recovery 规则。

Affected modules:
- Rust Codex app-server/runtime: `src-tauri/src/shared/codex_core.rs`, `src-tauri/src/backend/app_server.rs`, `src-tauri/src/runtime/mod.rs`。
- Frontend Codex recovery and messaging hooks: `src/features/threads/hooks/**`, `src/features/threads/utils/codexConversationLiveness.ts`。
- Message rendering auto-follow: `src/features/messages/components/Messages.tsx`。

Validation:
- User reported the working tree code had already passed tests before the writeback request.
- Ran `openspec validate fix-codex-thread-start-continuity-and-recovery --strict --no-interactive` successfully.
- Ran `git diff --check` successfully.

Follow-ups:
- Archive/sync the OpenSpec change after any additional human acceptance gate desired for this release line.


### Git Commits

| Hash | Message |
|------|---------|
| `a1f2ad06` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 943: 修复 Windows 精选技能打包 hash 漂移

**Date**: 2026-06-26
**Task**: 修复 Windows 精选技能打包 hash 漂移
**Branch**: `v0.5.13`

### Summary

(Add summary)

### Main Changes

修复 Windows CI 打包时 curated skill lock hash mismatch。

**问题**:
- Windows checkout 将 `src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md` 转成 CRLF。
- `src-tauri/build.rs` 按文件字节计算 SHA-256,导致 Windows 得到 `d0843f58...`,而 `skills-lock.json` 记录的是 LF 文件的 `4e82b494...`。

**变更**:
- 新增 `.gitattributes`,强制 `src-tauri/resources/curated-skills/**/*.md` 使用 LF。
- 更新 `docs/curated-skill-onboarding.md` 的 review checklist,记录 LF 约束。
- 更新 `openspec/specs/curated-skill-bundles/spec.md`,明确 curated `SKILL.md` hash 输入必须跨平台稳定。

**验证**:
- `git check-attr -a -- src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md`
- `shasum -a 256 src-tauri/resources/curated-skills/lazy-senior-dev/SKILL.md`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

**注意**:
- 提交前工作区已有 5 个其它任务未提交改动,本次提交未包含这些文件。


### Git Commits

| Hash | Message |
|------|---------|
| `963b45fd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
