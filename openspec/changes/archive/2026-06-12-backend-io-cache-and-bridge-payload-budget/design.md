# Design / 设计

## Context / 背景

Backend IO pressure currently appears in several independent modules: session catalog/history, local usage, workspace file listing, git commands, and project map relations. Some paths already have limits, timeouts, or partial states, but there is no common evidence contract for scan cost, cache behavior, or Tauri bridge payload size.

This design deliberately avoids a big-bang rewrite. It introduces inventory, diagnostics, cache adapters, and bridge payload budgets in layers.

## Architecture / 架构

```text
Backend command / scan path
  -> ScanEvidenceEmitter
  -> optional ScanCacheAdapter
  -> blocking/timeout policy
  -> partial or complete domain result
  -> BridgePayloadBudget wrapper/metadata
  -> rendererDiagnostics / runtime evidence gate
```

## Decisions / 关键决策

### Decision 1: Diagnostics before cache

Every audited path should first report content-safe scan/payload evidence. Paths without safe cache support report `cacheState=unsupported` or `disabled`.

Reason: cache correctness is path-specific. A common evidence contract is safer than forcing all modules into one generic cache immediately.

### Decision 2: Cache is adapter-based

Each cached path defines a `ScanCacheAdapter` shape:

| Field | Purpose |
|---|---|
| `owner` | session/history/workspace/git/project-map path |
| `key` | normalized root/workspace/provider/options/schema hash |
| `sourceSignature` | mtime/size/inode/content/hash summary as appropriate |
| `valueSchemaVersion` | invalidates stale serialized summaries |
| `invalidationReason` | reviewable miss reason |
| `evidence` | hit/miss/duration/counts |

A single generic `ScanCache<K,V>` may be introduced later, but the design does not require one up front.

### Decision 3: JSONL append fast path is conditional

Append-only offset reuse is allowed only when file identity and prefix signature remain compatible. Truncate, rotation, inconsistent mtime/size, schema version change, or parse corruption must force full rescan or degraded partial result.

This protects providers that rewrite JSONL files instead of strictly appending.

### Decision 4: Blocking policy is explicit

Filesystem walks, JSONL parsing, libgit2 work, and project-map parsing should run through a documented blocking/timeout policy. The policy records duration and partial/failure state; it does not hide slow work behind an async command boundary.

### Decision 5: Bridge payload budget is additive

High-volume Tauri commands keep legacy-compatible DTOs where necessary, but add payload budget metadata or an adjacent diagnostics entry. Over-budget responses can still succeed for compatibility, but the regression becomes visible.

### Decision 6: Sensitive data is excluded at the source

Backend evidence should only emit ids/hashes/counts/timings/booleans. Do not rely on frontend redaction to remove absolute paths, secrets, prompt text, assistant body, terminal output, or diff body.

## Contracts / 合同

### Scan Evidence

```text
owner
surfaceId
workspaceHash/rootHash
providerId/providerKind
scanOptionsHash
durationMs
cacheState: hit | miss | disabled | unsupported
invalidationReason?
scannedFiles?
scannedBytes?
partial: boolean
evidenceClass
```

### Bridge Payload Evidence

```text
command
surfaceId
itemCount
estimatedBytes
partial
truncated
cacheState?
evidenceClass
nextAction?
```

### Selected Migration Candidates

| Area | First useful layer | Notes |
|---|---|---|
| session/history JSONL | diagnostics + append guard + adapter | highest duplicate scan risk |
| workspace files | payload evidence + existing partial state | overlaps workspace tree change |
| git diff/log | truncation/pagination metadata | preserve legacy hooks |
| project map relations | duration/partial budget | avoid hiding long scans |

## Rollout Plan / 实施顺序

1. Inventory high-volume commands and scan paths.
2. Add evidence emitters and content-safety tests.
3. Implement one scan cache adapter for the highest-confidence path.
4. Add JSONL append/truncate/corrupt tests.
5. Add payload budget metadata for selected high-volume commands.
6. Add git/project-map pagination or truncation metadata where evidence shows pressure.
7. Extend runtime evidence gate.

## Validation Matrix / 验证矩阵

| Area | Evidence |
|---|---|
| Cache adapter | Rust hit/miss/invalidation tests |
| JSONL safety | append/truncate/corrupt tests |
| Blocking policy | timeout/partial fallback tests |
| Git payload | pagination/truncation tests for migrated command |
| Bridge content safety | DTO/evidence redaction tests |
| Evidence gate | `npm run check:runtime-evidence-gates` |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Type/lint | `npm run typecheck`, `npm run lint` |
| OpenSpec | `openspec validate backend-io-cache-and-bridge-payload-budget --strict --no-interactive` |

## Rollback / 回滚

- Evidence emitters can stay if bounded/content-safe.
- Cache adapter can be disabled per owner via feature/config path while retaining diagnostics.
- Pagination/truncation migrations must keep legacy fallback until UI is fully partial-aware.

## Risks / 风险

- Cache key mistakes are worse than slow scans; adapter-specific invalidation tests are mandatory.
- Payload byte estimate may be approximate; it is still useful for regression direction, but evidence class must be honest.
- Blocking pool changes can shift latency; record queue/timeout where available.
