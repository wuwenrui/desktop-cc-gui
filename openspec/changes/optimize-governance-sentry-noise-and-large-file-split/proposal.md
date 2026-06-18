## Why

当前 governance sentry 把 advisory signal 和 hard blocking gate 混在同一条 PR/push 三平台路径里：large-file near-threshold watch 会持续制造告警噪音，而 `src/services/tauri.ts` 已经成为新的 P0 hard-debt。现在需要把真正必须拦截的风险保留下来，同时拆掉唯一 hard 大文件，让 CI 输出回到可行动状态。

## 目标与边界

- 保留 large-file hard-debt gate：新增或增长的 fail-threshold debt 继续阻塞 CI。
- 降低 advisory watch 噪音：near-threshold watch 保持可运行、可审计，但不再污染普通 PR/push 主路径。
- 保留 heavy-test-noise 的真实失败能力：repo-owned `act(...)` warning、stdout/stderr leak 仍然失败。
- 拆分 `src/services/tauri.ts` 中的边界清晰 API 区域，保持原 module facade 和现有 import 兼容。

## 非目标

- 不调整 large-file policy threshold。
- 不删除 heavy-test-noise gate。
- 不重写 `scripts/check-large-files.mjs` 或 `scripts/check-heavy-test-noise.mjs` 的核心解析规则。
- 不迁移所有 near-threshold 文件，本次只处理当前 hard fail 和 workflow 噪音。

## What Changes

- `src/services/tauri.ts` 拆出职责模块，优先抽离 Git / workspace file / email-web API 这类低耦合 invoke wrapper。
- `.github/workflows/large-file-governance.yml` 的 PR/push 路径只运行 parser tests 与 hard-debt gate；near-threshold watch 改为手动或定时 advisory。
- `.github/workflows/heavy-test-noise-sentry.yml` 保留三平台 gate，但 artifact 上传仅在失败时发生，减少成功路径日志噪音。
- OpenSpec delta 明确 hard gate 与 advisory watch 的 CI 边界。

## 技术方案取舍

| 方案 | 做法 | 取舍 |
|---|---|---|
| 推荐：hard gate 与 advisory watch 分离 | PR/push 保留 hard gate；watch 用 `workflow_dispatch` / schedule | 保留治理信号，同时减少高频噪音 |
| 备选：全部保留但 continue-on-error | near-threshold watch 在 PR/push 中继续跑但不失败 | 仍然刷日志，开发者会继续忽略告警 |
| 放弃：调高阈值或删除 gate | 通过 policy 放宽让 CI 安静 | 掩盖结构债，破坏治理价值 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `large-file-modularization-governance`: large-file sentry SHALL separate hard-debt blocking from advisory near-threshold watch in high-frequency CI.
- `heavy-test-noise-cleanliness`: heavy-test-noise sentry SHALL keep failure artifacts targeted to failing runs.
- `harness-governance-gate-consolidation`: advisory near-threshold evidence SHALL remain non-blocking while hard large-file debt remains blocking.

## Impact

- CI workflow behavior:
  - `.github/workflows/large-file-governance.yml`
  - `.github/workflows/heavy-test-noise-sentry.yml`
- Frontend bridge service facade:
  - `src/services/tauri.ts`
  - new `src/services/tauri/*.ts` modules
- Validation:
  - `node --test scripts/check-large-files.test.mjs`
  - `npm run check:large-files:gate`
  - `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  - `npm run typecheck`

## 验收标准

- `src/services/tauri.ts` 不再超过 matched policy fail threshold。
- `npm run check:large-files:gate` 通过。
- large-file near-threshold watch 仍可手动或定时运行，并继续产出 advisory artifact。
- heavy-test-noise 成功路径不再无条件上传日志 artifact。
- 现有 `src/services/tauri.ts` public imports 继续 typecheck 通过。
