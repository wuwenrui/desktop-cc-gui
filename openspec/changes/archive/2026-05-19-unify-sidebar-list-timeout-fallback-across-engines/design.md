# Design: Unify Sidebar List Timeout Fallback Across Engines

## Context

### 既有时序对比（四引擎）

```text
listThreadsForWorkspace(ws, { startupHydrationMode: "full-catalog" })
  │
  ├─ Promise.allSettled([
  │     claudePromise,                                ← withTimeout 30s
  │     opencodePromise,                              ← withTimeout 30s
  │     projectCatalogPromise,                        ← withTimeout 30s（catalog 路径）
  │  ])
  │
  ├─ Claude   (useThreadActions.ts:1852-1931)
  │    ├─ fulfilled + null      → seedLastGoodClaudeIntoMerged ✅
  │    ├─ fulfilled + array     → forEach 投递 mergedById
  │    └─ rejected              → seedLastGoodClaudeIntoMerged ✅
  │
  ├─ OpenCode (useThreadActions.ts:1932-1983)
  │    ├─ fulfilled + null      → ❌ 缺 seed                        ← 修复点 ①
  │    ├─ fulfilled + array     → forEach 投递 mergedById
  │    └─ rejected              → ❌ 整个 else 分支缺失              ← 修复点 ②
  │
  ├─ Codex catalog (useThreadActions.ts:1984-2015)
  │    └─ projectCatalogValue?.sessions ?? []
  │         → mergeCodexCatalogSessionSummaries(base, [], ...)
  │              → if (codexSessions.length === 0) return baseSummaries ✅ 早退
  │
  └─ Gemini   (useThreadActions.ts:2201-2295)
       └─ void (async () => { ... })()        ← fire-and-forget，独立链路
            ├─ withTimeout(50, GEMINI_SESSION_FETCH_TIMEOUT_MS)
            └─ result === null → return ✅    ← 不触碰主链路 mergedById
```

### 关键差异：为什么只有 Claude / OpenCode 同病

- **Claude / OpenCode** 走 `Promise.allSettled` + 同一 `mergedById` 共用合并器，子源 `null` 会被等同空数组**强行参与下游合并**——这是病根。
- **Codex** 走 catalog merge，`mergeCodexCatalogSessionSummaries` 在入口 `if (codexSessions.length === 0) return baseSummaries` 早退，**契约级别的保护**。
- **Gemini** 走 `void (async () => {...})()` 独立异步任务，timeout 时直接 `return` 不触碰 `mergedById`，**通过并发模型本身保护**。

### `harden-claude-sidebar-list-timeout-fallback` 已交付的能力

- `seedLastGoodClaudeIntoMerged(mergedById, lastGood, excluded)`：把 last-good Claude 条目 seed 进 mergedById，前置于 partial-source merge 与 catalog merge。
- `isRetainableClaudeContinuitySummary(summary)`：判断 last-good 条目是否仍适用（非 archived / 非 shared / 非 pending）。
- `hasHealthyThreadSummaries` 收紧 healthy 判定（剔除 `partialSource` / `degradedReason`）。
- `getLastGoodThreadSummaries` 多级 fallback：current → previous → state → snapshot。
- `latestThreadsByWorkspaceRef.current` 只在 healthy 时才覆盖（自污染防御）。

> 上述 4 项是本次复用的**横向能力**，OpenCode 直接受益，**不需要重新实现**。

## Decision

### D-1：参数化引擎而非 strategy 类

**采用**：函数签名加 `engine` 参数，内部分发到引擎特定判定。

```ts
// helpers.ts
export function seedLastGoodEngineIntoMerged(
  engine: "claude" | "opencode",     // 仅声明已纳入主链路 seed 的引擎
  mergedById: Map<string, ThreadSummary>,
  lastGoodSummaries: ThreadSummary[],
  excludedThreadIds: ReadonlySet<string> = new Set(),
): number;

export function isRetainableEngineContinuitySummary(
  engine: "claude" | "codex" | "opencode",   // Gemini 走独立路径，不在此枚举
  summary: ThreadSummary,
): boolean;
```

**为什么不上 strategy 类**：
- 当前只有 2 个 seed 引擎、3 个 retainable 引擎，配置项 < 5 个，strategy 类是过度设计；
- 既有 `isRetainable*ContinuitySummary` 已经是函数式，统一为参数化函数比引入 OOP 更平滑；
- 测试更容易：每个 engine 都可以独立 `expect(isRetainableEngineContinuitySummary("opencode", summary)).toBe(...)`。

### D-2：旧函数名保留为薄包装

```ts
export function seedLastGoodClaudeIntoMerged(
  mergedById: Map<string, ThreadSummary>,
  lastGood: ThreadSummary[],
  excluded: ReadonlySet<string> = new Set(),
): number {
  return seedLastGoodEngineIntoMerged("claude", mergedById, lastGood, excluded);
}
```

- 既有 `useThreadActions.timeout-fallback.test.tsx` 4 case 直接 import `seedLastGoodClaudeIntoMerged`，薄包装让既有测试**零退化**；
- 未来如果想去掉 wrapper，单独提一个 cleanup change，不混本次 PR。

### D-3：Gemini / Codex 不纳入主链路 seed

| 引擎 | 失败模式 | 主链路是否被污染 | 是否纳入 seed | 理由 |
|---|---|---|---|---|
| Claude | `withTimeout → null → forEach([])` | ✅ 会，已修 | ✅ | 病根在这条路径 |
| OpenCode | 同 Claude | ✅ 会，未修 | ✅ | 病根对称 |
| Codex | catalog merge 空源早退 | ❌ 不会 | ❌ | 契约级别已保护 |
| Gemini | 异步独立 task，timeout 时直接 `return` | ❌ 不会 | ❌ | 并发模型本身保护 |

