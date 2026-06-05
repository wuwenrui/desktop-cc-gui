## Context

As Project Map grows relations and governance links, freshness and graph integrity become product requirements. This change will add explicit stale reasons, fingerprint-aware refresh suggestions, and deterministic graph repair.

## Goals / Non-Goals

**Goals:**

- Explain why Project Map nodes or relations are stale.
- Classify changes into skip, partial refresh, architecture refresh, or full refresh suggested.
- Validate and repair dangling relations, orphan topology, and missing evidence references.

**Non-Goals:**

- No automatic post-commit update hook.
- No automatic SessionStart graph mutation.
- No LLM repair before deterministic repair exists.

## Decisions

- Refresh remains explicit and user-triggered.
- Deterministic validation runs before any AI repair suggestion.
- Repair output is visible and scoped.

## Risks / Trade-offs

- [Risk] Fingerprints may miss semantic changes -> Mitigation: classify as refresh suggestions, not hard truth.
- [Risk] Repair could remove useful data -> Mitigation: quarantine or report before destructive repair where possible.
