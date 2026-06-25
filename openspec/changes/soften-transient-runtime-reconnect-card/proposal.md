## Why

Realtime conversation output can currently show the full `Runtime 连接已中断` recovery card while the backend is already performing expected managed runtime cleanup such as `stale_reuse_cleanup`. The backend behavior is correct, but the live message canvas presents this transient diagnostic as a blocking failure, briefly hiding the assistant message text and making an auto-recovering turn feel broken.

## 目标与边界

- 目标：只调整 realtime conversation UI 对 transient runtime cleanup diagnostics 的展示强度。
- 边界：保留现有 runtime reconnect / resend actions、message recovery hooks、backend lifecycle ownership、terminal settlement rules。
- 重点：`stale_reuse_cleanup` / equivalent internal replacement diagnostics 在实时幕布中应低打扰、可自动收敛，不应像 foreground runtime loss 一样抢占主视觉。

## What Changes

- Classify runtime reconnect hints with a UI-only tone, distinguishing blocking recovery from transient managed-runtime cleanup.
- Render transient cleanup diagnostics as a lightweight inline notice in the live message canvas.
- Hide raw `[RUNTIME_ENDED]` diagnostic text for transient cleanup notices; keep it only for blocking recovery cases.
- Scope the reconnect card to the latest assistant message only; once a newer assistant reply arrives, older runtime diagnostics must not keep a card or raw error text visible.
- Keep backend `runtime/ended` semantics unchanged; no lifecycle settlement or recovery behavior changes.
- Preserve the existing full recovery card for true broken pipe, workspace-not-connected, runtime-ended before settlement, recovery quarantine, and stale thread/session recovery cases.
- Keep transient notice styling theme-token based so light / dark / system themes and Windows WebView2 light surfaces remain compatible.

## 非目标

- 不修改 Rust backend runtime lifecycle, `runtime/ended` payload emission, or shutdown-source semantics.
- 不新增 frontend inference settlement based on assistant text completion.
- 不改变 reconnect / resend / fork recovery action behavior.
- 不隐藏 genuine blocking runtime failures.

## 技术方案对比

| 选项 | 说明 | 取舍 |
|---|---|---|
| A. 后端不再发 `stale_reuse_cleanup` diagnostic | 从源头减少前端卡片 | 不采用。用户已确认后端交互目前正确，且 diagnostic 对排查有价值。 |
| B. 前端完全忽略 `stale_reuse_cleanup` | UI 最安静 | 不采用。会丢失诊断可见性，也不利于用户理解短暂恢复。 |
| C. 前端保留诊断但降级为 transient UI | 不改功能，只调整视觉强度 | 采用。符合最小变更原则，保留诊断和恢复能力。 |
| D. transient 分支改成 lightweight notice | 保留按钮但弱化 recovery/error card 视觉 | 采用。可恢复场景不应被误读为断联失败，同时仍保留手动兜底入口。 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-live-message-canvas-rendering`: realtime message canvas MUST distinguish transient managed-runtime cleanup diagnostics from blocking runtime reconnect failures.

## Impact

- Frontend message UI:
  - `src/features/messages/components/runtimeReconnect.ts`
  - `src/features/messages/components/RuntimeReconnectCard.tsx`
  - `src/styles/messages.part1.css`
  - `src/i18n/locales/*.ts`
- Tests:
  - focused runtime reconnect Vitest coverage.
- No backend, API, database, or dependency changes.

## Acceptance Criteria

- `stale_reuse_cleanup` runtime-ended diagnostic in live messages is shown as low-interruption transient UI, not as the full blocking recovery card.
- The transient cleanup surface uses lightweight notice copy and theme-token styling, not the high-severity recovery/error card treatment.
- Genuine runtime failures still show the existing recovery actions.
- Transient cleanup notices do not repeat raw `会话失败: [RUNTIME_ENDED] ...` diagnostic text in the card or underneath it.
- Older runtime diagnostics are hidden after a newer assistant reply proves the conversation surface has moved on.
- Focused message reconnect tests and typecheck pass.
