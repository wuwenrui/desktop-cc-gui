// @vitest-environment jsdom
//
// Representative fixture test for the search compute path. Mirrors the
// data shape used by `useUnifiedSearch.test.ts > keeps global search
// latency under baseline for large data` so the two tests do not drift.
//
// Asserts on the evidence payload (elapsedMs, candidate totals, hydration
// state, provider timings) without reading from `console.debug`. This is
// the durable perf-evidence contract that the next iteration can plumb
// into a real fixture file without changing the hook.

import { describe, expect, it } from "vitest";
import type {
  ConversationItem,
  CustomCommandOption,
  SkillOption,
  ThreadSummary,
} from "../../../types";
import { SEARCH_PERF_BASELINE_GLOBAL } from "./baseline.config";
import type { SearchContentFilter } from "../types";
import {
  createSearchEvidenceBuffer,
  type SearchEvidence,
} from "./evidence";
import { computeUnifiedSearchResults } from "../hooks/useUnifiedSearch";

function makeThread(id: string, name: string, updatedAt: number): ThreadSummary {
  return { id, name, updatedAt };
}

function makeMessage(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "assistant", text };
}

function buildFixture() {
  const { workspaceCount, filesPerWorkspace, threadsPerWorkspace, messagesPerThread } =
    SEARCH_PERF_BASELINE_GLOBAL;
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

  return { query, workspaceSources, threadItemsByThread };
}

describe("search compute evidence (representative fixture)", () => {
  it("emits a single evidence record per compute call", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    const results = computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    expect(results.length).toBeGreaterThan(0);
    expect(buffer.size).toBe(1);
    const evidence = buffer.last() as SearchEvidence;
    expect(evidence.query).toBe(query);
    expect(evidence.resultCount).toBe(results.length);
  });

  it("records a non-negative elapsedMs that respects the latency budget", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    const evidence = buffer.last() as SearchEvidence;
    expect(evidence.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(evidence.elapsedMs).toBeLessThan(
      SEARCH_PERF_BASELINE_GLOBAL.maxElapsedMs,
    );
  });

  it("labels the hydration state as partial-global for multi-workspace input", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    const evidence = buffer.last() as SearchEvidence;
    expect(evidence.hydrationState).toBe("partial-global");
  });

  it("sums candidateTotal across providerTimings", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    const evidence = buffer.last() as SearchEvidence;
    let summed = 0;
    for (const timing of evidence.providerTimings) {
      summed += timing.candidateCount;
    }
    expect(evidence.candidateTotal).toBe(summed);
  });

  it("emits one timing row per provider per workspace for the workspace-scoped providers", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    const evidence = buffer.last() as SearchEvidence;
    const filesRows = evidence.providerTimings.filter((t) => t.provider === "files").length;
    const threadRows = evidence.providerTimings.filter((t) => t.provider === "threads").length;
    const messageRows = evidence.providerTimings.filter((t) => t.provider === "messages").length;
    expect(filesRows).toBe(workspaceSources.length);
    expect(threadRows).toBe(workspaceSources.length);
    expect(messageRows).toBe(workspaceSources.length);
  });

  it("emits a single timing row for the workspace-agnostic providers", () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    computeUnifiedSearchResults({
      query,
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [{ id: "k-1", title: "alpha", description: "d", workspaceId: "w-0", panelId: "p-1" } as never],
      threadItemsByThread,
      historyItems: [{ text: "alpha history", importance: 1 }],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e) => buffer.push(e),
    });

    const evidence = buffer.last() as SearchEvidence;
    const kanbanRows = evidence.providerTimings.filter((t) => t.provider === "kanban").length;
    const historyRows = evidence.providerTimings.filter((t) => t.provider === "history").length;
    expect(kanbanRows).toBe(1);
    expect(historyRows).toBe(1);
  });

  it("captures a non-decreasing capturedAt across consecutive calls", async () => {
    const { query, workspaceSources, threadItemsByThread } = buildFixture();
    const buffer = createSearchEvidenceBuffer();
    const options = {
      contentFilters: ["all"] as SearchContentFilter[],
      workspaceSources,
      kanbanTasks: [],
      threadItemsByThread,
      historyItems: [],
      skills: [] as SkillOption[],
      commands: [] as CustomCommandOption[],
      activeWorkspaceId: "w-0",
      recencyMap: {},
      reportMetrics: false,
      evidenceSink: (e: SearchEvidence) => buffer.push(e),
    };
    computeUnifiedSearchResults({ ...options, query });
    await new Promise((resolve) => setTimeout(resolve, 1));
    computeUnifiedSearchResults({ ...options, query });
    expect(buffer.size).toBe(2);
    const [first, second] = buffer.all();
    expect(second.capturedAt).toBeGreaterThanOrEqual(first.capturedAt);
  });
});
