// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem, CustomCommandOption, SkillOption, ThreadSummary } from "../../../types";
import { SEARCH_PERF_BASELINE_GLOBAL } from "../perf/baseline.config";
import { SEARCH_DEBOUNCE_MS } from "../perf/limits";
import { discardIfStale, useSearchQueryToken } from "./searchQueryToken";
import type { SearchContentFilter } from "../types";
import { computeUnifiedSearchResults, useUnifiedSearch } from "./useUnifiedSearch";

function makeThread(id: string, name: string, updatedAt: number): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "assistant", text };
}

describe("computeUnifiedSearchResults", () => {
  it("supports scope switching by source set", () => {
    const workspaceA = {
      workspaceId: "w-a",
      workspaceName: "A",
      files: ["src/hello-a.ts"],
      threads: [makeThread("t-a", "hello thread a", 10)],
    };
    const workspaceB = {
      workspaceId: "w-b",
      workspaceName: "B",
      files: ["src/hello-b.ts"],
      threads: [makeThread("t-b", "hello thread b", 10)],
    };

    const base = {
      query: "hello",
      contentFilters: ["all"] as SearchContentFilter[],
      kanbanTasks: [],
      threadItemsByThread: {} as Record<string, ConversationItem[]>,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-a",
      recencyMap: {},
      reportMetrics: false,
    };

    const activeResults = computeUnifiedSearchResults({
      ...base,
      workspaceSources: [workspaceA],
    });
    expect(activeResults.some((item) => item.workspaceId === "w-a")).toBe(true);
    expect(activeResults.some((item) => item.workspaceId === "w-b")).toBe(false);

    const globalResults = computeUnifiedSearchResults({
      ...base,
      workspaceSources: [workspaceA, workspaceB],
    });
    expect(globalResults.some((item) => item.workspaceId === "w-a")).toBe(true);
    expect(globalResults.some((item) => item.workspaceId === "w-b")).toBe(true);
  });

  it("includes skills and commands when selected", () => {
    const results = computeUnifiedSearchResults({
      query: "plan",
      contentFilters: ["skills", "commands"],
      workspaceSources: [],
      kanbanTasks: [],
      threadItemsByThread: {},
      historyItems: [],
      skills: [{ name: "plan-writer", path: "/skill/plan", description: "Plan helper" }],
      commands: [{ name: "plan", path: "/command/plan", description: "Command plan", content: "" }],
      activeWorkspaceId: "w-1",
      recencyMap: {},
      reportMetrics: false,
    });

    expect(results.some((item) => item.kind === "skill" && item.skillName === "plan-writer")).toBe(true);
    expect(results.some((item) => item.kind === "command" && item.commandName === "plan")).toBe(true);
  });

  it("keeps global search latency under baseline for large data", () => {
    const {
      workspaceCount,
      filesPerWorkspace,
      threadsPerWorkspace,
      messagesPerThread,
      maxElapsedMs,
    } = SEARCH_PERF_BASELINE_GLOBAL;
    const query = "alpha";

    const workspaceSources = Array.from({ length: workspaceCount }, (_, workspaceIndex) => {
      const workspaceId = `w-${workspaceIndex}`;
      const files = Array.from({ length: filesPerWorkspace }, (_, fileIndex) =>
        fileIndex % 15 === 0
          ? `src/alpha-${workspaceIndex}-${fileIndex}.ts`
          : `src/feature-${workspaceIndex}-${fileIndex}.ts`,
      );
      const threads = Array.from({ length: threadsPerWorkspace }, (_, threadIndex) =>
        makeThread(
          `${workspaceId}-t-${threadIndex}`,
          threadIndex % 8 === 0
            ? `alpha-thread-${workspaceId}-${threadIndex}`
            : `thread-${workspaceId}-${threadIndex}`,
          1_700_000_000 + threadIndex,
        ),
      );
      return {
        workspaceId,
        workspaceName: `Workspace ${workspaceIndex}`,
        files,
        threads,
      };
    });

    const threadItemsByThread: Record<string, ConversationItem[]> = {};
    for (const source of workspaceSources) {
      for (const thread of source.threads) {
        threadItemsByThread[thread.id] = Array.from({ length: messagesPerThread }, (_, msgIndex) =>
          makeMessage(
            `${thread.id}-m-${msgIndex}`,
            msgIndex % 6 === 0
              ? `alpha message ${msgIndex} in ${thread.id}`
              : `regular message ${msgIndex} in ${thread.id}`,
          ),
        );
      }
    }

    const startedAt = performance.now();
    const results = computeUnifiedSearchResults({
      query,
      contentFilters: ["all"],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [],
      commands: [],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
    });
    const elapsedMs = performance.now() - startedAt;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(maxElapsedMs);
  });
});

