## Context

The current Claude model pipeline has two frontend readers for `claude-custom-models`: composer model options and engine controller model options. Both read the same localStorage fact, but they apply a stricter model id validator from a generic provider module. The settings surface uses a looser contract and therefore can persist entries that the selector later hides.

## Decision

Introduce a Claude-specific custom model normalization helper. It treats user-entered Claude model ids as facts, not as values to be checked against a generic model-id pattern.

The helper accepts only structurally usable entries:

- payload is an array
- entry is an object
- `id` is a string
- trimmed `id` is non-empty

It preserves the trimmed id as both UI identity and runtime model value. `label` and `description` remain optional display metadata. Duplicate ids are deduped by first occurrence.

## Alternatives

| Option | Result | Reason |
|---|---|---|
| Keep strict regex and ask users to slug ids | Rejected | Violates the custom-model fact-source contract |
| Add one-off exceptions for spaces | Rejected | Still leaves punctuation/Unicode drift and two readers |
| Shared shape-only Claude helper | Accepted | Keeps one contract and preserves user intent |

## Data Flow

1. Backend `get_engine_models("claude")` continues to return settings/env override entries.
2. Frontend reads `claude-custom-models` through the shared helper.
3. EngineController merges backend settings/env entries with normalized custom entries.
4. Composer model options also use the same helper when building grouped selector models.
5. Vendor settings reads Claude custom models through the same helper and uses shape-only dialog validation for Claude.
6. Send-time Claude logic keeps using the resolved runtime model and does not apply an official allowlist.

## Risk

The runtime may reject a user-entered model. That rejection belongs to Claude CLI/provider runtime and should be surfaced as a runtime error. The GUI should not preemptively hide user-owned custom model facts.

## Validation

- Focused Vitest for composer model option merge.
- Focused Vitest for engine controller merge.
- Focused Vitest for Claude shape-only custom model dialog validation.
- Focused Vitest for vendor-side Claude custom model storage reads.
- OpenSpec strict validation for this change.
