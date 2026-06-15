# Enforce Bundle Budget Gate

## Goal

执行 OpenSpec change `enforce-bundle-budget-gate`，将 `npm run check:bundle-chunking` 从 chunk existence check 扩展为 structured bundle budget gate。

## Requirements

- 新增 versioned `scripts/bundle-budget.config.json`。
- 统计 `dist/assets` 下 js/mjs/css raw bytes 与 gzip bytes。
- 支持 app JS、app CSS、heavy optional vendor、total js/mjs/css groups。
- 区分 advisory mode 与 fail mode。
- 输出 actionable offender/pass table。
- 保留现有 manual chunk existence checks。

## Acceptance Criteria

- [ ] `npm run check:bundle-chunking` 仍通过。
- [ ] 当前超 future target 的 group 输出 advisory，不阻塞本批次。
- [ ] fail-mode group 超 hardFail 时脚本具备退出非零能力。
- [ ] OpenSpec validation passes。

## Technical Notes

- First rollout 不应直接用 roadmap future thresholds 阻塞当前 branch。
- Heavy optional startup eagerness 若无法可靠测量，必须输出 `not-measured`。
