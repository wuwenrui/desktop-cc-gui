## Context

Project Map now has context/explain/impact foundations, but large maps still need guided navigation. This change will add tour, search/history, and path finding without waiting for a full relation extraction pipeline.

## Goals / Non-Goals

**Goals:**

- Provide guided tour steps for onboarding, architecture review, risk review, and task planning.
- Improve Project Map search and navigation history.
- Add shortest available path finding between two nodes using hierarchy and optional relations.

**Non-Goals:**

- No docs/wiki graph ingestion.
- No renderer replacement.
- No AI-only tour requirement; deterministic tour generation is acceptable first.

## Decisions

- Use optional tour metadata so legacy datasets remain valid.
- Compute path finding from existing hierarchy plus optional relations.
- Keep search/tour/path visual state separate from layout state to avoid recomputation.

## Risks / Trade-offs

- [Risk] Sparse relations may produce short or missing paths -> Mitigation: fallback to hierarchy paths and explicit no-path messaging.
- [Risk] Tour UI can crowd inspector -> Mitigation: use a dedicated panel/section with compact step controls.
