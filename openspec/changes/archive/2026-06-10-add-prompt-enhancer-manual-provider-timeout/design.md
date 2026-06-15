## Context

Composer prompt enhancement currently couples dialog opening with request execution. `usePromptEnhancer.handleEnhancePrompt()` reads the draft, opens `PromptEnhancerDialog`, selects an engine from the current Composer provider, and immediately calls `engineSendMessageSync` with a fixed 60 second timeout.

The requested behavior requires a different contract: opening the dialog is a configuration step, and the enhancement run is a user-triggered action after selecting an engine and timeout.

## Goals / Non-Goals

**Goals:**

- Split prompt enhancer lifecycle into `open` and `run`.
- Add per-run engine selection inside the dialog.
- Add per-run model selection inside the dialog.
- Add per-run timeout input inside the dialog.
- Keep existing isolated hidden auto-session behavior.
- Keep enhanced prompt adoption behavior unchanged.
- Keep the change frontend-only unless the existing bridge contract proves insufficient.

**Non-Goals:**

- No global persisted prompt enhancer settings.
- No new engine provider management.
- No change to normal Composer send provider/model behavior.
- No Rust/Tauri command schema change.
- No new dependency.

## Decisions

### Decision 1: Keep state orchestration in `usePromptEnhancer`

`usePromptEnhancer` will remain the feature-local orchestration boundary. The dialog receives controlled values and callbacks for config changes and run execution.

Alternatives considered:

- Move request logic into `PromptEnhancerDialog`: rejected because it would mix render concerns with runtime side effects.
- Introduce a new global prompt enhancer store: rejected because the requirement is per-dialog configuration, not persistence.

### Decision 2: Model provider selection as `EngineType`

The dialog will expose the current enhancement engine as an `EngineType` choice: `claude`, `codex`, `gemini`, and `opencode`.

Alternatives considered:

- Reuse Codex provider-scoped session providers: rejected because those are Codex launch profiles, not generic prompt enhancement engines.
- Reuse the Composer model selector directly: rejected because prompt enhancement is a temporary hidden auto-session and needs per-run control independent from ordinary send.

### Decision 3: Clamp timeout in the hook

Timeout input may be edited freely, but the hook will sanitize before running. The implementation will keep a bounded range to prevent accidental zero-timeout or unbounded waits.

Alternatives considered:

- Trust raw input: rejected because it creates unsafe runtime behavior.
- Persist timeout globally: rejected as unnecessary state.

### Decision 4: Reuse Composer model groups for enhancer model selection

The prompt enhancer will receive the existing Composer provider model groups and select a model from the group matching the selected enhancer engine. The runtime model value will prefer the model's explicit runtime `model` field when present, otherwise fall back to its `id`.

Alternatives considered:

- Query engine models again from the enhancer hook: rejected because it duplicates existing Composer model discovery and can drift.
- Only use the active Composer selected model: rejected because it fails the requirement to choose a model under the selected enhancer engine.

### Decision 5: Preserve stale-request invalidation

The existing `activeRequestIdRef` pattern will continue to invalidate in-flight results when the dialog closes or a newer run starts.

Alternatives considered:

- Add AbortController: rejected for this change because `engineSendMessageSync` is already wrapped by timeout and does not currently expose abort semantics through the service boundary.

## Risks / Trade-offs

- [Risk] More dialog props increase local component complexity. → Mitigation: keep all business logic in the hook and keep the dialog as controlled UI.
- [Risk] Users may enter invalid timeout values. → Mitigation: sanitize/clamp before running and show the normalized value.
- [Risk] Existing tests expect immediate request on open. → Mitigation: update tests to assert the new manual-run contract.
- [Risk] Claude fallback behavior could surprise users who explicitly select a different engine. → Mitigation: only keep fallback semantics for Claude runs; non-Claude explicit selections fail directly with their own diagnostic.

## Migration Plan

1. Add OpenSpec requirement for manual prompt enhancement run.
2. Update hook lifecycle and dialog props.
3. Update i18n copy.
4. Update focused hook tests.
5. Validate with focused tests/typecheck when requested.

Rollback is file-level: revert the prompt enhancer hook, dialog, i18n, and tests to restore the previous open-and-run behavior.

## Open Questions

- Whether per-run engine/timeout should later become persisted defaults. This is intentionally deferred until there is repeated usage evidence.
