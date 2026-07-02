# Verification

## Passed

- `npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts`
  - 68 tests passed（含新增 3 项：codex 升级收尾、进展恢复取消升级、claude 僵尸执行项收尾）。
- `npx vitest run src/features/threads/`
  - 119 test files passed, 1359 tests passed.
- `npm run test`
  - 770 test files completed（见提交时门禁记录）。
- `npm run typecheck`
  - TypeScript passed.
- `npx eslint` on changed files
  - 0 errors, 0 warnings.

## Not Run

- `openspec validate settle-stalled-turn-busy-state --strict --no-interactive`
  - Blocked because `openspec` is not installed or available on PATH.
- 用户机复现回归（需 v0.6.7 发布后由用户验证同场景不再无限转圈）。
