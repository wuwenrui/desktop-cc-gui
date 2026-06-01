## Why

Post-Phase2a evidence now shows the required Phase2b GO signals: scoped terminal evidence is accepted, lifecycle state still reports busy, and watchdog/interruption can race into a skipped cleanup path. The problem is no longer missing evidence; it is fragmented foreground-turn settlement after terminal, interrupt, or watchdog recovery signals.

## 目标与边界

Phase2b targets scoped guarded cleanup for the exact foreground turn that has already been proven terminal or abandoned by accepted evidence.

- Clear frontend loading residue only for the matching `workspaceId + engine + threadId + turnId` lifecycle scope.
- Converge terminal evidence, authoritative reconciliation status, interrupt, and watchdog recovery into one settlement contract.
- Preserve normal long-running Codex turns and active execution items.
- Keep all diagnostics bounded and free of prompt/output/tool/file-diff content.

## What Changes

- Add Phase2b foreground settlement rules for `cleanup-residue` decisions accepted by the three-evidence helper.
- Clear matching foreground busy state, processing flags, and active-turn markers only after accepted scoped terminal evidence.
- Treat matched terminal evidence with `busy-residue` as sufficient cleanup input even when reconciliation query is skipped because the helper already decided `cleanup-residue`.
- Treat interrupted watchdog skips as a settlement trigger only when they match the current or immediately abandoned foreground turn scope.
- Keep `running`, `unknown`, `query-failed`, stale scope, and scope-mismatched evidence as no-cleanup outcomes.
- Add focused regression coverage for the two observed GO paths from `2026-06-01`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-stalled-recovery-contract`: Codex foreground turns with accepted terminal/interrupted settlement evidence must not remain in pseudo-processing or busy residue.
- `engine-runtime-contract`: three-evidence lifecycle cleanup must remain scoped, conservative, and forbidden from inferring completion from elapsed time, visible text, history content, or frontend silence.

## 技术方案选项

| 选项 | 描述 | 优点 | 风险 | 取舍 |
| --- | --- | --- | --- | --- |
| A. 分散补丁式清状态 | 在 terminal、interrupt、watchdog 各入口分别补清理字段 | 改动局部、短期快 | 容易再次漏字段；状态语义继续分裂 | 不采用 |
| B. 统一 guarded settlement | 所有可证明终态路径收敛到同一个 scoped cleanup helper | 契约清晰；测试可覆盖；减少时序竞争 | 需要梳理调用点 | 采用 |
| C. 后端强制重放 terminal | 通过 runtime replay 弥补前端遗漏 | 可扩展到更多异常 | 当前证据已足够，不应扩大范围 | 延后 |

## 非目标

- 不从 elapsed time、visible text、history content、stale progress 推断完成。
- 不新增 generic runtime recovery state machine。
- 不重放 missed terminal events。
- 不改变正常 long-running turn 的 active-work protection。
- 不扩大 error-log 采集范围到敏感内容。

## Impact

- Frontend lifecycle: `src/features/threads/hooks/useThreadEventHandlers.ts` and adjacent settlement helpers/tests.
- Diagnostics: bounded client error-log payloads for Phase2b cleanup applied/skipped decisions if needed.
- Specs: `codex-stalled-recovery-contract`, `engine-runtime-contract`.
- Tests: focused Vitest coverage for query-skipped cleanup residue and watchdog interrupted race.

## Acceptance

- A scoped `three-evidence-reconciliation-query-skipped` payload with matched terminal/state evidence and `cleanup-residue + busy-residue` clears only the matching foreground busy residue.
- A scoped watchdog interrupted race does not leave the old turn in processing or active-turn state.
- `running`, `unknown`, `query-failed`, stale scope, and mismatched scope never clear a current active turn.
- Long-running turns with active execution evidence continue to be protected.
- Focused tests and OpenSpec strict validation pass.
