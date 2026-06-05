## Context

当前 workspace 会话列表和 session catalog 以 shared projection 为 membership truth，但各 engine 的历史来源仍保留 related discovery 能力。Claude history 侧的典型表现是扫描多个 Claude project dir，并通过 transcript `cwd`、workspace path、git root、worktree family 等证据恢复可能相关的历史会话；其他 engine 也可能通过各自 native listing / catalog bridge 形成 workspace membership。

这个能力对历史找回有价值，但对多 workspace、父子目录、多项目并行用户会形成“当前项目侧边栏混入其他项目会话”的体验。新的设计必须保留当前模式作为默认值，同时提供一个窄拉取模式，并让 sidebar、Workspace Home、Session Management、Session Radar / prewarm 使用同一语义。

## Goals / Non-Goals

**Goals:**

- 在 `设置 > 会话管理` 增加 workspace 会话拉取模式设置。
- 默认 `related` 模式保持现有行为和现有测试语义。
- 新增 `workspace-only` 模式，缩窄当前 workspace 的全引擎 session membership。
- 将 attribution mode 作为 backend session membership resolver 的输入，而不是只在前端做展示过滤。
- 要求 `workspace-only` 使用新增独立逻辑分支，不把现有 `related` 拉取链路当作窄模式实现。
- 确保 source fact cache、pagination、source status、prewarm 不绕过 mode 语义。

**Non-Goals:**

- 不移除 related discovery。
- 不把 `workspace-only` 设为默认。
- 不重写 Session Catalog、folder tree、archive/delete mutation、runtime 启动链路。
- 不改变 transcript 加载行为；用户打开已知 session 时仍可按既有 session id/path 读取。
- 不为所有 engine 强行设计相同历史存储格式；本变更定义统一 mode contract，各 engine adapter 按自身证据接入。

## Decisions

### Decision 1: 使用显式枚举而不是 boolean

引入 `sessionAttributionMode`，候选值：

- `related`: 当前默认行为，保留宽松相关会话发现。
- `workspace-only`: 窄拉取模式，只显示明确属于当前 workspace 范围的会话。

放弃 `strictWorkspaceAttribution: boolean`。boolean 短期简单，但后续难以表达更细分策略，也不利于 UI 文案和遥测诊断。枚举能让默认兼容、窄模式、未来可能的更严格模式保持可扩展。

### Decision 2: 在 backend membership resolver 中执行 mode，而不是前端过滤

设置由 frontend 持久化并透传到 session catalog / thread list hydration / radar prewarm 相关请求。backend 在 engine-native listing、source facts projection、catalog attribution 阶段根据 mode 选择策略。

选择 backend-first 的原因：

- membership truth 必须在源头一致，避免 sidebar、Workspace Home、Session Management、Radar 各自实现过滤。
- pagination、count、source completeness、last-good continuity 都依赖 backend projection；前端过滤会让这些元信息失真。
- source fact cache 需要知道请求 scope，不能把 related 模式结果复用成 workspace-only membership truth。

### Decision 3: mode 是全引擎 contract，Claude 是第一批重点收敛对象

`sessionAttributionMode` 属于 workspace session membership contract，而不是 Claude 专属设置。所有 engine adapter 都必须接收 effective mode，并把候选会话交给 mode-aware projection 决定 membership。

Claude history 是第一批必须严格收敛的对象，因为它存在全局 project dir 扫描和 related attribution 的明确污染链路。Codex、Gemini、OpenCode 等 engine 即使当前污染风险较低，也不得绕过 mode-aware projection 直接向 sidebar、Workspace Home、Session Management 或 Radar hydration 写入 workspace membership。

### Decision 4: `workspace-only` 使用新增独立 Strategy，不复用 `related` 拉取链路

`workspace-only` 必须实现为独立 strategy / code path。它不能调用现有 `related` scanner/listing pipeline 后再过滤结果，也不能通过给现有 related 逻辑加条件分支来模拟窄模式。

原因：本变更的核心目标是不影响现有逻辑。最安全的工程边界是 `related` 继续走原有代码路径，`workspace-only` 走新增代码路径；两者只在最终 projection response shape 上对齐。

### Decision 5: `workspace-only` 扫描 exact + child-prefix Claude project dirs

`workspace-only` 不等于 `cwd exact only`，也不等于只扫描单个 exact Claude project dir。它应扫描当前 workspace 精确对应的 Claude project dir，以及明确位于当前 workspace 子路径下的 Claude project dirs。

原因：真实开发中用户经常从 `src/`、`packages/web/`、`frontend/` 等子目录启动 Claude Code。如果只接受 exact cwd，会让用户误以为会话丢失。

该模式必须排除的是“通过全局无关 Claude project dir、shared worktree family、sibling、git-root 模糊相关性混入当前 workspace”的会话，而不是排除当前 workspace 内部子目录会话。

