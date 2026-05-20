import { describe, expect, it } from "vitest";

import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  isRetainableEngineContinuitySummary,
  mergeDegradedClaudeContinuitySummaries,
  mergeCodexCatalogSessionSummaries,
  seedLastGoodEngineIntoMerged,
  selectRecoveredNewThreadSummary,
  selectReplacementThreadByMessageHistory,
} from "./useThreadActions.helpers";

describe("useThreadActions.helpers", () => {
  it("keeps quoted broken-pipe explanations in history matching", () => {
    const staleItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续",
      },
      {
        id: "assistant-1",
        kind: "message",
        role: "assistant",
        text: "Broken pipe (os error 32)\n\n结论先行：这是 stale session，需要重建 runtime。",
      },
    ];

    const candidateA: ThreadSummary = {
      id: "thread-a",
      name: "hi",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };
    const candidateB: ThreadSummary = {
      id: "thread-b",
      name: "hi",
      updatedAt: 9,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectReplacementThreadByMessageHistory({
      staleItems,
      candidates: [
        {
          summary: candidateA,
          items: staleItems,
        },
        {
          summary: candidateB,
          items: [
            {
              id: "user-2",
              kind: "message",
              role: "user",
              text: "继续",
            },
          ],
        },
      ],
    });

    expect(matched?.id).toBe("thread-a");
  });

  it("selects the sole newly discovered replacement thread when generic summaries are ambiguous", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const knownOlder: ThreadSummary = {
      id: "thread-known",
      name: "1",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const newlyRecovered: ThreadSummary = {
      id: "thread-recovered",
      name: "1",
      updatedAt: 101,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectRecoveredNewThreadSummary({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary, knownOlder],
      summaries: [newlyRecovered, knownOlder, staleSummary],
    });

    expect(matched?.id).toBe("thread-recovered");
  });

  it("selects the sole strictly newer replacement thread when stale summary falls out of the current list", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const knownOlder: ThreadSummary = {
      id: "thread-known",
      name: "1",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const recovered: ThreadSummary = {
      id: "thread-recovered",
      name: "1",
      updatedAt: 105,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectRecoveredNewThreadSummary({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [knownOlder, recovered],
      summaries: [recovered, knownOlder],
    });

    expect(matched?.id).toBe("thread-recovered");
  });

  it("preserves real Claude subagent parent links from catalog sessions", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:parent-session",
          name: "父会话",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:subagent:parent-session:a5e6403f261113239",
          title: "分析前端项目",
          updatedAt: 110,
          engine: "claude",
          parentSessionId: "claude:parent-session",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(
      merged.find((thread) => thread.id === "claude:subagent:parent-session:a5e6403f261113239")
        ?.parentThreadId,
    ).toBe("claude:parent-session");
  });

  it("normalizes bare Claude subagent parent links from catalog sessions", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:parent-session",
          name: "父会话",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:subagent:parent-session:a5e6403f261113239",
          title: "分析前端项目",
          updatedAt: 110,
          engine: "claude",
          parentSessionId: "parent-session",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(
      merged.find((thread) => thread.id === "claude:subagent:parent-session:a5e6403f261113239")
        ?.parentThreadId,
    ).toBe("claude:parent-session");
  });

  it("does not let generic Claude catalog titles overwrite meaningful existing titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:session-1",
          name: "稳定命名",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:session-1",
          title: "",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe("稳定命名");
  });

  it("does not let ordinal Agent catalog titles overwrite meaningful existing titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:session-1",
          name: "帮我审核一下这个 PR",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:session-1",
          title: "Agent 202",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "帮我审核一下这个 PR",
    );
  });

  it("does not resurrect excluded Claude rows during degraded continuity", () => {
    const merged = mergeDegradedClaudeContinuitySummaries(
      [],
      [
        {
          id: "claude:hidden-native",
          name: "Hidden native",
          updatedAt: 120,
          engineSource: "claude",
          threadKind: "native",
        },
        {
          id: "claude:visible-native",
          name: "Visible native",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      new Set(["claude:hidden-native"]),
    );

    expect(merged.map((thread) => thread.id)).toEqual(["claude:visible-native"]);
  });

  it("rejects pending placeholders in engine-aware continuity filters", () => {
    const pendingByEngine = ["claude", "codex", "opencode"] as const;

    for (const engine of pendingByEngine) {
      const summary: ThreadSummary = {
        id: `${engine}-pending-123`,
        name: "Pending",
        updatedAt: 100,
        engineSource: engine,
        threadKind: "native",
      };

      expect(isRetainableEngineContinuitySummary(engine, summary)).toBe(false);
    }
  });

  it("does not seed pending OpenCode placeholders from last-good fallback", () => {
    const mergedById = new Map<string, ThreadSummary>();
    const seeded = seedLastGoodEngineIntoMerged(
      "opencode",
      mergedById,
      [
        {
          id: "opencode-pending-123",
          name: "Pending OpenCode",
          updatedAt: 100,
          engineSource: "opencode",
          threadKind: "native",
        },
        {
          id: "opencode:session-1",
          name: "Real OpenCode",
          updatedAt: 90,
          engineSource: "opencode",
          threadKind: "native",
        },
      ],
    );

    expect(seeded).toBe(1);
    expect([...mergedById.keys()]).toEqual(["opencode:session-1"]);
  });

});
