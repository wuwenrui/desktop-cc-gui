# Design / 设计

## Context / 背景

Message Markdown already has two important performance boundaries: live streaming can use lightweight/progressive rendering, and `FullMarkdownRuntime` is lazy-loaded for rich final rendering. File Markdown preview already has a fast markdown worker substrate. The missing piece is a message final Markdown precompute pipeline that moves serializable heavy work off the main thread while preserving the existing rich React renderer for features that require React/DOM/sanitization.

This design intentionally does not run ReactMarkdown in a worker.

## Architecture / 架构

```text
Markdown.tsx
  -> classify live vs final
  -> resolve renderer profile/options
  -> compute contentHash/sourceVersion
  -> if large final and worker supported:
       markdownPrecomputeWorker
       -> serializable metadata/segments/fast compile result
       -> cache by profile + messageId + contentHash + optionsHash + schema
     else:
       existing main path
  -> FullMarkdownRuntime lazy boundary for rich React render
  -> diagnostics/evidence
```

## Decisions / 关键决策

### Decision 1: Worker handles serializable precompute, not React render

Worker-eligible work includes content hashing, block scanning, heading/heavy-block metadata, safe fast compile outputs, segmentation hints, or similar serializable results. React components, DOM, Tauri APIs, sanitizer trust decisions, Mermaid rendering, KaTeX DOM output, and copy/file-link actions stay in the main React path.

### Decision 2: Large final threshold avoids worker overhead for small messages

Small messages should keep the existing main path. Worker precompute starts only when content length or complexity signals justify startup/serialization cost. Initial threshold can be `>= 10_000` chars or heavy-block/math/tool-call complexity, then tuned by evidence.

### Decision 3: Cache key includes renderer options

Cache key:

```text
rendererProfile + messageId + contentHash + optionsHash + schemaVersion
```

`optionsHash` must include feature flags and sanitization-affecting options. Omitting options risks stale or unsafe structure reuse.

### Decision 4: Stale guard is mandatory

Every async worker result carries request id, message id, content hash, options hash, and schema version. If current visible source differs, the result is dropped.

### Decision 5: Fallback is functional, not performance proof

Worker unsupported, timeout, or error falls back to existing readable main path. That preserves correctness but may still be slow. Evidence must record `fallbackReason` and must not claim off-main-thread improvement for fallback cases.

### Decision 6: Live streaming behavior is protected

The pipeline applies to final/settled message path. Live partial Markdown continues to use bounded stabilization/lightweight fallback and must not load/execute full parser for every fragment.

## Worker Protocol / Worker 协议

Input:

```text
requestId
messageId
contentHash
rendererProfile
optionsHash
schemaVersion
sourceLength
source
```

Output:

```text
requestId
messageId
contentHash
optionsHash
schemaVersion
mode
precomputeResult
durationMs
warnings?
```

The output is never trusted HTML by default. Sanitization and rich rendering boundaries remain explicit.

## Diagnostics Contract / 诊断合同

Markdown evidence includes:

- mode: `worker-precompute` / `main` / `cache-hit` / `fallback`;
- duration;
- content length;
- content hash;
- threshold reason;
- cache state;
- fallback reason;
- evidence class.

Diagnostics MUST NOT include raw Markdown, prompt text, assistant body text, tool output body, or file content.

## Rollout Plan / 实施顺序

1. Audit current message Markdown and fast markdown worker capabilities.
2. Define message precompute protocol and cache shape.
3. Implement cache/stale guard independent of UI.
4. Route large final messages through worker precompute under threshold.
5. Keep fallback to existing `FullMarkdownRuntime` rich render.
6. Add diagnostics and runtime evidence gate fields.
7. Run live streaming compatibility and rich Markdown regression tests.

## Validation Matrix / 验证矩阵

| Area | Evidence |
|---|---|
| Worker protocol | success/failure/timeout tests |
| Cache | hit/miss/options/schema invalidation tests |
| Stale guard | stale worker result drop test |
| Fallback | unsupported worker fallback test |
| Live compatibility | existing live Markdown streaming tests |
| Rich Markdown | file links, math, code blocks, tool-call fallback tests |
| Realtime perf | `npm run perf:realtime:extended-baseline` |
| Evidence gate | `npm run check:runtime-evidence-gates` |
| Type/lint | `npm run typecheck`, `npm run lint` |
| OpenSpec | `openspec validate markdown-off-main-thread-pipeline --strict --no-interactive` |

## Rollback / 回滚

- Disable worker precompute threshold to force existing main path.
- Keep cache disabled if option hashing proves incomplete.
- Preserve live lightweight behavior regardless of final precompute rollback.

## Risks / 风险

- Worker precompute can reduce parse-adjacent cost but cannot remove all rich render cost from main thread.
- Unsafe HTML handling must remain guarded by existing sanitizer path.
- Serialization overhead can outweigh benefit for medium messages; threshold must remain evidence-tuned.