**风险**：未来如果有人重构 Gemini 改成走主链路，就会失去这层保护。
**缓解**：spec delta 里成文写出"Gemini / Codex 当前不纳入主链路 seed"的契约，并在 `seedLastGoodEngineIntoMerged` 的 engine 类型联合中**仅列 claude / opencode**，从类型层面挡住误用。任何后续把 Gemini/Codex 改成走 mergedById 的重构，都会触发 TypeScript 编译错误，强制重新评估契约。

### D-4：补全 OpenCode 缺失的 reject else

既有 OpenCode 分支只有 `if (opencodeResult.status === "fulfilled")`，**没有 else**——意味着 rejected 时 OpenCode 子源被**静默吞掉**，连 `opencode-session-error` 这种 partial-source 诊断都没有。

**修复**：补 `else` 分支，结构对称 Claude：

```ts
} else {
  rememberPartialSource("opencode-session-error");
  onDebug?.({
    id: `${Date.now()}-client-opencode-session-error`,
    timestamp: Date.now(),
    source: "client",
    label: "thread/list opencode error",
    payload: {
      workspaceId: workspace.id,
      error: String(opencodeResult.reason ?? "unknown error"),
    },
  });
  seedLastGoodEngineIntoMerged(
    "opencode",
    mergedById,
    lastGoodThreadSummaries,
    hiddenSharedBindingIds,
  );
}
```

### D-5：seed 顺序与 catalog merge 的交互

`seedLastGoodEngineIntoMerged` 在 `mergeCodexCatalogSessionSummaries` 之前调用——但 catalog merge 内部对 OpenCode 条目的处理路径需要核对：

- `mergeCodexCatalogSessionSummaries(baseSummaries, codexSessions, ...)` 的 baseSummaries 是 `Array.from(mergedById.values())`；
- 如果 seed 已经把 OpenCode 条目放进 mergedById，baseSummaries 会带上它们；
- 函数实现（`useThreadActions.helpers.ts:771-827`）只对 `codexSessions` 做投递，并以 `mergedById = new Map(); baseSummaries.forEach(set)` 起步——baseSummaries 中的 OpenCode 条目**会被原样保留**，不会被洗掉。

**验证手段**：Tests 中 Case "OpenCode timeout + Codex catalog 非空" 会专门覆盖这个场景。

## Alternatives Considered

### Alternative A：每引擎独立 seed 函数（不参数化）

- ✅ 简单直观，命名清晰
- ❌ 复制粘贴 ≈ 80 行代码，违反 DRY
- ❌ 未来新增引擎要复制第 N 次
- **拒绝理由**：本次目标就是归一化，独立函数与初衷相悖

### Alternative B：strategy 类 + DI

```ts
abstract class EngineSidebarFallback {
  abstract seed(mergedById, lastGood, excluded): number;
  abstract isRetainable(summary): boolean;
}
class ClaudeFallback extends EngineSidebarFallback { ... }
class OpenCodeFallback extends EngineSidebarFallback { ... }
```

- ✅ 类型严谨、可扩展
- ❌ 当前 2 个 seed 引擎，类层级过重
- ❌ 与既有函数式 helpers 风格不一致，迁移面太大
- **拒绝理由**：YAGNI，函数参数化已经够用

### Alternative C：每引擎独立 lastGood 快照（`evolve-thread-list-per-engine-snapshot`）

- ✅ 真正消除 cross-engine 污染
- ❌ 工作量 1-2 天，涉及 store / reducer / ref 大量重构
- ❌ 与本次"补齐 OpenCode"的紧迫目标不匹配
- **拒绝理由**：已在 proposal Non-Goals 中明确为未来变更

## Risks & Mitigations

| 风险 | 等级 | 缓解 |
|---|---|---|
| 薄包装 wrapper 让既有测试 import 路径"假绿" | 低 | wrapper 内部直接转调，只要 wrapper 测一遍即可；既有 4 case 真实跑过通用函数 |
| OpenCode `else` 分支补全后某些既有日志重复 | 低 | 既有 OpenCode 路径无 else，不会产生重复，只会从"静默"变"有诊断" |
| seed 在 catalog merge 之前可能被后续 archive merge 洗掉 | 中 | Tests Case "连续 timeout 不递减" 专门覆盖整条管道；archive merge 不删 mergedById 里既有非 archived 条目 |
| Gemini 未来重构走主链路被忽略 | 中 | `seedLastGoodEngineIntoMerged` 的 engine 联合类型仅含 `"claude" \| "opencode"`，强制类型 gate |
| 既有 Claude 4 case 因签名调整退化 | 高 | 薄包装保留旧函数名 + 旧签名；CI Gate：跑 timeout-fallback.test.tsx 必须全绿 |

## Open Questions

- 是否需要把 `seedLastGoodEngineIntoMerged` 的 engine 联合扩展为可配置的 `"claude" | "opencode" | "gemini-future"`？  
  **当前决定**：不扩展。Gemini 走主链路是未来变更，到时再扩展类型，避免现在留死代码。

- `isRetainableEngineContinuitySummary` 是否需要把 Gemini / Codex 也纳入？  
  **当前决定**：Codex 已有 `isRetainableCodexContinuitySummary`，会改写为通用版本的薄包装；Gemini 暂无对应函数，**也不在本次新增**——Gemini 异步任务自己用 `latestThreadsByWorkspaceRef.current` 做 baseline，不调用 retainable 判定。