### Decision 6: `workspace-only` 对 known workspace 冲突使用 fail-closed

如果 Claude project dir 映射到另一个已知 workspace，但 transcript `cwd` 看起来落在当前 workspace 内，`workspace-only` 不得直接把该 session 归入当前 workspace。该候选应被排除或标记为 conflict diagnostic。

原因：`workspace-only` 的核心价值是项目隔离。面对 project dir owner 和 transcript cwd owner 冲突时，选择任一 owner 都是在猜；窄模式必须 fail-closed。`related` 模式仍可保留现有更宽松的恢复策略。

### Decision 7: `related` 保持完全兼容

旧设置缺失时按 `related` 处理。实现时应把现有扫描和归因路径保留为 default branch，新增 `workspace-only` 作为独立显式分支，避免在默认模式下改动候选集、排序、count、source status 或 last-good continuity。

### Decision 8: Radar 保持全局视图，但 hydration 必须 mode-aware

Session Radar 可以继续作为全局视图展示多个 workspace 的 running / recent 状态。`workspace-only` 不要求把 Radar 改成 active-workspace-only。

但 Radar 触发的 hydration / prewarm 必须按目标 workspace 的 attribution mode 计算 membership，不能使用 related 模式结果写入 workspace-only 的 thread list，也不能把其他 workspace 的 session 作为当前 workspace membership。

### Decision 9: cache namespace / cache read condition 必须包含有效 scope 语义

Claude source fact cache 只能加速 source fact 读取，不能成为 membership truth。新增 mode 后，cache 命名空间或读取条件必须区分会影响候选覆盖范围和归因结果的输入。

如果 cache 只存 transcript source facts，且 projection 每次都会重新执行 mode-aware ownership resolver，可以复用同一 source fact；但任何“扫描候选集合完整性”“authoritative empty”“scan cap reached”等状态不得跨 mode 复用为 membership 结论。

## Risks / Trade-offs

- [Risk] `workspace-only` 隐藏用户期望找回的历史 session → Mitigation: 默认保留 `related`，UI 文案明确说明窄模式更强调隔离，用户可随时切回。
- [Risk] 只缩 backend 不缩 frontend prewarm，导致 Radar 仍混入宽口径结果 → Mitigation: 将 mode 纳入 thread hydration / radar prewarm 参数和测试断言。
- [Risk] cache 复用造成 workspace-only 使用 related 的 completeness 结论 → Mitigation: cache namespace 或 projection source status 必须携带 mode/scope evidence。
- [Risk] worktree / parent workspace 聚合语义被窄模式误伤 → Mitigation: specs 明确 worktree scope resolver 仍是单一事实源；workspace-only 只禁止跨 scope related widening，不否定当前 resolver 已定义的 owner scope。
- [Risk] exact-only 实现误伤子目录启动的 Claude sessions → Mitigation: specs 明确 workspace-only 扫描 exact + child-prefix Claude project dirs，并保留 child cwd。
- [Risk] 实现者复用 related pipeline 导致默认逻辑被动改变 → Mitigation: tasks 明确 workspace-only 使用新增独立 strategy，related 分支零行为变更。
- [Risk] 非 Claude engine 绕过新 mode → Mitigation: specs 要求 all-engine adapter compliance，并新增跨 engine mode propagation tests。
- [Risk] 默认行为回归难以察觉 → Mitigation: 保留现有 related tests，并新增默认缺省设置兼容测试。

## Migration Plan

1. 在 app settings schema 中新增 `sessionAttributionMode`，缺省值为 `related`。
2. 设置页 `会话管理` 增加单选按钮组并持久化设置。
3. 前端 thread list hydration、Session Management 查询、Session Radar / prewarm 读取并透传 mode。
4. 后端 session catalog query / all engine listing 增加 mode 参数。
5. `related` 分支复用当前逻辑。
6. `workspace-only` 分支使用新增独立 strategy，不复用 `related` scanner/listing pipeline。
7. `workspace-only` 分支缩窄 all-engine membership；Claude adapter 扫描 exact + child-prefix project dirs，但不扫描全局无关 dirs。
8. 调整 source fact cache namespace / completeness evidence，避免跨 mode 复用 membership 结论。
9. 补充 Rust 和 Vitest 覆盖后执行 OpenSpec / typecheck / focused tests。

Rollback 策略：由于默认值和现有分支保持 `related`，若 `workspace-only` 出现误隐藏，可在 UI 切回 `related`；代码级回滚也可只禁用或隐藏 `workspace-only` 入口，不影响默认模式。

## Open Questions

- `workspace-only` 对 main workspace 是否继续包含 child worktree owner scope，应沿用现有 shared scope resolver；实现前需要确认当前 UI 文案是否要说明 main/worktree 差异。
