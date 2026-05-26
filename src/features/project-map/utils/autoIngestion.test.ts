import { describe, expect, it } from "vitest";

import type { ProjectMemoryItem } from "../../../services/tauri/projectMemory";
import type { ProjectMapRunMetadata } from "../types";
import { mockProjectMapData } from "../mockProjectMapData";
import {
  createConversationKnowledgeCandidate,
  discoverUnprocessedProjectMemoryMessages,
  extractProjectMapMemoryEvidencePaths,
  hasActiveProjectMapAutoIngestionRun,
  markProjectMapMessagesProcessed,
  shouldEvaluateProjectMapAutoIngestion,
  shouldTriggerProjectMapAutoIngestion,
} from "./autoIngestion";

function memory(overrides: Partial<ProjectMemoryItem> = {}): ProjectMemoryItem {
  return {
    id: "memory-1",
    workspaceId: "ws-1",
    kind: "fact",
    title: "Project map fact",
    summary: "Project map code references src/features/project-map/types.ts",
    cleanText: "Project map code references src/features/project-map/types.ts",
    tags: [],
    importance: "medium",
    source: "conversation",
    fingerprint: "fp-1",
    createdAt: 1,
    updatedAt: 2,
    threadId: "session-1",
    ...overrides,
  };
}

describe("project map auto ingestion", () => {
  it("discovers only unprocessed session/message hash pairs", () => {
    const first = memory({ id: "memory-1", threadId: "session-1" });
    const second = memory({ id: "memory-2", threadId: "session-1", updatedAt: 3 });
    const [processedFirst] = discoverUnprocessedProjectMemoryMessages({
      memories: [first],
      processedMessages: [],
    });

    const unprocessed = discoverUnprocessedProjectMemoryMessages({
      memories: [first, second],
      processedMessages: [processedFirst],
    });

    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0].sessionId).toBe("session-1");
  });

  it("triggers when opt-in ingestion reaches threshold in either write mode", () => {
    expect(
      shouldTriggerProjectMapAutoIngestion({
        settings: {
          enabled: true,
          engine: "codex",
          model: "default",
          newSessionThreshold: 2,
          checkIntervalMinutes: 30,
          applyMode: "createCandidate",
        },
        unprocessedMessages: [
          { sessionId: "s1", messageHash: "h1" },
          { sessionId: "s2", messageHash: "h2" },
        ],
      }),
    ).toBe(true);
    expect(
      shouldTriggerProjectMapAutoIngestion({
        settings: {
          enabled: true,
          engine: "codex",
          model: "default",
          newSessionThreshold: 1,
          checkIntervalMinutes: 30,
          applyMode: "autoApplyEvidenceBacked",
        },
        unprocessedMessages: [{ sessionId: "s1", messageHash: "h1" }],
      }),
    ).toBe(true);
  });

  it("clamps invalid ingestion thresholds before trigger checks", () => {
    expect(
      shouldTriggerProjectMapAutoIngestion({
        settings: {
          enabled: true,
          engine: "codex",
          model: "default",
          newSessionThreshold: Number.NaN,
          checkIntervalMinutes: 30,
          applyMode: "createCandidate",
        },
        unprocessedMessages: [{ sessionId: "s1", messageHash: "h1" }],
      }),
    ).toBe(true);
    expect(
      shouldTriggerProjectMapAutoIngestion({
        settings: {
          enabled: true,
          engine: "codex",
          model: "default",
          newSessionThreshold: 100,
          checkIntervalMinutes: 30,
          applyMode: "createCandidate",
        },
        unprocessedMessages: Array.from({ length: 49 }, (_, index) => ({
          sessionId: `s${index}`,
          messageHash: `h${index}`,
        })),
      }),
    ).toBe(false);
  });

  it("evaluates auto ingestion only after the configured interval and without active auto runs", () => {
    const settings = {
      enabled: true,
      engine: "codex",
      model: "default",
      newSessionThreshold: 1,
      checkIntervalMinutes: 30,
      applyMode: "createCandidate" as const,
    };
    const cursor = {
      lastCheckedAt: "2026-05-26T00:00:00.000Z",
      processedMessages: [],
      pendingMessages: [],
    };

    expect(
      shouldEvaluateProjectMapAutoIngestion({
        settings,
        cursor,
        runs: [],
        now: "2026-05-26T00:20:00.000Z",
      }),
    ).toBe(false);
    expect(
      shouldEvaluateProjectMapAutoIngestion({
        settings,
        cursor,
        runs: [],
        now: "2026-05-26T00:31:00.000Z",
      }),
    ).toBe(true);
  });

  it("clamps invalid check intervals before evaluation", () => {
    const settings = {
      enabled: true,
      engine: "codex",
      model: "default",
      newSessionThreshold: 1,
      checkIntervalMinutes: 0,
      applyMode: "createCandidate" as const,
    };
    const cursor = {
      lastCheckedAt: "2026-05-26T00:00:00.000Z",
      processedMessages: [],
      pendingMessages: [],
    };

    expect(
      shouldEvaluateProjectMapAutoIngestion({
        settings,
        cursor,
        runs: [],
        now: "2026-05-26T00:04:00.000Z",
      }),
    ).toBe(false);
    expect(
      shouldEvaluateProjectMapAutoIngestion({
        settings,
        cursor,
        runs: [],
        now: "2026-05-26T00:05:00.000Z",
      }),
    ).toBe(true);
  });

  it("detects pending or running auto ingestion runs as active", () => {
    const autoRun = {
      id: "auto-1",
      kind: "auto",
      status: "pending",
      engine: "codex",
      model: "default",
      startedAt: "2026-05-26T00:00:00.000Z",
      completedAt: null,
      scope: "auto",
      requestScope: { kind: "auto", messageHashes: ["h1"] },
    } satisfies ProjectMapRunMetadata;

    expect(hasActiveProjectMapAutoIngestionRun([autoRun])).toBe(true);
    expect(hasActiveProjectMapAutoIngestionRun([{ ...autoRun, status: "completed" }])).toBe(false);
  });

  it("does not mark messages processed on failed runs", () => {
    const processed = markProjectMapMessagesProcessed({
      processedMessages: [],
      consumedMessages: [{ sessionId: "s1", messageHash: "h1" }],
      runId: "run-1",
      processedAt: "2026-05-26T00:00:00Z",
      runSucceeded: false,
    });

    expect(processed).toEqual([]);
  });

  it("creates conversation candidates only when evidence is identifiable", () => {
    const candidate = createConversationKnowledgeCandidate({
      dataset: mockProjectMapData,
      memory: memory(),
      createdAt: "2026-05-26T00:00:00Z",
    });
    const missingEvidenceCandidate = createConversationKnowledgeCandidate({
      dataset: mockProjectMapData,
      memory: memory({ cleanText: "general project knowledge", summary: "general project knowledge" }),
      createdAt: "2026-05-26T00:00:00Z",
    });

    expect(candidate?.status).toBe("pending");
    expect(candidate?.source).toBe("conversation");
    expect(missingEvidenceCandidate).toBeNull();
  });

  it("extracts Windows-style evidence paths from memory text", () => {
    expect(
      extractProjectMapMemoryEvidencePaths([
        memory({
          cleanText: String.raw`Updated src\features\project-map\types.ts:42 and ignored C:\repo\mossx\secret.ts`,
          summary: "Project map path extraction",
        }),
      ]),
    ).toEqual(["src/features/project-map/types.ts"]);
  });
});
