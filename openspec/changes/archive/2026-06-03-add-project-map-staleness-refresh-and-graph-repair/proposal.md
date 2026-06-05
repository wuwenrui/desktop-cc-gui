## Why

Project Map already tracks stale nodes, and the first context/impact change added ignore policy and minimal impact analysis. The remaining research recommendations call for fingerprint-based refresh, explainable stale suggestions, and graph validation/repair to keep Project Map trustworthy as the graph grows.

This change adds the governance layer for Project Map freshness and graph integrity.

## 目标与边界

目标：

- Add fingerprint/change-classification support for Project Map refresh decisions.
- Show explainable stale reasons and refresh recommendations in Project Map.
- Add graph validation for dangling relations, orphan nodes, invalid relation endpoints, and missing evidence.
- Add safe repair actions that remove or quarantine invalid graph records.
- Keep refresh explicit and user-triggered.

边界：

- Refresh suggestions are advisory unless the user explicitly triggers refresh.
- Validation/repair should be deterministic first.
- LLM reviewer/repair can be proposed as a later optional enhancement only after deterministic checks exist.

## 非目标

- 不增加 post-commit auto-update hook。
- 不在 SessionStart 自动修改 Project Map。
- 不重建完整 graph generation pipeline。
- 不实现 external dashboard token gate。

## What Changes

- Add Project Map fingerprint metadata for source/spec/task evidence where practical.
- Add change classifier categories such as `skip`, `partial-refresh`, `architecture-refresh`, and `full-refresh-suggested`.
- Add stale reason display in Project Map panel.
- Add graph integrity validator for relations, node references, evidence references, and orphan topology.
- Add safe repair output and UI actions for deterministic fixes.

## 技术方案取舍

| 选项 | 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | Auto-refresh Project Map after every git operation | Keeps map fresh | Violates PlanFirst/user-control expectations | 不采用 |
| B | Explicit stale badge + fingerprint classifier + user-triggered refresh | Trustworthy and workflow-compatible | Requires user action | 采用 |
| C | Full rebuild on every change | Simple mental model | Expensive and noisy | 不采用 |

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `project-map-incremental-generation`: Project Map refresh shall use fingerprint/change classification and preserve graph integrity.
- `project-xray-panel`: Project Map shall show stale reasons, refresh recommendations, and graph repair results.
- `dynamic-project-governance-evidence`: Project Map freshness and repair evidence may be surfaced as governance evidence.

## Impact

- Project Map generation metadata.
- Project Map stale/refresh services.
- ProjectMapPanel stale and repair UI.
- Optional governance evidence integration.

## 验收标准

- Project Map can explain why a node or map is stale.
- Cosmetic or ignored changes do not force refresh recommendations.
- Structural changes produce partial or architecture refresh recommendations.
- Invalid relations with missing endpoints are detected before rendering-dependent use.
- Repair actions are deterministic, scoped, and user-visible.
