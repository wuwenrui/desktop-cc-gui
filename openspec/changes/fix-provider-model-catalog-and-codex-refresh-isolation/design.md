## Context

Composer model selection is now rendered as provider-grouped compact rows. The current data path still passes one `models` array that represents the active engine only. That causes non-active provider groups to lose dynamic catalog facts, and it makes user custom models vulnerable to being dropped when a parent already passes a hydrated catalog.

Codex model refresh has a separate lifecycle issue: `refreshCodexModelConfig()` calls `reloadCodexRuntimeConfig()` before refreshing the model list. That was acceptable when refresh was treated as external config reload, but it is wrong for the selector footer. A model catalog refresh is expected to be safe while a conversation is running; runtime reload is an explicit lifecycle action.

## Goals / Non-Goals

**Goals:**

- Make Codex selector refresh catalog-only.
- Keep explicit Codex runtime reload available in settings.
- Preserve Codex and Claude custom models in both single-provider and grouped selector surfaces.
- Let grouped selector consume per-provider catalog facts instead of only the active engine model list.
- Keep provider-scoped launch and thread binding unchanged.

**Non-Goals:**

- No new backend command.
- No redesign of provider management UI.
- No change to Codex runtime key, `CODEX_HOME`, or provider binding persistence.
- No HomeChat UI changes.

## Decisions

### Decision 1: split catalog refresh from runtime reload

`refreshCodexModelConfig()` will stop calling `reloadCodexRuntimeConfig()` and will only run `refreshModels()`.

Alternative A was to keep reload and suppress runtime-ended UI cards. That would hide the symptom but still kill active work. Alternative B was to add a new backend no-op reload mode. That adds contract surface without need. The existing model list and config-model reads are already enough for catalog refresh.

### Decision 2: keep runtime reload as an explicit settings action

The settings page Codex runtime reload button and official `unified_exec` action lane can continue using `reloadCodexRuntimeConfig()`. Those actions are explicitly about applying external runtime config and already display reload status.

Alternative was to remove runtime reload entirely from the frontend. That would break legitimate external config apply workflows.

### Decision 3: introduce provider catalog snapshots for grouped selector

Composer will pass provider-scoped model groups or a model-catalog snapshot that includes at least Codex, Claude Code, and Gemini model lists. `modelOptions` will use the provider-specific list when resolving each group and fall back to provider custom models where no runtime list exists.

Alternative was to keep one `models` prop and special-case current provider. That is the existing failure mode: the grouped UI pretends to show all providers but only owns one provider's source-of-truth.

### Decision 4: treat provider-scoped Codex custom models as catalog facts

Codex provider `customModels` will be merged into the visible Codex custom model store after provider load/save. This keeps existing UI and storage contracts while avoiding a new backend catalog API.

Alternative was to require users to duplicate models in the global plugin model dialog. That violates the provider dialog's own custom model affordance and explains the current confusion.

## Risks / Trade-offs

- [Risk] Provider custom model merge may duplicate global custom models. → Mitigation: merge by trimmed `id`, preserve existing global labels first, and only add missing provider models.
- [Risk] Per-provider catalog data could become stale after switching engines. → Mitigation: existing refresh events update current engine; custom models update through `localStorageChange`; provider snapshots are additive and fail-safe.
- [Risk] Removing Codex runtime reload from selector refresh means some external config values only apply on explicit reload. → Mitigation: the settings page still exposes explicit runtime reload with status.

## Migration Plan

1. Add spec deltas for refresh isolation and provider catalog preservation.
2. Update frontend catalog helpers and tests.
3. Update Codex provider management hook to merge provider custom models after load/save.
4. Run focused tests and typecheck.

Rollback: revert the frontend helper and hook changes. Explicit runtime reload remains available, so rollback does not require backend migration.

## Open Questions

- Longer term, a backend `get_provider_model_catalogs` command could centralize all catalogs. This is intentionally deferred because the current regression can be fixed without expanding IPC surface.
