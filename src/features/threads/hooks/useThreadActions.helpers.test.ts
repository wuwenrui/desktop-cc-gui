import { describe, expect, it } from "vitest";

import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  isRetainableEngineContinuitySummary,
  mergeCodexCatalogSessionSummaries,
  mergeDegradedClaudeContinuitySummaries,
  mergeDegradedCodexContinuitySummaries,
  mergeGeminiSessionSummaries,
  seedLastGoodEngineIntoMerged,
  selectRecoveredNewThreadDecision,
  selectRecoveredNewThreadSummary,
  selectReplacementThreadDecision,
  selectReplacementThreadByMessageHistory,
  selectReplacementThreadByMessageHistoryDecision,
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

  it("marks time-coherent newly discovered replacement as persistent", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
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

    const decision = selectRecoveredNewThreadDecision({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary],
      summaries: [staleSummary, recovered],
    });

    expect(decision.summary?.id).toBe("thread-recovered");
    expect(decision.isPersistent).toBe(true);
    expect(decision.featureSignals).toContain("time_window_coherent");
  });

  it("keeps strictly newer replacements outside the recovery window non-persistent", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const previousCandidate: ThreadSummary = {
      id: "thread-previous",
      name: "Previous",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const recovered: ThreadSummary = {
      id: "thread-recovered",
      name: "Recovered much later",
      updatedAt: 100 + 25 * 60 * 60 * 1000,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectRecoveredNewThreadDecision({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary, previousCandidate, recovered],
      summaries: [staleSummary, previousCandidate, recovered],
    });

    expect(decision.summary?.id).toBe("thread-recovered");
    expect(decision.reasonCode).toBe("low-confidence");
    expect(decision.featureSignals).toEqual(["strictly_newer_candidate"]);
    expect(decision.isPersistent).toBe(false);
  });

  it("keeps sole weak replacement candidates non-persistent", () => {
    const candidate: ThreadSummary = {
      id: "thread-only",
      name: "Unrelated",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectReplacementThreadDecision({
      staleThreadId: "thread-stale",
      summaries: [candidate],
    });

    expect(decision.summary?.id).toBe("thread-only");
    expect(decision.reasonCode).toBe("low-confidence");
    expect(decision.isPersistent).toBe(false);
  });

  it("marks unique history-boundary matches as persistent", () => {
    const staleItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续写第二章",
      },
    ];
    const candidate: ThreadSummary = {
      id: "thread-history",
      name: "第二章",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectReplacementThreadByMessageHistoryDecision({
      staleThreadId: "thread-stale",
      staleItems,
      candidates: [{ summary: candidate, items: staleItems }],
    });

    expect(decision.summary?.id).toBe("thread-history");
    expect(decision.strategy).toBe("history-match");
    expect(decision.isPersistent).toBe(true);
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

  it("lets custom titles override mapped titles in catalog and Gemini merges", () => {
    const catalogMerged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "claude:session-1",
          title: "Native title",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      { "claude:session-1": "Mapped title" },
      () => "Custom title",
    );
    const geminiMerged = mergeGeminiSessionSummaries(
      [],
      [
        {
          sessionId: "session-2",
          firstMessage: "Gemini native title",
          updatedAt: 120,
        },
      ],
      "workspace-1",
      { "gemini:session-2": "Mapped Gemini title" },
      () => "Custom Gemini title",
    );

    expect(catalogMerged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "Custom title",
    );
    expect(geminiMerged.find((thread) => thread.id === "gemini:session-2")?.name).toBe(
      "Custom Gemini title",
    );
  });

  it("uses catalog owner workspace when resolving aggregate custom titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "claude:session-1",
          workspaceId: "child-workspace",
          title: "Native child title",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "parent-workspace",
      {},
      (workspaceId) =>
        workspaceId === "child-workspace"
          ? "Owner custom title"
          : "Parent fallback title",
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "Owner custom title",
    );
  });

  it("projects provider-backed Codex metadata from catalog rows", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "codex-provider-session",
          workspaceId: "workspace-1",
          title: "Provider restored session",
          updatedAt: 120,
          engine: "codex",
          providerProfileId: "provider-a",
          providerProfileSource: "managed",
          providerProfileName: "AskUs",
          providerAvailability: "available",
          sourceLabel: "AskUs",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged[0]).toMatchObject({
      id: "codex-provider-session",
      engineSource: "codex",
      providerProfileId: "provider-a",
      providerProfileSource: "managed",
      providerProfileName: "AskUs",
      providerAvailability: "available",
      sourceLabel: "AskUs",
    });
  });

  it("preserves provider-backed Codex rows during degraded continuity", () => {
    const merged = mergeDegradedCodexContinuitySummaries(
      [],
      [
        {
          id: "codex-provider-session",
          name: "Provider restored session",
          updatedAt: 120,
          engineSource: "codex",
          threadKind: "native",
          providerProfileId: "provider-a",
          providerProfileSource: "managed",
          providerProfileName: "AskUs",
          providerAvailability: "available",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "codex-provider-session",
      providerProfileId: "provider-a",
      providerProfileSource: "managed",
      providerProfileName: "AskUs",
      providerAvailability: "available",
    });
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
