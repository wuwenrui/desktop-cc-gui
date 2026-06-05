## Context

Project Map 的新能力大多是 deterministic projection：从 dataset、relations、source refs、governance artifacts、changed files 推导 UI 可以展示的 context、impact、path、stale、repair 信息。这类逻辑天然适合 focused tests。如果只依赖 typecheck，后续重构很容易保持类型正确但破坏语义。

## Goals / Non-Goals

**Goals:**

- Add fast focused Vitest tests around Project Map pure utilities and persistence normalization.
- Build compact fixtures that are easy to read and maintain.
- Cover mutation boundaries and degraded states.
- Prepare test seams for Evidence Explorer and Relation UX implementation.

**Non-Goals:**

- No new behavior hidden inside tests.
- No broad visual snapshot suite.
- No requirement to run full `npm run test` on every local iteration.

## Decisions

### 1. Prefer pure utility tests first

#### 决策

Prioritize tests for functions that already have deterministic inputs and outputs:

- `buildProjectMapGuidedTour`
- `searchProjectMapNodes`
- `buildProjectMapShortestPath`
- `buildProjectMapImpactAnalysis`
- `buildGitStatusProjectMapImpactInput`
- `extractOpenSpecMetadata`
- `extractTrellisTaskMetadata`
- `buildProjectMapAgentTaskContextPack`
- `classifyProjectMapRefresh`
- `validateProjectMapGraphIntegrity`
- `repairProjectMapGraphIntegrity`

#### 原因

These tests are fast, stable, and will catch most semantic regressions before UI tests are needed.

### 2. Use compact fixture builders

#### 决策

Create small fixture helpers such as:

```ts
createProjectMapTestDataset({ nodes, relations, sources })
createProjectMapNodeFixture(overrides)
createProjectMapRelationFixture(overrides)
```

Fixtures must use workspace-relative paths like `src/app.ts` and avoid personal absolute paths.

#### 原因

Long inline fixtures make tests unreadable. Compact builders reduce noise and keep expected behavior visible.

### 3. Test degraded states explicitly

#### 决策

Every helper that consumes graph evidence should have at least one degraded-state test:

- missing relation endpoint
- missing source path
- stale node
- low/unknown confidence
- malformed provider metadata
- legacy dataset without new optional fields

#### 原因

The Project Map UI is evidence-backed; degraded states are normal, not exceptional.

### 4. Persistence tests should target normalization and roundtrip boundaries

#### 决策

Where persistence is easy to unit-test without Tauri backend, test frontend serialization/normalization. Backend storage whitelist/atomic write tests should only be added if the implementation changes backend code.

#### 原因

This change should remain lightweight and avoid expensive integration setup unless the implementation crosses the backend boundary.

### 5. UI tests are selective

#### 决策

Use component tests only for state layering that pure utilities cannot cover:

- selected node -> relation/evidence panel state
- filters do not mutate dataset
- empty/degraded visible states

Avoid large snapshots of the whole ProjectMapPanel.

#### 原因

Broad UI snapshots are brittle and often hide intent.

## Risks / Trade-offs

- [Risk] Tests may ossify implementation details.
  - Mitigation: assert behavior and output shape, not private intermediate variables.

- [Risk] Fixture helpers become another abstraction to maintain.
  - Mitigation: keep helpers minimal and local to Project Map tests.

- [Risk] Persistence tests may be hard if functions are not exported.
  - Mitigation: prefer testing public normalization/serialization seams; only expose helpers if it improves maintainability.

## Migration Plan

1. Add fixture builder helpers.
2. Add navigation tests.
3. Add impact/governance tests.
4. Add refresh/graph integrity tests.
5. Add relation persistence normalization tests where practical.
6. Add Evidence Explorer and Relation UX helper tests when those changes are implemented.
7. Run focused Vitest suites and typecheck during implementation.