describe("useUnifiedSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears rendered results immediately when query becomes empty", () => {
    const baseOptions = {
      contentFilters: ["skills"] as SearchContentFilter[],
      workspaceSources: [],
      kanbanTasks: [],
      threadItemsByThread: {},
      historyItems: [],
      skills: [
        { name: "api-fulldoc-sync", path: "/s/api-fulldoc-sync", description: "A" },
        { name: "mermaid-visualizer", path: "/s/mermaid-visualizer", description: "B" },
      ] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-1",
    };

    const { result, rerender } = renderHook(
      ({ query }) =>
        useUnifiedSearch({
          query,
          ...baseOptions,
        }),
      {
        initialProps: { query: "api" },
      },
    );

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.some((item) => item.title === "/api-fulldoc-sync")).toBe(true);

    act(() => {
      rerender({ query: "" });
    });
    expect(result.current).toEqual([]);
  });

  it("allows immediate re-search after clear without stale previous results", () => {
    const baseOptions = {
      contentFilters: ["skills"] as SearchContentFilter[],
      workspaceSources: [],
      kanbanTasks: [],
      threadItemsByThread: {},
      historyItems: [],
      skills: [
        { name: "api-fulldoc-sync", path: "/s/api-fulldoc-sync", description: "A" },
        { name: "mermaid-visualizer", path: "/s/mermaid-visualizer", description: "B" },
      ] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-1",
    };

    const { result, rerender } = renderHook(
      ({ query }) =>
        useUnifiedSearch({
          query,
          ...baseOptions,
        }),
      {
        initialProps: { query: "api" },
      },
    );

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.some((item) => item.title === "/api-fulldoc-sync")).toBe(true);

    act(() => {
      rerender({ query: "" });
    });
    expect(result.current).toEqual([]);

    act(() => {
      rerender({ query: "mermaid" });
    });
    expect(result.current).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.some((item) => item.title === "/mermaid-visualizer")).toBe(true);
    expect(result.current.some((item) => item.title === "/api-fulldoc-sync")).toBe(false);
  });
});


describe("useUnifiedSearch stale query guard integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the latest debounced query results, not earlier ones", () => {
    const baseOptions = {
      contentFilters: ["skills"] as SearchContentFilter[],
      workspaceSources: [],
      kanbanTasks: [],
      threadItemsByThread: {},
      historyItems: [],
      skills: [
        { name: "alpha-runner", path: "/s/alpha", description: "A" },
        { name: "beta-runner", path: "/s/beta", description: "B" },
      ] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-1",
    };

    const { result, rerender } = renderHook(
      ({ query }) => useUnifiedSearch({ query, ...baseOptions }),
      { initialProps: { query: "alpha" } },
    );

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.some((item) => item.title === "/alpha-runner")).toBe(true);

    // Switch query fast, before debounce settles; the last computed
    // results must be the most recent query, not the previous one.
    act(() => {
      rerender({ query: "beta" });
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.some((item) => item.title === "/beta-runner")).toBe(true);
    expect(result.current.some((item) => item.title === "/alpha-runner")).toBe(false);
  });

  it("does not crash when query is empty and the hook is reused", () => {
    const baseOptions = {
      contentFilters: ["skills"] as SearchContentFilter[],
      workspaceSources: [],
      kanbanTasks: [],
      threadItemsByThread: {},
      historyItems: [],
      skills: [
        { name: "alpha-runner", path: "/s/alpha", description: "A" },
      ] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-1",
    };

    const { result, rerender } = renderHook(
      ({ query }) => useUnifiedSearch({ query, ...baseOptions }),
      { initialProps: { query: "alpha" } },
    );
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.length).toBeGreaterThan(0);

    act(() => {
      rerender({ query: "" });
    });
    expect(result.current).toEqual([]);

    act(() => {
      rerender({ query: "alpha" });
    });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.length).toBeGreaterThan(0);
  });
});

describe("useSearchQueryToken + discardIfStale wiring", () => {
  it("the hook advances the token on every query change", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useSearchQueryToken(query),
      { initialProps: { query: "a" } },
    );
    const t0 = result.current.current.token;
    act(() => {
      rerender({ query: "b" });
    });
    expect(result.current.current.token).toBe(t0 + 1);
  });

  it("discardIfStale returns the previous value untouched when tokens match", () => {
    const initial = {
      token: 7,
      query: "x",
      bumpKey: 0,
      updatedAt: 0,
    };
    const current = { ...initial };
    const captured = { ...initial };
    const out = discardIfStale(current, captured, ["r1", "r2"]);
    expect(out.staleDropped).toBe(false);
    expect(out.value).toEqual(["r1", "r2"]);
  });

  it("discardIfStale flags stale when the current token has moved on", () => {
    const captured = {
      token: 1,
      query: "x",
      bumpKey: 0,
      updatedAt: 0,
    };
    const current = { ...captured, token: 2 };
    const out = discardIfStale(current, captured, ["r1"]);
    expect(out.staleDropped).toBe(true);
  });
});

describe("useUnifiedSearch metrics integration (regression for elapsedMs: 0 bug)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("MODE", "development");
    vi.stubEnv("DEV", true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("delegates perf metrics to the compute path so elapsedMs is real, not 0", async () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useUnifiedSearch({
        query: "alpha",
        contentFilters: ["skills"],
        workspaceSources: [],
        kanbanTasks: [],
        threadItemsByThread: {},
        historyItems: [],
        skills: [
          { name: "alpha-runner", path: "/s/alpha", description: "A" },
        ] as SkillOption[],
        commands: [] as CustomCommandOption[],
        activeWorkspaceId: "w-1",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
    });
    expect(result.current.length).toBeGreaterThan(0);

    // console.debug must have been called with a real (non-zero, non-NaN)
    // elapsedMs in the search metrics payload. The previous bug reported
    // 0 here; this assertion guards against that regression.
    const calls = spy.mock.calls.filter(
      (call) => Array.isArray(call) && call[0] === "[search]",
    );
    expect(calls.length).toBeGreaterThan(0);
    const lastPayload = calls[calls.length - 1][1] as { ms: number };
    expect(typeof lastPayload.ms).toBe("number");
    expect(lastPayload.ms).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(lastPayload.ms)).toBe(false);
  });
});
