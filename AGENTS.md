<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

Use the `/trellis:start` command when starting a new session to:
- Initialize your developer identity
- Understand current project context
- Read relevant guidelines

Use `@/.trellis/` to learn:
- Development workflow (`workflow.md`)
- Project structure guidelines (`spec/`)
- Developer workspace (`workspace/`)

If you're using Codex, project-scoped helpers may also live in:
- `.agents/skills/` for reusable Trellis skills
- `.codex/agents/` for optional custom subagents

Keep this managed block so 'trellis update' can refresh the instructions.

<!-- TRELLIS:END -->

# 项目规则入口（mossx）

## 规则优先级

- 当前项目代码实现 > 项目内文档（`AGENTS.md` / `.trellis/spec/**` / `openspec/**`）> 全局 `~/.codex/rules/*` / 全局 `~/.codex/AGENTS.md`
- 文档主体使用中文，technical terms 保留 English

## 文档分层

本仓库将规则与状态分成五层：

1. **Project entry**：`AGENTS.md`
   - 只负责规则优先级、最小读取路径、全局 gate、分层指针
2. **Implementation rules**：`.trellis/spec/**`
   - frontend / backend / guides 的具体实现规范
3. **Behavior specs**：`openspec/**`
   - proposal / design / tasks / main specs / workspace governance
4. **Host adapter config**：`.claude/**`、`.codex/**`
   - hooks / commands / skills / host-specific glue
5. **Runtime artifacts**：`.omx/**` 及其他本地运行态目录
   - 不是长期仓库资产，不作为规范事实源

## 最小读取路径

- 开始任务先读本文件。
- 涉及实现时，再按需读：
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/guides/index.md`
  - 若任务本身在改规则入口或文档边界，再读 `.trellis/spec/guides/project-instruction-layering-guide.md`
- 涉及 behavior/change/workflow 时，再读：
  - `openspec/README.md`
  - `openspec/project.md`
  - 对应 `openspec/changes/<change-id>/**`
- 只有在调试 host hooks / commands / skills 时，才优先深入 `.claude/**` 或 `.codex/**`。

## OpenSpec + Trellis

- `openspec/**` 是 behavior / proposal / change 的 single source of truth。
- `.trellis/spec/**` 是 code-level rule 与 executable contract 的沉淀位置。
- `.trellis/tasks/**` 是执行容器；每个 Trellis task 都必须关联一个 OpenSpec change。
- 涉及行为变更、产品交互、跨层 contract 变更时：
  1. 先创建或选择 OpenSpec change
  2. 再进入 Trellis / implementation
  3. 实现后同步更新相关 spec，并执行 verify / sync / archive 流程

## 实现入口

- frontend / backend / cross-layer 详细规则不要写回 `AGENTS.md`。
- 这类细则统一维护在 `.trellis/spec/**`：
  - frontend: `component-guidelines.md`、`hook-guidelines.md`、`state-management.md`、`quality-guidelines.md`、`type-safety.md`
  - backend: `directory-structure.md`、`error-handling.md`、`logging-guidelines.md`、`database-guidelines.md`、`quality-guidelines.md`
  - cross-layer / reuse / shell / unified-exec: `.trellis/spec/guides/**`

## 全局 Gate

### Trellis Session Record

- AI 在本仓库成功执行 `git commit` 后，必须继续执行 Trellis session record，除非用户明确要求跳过。
- record 前先运行 `python3 ./.trellis/scripts/get_context.py --mode record`，不得猜测 developer id。
- 所有 Trellis 路径使用 repo-relative path，禁止写死个人绝对路径。

### Git Commit Message

- 默认必须使用中文主体的 Conventional Commits：`type(scope): 中文动宾短句`
- 若仓库脚本或 workflow 与此冲突，先修正规则或配置，再提交

### PlanFirst

- 任何代码、配置、规范落盘前，先给出 `PLAN` 或等价 OpenSpec artifact。
- 若任务已进入 OpenSpec workflow，则以 OpenSpec artifact 作为 plan 载体。

### Merge Guardrails

- 高风险文件冲突时，禁止整文件 `--ours` / `--theirs` 覆盖。
- 必须先列 capability matrix，再做 semantic merge，并验证关键 symbol / tests / contract command。

### Shell Baseline

- 遇到 `command not found`，先执行：
  - `zsh -lc 'source ~/.zshrc && <command>'`
- 仍失败再排查：
  - `zsh -lc 'source ~/.zshrc && which <command> && echo $PATH'`

## 仓库卫生

- `.omx/**`、`.trellis/.developer`、`.trellis/.current-task` 等本地 state 属于 runtime artifact 或 local-only state。
- 这类目录和文件不作为规范事实源；若误入库，应按仓库卫生规则清退并加入忽略策略。

## Fork 能力保护（不可被上游合并覆盖）

本仓库是 upstream `desktop-cc-gui` 的 fork。以下 4 项能力是本 fork 专属，**每次
`git merge upstream/main` 后都必须存活**。合并后逐项对照锚点文件核验，未通过不得 push。
逐文件改动清单见 `docs/FORK-PATCHES.md`。

1. **去掉「社区与反馈」模块** —— SettingsView 不再渲染 community section。
   - 锚点：`src/features/settings/components/SettingsView.tsx`
   - 核验：无社区/反馈导航项或面板。

2. **模型自动配置** —— 首启 onboarding 自动配 new-api provider；vendors 面板提供对应预设。
   - 锚点：`src/features/onboarding/OnboardingWizard.tsx`、
     `src/features/vendors/components/VendorSettingsPanel.tsx`
   - 核验：onboarding 仍向 `~/.claude/settings.json` 注入 new-api provider；vendor 面板仍有预设。

3. **环境依赖检查与安装（非阻塞）** —— 左侧设置菜单 → 运行环境 → 环境依赖。缺失依赖不阻塞启动，
   仅按需安装；检测会探测常见安装目录（装完工具点「检查依赖」不重启 app 即识别）。
   - 锚点：`src/features/setup/EnvironmentDependenciesSection.tsx`、
     `src/features/setup/hooks/useEnvironmentInstaller.ts`、
     `src/features/setup/DependencyGate.tsx`、
     `src-tauri/src/environment_installer.rs`、
     `src-tauri/src/claude_installer.rs`
   - 核验：环境依赖区块仍渲染；`detect_command` / `detect_claude` 仍探测额外安装目录。

4. **余额展示 + skill 市场** —— 顶栏徽标显示 new-api 实时余额；skill 市场可浏览/安装 skill。
   - 锚点：`src/features/app/components/MainTopbar.tsx`、`src/features/usage/UsageBadge.tsx`、
     `src/features/usage/usage-badge.css`、`src-tauri/src/newapi_usage.rs`、
     `src/features/skill-market/`
   - 核验：余额徽标仍挂在顶栏；skill 市场入口仍能打开面板。

## 上游同步流程

每次 push 前执行，确保 fork 能力不被静默回退：

1. `git fetch upstream`
2. 若 `upstream/main` 有我们没有的提交，则合并（`git merge upstream/main`）。冲突按语义解决——
   对上述锚点文件**禁止**整文件 `--ours` / `--theirs` 覆盖。
3. 合并后逐项核验「Fork 能力保护」的 4 项能力，重放被合并覆盖的 `docs/FORK-PATCHES.md` 改动。
4. 跑质量门禁（`npm run typecheck`、`npm run test`，以及 `src-tauri/` 下的 `cargo test`）。
5. 4 项能力核验通过且门禁全绿后，才 push 触发构建。
