## Context

The observed `aaa` session exposes two separate failure planes:

1. **Durability gap**: Claude's JSONL source did not contain the long assistant final body after the client was closed. The app had shown live text, but no local durable copy existed outside frontend memory.
2. **Live canonical corruption risk**: active `appendAgentDelta` can pass merged assistant text through generic item normalization on both the Claude reducer fast path and the fallback `prepareThreadItems` path. `normalizeItem` applies `MAX_ITEM_TEXT = 20000`, which is appropriate for bounded previews but unsafe for active assistant canonical text. Once a truncated string becomes the merge base, later deltas can be appended to a damaged body.

The stutter is a third plane: one active assistant row can grow to tens of thousands of CJK chars. List virtualization protects many rows; it does not make a single row cheap to repeatedly concatenate, normalize, parse, layout, and scroll.

Additional observation: the highest gain for short-cycle user experience is now in the live visual surface path. For Claude long-text streaming, visible head/tail folding is used to avoid huge single-node text churn while preserving canonical text separately and keeping the live surface on lightweight Markdown.

## Goals / Non-Goals

**Goals:**

- Preserve Claude Code active streaming assistant canonical text beyond ordinary preview limits.
- Persist enough Claude Code live assistant text locally to recover an interrupted turn when provider history lacks the final body.
- Keep restored text clearly marked as local recovery evidence rather than provider truth.
- Preserve paragraph/newline shape during live rendering and after recovery.
- Bound long-output reducer/render work and add evidence that distinguishes provider delay from local UI amplification.

**Non-Goals:**

- No provider protocol rewrite.
- No new user-facing setting for transcript persistence.
- No claim that Claude must finish 50000 chars.
- No global replacement of the thread/history storage model.
- No full internal virtualization of a single message in the first implementation pass unless the focused Claude Code evidence gate still fails after canonical/recovery fixes.

## Decisions

### Decision 1: Introduce a bounded Claude Code live shadow transcript store

The client will persist Claude Code assistant text for active turns into an app-data shadow transcript keyed by stable conversation dimensions: engine, workspace, session/thread, turn, item id when available, and source session id when known. The storage API may stay engine-neutral, but the P0 contract is Claude Code first.

The store is local-only and must distinguish ingress shape:

- true assistant text deltas are appended;
- cumulative `agentMessage` snapshots are upserted/merged as snapshots so a later full snapshot replaces or extends the previous body instead of duplicating it.

On normal turn completion, the store marks the shadow as settled and can remove it after the provider final body is observed. On interruption or crash, the shadow remains available for a bounded retention window.

Retention pruning is recovery-aware: recent interrupted/unsettled entries have higher retention priority than provider-final or settled entries, then entries are ordered by recency inside that priority class.

**Alternatives considered:**

- **Rely only on Claude JSONL**: rejected because the observed source lacked the long assistant body after close.
- **Persist every normalized thread item snapshot**: rejected because it creates large redundant writes and couples recovery to frontend presentation shape.

### Decision 2: Split canonical text from preview truncation on every active append path

Active assistant canonical text must not use generic display truncation. `MAX_ITEM_TEXT` remains valid for bounded previews, summaries, and explicitly degraded display surfaces, but not for the active message body being merged with future deltas.

Implementation should add either a normalization mode or a separate helper so active live assistant items can preserve full text while still normalizing ids, role, metadata, and structural fields. This must cover both the reducer fast path and the `prepareThreadItems` fallback path.

**Alternatives considered:**

- **Raise `MAX_ITEM_TEXT`**: rejected because it only moves the cliff and keeps the wrong ownership boundary.
- **Remove truncation globally**: rejected because lists, previews, and defensive history surfaces still need bounded payloads.

### Decision 3: Recover only when provider final body is absent

History restore should prefer provider JSONL when it contains a valid final assistant body. Shadow recovery applies only when a matching recent shadow exists and provider history has no equivalent assistant text body for that turn.

Recovered rows must include metadata such as `recoveredFromLiveShadow`, `recoveryStatus: interrupted | recovered`, and shadow identity. The UI may expose this through diagnostics or internal metadata; it must not silently masquerade as a normal provider-completed answer.

**Alternatives considered:**

- **Always merge shadow and provider final**: rejected because it risks duplicate text and source disagreement.
- **Never show interrupted local text**: rejected because it loses user-visible content after a crash, matching the reported failure.

### Decision 4: Treat paragraph-preserving live rendering as a secondary guard

