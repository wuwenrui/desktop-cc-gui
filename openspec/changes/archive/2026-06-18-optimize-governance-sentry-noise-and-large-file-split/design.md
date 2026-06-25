## Overview

本变更把 governance sentry 分成两层：blocking layer 只处理必须阻断合并的 hard regression，advisory layer 继续保留 near-threshold / audit evidence，但从高频 PR/push 成功路径中移出。代码侧通过 boundary-driven split 降低 `src/services/tauri.ts` 的 hard-debt，而不是调阈值。

## Architecture

### Large-file sentry

- `large-file-sentry-hard-gate` 继续在 PR/push/workflow_dispatch 三平台运行。
- hard gate steps：
  - checkout
  - setup node
  - `npm ci`
  - parser tests
  - `npm run check:large-files:gate`
- near-threshold watch 拆到 advisory job：
  - 仅在 `workflow_dispatch` 或 schedule 运行。
  - 继续生成 `.artifacts/large-files-near-threshold.json`。
  - 不参与普通 PR/push blocking path。

### Heavy-test-noise sentry

- 三平台 full sentry 保持 blocking semantics。
- parser tests 和 `npm run check:heavy-test-noise` 保持不变。
- artifact upload 改为 `if: failure()`，只在需要诊断时上传 `.artifacts/heavy-test-noise.log`。
- 可加 workflow/job concurrency，减少同一 branch 高频 push 的重复执行。

### `src/services/tauri.ts` split

`src/services/tauri.ts` 继续作为 public facade。抽离原则：

- 每个新模块只拥有一组相关 Tauri command wrapper 与类型。
- 保持 payload field names 不变。
- 不改调用方 import path。
- 不改 backend command names。

优先拆出：

- `src/services/tauri/git.ts`: Git status / diff / branch / PR workflow invoke wrappers。
- `src/services/tauri/workspaceFiles.ts`: workspace file tree / read-write / external spec / file operation invoke wrappers。
- `src/services/tauri/emailAndServer.ts`: email settings, mail session, web server, daemon, menu labels。

## 方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Boundary-driven split + advisory job | 解决 hard debt，同时降低 CI 噪音；行为边界清晰 | 需要谨慎迁移 exports | 采用 |
| 仅改 workflow | 快速降噪 | `src/services/tauri.ts` hard fail 仍存在 | 不足 |
| 仅拆文件 | hard gate 通过 | near-threshold watch 仍刷 PR/push 日志 | 不足 |

## Data Flow / Error Handling

- Tauri invoke wrapper 保持原 command label、payload shape、return type。
- 旧 facade 从新模块 re-export，调用方不感知模块拆分。
- `listWorkspaces()` 的 missing Tauri invoke fallback 留在 facade 或专门 runtime/workspace module 中，避免改变 web preview 行为。
- CI workflow 只调整触发和 artifact 条件，不吞掉实际 gate exit code。

## Validation Plan

- `node --test scripts/check-large-files.test.mjs`
- `npm run check:large-files:gate`
- `node scripts/check-large-files.mjs --policy-file scripts/check-large-files.policy.json --baseline-file docs/architecture/large-file-baseline.json --scope warn --mode report`
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `npm run typecheck`

## Rollback

- Workflow 回滚可单独 revert 两个 YAML。
- Service split 回滚可恢复 `src/services/tauri.ts` 原实现；新模块不改变 command contract，不涉及 persisted data migration。
