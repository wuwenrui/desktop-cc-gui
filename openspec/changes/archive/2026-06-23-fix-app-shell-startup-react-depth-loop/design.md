## Context

生产包启动时报 React #185，renderer lifecycle 显示错误发生在 `bootstrap/render-committed` 后约 700ms，component stack 落在 `AppShell`。当前 `src/app-shell.startup.test.tsx` 已覆盖基础启动不触发 maximum update depth，但没有覆盖用户真实 persisted state 中大量 thread-scoped selection、provider model catalog 恢复、workspace catalog 未就绪的组合。

近期 `fix(composer): 修复供应商模型目录与 Codex 刷新断联` 修改了 AppShell composer model section、provider model catalogs、ChatInputBox model options。该链路包含多处“修复型 effect”：读取 persisted selection，基于当前 catalog 计算有效 model / effort，再写回 thread/global selection。若 effect 每次 render 都生成等价但新引用的 state，就会触发 React maximum update depth。

## Goals / Non-Goals

**Goals:**

- Codex composer startup selection 修复必须幂等：logical value unchanged 时返回 previous reference。
- Catalog 未就绪或 selection 暂不可判定时，不做破坏性默认值写回。
- AppShell startup test 覆盖真实 persisted-state 风格的 selection 恢复路径。
- 保持合法 selection、失效 selection 自愈、pending-to-canonical migration 的既有语义。

**Non-Goals:**

- 不重构 AppShell 全局 state ownership。
- 不迁移或清理用户 `.ccgui/client/*.json` 存量数据。
- 不改变供应商模型拉取、排序、展示策略。
- 不新增依赖。

## Decisions

### Decision 1: 在修复型 state updater 内做 equality gate

采用 updater-local guard：

1. 计算 normalized/effective selection。
2. 若 next 与 previous 在 `modelId`、`effort`、scope key 等逻辑字段上相同，直接 `return previous`。
3. 只有真实变化才创建新对象并触发 persist。

Alternatives:

- 清空 persisted selection：只能修当前机器，且会丢用户偏好。
- 在外层 effect 用 ref 记录 last write：可止血，但容易绕过 React state truth，后续逻辑仍可能写新引用。

### Decision 2: catalog readiness 优先于默认值写回

当 workspace catalog 尚未 ready，系统不得用内置 fallback catalog 判定 persisted thread selection 失效。修复逻辑只在可判定时写回，避免冷启动首帧把合法值改成默认值，并避免“catalog 恢复 -> selection 修复 -> catalog/context 更新”的循环。

Alternatives:

- 立即 fallback 到 built-in catalog：UI 响应快，但容易误判用户自定义模型。
- 完全跳过 selection 修复：避免循环，但坏 selection 会进入发送链。

### Decision 3: 用 AppShell startup 回归测试锁住链路

局部纯函数测试不能覆盖 React effect 之间的顺序和 reference stability。新增或扩展 AppShell startup 测试，模拟 persisted thread selection、catalog 恢复前后状态，并断言不会抛出 `Maximum update depth exceeded`。

Alternatives:

- 只测 helper：快，但无法捕捉 effect loop。
- 只依赖手动 Tauri dev：能观察真实窗口，但不可自动防回归。

## Risks / Trade-offs

- [Risk] Guard 写得过宽，导致真实失效 selection 不被修复。→ Mitigation: 保留 invalid model / effort 自愈测试。
- [Risk] 测试 mock 与真实 persisted state 仍有差距。→ Mitigation: 从本次 renderer lifecycle 与 persisted key 形状抽取非敏感 fixture，只覆盖 selection/catalog shape，不复制 token/config。
- [Risk] 只修 composer selection 后，其他 AppShell startup effect 仍可能有类似问题。→ Mitigation: 以 React #185 regression test 为 gate；若仍失败，再扩大到 view state / domain context。

## Migration Plan

1. 增加 focused regression test，先证明现有代码在目标路径上存在风险或缺口。
2. 对 composer startup selection 修复链路补 equality gate。
3. 跑 focused Vitest。
4. 若 focused test 与当前用户启动路径都稳定，再视需要跑 typecheck。

Rollback strategy: revert 本 change 中 frontend guard 与测试文件；无 storage migration，无 backend API 变化。

## Open Questions

- 生产 minified stack 无 source map，无法从现有日志精确到具体 effect；实现时以可复现的 startup regression 和最小幂等修复为准。
