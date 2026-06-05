## Why

Project Map 最近连续补了 context/explain、impact sources、relation persistence、guided tour/path finder、governance graph、refresh/staleness、graph integrity/repair 等能力。OpenSpec validate 和 TypeScript typecheck 已经通过，但这些新增能力主要依赖 pure utilities、derived projections、UI state layering 和 persistence normalization，缺少足够的 focused regression tests。

如果继续叠加 Evidence Explorer、Relation UX 和 Orchestration bridge，而没有测试护栏，风险会从“功能未完成”变成“后续改动悄悄回退已完成能力”。下一步应先补一组精准测试，锁住 Project Map 核心借鉴功能的行为边界。

## 目标与边界

目标：

- Add focused Vitest coverage for Project Map pure utilities and persistence normalization.
- Cover navigation, impact, governance graph, refresh/staleness, graph integrity/repair, relation persistence, and upcoming evidence/relation UX helpers.
- Keep tests deterministic and fixture-driven.
- Prefer pure utility/store tests over broad brittle UI snapshots.

边界：

- This change is a quality-gate/backfill change; it should not introduce new product behavior by itself.
- Tests should use small representative fixtures, not full production map dumps.
- Do not run broad full-suite gates unless implementation phase explicitly chooses to.

## 非目标

- 不重写 Project Map architecture。
- 不引入 Playwright/E2E 作为第一层护栏。
- 不做 snapshot-only 视觉回归。
- 不借测试名义修改已有业务行为。

## What Changes

- Add focused tests for existing Project Map utilities:
  - `navigation.ts`: guided tour, search, shortest path, hierarchy fallback.
  - `impactAnalysis.ts` and `impactSources.ts`: changed-file matching and impact summary.
  - `governanceGraph.ts`: OpenSpec/Trellis metadata extraction and AgentTask context pack source refs.
  - `refreshClassifier.ts`: stale reason classification.
  - `graphIntegrity.ts`: validation and manual repair result.
  - `projectMapPersistence.ts`: relation/read-write normalization and legacy compatibility where practical.
- Add fixture builder utilities for compact Project Map datasets.
- Add test expectations for read-only boundaries: filters, indexes, and derived projections do not mutate datasets.
- When Evidence Explorer and Relation UX are implemented, add tests for evidence file index and relation index helpers.

## 技术方案取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 只继续跑 typecheck | 快 | 无法防行为回退 | 不采用 |
| B | 补 focused utility/store tests | 稳定、快、定位精准 | 需要写 fixture builder | 采用 |
| C | 直接做全量 E2E | 覆盖真实交互 | 成本高、慢、易受环境影响 | 不作为 MVP |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-xray-panel`: Project Map core derived projections and navigation behavior shall have focused regression coverage for key user-facing contracts.

## Impact

- Test files under `src/features/project-map/**`.
- Possible shared test fixture helper under Project Map test utilities.
- No production behavior change expected.

## 验收标准

- Project Map navigation utility tests cover search, guided tour, shortest path, and no-path behavior.
- Project Map impact tests cover git-status changed file matching and no-impact fallback.
- Governance graph tests cover OpenSpec metadata, Trellis task metadata, and Agent Task context pack source refs.
- Refresh/staleness tests cover fresh, stale, missing evidence, and changed source scenarios.
- Graph integrity tests cover missing endpoints, duplicate relation ids, and manual repair result.
- Relation persistence tests cover reading/writing relation payloads and legacy missing-relation datasets.
- Tests use compact fixtures and do not rely on real user absolute paths.
