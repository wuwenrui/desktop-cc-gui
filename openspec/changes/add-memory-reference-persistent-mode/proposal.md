## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 13/13 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: Composer 已使用 `memoryReferenceMode: off | single | always`，`ButtonArea` 提供 single/always 选择，`useThreadMessaging` 继续消费 `memoryReferenceEnabled`。
- **Next action**: 归档前补 focused Composer/ButtonArea/memory reference tests 与 strict validation 证据。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Composer 的 Memory Reference 当前只有一个 one-shot 开关，但弹层文案只写“开启引用”，用户无法在发送前区分“只开本次”与“后续持续开启”。这会让需要连续多轮引用项目记忆的用户反复点按钮，也让一次性引用的关闭语义不够清楚。

本次变更把同一个入口拆成两个明确动作：`单次开启引用` 和 `一直开启引用`，让引用生命周期在发送前可见、可选、可关闭。

## 目标与边界

- 在 Composer Memory Reference 弹层中新增 `一直开启引用` 按钮。
- 将原确认按钮重命名为 `单次开启引用`。
- 调整弹层文案，明确发送前只读检索项目记忆，并生成可追踪的 Memory Brief / Retrieval Pack。
- 单次引用发送后自动关闭；持续引用发送后保持开启，直到用户手动关闭或切换会话上下文时被清理。
- 保持现有 Memory Scout、Project Memory 注入格式、消息发送参数和关联资源展示契约不变。

## 非目标

- 不新增静默自动记忆注入。
- 不把持续引用写入全局设置或 localStorage。
- 不修改 Project Memory 存储、检索、排序、清洗、预算或 Retrieval Pack 格式。
- 不改变 `@@` 手动选择记忆的 one-shot 语义。
- 不新增后端 command、数据库结构或 Tauri IPC contract。

## What Changes

- Composer Memory Reference 状态从 boolean armed 扩展为 mode：
  - `off`
  - `single`
  - `always`
- 弹层展示更清晰的模式文案，并提供两个主动作：
  - `单次开启引用`
  - `一直开启引用`
- 发送选项继续以现有 `memoryReferenceEnabled: true` 驱动 Memory Scout；区别只在前端发送后是否自动关闭。
- 图标按钮的 title / accessible state 反映当前模式：关闭、单次已开启、持续已开启。
- 测试覆盖单次发送后关闭、持续发送后保持开启、手动点击图标关闭当前引用模式。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-memory-consumption`: Composer Memory Reference 从 one-shot toggle 扩展为 one-shot / persistent 两种显式开启模式。

## 技术方案对比

### 方案 A：前端局部 mode，发送参数保持不变

在 Composer 内部把 `memoryReferenceArmed: boolean` 替换为 `memoryReferenceMode: "off" | "single" | "always"`。发送时只要 mode 不是 `off`，仍传入现有 `memoryReferenceEnabled: true`；发送完成后仅 `single` 自动回到 `off`。

优点：
- 最小化跨层改动，不碰 Memory Scout 与注入 contract。
- `always` 只是 UI 生命周期策略，不污染全局设置。
- 回滚简单，测试面集中在 Composer / ButtonArea。

缺点：
- 下游发送链路无法区分 single / always；但当前下游不需要知道生命周期模式。

结论：采用。生命周期属于 Composer UI 状态，发送链路只需要知道本次是否启用 Memory Reference。

### 方案 B：扩展 sendOptions 增加 `memoryReferenceMode`

发送时传入 `{ memoryReferenceMode: "single" | "always" }`，让下游链路知道模式。

优点：
- 语义完整，便于未来做日志或诊断。

缺点：
- 扩大 typed contract 与测试范围。
- 当前 Memory Scout 注入只关心本次是否启用，mode 传到下游没有实际消费点。
- 容易把 UI 生命周期策略误扩散成 runtime contract。

结论：不采用，避免无消费方的 contract 扩张。

## 验收标准

- 点击 Memory Reference 图标时，未开启状态下打开弹层，不直接启用引用。
- 弹层包含 `单次开启引用` 和 `一直开启引用` 两个动作。
- 点击 `单次开启引用` 后，本次发送带 `memoryReferenceEnabled: true`，发送收敛后引用状态自动关闭。
- 点击 `一直开启引用` 后，本次及后续发送都带 `memoryReferenceEnabled: true`，发送后状态保持开启。
- 引用已开启时点击图标可关闭当前引用模式。
- 弹层文案不再把 “本次发送” 当作唯一引用范围。
- 中英文 i18n 文案同步更新。
- Focused Composer / ButtonArea tests 通过。

## Impact

- Frontend:
  - `src/features/composer/components/Composer.tsx`
  - `src/features/composer/components/ChatInputBox/**`
  - `src/styles/composer.part2.css`
- i18n:
  - `src/i18n/locales/zh.part1.ts`
  - `src/i18n/locales/en.part6.ts`
- Tests:
  - `src/features/composer/components/ChatInputBox/ButtonArea.test.tsx`
  - `src/features/composer/components/Composer.memory-reference.test.tsx`
- No new dependencies.