The first pass should make live rendering preserve paragraphs and avoid repeated full Markdown work for huge active rows, but this is a secondary guard rather than the proven root cause for the observed Claude session. A paragraph-preserving chunked/plain fallback is acceptable while processing, provided completion converges to final Markdown semantics and never writes shortened display text back into canonical state.

If evidence still shows long tasks or visible stalls after the first pass, a later change can introduce true message-internal virtualization.

Implementation evidence records long live row behavior through the existing stream latency diagnostics surface. The correlated payload includes text ingress, reducer/normalization dispatch envelope, live row render cost, visible text growth, and recovery source so local amplification can be separated from upstream provider delay.

**Alternatives considered:**

- **Full internal message virtualization now**: stronger but broader, with higher risk around selection, copy, Markdown blocks, anchors, and accessibility.
- **Throttle harder only**: reduces render frequency but makes visible output more bursty and does not fix format corruption.

### Decision 5: Collapse long Claude live output on lightweight Markdown (head/tail folding)

For large Claude streaming messages, cap visible growth by folding long text before it reaches the live Markdown surface.

- `STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD = 20000`
- `STREAMING_PLAIN_TEXT_HEAD_CHARS = 4000`
- `STREAMING_PLAIN_TEXT_TAIL_CHARS = 2000`

When the text exceeds threshold, the value passed to the live lightweight Markdown renderer uses:

- 前面若干字符（head）
- 折叠占位文案（含被省略字符数）
- 后面若干字符（tail）

Rules:

- canonical `displayText` remains full-length and drives subsequent delta merge and recovery logic;
- the collapsed string is only for view; it must not replace or mutate canonical source;
- active streaming SHOULD render the folded value through lightweight Markdown, not a plain-text `<div>`, so headings, lists, code fences, links, and emphasis keep basic shape while streaming;
- explicit plain-text mitigation surfaces MUST still apply the same head/tail fold when the Claude live text exceeds threshold, while visible diagnostics continue to report the full canonical text;
- on completion (`isFinal`), rendering must recover to full Markdown and drop this visible fold.
- folding is independent from shadow transcript and can be toggled without affecting recovery semantics.

### Decision 6: Require turn-safe shadow recovery matching

When provider history exposes a current turn id, shadow recovery must not fall back to a different concrete turn id. Exact turn matches are preferred. If no exact match exists, only legacy shadow entries without turn id may be considered as a fallback.

This prevents an old interrupted long answer from being restored into a later Claude turn after reopen or direct refresh.

## Risks / Trade-offs

- **Shadow transcript grows too large** -> enforce per-turn and global retention budgets, settled cleanup, and startup-safe parsing that can skip oversized/corrupt shadows.
- **Recovered text duplicates provider final body** -> recovery must run after provider parse and require an absence/confidence check before insertion.
- **Shadow key mismatch across Claude history/session ids** -> key by multiple dimensions and allow a confidence-scored match using recent user prompt, timestamp window, engine, workspace, and session id.
- **Shadow turn mismatch restores old text into a new turn** -> when an expected turn id exists, reject shadows with a different concrete turn id; only no-turn legacy shadows may fall back.
- **Canonical/display split bypasses needed sanitation** -> keep structural normalization, but move text truncation to explicit display helpers.
- **Plain/chunked live fallback differs from final Markdown** -> require final convergence tests for headings, paragraphs, lists, code fences, and emphasis after turn completion.
- **Folded live Markdown hides context** -> we explicitly keep canonical text untouched and return to full rendering on `isFinal`; acceptance checks focus on completion parity rather than live middle-section readability.

## Migration Plan

1. Add tests that fail against the current behavior: active >20k assistant text, provider-history-missing-final recovery, and paragraph-preserving live render.
2. Add the shadow transcript module behind existing app storage conventions.
3. Wire live assistant delta handling to batch writes without blocking reducer/render hot paths.
4. Split active assistant canonical normalization from preview truncation.
5. Wire Claude history restore to consult shadow transcript only when provider final body is absent.
6. Add diagnostics/evidence for shadow recovery source and long live row render pressure.
7. Rollback by disabling shadow recovery and active long-row fallback independently; canonical truncation fix should remain because it removes data corruption.

## Open Questions

- Which app-data namespace should own shadow files: session-management cache, thread runtime cache, or a new conversation recovery bucket?
- What retention budget is appropriate for interrupted long outputs: time-based only, size-based only, or both?
- Should recovered interrupted text show a subtle user-visible badge, or remain diagnostics-only unless the user opens details?
