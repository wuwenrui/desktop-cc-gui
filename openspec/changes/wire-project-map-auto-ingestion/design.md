## Context

The existing footer UI writes `dataset.autoIngestionSettings`. The hook then immediately calls `projectMemoryList` whenever the dataset changes and the setting is enabled. If enough unprocessed messages exist, it builds candidates synchronously and writes a synthetic `kind="auto" status="completed"` run.

That path does not satisfy the Project Map contract. It does not use `checkIntervalMinutes`, does not use the existing generation queue, and does not run the AI worker. It also makes the footer look more capable than the backend behavior.

## Decision 1: Auto Ingestion is a queued Project Map run

Auto Ingestion MUST enqueue a `ProjectMapGenerationRequest` with:

- `kind: "auto"`
- `scope: { kind: "auto", messageHashes }`
- `generationIntent: "autoIngestion"`
- `readSources` derived from the Project Memory entries and existing map context
- `autoIngestion` metadata containing the consumed Project Memory message keys

The existing worker claim / active-slot lifecycle remains the single executor. This preserves queue visibility, cancellation, failure state, and run logs.

## Decision 2: Project Memory evidence is prompt evidence, not direct mutation

The worker prompt will include a bounded Project Memory evidence section for auto runs. These snippets are not workspace files and must be labeled as memory evidence.

The prompt rules for default `createCandidate` mode instruct the model to mark generated nodes as `candidate=true`, `confidence=low|unknown` unless code/file evidence supports stronger claims. Direct deletion remains forbidden.

## Decision 3: Scheduling is interval-gated and idempotent

The scheduler evaluates:

- Auto Ingestion enabled
- persisted Project Map dataset is available
- no existing pending/running auto run
- `now - memoryCursor.lastCheckedAt >= checkIntervalMinutes`
- unprocessed Project Memory count >= `newSessionThreshold`

If the threshold is not met, it updates only `lastCheckedAt`. If threshold is met, it persists the queued run and `pendingMessages`. Processed markers are written only when the queued run completes successfully.

## Decision 4: `autoApplyEvidenceBacked` is not a fake switch

Until a deterministic direct-apply path is implemented, auto ingestion will still route through the candidate-safe merge path. The UI copy can label the option as advanced, but the implementation must not make selecting it disable all ingestion.

The practical behavior for this change is:

- `createCandidate`: generated updates remain candidates.
- `autoApplyEvidenceBacked`: still queues a real auto run, but only evidence-backed generated facts may avoid candidate status. Unsupported/weak memory-only claims remain candidates.

## Decision 5: Auto Ingestion must preserve root reachability

Auto Ingestion is allowed to add or update nodes, but it must not create a second root or an unreachable subgraph. Generated `parentId` values may point at existing dataset nodes even when the parent is not repeated in the AI payload.

The merge and read-normalization layers enforce the graph invariant:

- parent/children links are normalized as a bidirectional topology
- new auto-ingestion top-level nodes are attached to the existing root node
- persisted orphan roots are repaired on read so legacy bad snapshots remain navigable

Prompt instructions still ask the model to set `parentId` to the existing root for top-level concepts, but runtime topology repair is the authority.

## Decision 6: Enablement must configure engine and model first

Auto Ingestion `enabled=true` means the scheduler is allowed to enqueue background generation. It must therefore represent a fully configured execution contract, not a partially enabled toggle that later relies on defaults.

When the user turns Auto Ingestion on, the UI opens an engine/model configuration step using the same engine/model discovery source as manual Project Map generation. The setting is persisted only after confirmation, and the persisted update writes `enabled`, `engine`, and `model` together. Cancelling the flow leaves `enabled=false`.

This keeps background runs from silently using stale or placeholder values such as `codex/default`, especially in accounts where Codex rejects the `default` model.

## Decision 7: Invalid structured output gets one bounded repair turn

The Project Map worker still treats strict JSON as the only accepted write format. However, model responses can occasionally contain natural-language summaries or malformed JSON despite the prompt contract.

When the first response fails structured JSON validation, the worker performs one recovery turn through the same selected engine/model. The repair prompt includes:

- the validation error
- the previous invalid output, truncated to a bounded size
- the original generation prompt and schema example
- an explicit JSON-only instruction with no markdown or explanation

If the repair response validates, the run continues through the normal merge path. If it also fails, the run remains failed and reports the validation error. The repair path does not bypass schema validation, candidate safety, root normalization, or processed-marker rules.

## Decision 8: Configuration dialogs use adaptive desktop width

The Auto Ingestion enable dialog and Confirm Generation dialog should stay compact for ordinary engine/model confirmation, but they must not treat that compact width as a fixed desktop width. The current compact width is the minimum desktop width. When content includes long write paths or many source chips, the dialog may expand to a viewport-safe maximum.

Layout rules:

- desktop width uses content-adaptive sizing with the existing compact width as `min-width`
- maximum width remains bounded by the viewport so the modal never escapes the visible canvas
- fields keep a dense two-column rhythm when there is enough room
- long paths and source chips wrap or truncate inside the dialog instead of clipping the left labels
- narrow screens fall back to a single-column layout

## Decision 9: Canvas controls have an independent persisted collapsed state

The Project Map canvas controls are useful, but the full zoom/layout toolbar competes with the graph. The toolbar should therefore default to a compact collapsed entry. The expanded/collapsed state is a local UI preference, not Project Map knowledge, so it must not be written into the Project Map dataset or persisted snapshot.

The state boundary is deliberately narrow:

- default is collapsed when no user preference exists
- only the canvas controls toggle writes the preference
- zoom, reset view, auto layout, reset layout, layout preset changes, drilldown, and overview navigation do not mutate the preference
- the preference is feature-scoped local UI state and is restored on remount/reload

This keeps the toolbar predictable without letting unrelated map actions fight the user's chosen chrome density.

## Risks

- [Risk] Auto runs could repeatedly enqueue under StrictMode. Mitigation: detect existing pending/running auto runs and persist `lastCheckedAt` before leaving the scan cycle.
- [Risk] Memory evidence could over-promote weak conversation claims. Mitigation: prompt rules and merge confidence guards keep memory-only facts conservative.
- [Risk] Failed runs could hide future ingestion. Mitigation: processed markers are written only after successful completion.
- [Risk] Auto-generated nodes can become unreachable if the model omits the existing parent node from the payload. Mitigation: allow generated parent ids to reference existing nodes and repair orphan roots to the project root during merge/read normalization.
- [Risk] Enabling Auto Ingestion can start a background run with an unsupported placeholder model. Mitigation: require engine/model confirmation before `enabled=true` is persisted.
- [Risk] A model may answer with prose instead of JSON and fail otherwise valid collection work. Mitigation: perform one bounded JSON-only repair retry, then keep strict failure semantics if repair still does not validate.
- [Risk] A fixed compact dialog width can clip labels or make source chips create awkward horizontal overflow. Mitigation: use compact width as the minimum, allow content-driven expansion, and keep viewport/mobile bounds explicit.
- [Risk] Persisting the canvas toolbar state into the dataset would leak personal UI chrome into shared Project Map artifacts. Mitigation: store only a feature-scoped local UI preference and never include it in Project Map snapshot data.

## Rollback

Revert this change to restore the previous settings-only substrate. Existing persisted `settings.json`, `memory-ingestion/cursor.json`, and `processed.json` remain compatible.
