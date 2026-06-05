## Context

Project Map currently has two different model-output paths. The main generation worker scans candidate JSON blocks, applies lenient repair, and performs a one-shot JSON-only repair prompt when validation fails. The AI organizer path is separate and directly parses the extracted object with `JSON.parse()`. Switching to MiniMax-M2.7 exposed that drift: malformed organizer JSON with a missing `]` fails immediately even though the product already has a stronger repair pattern elsewhere.

Model providers are not stable structured transports. Claude, MiniMax, Codex, Gemini, and future engines can wrap JSON in prose, emit markdown fences, use relaxed object syntax, or truncate arrays. Business logic must therefore treat raw model text as untrusted input and consume only normalized, domain-validated payloads.

## Goals / Non-Goals

**Goals:**

- Create a reusable structured-output normalization utility with no model-specific branches.
- Preserve strict domain validation: parsing JSON is not enough; payload shape must still match the caller's validator.
- Give organizer the same bounded repair behavior as main Project Map generation.
- Keep failure visible and fail-closed when repair cannot recover a valid payload.

**Non-Goals:**

- No persisted schema migration.
- No external tolerant JSON parser dependency.
- No automatic multi-retry loop or hidden background retry.
- No claim that every malformed or truncated model response is recoverable.

## Decisions

### Decision 1: Shared pure utility, not feature-local copy

The shared module lives under `src/services/modelStructuredOutput.ts` because it is model-output infrastructure, not Project Map business logic. Feature code supplies validators and repair prompts; the utility only handles text normalization and parse diagnostics.

Alternative A was to leave the current worker helpers in place and copy them into organizer. That would fix the immediate bug but preserve drift. Alternative B was a broad AI SDK abstraction. That is over-scoped for this change. The selected approach is a small pure utility with explicit caller-owned validation.

### Decision 2: Bounded repair policy

The flow is strict parse, lenient local repair, caller validator, then at most one JSON-only model repair attempt when the caller opts in. This keeps the system robust against common model formatting errors without creating infinite loops or hiding model failures.

### Decision 3: Domain validators remain mandatory

The normalizer accepts a validator function such as `isProjectMapAiPayloadShape` or `isOrganizerPayloadShape`. It returns a typed payload only when the validator passes. Parsed non-payload JSON is treated as schema mismatch, not success.

### Decision 4: Fail-closed remains the safety boundary

If normalization and one repair attempt fail, Project Map records a failed run and does not write partial lenses, partial nodes, partial candidates, or manifest updates as trusted knowledge.

## Risks / Trade-offs

- [Risk] Lenient repair may make invalid text parseable but semantically wrong. → Mitigation: every caller must provide a domain validator and existing Project Map safety gates still validate candidate moves.
- [Risk] Moving helpers can regress existing main generation repair behavior. → Mitigation: preserve existing focused generation repair tests and add organizer-specific malformed JSON tests.
- [Risk] One-shot repair adds extra model call latency on malformed output. → Mitigation: only triggered after validation failure and bounded to one attempt.
- [Risk] A completely truncated response may still be unrecoverable. → Mitigation: visible `output_parse_failed` remains the intended safe fallback.

## Migration Plan

1. Add shared structured-output utility and tests through Project Map call sites.
2. Refactor main Project Map generation parser to use the shared utility while keeping existing behavior.
3. Refactor organizer parser to use the shared utility and add one JSON-only repair prompt.
4. Keep persisted Project Map files backward compatible; no migration needed.
5. Rollback is local: revert utility adoption and organizer repair path; existing persisted data remains valid.

## Open Questions

None for the first slice. Future changes can adopt the utility in other AI JSON consumers after their validators are identified.

## Implementation Calibration

Implemented code facts:

- Shared normalization lives in `src/services/modelStructuredOutput.ts`.
- Main Project Map generation now calls `parseModelStructuredJsonObject` with `isProjectMapAiPayloadShape` before applying `ProjectMapAiPayload`.
- Project Map organizer now calls the same normalization layer with `isOrganizerPayloadShape` and performs one JSON-only repair attempt before failing closed.
- Organizer parsing remains provider-agnostic; no Claude/MiniMax/Codex/Gemini branch was introduced.
- Frontend implementation memory was captured in `.trellis/spec/frontend/model-structured-output.md`, and the trigger was linked from `.trellis/spec/frontend/index.md` and `.trellis/spec/frontend/quality-guidelines.md`.

Compatibility notes:

- Existing Project Map repair cases remain covered, including markdown/prose wrappers, bare object keys, trailing commas, bare enum values, schema placeholder ellipsis, missing closers, and unquoted Chinese/natural-language values.
- No persisted Project Map schema changed.
- Repair remains bounded to one model retry where prompt context is available.
