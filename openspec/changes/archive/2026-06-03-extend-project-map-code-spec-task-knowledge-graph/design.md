## Context

Project Map currently understands code-oriented nodes better than project governance artifacts. mossx also stores truth in OpenSpec, Trellis, AGENTS.md, and docs. This change will add deterministic Code+Spec+Task relationships before any LLM enrichment.

## Goals / Non-Goals

**Goals:**

- Link Project Map code nodes to OpenSpec capabilities, scenarios, Trellis tasks, and docs.
- Prefer deterministic extraction over LLM inference.
- Make context packs useful for Agent Task Orchestration and Spec Hub flows.

**Non-Goals:**

- No standalone knowledge dashboard.
- No automatic spec/task mutation from inferred graph data.
- No arbitrary wiki semantic graph in the first iteration.

## Decisions

- Add spec/task/doc relationships first, not a separate product surface.
- Mark source kind for every relation so deterministic and inferred data remain distinguishable.
- Keep graph expansion optional and backwards compatible.

## Risks / Trade-offs

- [Risk] Spec/task parsing can become broad -> Mitigation: start with OpenSpec capability/scenario and Trellis task metadata only.
- [Risk] Graph can become noisy -> Mitigation: require evidence and source kind for governance links.
