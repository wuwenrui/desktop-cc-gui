## Context

Current measured evidence:

- `turnStartAckLatencyP95=114ms`
- `firstDeltaLatencyP95=3616ms`
- `postAckFirstDeltaWaitApprox=3502ms`
- visible lag and reducer amplification remain healthy

This narrows the next unknown to the backend ack-after path: after frontend receives `send_user_message` ack, before renderer sees the first assistant delta.

Existing frontend code already parses `params.ccguiTiming` in `noteThreadAppServerEventReceived`, but the Codex backend path does not currently attach phase timing metadata to app-server events.

## Goals / Non-Goals

**Goals:**

- Record Codex backend phase timing without storing content.
- Reuse `ccguiTiming` app-server event metadata so single-event and batched-event paths share the same diagnostics.
- Report `codexPostAckFirstDeltaP95` and phase fields from renderer diagnostics.

**Non-Goals:**

- No provider optimization.
- No Codex protocol changes.
- No prompt/assistant/tool/terminal/file content in diagnostics.
- No changes to provider-scoped runtime selection.

## Decisions

### Decision: store per-turn backend timing in `WorkspaceSession`

Use a bounded map keyed by `threadId` for foreground `turn/start` timing:

- `turnStartRequestStartedAtMs`
- `turnStartResponseReceivedAtMs`
- first stdout event timestamps
- first text delta timestamp
- first runtime/reasoning/agent-message/tool event timestamps
- first assistant item event timestamp
- bounded pre-first-text event counters and method names

Alternative considered: parse timing only at frontend. Rejected because the frontend cannot know when backend received the `turn/start` response or the first stdout line.

### Decision: attach `ccguiTiming` to app-server event params

When backend emits an event with a `threadId`, enrich `params.ccguiTiming` with content-safe fields. This reuses the existing frontend path.

Alternative considered: emit a parallel diagnostic app-server event. Rejected because it would add a new event type and require separate routing/reporting.

### Decision: only first relevant events carry first-delta phase meaning

The backend can attach timing to any event, but report aggregation will use `stream-latency/app-server-event` diagnostics and focus on entries that have `turnStartResponseToFirstTextDeltaMs`.

Alternative considered: add metrics to `realtime.turnTrace.summary`. Rejected for this step because the summary is renderer-owned and already stable; report can correlate through diagnostics without expanding the turn summary schema first.

### Decision: define assistant first text as non-empty `item/agentMessage/delta`

Reasoning deltas are useful evidence that the runtime is alive, but they are not visible assistant answer text. `firstTextDeltaReceivedAtMs` therefore advances only on non-empty `item/agentMessage/delta`. Reasoning/tool/lifecycle events before that point are counted separately through `eventCountBeforeFirstTextDelta`, `reasoningEventCountBeforeFirstTextDelta`, `toolEventCountBeforeFirstTextDelta`, and `methodsBeforeFirstTextDelta`.

Alternative considered: keep using the shared stream-delta extractor for both reasoning and assistant text. Rejected because it can collapse reasoning latency into assistant first-text latency and hide the real phase boundary.

### Decision: split assistant item start from assistant text delta

The first assistant item lifecycle event (`item/started`, `item/updated`, or `item/completed` with item type `agentMessage` / `assistantMessage`) marks when Codex begins materializing an assistant response item. Reports split `firstRuntimeEventToFirstAssistantItemEventMs` from `firstAssistantItemEventToFirstTextDeltaMs` so provider/model first-response delay is not confused with text streaming delay after the assistant item exists.

Alternative considered: infer assistant item start from `itemId` suffixes such as `_msg`. Rejected because item ids are implementation details; item type is the stable event contract.

### Decision: protect realtime evidence from renderer diagnostic eviction

Renderer diagnostics keep independent bounded buckets for ordinary lifecycle diagnostics, `perf.*` entries, `realtime.turnTrace.summary`, and `stream-latency/*` entries. This prevents long streaming sessions from evicting turn summaries before `perf-realtime-runtime-report` can correlate first-delta, visible-lag, and Codex phase evidence.

Alternative considered: increase the existing generic renderer diagnostics cap. Rejected because high-volume lifecycle or stream events could still evict summaries, and the retention contract would remain accidental rather than evidence-driven.

### Decision: report provider/model first-response dominance explicitly

When `firstRuntimeEventToFirstAssistantItemEventMs` accounts for most of `firstRuntimeEventToFirstTextDeltaMs`, is at least 2 seconds, and `firstAssistantItemEventToFirstTextDeltaMs` remains small, the runtime report emits a `providerFirstResponseDominates=...` note. The note remains content-safe and includes only ids, model, durations, method names, and bounded pre-first-text counters.

Alternative considered: leave this as a manual interpretation of phase metrics. Rejected because the same evidence pattern has repeated in manual runs and should guide the next action without relying on ad hoc analysis.

## Risks / Trade-offs

- [Risk] Multiple concurrent foreground turns on the same thread could overwrite timing state. → Mitigation: current Codex foreground send path is one turn per thread; state is bounded and terminal events clear the entry.
- [Risk] Some event shapes may lack `threadId`. → Mitigation: only enrich events with resolved `threadId`; unsupported report fields remain explicit.
- [Risk] Extra metadata increases event payload size slightly. → Mitigation: metadata is numeric and bounded; no content fields.
- [Risk] Dedicated realtime retention buckets increase the maximum persisted diagnostic count. → Mitigation: each bucket is bounded and stores only content-safe ids, methods, counters, and timings.

## Migration Plan

1. Add backend timing state and event enrichment.
2. Extend frontend parser to pass new fields into renderer diagnostics.
3. Extend runtime report with post-ack first-delta metrics.
4. Validate with focused Rust/TS/Node tests.

Rollback: remove the metadata enrichment and report fields; event semantics and Codex protocol remain unchanged.

## Open Questions

- If `codexPostAckFirstDeltaP95` remains high after this change, the next phase should split provider request start vs provider first event inside Codex runtime if the protocol exposes that information.
