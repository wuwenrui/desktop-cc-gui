# lawyer-mode-shell

律师模式壳：uiMode 设置、导航白名单过滤、本地案件登记表、案件工作区目录骨架与 skill 快捷动作。

## Requirement: uiMode 设置持久化且默认 developer

应用 SHALL 提供 `uiMode: "developer" | "lawyer"` 设置，持久化在 AppSettings（TS 与 Rust 双侧 serde/normalize），本期默认 `"developer"`；非法值回退 `"developer"`。设置页提供「界面模式」切换（中文：律师模式 / 开发者模式）。

### Scenario: 旧设置文件无 uiMode 字段
- WHEN 加载一份没有 `uiMode` 的既有设置 JSON
- THEN 设置加载成功且 `uiMode` 为 `"developer"`，存量行为不变

### Scenario: 切换到律师模式
- WHEN 用户在设置页把界面模式切到「律师模式」并保存
- THEN `uiMode` 持久化为 `"lawyer"`，重启后仍生效

## Requirement: 律师模式导航白名单过滤

`uiMode === "lawyer"` 时，侧栏 SHALL 只渲染白名单内的导航项（`LAWYER_VISIBLE_NAV`）：我的案件（置顶）、Skill 市场、lawhub、设置（下拉保留锁屏 / 环境依赖 / 发行说明 / 设置）。开发者向入口（快速新会话、自动化看板、全局搜索、Spec Hub、项目记忆、Git 日志）SHALL 隐藏。`uiMode === "developer"` 时全部可见。

### Scenario: 律师模式隐藏开发者入口
- WHEN `uiMode === "lawyer"` 渲染侧栏
- THEN 不出现 自动化看板 / 全局搜索 / Spec Hub / 项目记忆 / Git 日志 入口，「我的案件」在主导航最上方

### Scenario: 开发者模式不受影响
- WHEN `uiMode === "developer"` 渲染侧栏
- THEN 既有全部入口照常渲染，仅多出「我的案件」入口

## Requirement: 本地案件登记表

应用 SHALL 在 client store（`app` store，key `lawyerCases`）持久化案件登记表。字段：`id`、`title`、`caseNo`（可空）、`parties{our,opposing}`、`causeOfAction`、`stage`（`intake|filing_prep|filed|in_trial|judgment|enforcement|closed`，与 lawhub 契约一致）、`workspacePath`、`createdAt`、`updatedAt`、`lastOpenedAt`（卡片「最近打开」展示用）。

### Scenario: 新建案件写入注册表
- WHEN 新建案件向导提交
- THEN 注册表追加一条含上述字段的记录并落盘，案件列表立即可见

### Scenario: 注册表损坏或为空
- WHEN client store 中无 `lawyerCases` 或数据非法
- THEN 案件列表按空列表渲染，不抛错

## Requirement: 新建案件向导建工作区与目录骨架

新建案件向导 SHALL 收集 案件名（必填）/ 我方当事人 / 对方当事人 / 案由 / 存放目录（必填，目录选择器），并在 `存放目录/案件名` 下创建标准目录骨架：`起诉材料/ 证据材料/ 文书/ 沟通记录/ 庭审/ 结案/`（复用既有 `ensure_workspace_path_dir`，递归创建），随后注册为 workspace 并打开。

### Scenario: 创建成功
- WHEN 用户填写案件名与存放目录并确认
- THEN 案件根目录与六个子目录被创建，工作区被添加并激活，案件出现在登记表

### Scenario: 必填缺失
- WHEN 案件名或存放目录为空
- THEN 向导阻止提交并就地提示，不产生任何目录或注册表写入

## Requirement: 案件快捷动作预填 skill

案件卡片 SHALL 提供 [梳理卷宗] [起草文书] [整理证据] 三个快捷动作：点击后打开对应工作区，并通过既有 `SELECT_SKILL_EVENT` 桥派发 skill 选择（skill 名：卷宗梳理 / 民事起诉状 / 证据清单），由 Composer 附加 skill chip。skill 文件由另一分支提供，本变更按名引用。

### Scenario: 点击快捷动作
- WHEN 用户点击某案件卡片的 [起草文书]
- THEN 该案件工作区被打开，`SELECT_SKILL_EVENT` 携带 `{name:"民事起诉状"}` 被派发（延迟派发以等待 Composer 挂载）

### Scenario: skill 未安装
- WHEN 对应名字的 skill 尚未安装
- THEN 工作区仍正常打开，chip 附加行为由 Composer 既有逻辑兜底（不崩溃）
